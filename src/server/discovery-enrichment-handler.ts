import { resolve4, resolve6 } from "node:dns/promises";
import { isIP } from "node:net";
import {
  normalizeWebsiteInput,
  type DiscoveryEnrichmentResponse,
} from "../lib/discovery-release.ts";
import {
  isSameOrigin,
  readBoundedBody,
} from "./request-guards.ts";
import {
  type OpenAiStructuredEnvironment,
} from "./openai-structured.ts";
import { researchCompany, type CompanyResearchResult } from "./discovery-research.ts";
import { createDiscoveryContextToken } from "./discovery-context-token.ts";
import {
  checkDiscoveryRateLimit,
  trustedClientKey,
  type DiscoveryRateLimitEnvironment,
} from "./discovery-rate-limit.ts";

const MAX_BODY_BYTES = 16 * 1024;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 10 * 60 * 1_000;
const PROJECT_DAILY_LIMIT = 300;
const DAY_MS = 24 * 60 * 60 * 1_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const CACHE_MAX_ENTRIES = 100;

type FetchLike = typeof fetch;
type ResolveHost = (hostname: string) => Promise<string[]>;
interface EnrichmentOptions {
  env?: OpenAiStructuredEnvironment & DiscoveryRateLimitEnvironment & {
    NODE_ENV?: string;
    DISCOVERY_CONTEXT_SIGNING_SECRET?: string;
  };
  fetchImpl?: FetchLike;
  resolveHost?: ResolveHost;
  now?: number;
}

const globalEnrichmentState = globalThis as typeof globalThis & {
  __nncoDiscoveryEnrichmentRateLimits?: Map<string, number[]>;
  __nncoDiscoveryEnrichmentProjectLimits?: Map<string, number[]>;
  __nncoDiscoveryResearchCache?: Map<
    string,
    { expiresAt: number; research: CompanyResearchResult }
  >;
};
const rateLimits =
  globalEnrichmentState.__nncoDiscoveryEnrichmentRateLimits ??
  new Map<string, number[]>();
const projectLimits =
  globalEnrichmentState.__nncoDiscoveryEnrichmentProjectLimits ??
  new Map<string, number[]>();
const websiteCache =
  globalEnrichmentState.__nncoDiscoveryResearchCache ??
  new Map<string, { expiresAt: number; research: CompanyResearchResult }>();
globalEnrichmentState.__nncoDiscoveryEnrichmentRateLimits = rateLimits;
globalEnrichmentState.__nncoDiscoveryEnrichmentProjectLimits = projectLimits;
globalEnrichmentState.__nncoDiscoveryResearchCache = websiteCache;

