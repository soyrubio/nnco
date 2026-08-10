import { createHash, randomUUID } from "node:crypto";
import {
  CONTACT_FIELD_LIMITS,
  CONTACT_CONSENT_VERSION,
  isContactArea,
  isContactSector,
  isContactTextWithinLimits,
  isValidContactEmail,
  normalizeContactEmail,
  type ContactErrorResponse,
  type ContactRequestPayload,
  type ContactSuccessResponse,
} from "../lib/contact-contract.ts";
import { isValidRequestId } from "../lib/request-identity.ts";
import {
  LeadRepositoryError,
  persistLead,
  type LeadRecord,
} from "./lead-repository.ts";
import {
  checkSlidingWindowRateLimit,
  isSameOrigin,
  readBoundedBody,
} from "./request-guards.ts";

const MAX_BODY_BYTES = 32 * 1024;
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
  if (!isSameOrigin(request)) {
    return errorResponse(400, "VALIDATION_ERROR", "The request origin could not be verified.", false);
  }
  const retryAfter = checkSlidingWindowRateLimit(
    request,
    clientAddress,
    rateLimits,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );
  if (retryAfter !== null) {
    const response = errorResponse(429, "RATE_LIMITED", "Too many attempts. Wait briefly and retry.", true);
    response.headers.set("Retry-After", String(retryAfter));
    return response;
  }
  const body = await readBoundedBody(request, MAX_BODY_BYTES);
  if (!body.ok && body.reason === "too_large") {
    return errorResponse(400, "VALIDATION_ERROR", "The request is too large.", false);
  }
  if (!body.ok) {
    return errorResponse(400, "VALIDATION_ERROR", "The request could not be read.", false);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body.bytes));
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
    workEmail: normalizeContactEmail(payload.workEmail),
    organisation: payload.organisation.trim(),
    name: payload.name.trim(),
    consentVersion: payload.consent.version,
    consentedAt: confirmedAt,
    requestHash: createHash("sha256")
      .update(
        JSON.stringify({
          ...snapshot,
          name: payload.name.trim(),
          workEmail: normalizeContactEmail(payload.workEmail),
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
    return Response.json(body, {
      status: persisted.created ? 201 : 200,
      headers: { "Cache-Control": "no-store" },
    });
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
    !isValidRequestId(payload.requestId) ||
    typeof payload.name !== "string" ||
    !isContactTextWithinLimits(payload.name, CONTACT_FIELD_LIMITS.name) ||
    typeof payload.workEmail !== "string" ||
    !isValidContactEmail(payload.workEmail) ||
    typeof payload.organisation !== "string" ||
    !isContactTextWithinLimits(
      payload.organisation,
      CONTACT_FIELD_LIMITS.organisation,
    ) ||
    typeof payload.sector !== "string" ||
    !isContactSector(payload.sector) ||
    typeof payload.area !== "string" ||
    !isContactArea(payload.area) ||
    typeof payload.message !== "string" ||
    !isContactTextWithinLimits(payload.message, CONTACT_FIELD_LIMITS.message) ||
    payload.consent?.accepted !== true ||
    payload.consent.version !== CONTACT_CONSENT_VERSION
  ) {
    return { ok: false, message: "Check the contact fields and try again." };
  }
  return { ok: true, payload: payload as ContactRequestPayload };
}

function errorResponse(
  status: number,
  code: ContactErrorResponse["error"]["code"],
  message: string,
  retryable: boolean,
): Response {
  const body: ContactErrorResponse = { ok: false, error: { code, message, retryable } };
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
