import { createHmac, timingSafeEqual } from "node:crypto";
import type { CompanyContext } from "../lib/discovery-release.ts";

const TOKEN_VERSION = 1;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1_000;
const LOCAL_SIGNING_SECRET = "nnco-local-discovery-context-signing-key";

export interface DiscoveryContextTokenEnvironment {
  NODE_ENV?: string;
  DISCOVERY_CONTEXT_SIGNING_SECRET?: string;
}

interface ContextTokenClaims {
  version: typeof TOKEN_VERSION;
  expiresAt: number;
  company: CompanyContext;
}

export function createDiscoveryContextToken(
  company: CompanyContext,
  env: DiscoveryContextTokenEnvironment = process.env,
  now = Date.now(),
): string {
  const claims: ContextTokenClaims = {
    version: TOKEN_VERSION,
    expiresAt: now + TOKEN_TTL_MS,
    company,
  };
  const encodedClaims = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${encodedClaims}.${sign(encodedClaims, signingSecret(env))}`;
}

export function verifyDiscoveryContextToken(
  token: string,
  env: DiscoveryContextTokenEnvironment = process.env,
  now = Date.now(),
  options: { allowExpiredForReplay?: boolean } = {},
): CompanyContext | null {
  const [encodedClaims, suppliedSignature, extra] = token.split(".");
  if (!encodedClaims || !suppliedSignature || extra) return null;

  const expectedSignature = sign(encodedClaims, signingSecret(env));
  const supplied = Buffer.from(suppliedSignature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return null;
  }

  try {
    const claims = JSON.parse(
      Buffer.from(encodedClaims, "base64url").toString("utf8"),
    ) as ContextTokenClaims;
    if (
      claims.version !== TOKEN_VERSION ||
      !Number.isFinite(claims.expiresAt) ||
      (!options.allowExpiredForReplay && claims.expiresAt <= now) ||
      !claims.company
    ) {
      return null;
    }
    return claims.company;
  } catch {
    return null;
  }
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function signingSecret(env: DiscoveryContextTokenEnvironment): string {
  const configured = env.DISCOVERY_CONTEXT_SIGNING_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (env.NODE_ENV === "production") {
    throw new Error("DISCOVERY_CONTEXT_SIGNING_SECRET is not configured");
  }
  return LOCAL_SIGNING_SECRET;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}