export async function handleDiscoveryEnrichmentRequest(
  request: Request,
  clientAddress?: string,
  options: EnrichmentOptions = {},
): Promise<Response> {
  if (!isSameOrigin(request)) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "The request origin could not be verified.",
      false,
    );
  }
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now();
  let retryAfter: number | null;
  try {
    const clientKey = trustedClientKey(
      request,
      clientAddress,
      env.NODE_ENV === "production",
    );
    retryAfter = await checkDiscoveryRateLimit({
      env,
      key: clientKey,
      limit: RATE_LIMIT,
      localStore: rateLimits,
      now,
      scope: "enrichment-ip-10m",
      windowMs: RATE_WINDOW_MS,
    });
  } catch {
    return errorResponse(
      503,
      "ENRICHMENT_UNAVAILABLE",
      "Website checks are temporarily unavailable. Please retry later.",
      true,
    );
  }
  if (retryAfter !== null) {
    const response = errorResponse(
      429,
      "RATE_LIMITED",
      "Too many website checks. Wait briefly and retry.",
      true,
    );
    response.headers.set("Retry-After", String(retryAfter));
    return response;
  }

  const body = await readBoundedBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      body.reason === "too_large"
        ? "The request is too large."
        : "The request could not be read.",
      false,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body.bytes));
  } catch {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "The request could not be read.",
      false,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed).some(key => key !== "website")) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "Enter a public company website.",
      false,
    );
  }
  const input = parsed as { website?: unknown };
  const website =
    typeof input.website === "string"
      ? normalizeWebsiteInput(input.website)
      : null;
  if (!website) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "Enter a public company website.",
      false,
    );
  }

  let projectRetry: number | null;
  try {
    projectRetry = await checkDiscoveryRateLimit({
      env,
      key: "project",
      limit: PROJECT_DAILY_LIMIT,
      localStore: projectLimits,
      now,
      scope: "enrichment-project-day",
      windowMs: DAY_MS,
    });
  } catch {
    return errorResponse(
      503,
      "ENRICHMENT_UNAVAILABLE",
      "Website checks are temporarily unavailable. Please retry later.",
      true,
    );
  }
  if (projectRetry !== null) {
    const response = errorResponse(
      429,
      "RATE_LIMITED",
      "The daily website-check capacity has been reached. Please retry later.",
      true,
    );
    response.headers.set("Retry-After", String(projectRetry));
    return response;
  }

  if (!env.OPENAI_API_KEY?.trim()) {
    return errorResponse(503, "ENRICHMENT_UNAVAILABLE", "Company research is unavailable. Please try again later or continue without a website.", true);
  }
  try {
    await assertPublicUrl(website, options.resolveHost ?? resolvePublicHost);
    pruneWebsiteCache(now);
    const cacheKey = website.origin.replace("://www.", "://");
    const cached = websiteCache.get(cacheKey);
    const research = cached && cached.expiresAt > now
      ? cached.research
      : await researchCompany(website, env, options.fetchImpl ?? fetch);
    if (!cached || cached.expiresAt <= now) cacheWebsiteResearch(cacheKey, research, now);
    const contextToken = createDiscoveryContextToken(research.company, env, now);
    return Response.json({
      ok: true,
      company: { name: research.company.name, sector: research.company.sector },
      workflowOptions: research.company.workflowOptions ?? [],
      prefill: research.prefill,
      sources: research.company.sources,
      contextToken,
    } satisfies DiscoveryEnrichmentResponse, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorResponse(422, "ENRICHMENT_UNAVAILABLE", "We could not find reliable information about that company. Check the website or continue without one.", true);
  }
}

async function resolvePublicHost(hostname: string): Promise<string[]> {
  const [ipv4, ipv6] = await Promise.all([
    resolve4(hostname).catch(() => []),
    resolve6(hostname).catch(() => []),
  ]);
  return [...ipv4, ...ipv6];
}

async function assertPublicUrl(
  url: URL,
  resolveHost: ResolveHost,
): Promise<string[]> {
  if (!/^https?:$/.test(url.protocol)) throw new Error("Unsupported URL protocol");
  if (url.port) throw new Error("Non-standard website port");
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLocaleLowerCase("en");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Private hostname");
  }
  // Workers can include CNAME aliases alongside A/AAAA records. Require at
  // least one IP and validate every IP, without mistaking aliases for addresses.
  const records = isIP(hostname) ? [hostname] : await resolveHost(hostname);
  const addresses = records.filter(record => isIP(record) !== 0);
  if (!addresses.length || addresses.some((address) => !isPublicIpAddress(address))) {
    throw new Error("Private network address");
  }
  return addresses;
}

export function isPublicIpAddress(address: string): boolean {
  const normalized = address.toLocaleLowerCase("en").replace(/%.+$/, "");
  if (isIP(normalized) === 4) {
    const [a, b, c] = normalized.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }
  if (isIP(normalized) === 6) {
    const bytes = parseIpv6Bytes(normalized);
    if (!bytes) return false;

    const mapped = ipv4EmbeddedInIpv6(bytes);
    if (mapped) return isPublicIpAddress(mapped);

    return !BLOCKED_IPV6_PREFIXES.some(([prefix, bits]) =>
      matchesPrefix(bytes, prefix, bits),
    );
  }
  return false;
}

const BLOCKED_IPV6_PREFIXES: Array<[Uint8Array, number]> = [
  [ipv6Prefix("::"), 128],
  [ipv6Prefix("::1"), 128],
  [ipv6Prefix("64:ff9b::"), 96],
  [ipv6Prefix("64:ff9b:1::"), 48],
  [ipv6Prefix("100::"), 64],
  [ipv6Prefix("2001:2::"), 48],
  [ipv6Prefix("2001:10::"), 28],
  [ipv6Prefix("2001:20::"), 28],
  [ipv6Prefix("2001:db8::"), 32],
  [ipv6Prefix("2002::"), 16],
  [ipv6Prefix("3fff::"), 20],
  [ipv6Prefix("5f00::"), 16],
  [ipv6Prefix("fc00::"), 7],
  [ipv6Prefix("fe80::"), 10],
  [ipv6Prefix("fec0::"), 10],
  [ipv6Prefix("ff00::"), 8],
];

