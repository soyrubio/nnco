import { createHash, randomUUID } from "node:crypto";
import {
  calculateCoverage,
  isDiscoverySnapshot,
} from "../lib/discovery.ts";
import { buildFullDiagnosticReport } from "../lib/full-report.ts";
import {
  LEAD_CONSENT_VERSION,
  type LeadErrorCode,
  type LeadErrorResponse,
  type LeadRequestPayload,
  type LeadSuccessResponse,
} from "../lib/lead-contract.ts";
import {
  LeadRepositoryError,
  persistLead,
  type LeadRecord,
} from "./lead-repository.ts";

const MAX_BODY_BYTES = 128 * 1024;
const RATE_WINDOW_MS = 10 * 60 * 1_000;
const RATE_LIMIT = 10;

const globalRateStore = globalThis as typeof globalThis & {
  __nncLeadRateLimits?: Map<string, number[]>;
};
const rateLimits =
  globalRateStore.__nncLeadRateLimits ?? new Map<string, number[]>();
globalRateStore.__nncLeadRateLimits = rateLimits;

export async function handleLeadRequest(
  request: Request,
  clientAddress?: string,
): Promise<Response> {
  if (!sameOrigin(request)) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "The request origin could not be verified.",
      false,
    );
  }
  const retryAfter = rateLimit(request, clientAddress);
  if (retryAfter !== null) {
    const response = errorResponse(
      429,
      "RATE_LIMITED",
      "Too many handoff attempts. Wait briefly and retry.",
      true,
    );
    response.headers.set("Retry-After", String(retryAfter));
    return response;
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "The diagnostic request is too large.",
      false,
    );
  }

  let parsed: unknown;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      return errorResponse(
        400,
        "VALIDATION_ERROR",
        "The diagnostic request is too large.",
        false,
      );
    }
    parsed = JSON.parse(body);
  } catch {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "The request could not be read.",
      false,
    );
  }

  const validation = validateLeadPayload(parsed);
  if (!validation.ok) {
    return errorResponse(
      validation.status,
      validation.code,
      validation.message,
      false,
    );
  }
  const payload = validation.payload;
  if (!calculateCoverage(payload.snapshot).readyForPreview) {
    return errorResponse(
      409,
      "CASE_NOT_READY",
      "Complete the core diagnostic signals before requesting the full report.",
      false,
    );
  }

  const confirmedAt = new Date().toISOString();
  const record: LeadRecord = {
    requestId: payload.requestId,
    handoffId: randomUUID(),
    caseId: payload.caseId,
    caseRevision: payload.caseRevision,
    workEmail: payload.contact.workEmail.trim().toLocaleLowerCase("en"),
    organisation: payload.contact.organisation.trim(),
    name: payload.contact.name?.trim() || null,
    consentVersion: payload.consent.version,
    consentedAt: confirmedAt,
    requestHash: createRequestHash(payload),
    snapshot: payload.snapshot,
  };

  try {
    const persisted = await persistLead(record);
    if (!isDiscoverySnapshot(persisted.record.snapshot)) {
      throw new LeadRepositoryError(
        "HANDOFF_UNAVAILABLE",
        "The stored diagnostic could not be verified.",
      );
    }
    const body: LeadSuccessResponse = {
      ok: true,
      requestId: payload.requestId,
      handoffId: persisted.record.handoffId,
      caseId: payload.caseId,
      confirmedAt: persisted.record.consentedAt,
      persistence: persisted.persistence,
      reportAccess: {
        status: "confirmed",
        delivery: "one-shot-response",
      },
      fullReport: buildFullDiagnosticReport(persisted.record.snapshot),
    };
    return Response.json(body, {
      status: persisted.created ? 201 : 200,
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
        error.code === "IDEMPOTENCY_CONFLICT"
          ? "This retry key belongs to a different request. Refresh the form and try again."
          : error.code === "CONFIGURATION_ERROR"
            ? "The handoff service is not configured."
            : "We could not confirm the request. Your details remain in this form.",
        error.code === "HANDOFF_UNAVAILABLE",
      );
    }
    return errorResponse(
      503,
      "HANDOFF_UNAVAILABLE",
      "We could not confirm the request. Your details remain in this form.",
      true,
    );
  }
}

