import { LEAD_CONSENT_VERSION } from "./lead-contract.ts";

export const CONTACT_CONSENT_VERSION = LEAD_CONSENT_VERSION;

export interface ContactRequestPayload {
  schemaVersion: 1;
  requestId: string;
  name: string;
  workEmail: string;
  organisation: string;
  sector: string;
  area: string;
  message: string;
  consent: {
    accepted: true;
    version: typeof CONTACT_CONSENT_VERSION;
  };
}

export interface ContactSuccessResponse {
  ok: true;
  requestId: string;
  handoffId: string;
  confirmedAt: string;
  persistence: "ephemeral" | "supabase";
}

export interface ContactErrorResponse {
  ok: false;
  error: {
    code: "VALIDATION_ERROR" | "RATE_LIMITED" | "HANDOFF_UNAVAILABLE" | "CONFIGURATION_ERROR" | "IDEMPOTENCY_CONFLICT";
    message: string;
    retryable: boolean;
  };
}

export type ContactResponse = ContactSuccessResponse | ContactErrorResponse;
