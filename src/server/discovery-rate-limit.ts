import { createHmac } from "node:crypto";
import { supabaseAdminConfig } from "./supabase-admin.ts";

export interface DiscoveryRateLimitEnvironment {
  NODE_ENV?: string;
  DISCOVERY_RATE_LIMIT_MODE?: string;
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  DISCOVERY_RATE_LIMIT_SECRET?: string;
}

export class DiscoveryRateLimitError extends Error {}

export async function checkDiscoveryRateLimit({
  env = process.env,
  key,
  limit,
  localStore,
  now = Date.now(),
  scope,
  windowMs,
}: {
  env?: DiscoveryRateLimitEnvironment;
  key: string;
  limit: number;
  localStore: Map<string, number[]>;
  now?: number;
  scope: string;
  windowMs: number;
}): Promise<number | null> {
  if (env.NODE_ENV !== "production") {
    return checkLocalLimit(key, localStore, limit, windowMs, now);
  }

  if ((env.DISCOVERY_RATE_LIMIT_MODE || "supabase") !== "supabase") {
    throw new DiscoveryRateLimitError("Unsupported production rate-limit mode");
  }
  const supabase = supabaseAdminConfig(env);
  if (!supabase) {
    throw new DiscoveryRateLimitError("Shared rate limiting is not configured");
  }
  const rateLimitSecret = env.DISCOVERY_RATE_LIMIT_SECRET?.trim();
  if (!rateLimitSecret || rateLimitSecret.length < 32) {
    throw new DiscoveryRateLimitError("Rate-limit hashing is not configured");
  }

  const response = await fetch(
    `${supabase.url}/rest/v1/rpc/check_discovery_rate_limit`,
    {
      method: "POST",
      headers: supabase.headers,
      body: JSON.stringify({
        p_scope: scope,
        p_key_hash: createHmac("sha256", rateLimitSecret).update(key).digest("hex"),
        p_limit: limit,
        p_window_seconds: Math.ceil(windowMs / 1_000),
      }),
      signal: AbortSignal.timeout(5_000),
    },
  ).catch(() => null);
  if (!response?.ok) {
    throw new DiscoveryRateLimitError("Shared rate limiting is unavailable");
  }
  const rows = (await response.json()) as Array<{
    allowed?: boolean;
    retry_after?: number;
  }>;
  const result = rows[0];
  if (!result || typeof result.allowed !== "boolean") {
    throw new DiscoveryRateLimitError("Shared rate-limit response is invalid");
  }
  return result.allowed ? null : Math.max(1, Number(result.retry_after) || 1);
}

export function trustedClientKey(
  request: Request,
  clientAddress: string | undefined,
  production = process.env.NODE_ENV === "production",
): string {
  const trusted = clientAddress?.trim();
  if (trusted) return trusted;
  if (!production) {
    return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  }
  return "unresolved-client";
}

function checkLocalLimit(
  key: string,
  store: Map<string, number[]>,
  limit: number,
  windowMs: number,
  now: number,
): number | null {
  pruneLocalStore(store, windowMs, now);
  const recent = (store.get(key) ?? []).filter(
    (timestamp) => timestamp > now - windowMs,
  );
  if (recent.length >= limit) {
    store.set(key, recent);
    return Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1_000));
  }
  recent.push(now);
  store.set(key, recent);
  return null;
}

function pruneLocalStore(
  store: Map<string, number[]>,
  windowMs: number,
  now: number,
): void {
  for (const [key, timestamps] of store) {
    const recent = timestamps.filter((timestamp) => timestamp > now - windowMs);
    if (recent.length) store.set(key, recent);
    else store.delete(key);
  }
  while (store.size >= 10_000) {
    const oldestKey = store.keys().next().value as string | undefined;
    if (!oldestKey) break;
    store.delete(oldestKey);
  }
}
