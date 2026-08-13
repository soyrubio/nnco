import { randomUUID } from "node:crypto";
import { isDiscoveryReleaseReport } from "../lib/discovery-release.ts";

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

export interface StoredLeadAnalysis {
  confirmedAt: string;
  analysisMode: "ai" | "rules";
  report: unknown;
}

export interface LeadAnalysisReplay extends StoredLeadAnalysis {
  handoffId: string;
  persistence: "ephemeral" | "supabase";
}

export type LeadAnalysisClaim =
  | { state: "claimed"; claimToken: string }
  | { state: "pending" }
  | { state: "completed"; analysis: StoredLeadAnalysis };

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
  __nncoEphemeralLeadAnalyses?: Map<string, StoredLeadAnalysis>;
  __nncoEphemeralAnalysisClaims?: Map<string, string>;
};

const ephemeralLeads =
  globalLeadStore.__nncoEphemeralLeads ?? new Map<string, LeadRecord>();
globalLeadStore.__nncoEphemeralLeads = ephemeralLeads;
const ephemeralLeadAnalyses =
  globalLeadStore.__nncoEphemeralLeadAnalyses ??
  new Map<string, StoredLeadAnalysis>();
globalLeadStore.__nncoEphemeralLeadAnalyses = ephemeralLeadAnalyses;
const ephemeralAnalysisClaims =
  globalLeadStore.__nncoEphemeralAnalysisClaims ?? new Map<string, string>();
globalLeadStore.__nncoEphemeralAnalysisClaims = ephemeralAnalysisClaims;

