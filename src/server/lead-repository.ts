export interface LeadRecord {
  requestId: string;
  handoffId: string;
  caseId: string;
  caseRevision: number;
  workEmail: string;
  organisation: string;
  name: string | null;
  consentVersion: string;
  consentedAt: string;
  requestHash: string;
  snapshot: unknown;
}

export interface PersistedLead {
  record: LeadRecord;
  persistence: "ephemeral" | "supabase";
  created: boolean;
}

export class LeadRepositoryError extends Error {
  readonly code:
    | "CONFIGURATION_ERROR"
    | "HANDOFF_UNAVAILABLE"
    | "IDEMPOTENCY_CONFLICT";

  constructor(
    code:
      | "CONFIGURATION_ERROR"
      | "HANDOFF_UNAVAILABLE"
      | "IDEMPOTENCY_CONFLICT",
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

const globalLeadStore = globalThis as typeof globalThis & {
  __nncoEphemeralLeads?: Map<string, LeadRecord>;
};

const ephemeralLeads =
  globalLeadStore.__nncoEphemeralLeads ?? new Map<string, LeadRecord>();
globalLeadStore.__nncoEphemeralLeads = ephemeralLeads;

export async function persistLead(record: LeadRecord): Promise<PersistedLead> {
  const mode = process.env.LEAD_HANDOFF_MODE ?? "local";
  if (mode === "local") {
    if (process.env.NODE_ENV === "production") {
      throw new LeadRepositoryError(
        "CONFIGURATION_ERROR",
        "Local lead storage is disabled in production.",
      );
    }
    const existing = ephemeralLeads.get(record.requestId);
    if (existing) {
      assertSameRequest(existing, record);
      return { record: existing, persistence: "ephemeral", created: false };
    }
    ephemeralLeads.set(record.requestId, record);
    return { record, persistence: "ephemeral", created: true };
  }

  if (mode !== "supabase") {
    throw new LeadRepositoryError(
      "CONFIGURATION_ERROR",
      "The lead handoff mode is not supported.",
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new LeadRepositoryError(
      "CONFIGURATION_ERROR",
      "The production handoff is not configured.",
    );
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
  const tableUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/lead_requests`;
  const existing = await readSupabaseLead(
    tableUrl,
    record.requestId,
    headers,
  );
  if (existing) {
    assertSameRequest(existing, record);
    return { record: existing, persistence: "supabase", created: false };
  }

  const response = await fetch(tableUrl, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      id: record.handoffId,
      request_id: record.requestId,
      case_id: record.caseId,
      case_revision: record.caseRevision,
      work_email: record.workEmail,
      organisation: record.organisation,
      name: record.name,
      consent_version: record.consentVersion,
      consented_at: record.consentedAt,
      request_hash: record.requestHash,
      snapshot: record.snapshot,
      status: "received",
    }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);

  if (!response) {
    throw new LeadRepositoryError(
      "HANDOFF_UNAVAILABLE",
      "The handoff service did not respond.",
    );
  }
  if (response.status === 409) {
    const raced = await readSupabaseLead(
      tableUrl,
      record.requestId,
      headers,
    );
    if (raced) {
      assertSameRequest(raced, record);
      return { record: raced, persistence: "supabase", created: false };
    }
  }
  if (!response.ok) {
    throw new LeadRepositoryError(
      "HANDOFF_UNAVAILABLE",
      "The handoff service rejected the request.",
    );
  }
  const rows = (await response.json()) as unknown[];
  const persisted = rows[0] ? rowToRecord(rows[0]) : record;
  return { record: persisted, persistence: "supabase", created: true };
}

async function readSupabaseLead(
  tableUrl: string,
  requestId: string,
  headers: Record<string, string>,
): Promise<LeadRecord | null> {
  const url = new URL(tableUrl);
  url.searchParams.set("request_id", `eq.${requestId}`);
  url.searchParams.set(
    "select",
    "id,request_id,case_id,case_revision,work_email,organisation,name,consent_version,consented_at,request_hash,snapshot",
  );
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  if (!response || !response.ok) {
    if (response?.status === 404) return null;
    throw new LeadRepositoryError(
      "HANDOFF_UNAVAILABLE",
      "The handoff service could not verify an existing request.",
    );
  }
  const rows = (await response.json()) as unknown[];
  return rows[0] ? rowToRecord(rows[0]) : null;
}

function rowToRecord(value: unknown): LeadRecord {
  const row = value as Record<string, unknown>;
  return {
    requestId: String(row.request_id),
    handoffId: String(row.id),
    caseId: String(row.case_id),
    caseRevision: Number(row.case_revision),
    workEmail: String(row.work_email),
    organisation: String(row.organisation),
    name: typeof row.name === "string" ? row.name : null,
    consentVersion: String(row.consent_version),
    consentedAt: String(row.consented_at),
    requestHash: String(row.request_hash),
    snapshot: row.snapshot,
  };
}

function assertSameRequest(existing: LeadRecord, candidate: LeadRecord): void {
  if (
    existing.requestHash !== candidate.requestHash
  ) {
    throw new LeadRepositoryError(
      "IDEMPOTENCY_CONFLICT",
      "This retry key is already attached to a different request.",
    );
  }
}