export function validateLeadPayload(
  value: unknown,
):
  | { ok: true; payload: LeadRequestPayload }
  | {
      ok: false;
      status: 400 | 409 | 422;
      code: LeadErrorCode;
      message: string;
    } {
  if (!value || typeof value !== "object") {
    return invalid("The request format is invalid.");
  }
  const payload = value as Partial<LeadRequestPayload>;
  if (
    payload.schemaVersion !== 1 ||
    typeof payload.requestId !== "string" ||
    !UUID_PATTERN.test(payload.requestId) ||
    typeof payload.caseId !== "string" ||
    !Number.isInteger(payload.caseRevision) ||
    !payload.contact ||
    typeof payload.contact.workEmail !== "string" ||
    !EMAIL_PATTERN.test(payload.contact.workEmail.trim()) ||
    payload.contact.workEmail.length > 254 ||
    typeof payload.contact.organisation !== "string" ||
    payload.contact.organisation.trim().length < 2 ||
    payload.contact.organisation.length > 160 ||
    (payload.contact.name !== undefined &&
      (typeof payload.contact.name !== "string" ||
        payload.contact.name.length > 120)) ||
    !isDiscoverySnapshot(payload.snapshot)
  ) {
    return invalid("Check the contact fields and diagnostic before retrying.");
  }
  if (
    payload.snapshot.caseId !== payload.caseId ||
    payload.snapshot.revision !== payload.caseRevision
  ) {
    return {
      ok: false,
      status: 409,
      code: "IDEMPOTENCY_CONFLICT",
      message: "The diagnostic changed while the request was being prepared.",
    };
  }
  if (
    !payload.consent ||
    payload.consent.accepted !== true ||
    payload.consent.version !== LEAD_CONSENT_VERSION
  ) {
    return {
      ok: false,
      status: 422,
      code: "CONSENT_REQUIRED",
      message: "Consent is required before contact details can be submitted.",
    };
  }
  return { ok: true, payload: payload as LeadRequestPayload };
}

function invalid(message: string) {
  return {
    ok: false as const,
    status: 400 as const,
    code: "VALIDATION_ERROR" as const,
    message,
  };
}

function errorResponse(
  status: number,
  code: LeadErrorCode,
  message: string,
  retryable: boolean,
): Response {
  const body: LeadErrorResponse = {
    ok: false,
    error: { code, message, retryable },
  };
  return Response.json(body, { status });
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
  const forwarded = request.headers.get("x-forwarded-for");
  const key = forwarded?.split(",")[0]?.trim() || clientAddress || "local";
  const now = Date.now();
  const recent = (rateLimits.get(key) ?? []).filter(
    (timestamp) => timestamp > now - RATE_WINDOW_MS,
  );
  if (recent.length >= RATE_LIMIT) {
    const retryAt = recent[0] + RATE_WINDOW_MS;
    return Math.max(1, Math.ceil((retryAt - now) / 1_000));
  }
  recent.push(now);
  rateLimits.set(key, recent);
  return null;
}

function createRequestHash(payload: LeadRequestPayload): string {
  return createHash("sha256")
    .update(
      canonicalJson({
        caseId: payload.caseId,
        caseRevision: payload.caseRevision,
        contact: {
          workEmail: payload.contact.workEmail.trim().toLocaleLowerCase("en"),
          organisation: payload.contact.organisation.trim(),
          name: payload.contact.name?.trim() || null,
        },
        consentVersion: payload.consent.version,
        snapshot: payload.snapshot,
      }),
    )
    .digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
