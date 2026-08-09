import { createHash, randomUUID } from "node:crypto";
import {
  CONTACT_CONSENT_VERSION,
  type ContactErrorResponse,
  type ContactRequestPayload,
  type ContactSuccessResponse,
} from "../lib/contact-contract.ts";
import {
  LeadRepositoryError,
  persistLead,
  type LeadRecord,
} from "./lead-repository.ts";

const MAX_BODY_BYTES = 32 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RATE_WINDOW_MS = 10 * 60 * 1_000;
const RATE_LIMIT = 10;
const globalContactRateStore = globalThis as typeof globalThis & {
  __nncoContactRateLimits?: Map<string, number[]>;
};
const rateLimits =
  globalContactRateStore.__nncoContactRateLimits ?? new Map<string, number[]>();
globalContactRateStore.__nncoContactRateLimits = rateLimits;

export async function handleContactRequest(
  request: Request,
  clientAddress?: string,
): Promise<Response> {
  if (!sameOrigin(request)) {
    return errorResponse(400, "VALIDATION_ERROR", "The request origin could not be verified.", false);
  }
  const retryAfter = rateLimit(request, clientAddress);
  if (retryAfter !== null) {
    const response = errorResponse(429, "RATE_LIMITED", "Too many attempts. Wait briefly and retry.", true);
    response.headers.set("Retry-After", String(retryAfter));
    return response;
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return errorResponse(400, "VALIDATION_ERROR", "The request is too large.", false);
  }

  let parsed: unknown;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      return errorResponse(400, "VALIDATION_ERROR", "The request is too large.", false);
    }
    parsed = JSON.parse(body);
  } catch {
    return errorResponse(400, "VALIDATION_ERROR", "The request could not be read.", false);
  }

  const validation = validateContactPayload(parsed);
  if (!validation.ok) {
    return errorResponse(400, "VALIDATION_ERROR", validation.message, false);
  }
  const payload = validation.payload;
  const confirmedAt = new Date().toISOString();
  const snapshot = {
    schemaVersion: 1,
    kind: "contact-enquiry",
    sector: payload.sector,
    area: payload.area,
    message: payload.message.trim(),
    sourcePath: "/contact",
  };
  const record: LeadRecord = {
    requestId: payload.requestId,
    handoffId: randomUUID(),
    caseId: `CONTACT-${payload.requestId}`,
    caseRevision: 1,
    workEmail: payload.workEmail.trim().toLocaleLowerCase("en"),
    organisation: payload.organisation.trim(),
    name: payload.name.trim(),
    consentVersion: payload.consent.version,
    consentedAt: confirmedAt,
    requestHash: createHash("sha256")
      .update(
        JSON.stringify({
          ...snapshot,
          name: payload.name.trim(),
          workEmail: payload.workEmail.trim().toLocaleLowerCase("en"),
          organisation: payload.organisation.trim(),
          consentVersion: payload.consent.version,
        }),
      )
      .digest("hex"),
    snapshot,
  };

  try {
    const persisted = await persistLead(record);
    const body: ContactSuccessResponse = {
      ok: true,
      requestId: payload.requestId,
      handoffId: persisted.record.handoffId,
      confirmedAt: persisted.record.consentedAt,
      persistence: persisted.persistence,
    };
    return Response.json(body, { status: persisted.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof LeadRepositoryError) {
      const status =
        error.code === "IDEMPOTENCY_CONFLICT"
          ? 409
          : error.code === "CONFIGURATION_ERROR"
            ? 500
            : 503;
      return errorResponse(
        status,
        error.code,
        error.code === "CONFIGURATION_ERROR"
          ? "The handoff service is not configured."
          : error.code === "IDEMPOTENCY_CONFLICT"
            ? "This retry key belongs to another request. Refresh and try again."
            : "The request could not be stored.",
        error.code === "HANDOFF_UNAVAILABLE",
      );
    }
    return errorResponse(503, "HANDOFF_UNAVAILABLE", "The request could not be stored.", true);
  }
}

export function validateContactPayload(
  value: unknown,
): { ok: true; payload: ContactRequestPayload } | { ok: false; message: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, message: "The request format is invalid." };
  }
  const payload = value as Partial<ContactRequestPayload>;
  if (
    payload.schemaVersion !== 1 ||
    typeof payload.requestId !== "string" ||
    !UUID_PATTERN.test(payload.requestId) ||
    typeof payload.name !== "string" ||
    payload.name.trim().length < 2 ||
    payload.name.length > 120 ||
    typeof payload.workEmail !== "string" ||
    !EMAIL_PATTERN.test(payload.workEmail.trim()) ||
    payload.workEmail.length > 254 ||
    typeof payload.organisation !== "string" ||
    payload.organisation.trim().length < 2 ||
    payload.organisation.length > 160 ||
    typeof payload.sector !== "string" ||
    !CONTACT_SECTORS.has(payload.sector) ||
    typeof payload.area !== "string" ||
    !CONTACT_AREAS.has(payload.area) ||
    typeof payload.message !== "string" ||
    payload.message.trim().length < 10 ||
    payload.message.length > 4_000 ||
    payload.consent?.accepted !== true ||
    payload.consent.version !== CONTACT_CONSENT_VERSION
  ) {
    return { ok: false, message: "Check the contact fields and try again." };
  }
  return { ok: true, payload: payload as ContactRequestPayload };
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function rateLimit(request: Request, clientAddress?: string): number | null {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || clientAddress || "local";
  const now = Date.now();
  const recent = (rateLimits.get(key) ?? []).filter((timestamp) => timestamp > now - RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    return Math.max(1, Math.ceil((recent[0] + RATE_WINDOW_MS - now) / 1_000));
  }
  recent.push(now);
  rateLimits.set(key, recent);
  return null;
}

function errorResponse(
  status: number,
  code: ContactErrorResponse["error"]["code"],
  message: string,
  retryable: boolean,
): Response {
  const body: ContactErrorResponse = { ok: false, error: { code, message, retryable } };
  return Response.json(body, { status });
}

const CONTACT_SECTORS = new Set([
  "Banking",
  "Insurance",
  "Healthcare",
  "Capital markets or asset management",
  "Other",
]);
const CONTACT_AREAS = new Set([
  "An AI audit",
  "A specific workflow",
  "Private or on-premise infrastructure",
  "Running a system we already have",
  "Something else",
]);