function parseIpv6Bytes(value: string): Uint8Array | null {
  let normalized = value;
  if (normalized.includes(".")) {
    const lastColon = normalized.lastIndexOf(":");
    const dotted = normalized.slice(lastColon + 1).split(".").map(Number);
    if (
      lastColon < 0 ||
      dotted.length !== 4 ||
      dotted.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    ) {
      return null;
    }
    normalized = `${normalized.slice(0, lastColon)}:${(
      dotted[0] * 256 + dotted[1]
    ).toString(16)}:${(dotted[2] * 256 + dotted[3]).toString(16)}`;
  }

  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const groups = [
    ...left,
    ...Array.from({ length: halves.length === 2 ? missing : 0 }, () => "0"),
    ...right,
  ];
  if (groups.length !== 8) return null;

  const bytes = new Uint8Array(16);
  for (let index = 0; index < groups.length; index += 1) {
    if (!/^[\da-f]{1,4}$/i.test(groups[index])) return null;
    const group = Number.parseInt(groups[index], 16);
    bytes[index * 2] = group >> 8;
    bytes[index * 2 + 1] = group & 0xff;
  }
  return bytes;
}

function ipv4EmbeddedInIpv6(bytes: Uint8Array): string | null {
  const firstTenZero = bytes.slice(0, 10).every((value) => value === 0);
  const firstTwelveZero = bytes.slice(0, 12).every((value) => value === 0);
  const translated =
    bytes.slice(0, 8).every((value) => value === 0) &&
    bytes[8] === 0xff &&
    bytes[9] === 0xff &&
    bytes[10] === 0 &&
    bytes[11] === 0;
  if (
    firstTwelveZero ||
    (firstTenZero && bytes[10] === 0xff && bytes[11] === 0xff) ||
    translated
  ) {
    return Array.from(bytes.slice(12)).join(".");
  }
  return null;
}

function ipv6Prefix(value: string): Uint8Array {
  const bytes = parseIpv6Bytes(value);
  if (!bytes) throw new Error(`Invalid IPv6 prefix: ${value}`);
  return bytes;
}

function matchesPrefix(
  address: Uint8Array,
  prefix: Uint8Array,
  prefixBits: number,
): boolean {
  const completeBytes = Math.floor(prefixBits / 8);
  for (let index = 0; index < completeBytes; index += 1) {
    if (address[index] !== prefix[index]) return false;
  }
  const remainingBits = prefixBits % 8;
  if (!remainingBits) return true;
  const mask = (0xff << (8 - remainingBits)) & 0xff;
  return (address[completeBytes] & mask) === (prefix[completeBytes] & mask);
}

function cacheWebsiteResearch(
  key: string,
  research: CompanyResearchResult,
  now: number,
): void {
  pruneWebsiteCache(now);
  if (!websiteCache.has(key) && websiteCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = [...websiteCache.entries()].sort(
      ([, left], [, right]) => left.expiresAt - right.expiresAt,
    )[0]?.[0];
    if (oldest) websiteCache.delete(oldest);
  }
  const expiresAt = now + CACHE_TTL_MS;
  websiteCache.set(key, { expiresAt, research });
  const expiryTimer = setTimeout(() => {
    const current = websiteCache.get(key);
    if (current?.expiresAt === expiresAt) websiteCache.delete(key);
  }, CACHE_TTL_MS);
  expiryTimer.unref?.();
}

export function pruneWebsiteCache(now = Date.now()): number {
  let removed = 0;
  for (const [key, entry] of websiteCache) {
    if (entry.expiresAt <= now) {
      websiteCache.delete(key);
      removed += 1;
    }
  }
  return removed;
}

function errorResponse(
  status: number,
  code: Extract<DiscoveryEnrichmentResponse, { ok: false }>["error"]["code"],
  message: string,
  retryable: boolean,
): Response {
  return Response.json(
    { ok: false, error: { code, message, retryable } } satisfies DiscoveryEnrichmentResponse,
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