export async function readLeadAnalysis(
  requestId: string,
  requestHash: string,
): Promise<LeadAnalysisReplay | null> {
  const mode = process.env.LEAD_HANDOFF_MODE ?? "local";
  if (mode === "local") {
    const existing = ephemeralLeads.get(requestId);
    if (!existing) return null;
    assertRequestHash(existing.requestHash, requestHash);
    const analysis = ephemeralLeadAnalyses.get(requestId);
    return analysis
      ? { ...analysis, handoffId: existing.handoffId, persistence: "ephemeral" }
      : null;
  }
  const config = supabaseConfig();
  const url = new URL(`${config.url}/rest/v1/lead_requests`);
  url.searchParams.set("request_id", `eq.${requestId}`);
  url.searchParams.set("select", "id,request_hash,analysis_result");
  const response = await fetch(url, {
    headers: config.headers,
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  if (!response?.ok) {
    throw new LeadRepositoryError(
      "HANDOFF_UNAVAILABLE",
      "The handoff service could not read a completed analysis.",
    );
  }
  const rows = (await response.json()) as Array<Record<string, unknown>>;
  const row = rows[0];
  if (!row) return null;
  assertRequestHash(String(row.request_hash), requestHash);
  return isStoredLeadAnalysis(row.analysis_result)
    ? {
        ...row.analysis_result,
        handoffId: String(row.id),
        persistence: "supabase",
      }
    : null;
}

export async function claimLeadAnalysis(
  requestId: string,
  requestHash: string,
): Promise<LeadAnalysisClaim> {
  const mode = process.env.LEAD_HANDOFF_MODE ?? "local";
  if (mode === "local") {
    const existing = ephemeralLeads.get(requestId);
    if (!existing) {
      throw new LeadRepositoryError("HANDOFF_UNAVAILABLE", "Lead does not exist");
    }
    assertRequestHash(existing.requestHash, requestHash);
    const completed = ephemeralLeadAnalyses.get(requestId);
    if (completed) return { state: "completed", analysis: completed };
    if (ephemeralAnalysisClaims.has(requestId)) return { state: "pending" };
    const claimToken = randomUUID();
    ephemeralAnalysisClaims.set(requestId, claimToken);
    return { state: "claimed", claimToken };
  }

  const config = supabaseConfig();
  const response = await fetch(
    `${config.url}/rest/v1/rpc/claim_discovery_analysis`,
    {
      method: "POST",
      headers: config.headers,
      body: JSON.stringify({
        p_request_id: requestId,
        p_request_hash: requestHash,
      }),
      signal: AbortSignal.timeout(8_000),
    },
  ).catch(() => null);
  if (!response?.ok) {
    throw new LeadRepositoryError(
      "HANDOFF_UNAVAILABLE",
      "The analysis claim could not be acquired.",
    );
  }
  const rows = (await response.json()) as Array<{
    claim_state?: string;
    analysis_result?: unknown;
    claim_token?: string;
  }>;
  const row = rows[0];
  if (row?.claim_state === "claimed" && row.claim_token) {
    return { state: "claimed", claimToken: row.claim_token };
  }
  if (row?.claim_state === "pending") return { state: "pending" };
  if (
    row?.claim_state === "completed" &&
    isStoredLeadAnalysis(row.analysis_result)
  ) {
    return { state: "completed", analysis: row.analysis_result };
  }
  throw new LeadRepositoryError(
    "HANDOFF_UNAVAILABLE",
    "The analysis claim response was invalid.",
  );
}

export async function releaseLeadAnalysisClaim(
  requestId: string,
  requestHash: string,
  claimToken: string,
): Promise<void> {
  const mode = process.env.LEAD_HANDOFF_MODE ?? "local";
  if (mode === "local") {
    const existing = ephemeralLeads.get(requestId);
    if (existing) assertRequestHash(existing.requestHash, requestHash);
    if (ephemeralAnalysisClaims.get(requestId) === claimToken) {
      ephemeralAnalysisClaims.delete(requestId);
    }
    return;
  }
  const config = supabaseConfig();
  const url = new URL(`${config.url}/rest/v1/lead_requests`);
  url.searchParams.set("request_id", `eq.${requestId}`);
  url.searchParams.set("request_hash", `eq.${requestHash}`);
  url.searchParams.set("analysis_result", "is.null");
  url.searchParams.set("analysis_claim_token", `eq.${claimToken}`);
  const response = await fetch(url, {
    method: "PATCH",
    headers: { ...config.headers, Prefer: "return=minimal" },
    body: JSON.stringify({
      status: "received",
      analysis_started_at: null,
      analysis_claim_token: null,
    }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  if (!response?.ok) {
    throw new LeadRepositoryError(
      "HANDOFF_UNAVAILABLE",
      "The analysis claim could not be released.",
    );
  }
}

export async function saveLeadAnalysis(
  requestId: string,
  requestHash: string,
  claimToken: string,
  analysis: StoredLeadAnalysis,
): Promise<StoredLeadAnalysis> {
  const mode = process.env.LEAD_HANDOFF_MODE ?? "local";
  if (mode === "local") {
    const existing = ephemeralLeads.get(requestId);
    if (!existing) {
      throw new LeadRepositoryError("HANDOFF_UNAVAILABLE", "Lead does not exist");
    }
    assertRequestHash(existing.requestHash, requestHash);
    const alreadyCompleted = ephemeralLeadAnalyses.get(requestId);
    if (!alreadyCompleted && ephemeralAnalysisClaims.get(requestId) !== claimToken) {
      throw new LeadRepositoryError(
        "HANDOFF_UNAVAILABLE",
        "The analysis claim is no longer owned by this worker.",
      );
    }
    const completed = alreadyCompleted ?? analysis;
    ephemeralLeadAnalyses.set(requestId, completed);
    ephemeralAnalysisClaims.delete(requestId);
    return completed;
  }
  const config = supabaseConfig();
  const url = new URL(`${config.url}/rest/v1/lead_requests`);
  url.searchParams.set("request_id", `eq.${requestId}`);
  url.searchParams.set("request_hash", `eq.${requestHash}`);
  url.searchParams.set("analysis_result", "is.null");
  url.searchParams.set("analysis_claim_token", `eq.${claimToken}`);
  const response = await fetch(url, {
    method: "PATCH",
    headers: { ...config.headers, Prefer: "return=representation" },
    body: JSON.stringify({
      analysis_result: analysis,
      analysis_completed_at: analysis.confirmedAt,
      analysis_started_at: null,
      analysis_claim_token: null,
      status: "analysed",
    }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  if (!response?.ok) {
    throw new LeadRepositoryError(
      "HANDOFF_UNAVAILABLE",
      "The completed analysis could not be stored.",
    );
  }
  const rows = (await response.json()) as Array<Record<string, unknown>>;
  if (isStoredLeadAnalysis(rows[0]?.analysis_result)) {
    return rows[0].analysis_result;
  }
  const completed = await readLeadAnalysis(requestId, requestHash);
  if (completed) {
    return {
      confirmedAt: completed.confirmedAt,
      analysisMode: completed.analysisMode,
      report: completed.report,
    };
  }
  throw new LeadRepositoryError(
    "HANDOFF_UNAVAILABLE",
    "The completed analysis could not be verified.",
  );
}

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
  assertRequestHash(existing.requestHash, candidate.requestHash);
}

function assertRequestHash(existing: string, candidate: string): void {
  if (existing !== candidate) {
    throw new LeadRepositoryError(
      "IDEMPOTENCY_CONFLICT",
      "This retry key is already attached to a different request.",
    );
  }
}

function supabaseConfig(): {
  url: string;
  headers: Record<string, string>;
} {
  if ((process.env.LEAD_HANDOFF_MODE ?? "local") !== "supabase") {
    throw new LeadRepositoryError("CONFIGURATION_ERROR", "Unsupported handoff mode");
  }
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new LeadRepositoryError(
      "CONFIGURATION_ERROR",
      "The production handoff is not configured.",
    );
  }
  return {
    url,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  };
}

function isStoredLeadAnalysis(value: unknown): value is StoredLeadAnalysis {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const analysis = value as Partial<StoredLeadAnalysis>;
  return (
    typeof analysis.confirmedAt === "string" &&
    (analysis.analysisMode === "ai" || analysis.analysisMode === "rules") &&
    isDiscoveryReleaseReport(analysis.report)
  );
}
