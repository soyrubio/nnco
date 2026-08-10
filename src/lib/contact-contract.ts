import { LEAD_CONSENT_VERSION } from "./lead-contract.ts";

export const CONTACT_CONSENT_VERSION = LEAD_CONSENT_VERSION;

export const CONTACT_FIELD_LIMITS = {
  name: { minLength: 2, maxLength: 120 },
  workEmail: { maxLength: 254 },
  organisation: { minLength: 2, maxLength: 160 },
  message: { minLength: 10, maxLength: 4_000 },
} as const;

export const CONTACT_EMAIL_PATTERN_SOURCE = String.raw`[^\s@]+@[^\s@]+\.[^\s@]+`;

export const CONTACT_SECTORS = [
  "Banking",
  "Insurance",
  "Healthcare",
  "Capital markets or asset management",
  "Other",
] as const;

export const CONTACT_AREAS = [
  "An AI audit",
  "A specific workflow",
  "Private or on-premise infrastructure",
  "Running a system we already have",
  "Something else",
] as const;

export type ContactSector = (typeof CONTACT_SECTORS)[number];
export type ContactArea = (typeof CONTACT_AREAS)[number];

interface ContactFieldLimits {
  minLength?: number;
  maxLength: number;
}

const CONTACT_EMAIL_PATTERN = new RegExp(
  `^(?:${CONTACT_EMAIL_PATTERN_SOURCE})$`,
);

export function isContactTextWithinLimits(
  value: string,
  limits: ContactFieldLimits,
): boolean {
  return (
    value.length <= limits.maxLength &&
    value.trim().length >= (limits.minLength ?? 0)
  );
}

export function isValidContactEmail(value: string): boolean {
  return (
    value.length <= CONTACT_FIELD_LIMITS.workEmail.maxLength &&
    CONTACT_EMAIL_PATTERN.test(value.trim())
  );
}

export function normalizeContactEmail(value: string): string {
  return value.trim().toLocaleLowerCase("en");
}

export function isContactSector(value: string): value is ContactSector {
  return CONTACT_SECTORS.some((sector) => sector === value);
}

export function isContactArea(value: string): value is ContactArea {
  return CONTACT_AREAS.some((area) => area === value);
}

export interface ContactRequestPayload {
  schemaVersion: 1;
  requestId: string;
  name: string;
  workEmail: string;
  organisation: string;
  sector: ContactSector;
  area: ContactArea;
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
