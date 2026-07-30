import type { DiscoverySnapshot } from "./discovery.ts";

export const LEAD_CONSENT_VERSION = "2026-07-29";

export type SolutionKind =
  | "saas"
  | "agent-skill"
  | "workflow-automation"
  | "integration"
  | "custom"
  | "process-change";

export type PricingModel =
  | "saas-plus-integration"
  | "fixed-implementation"
  | "implementation-plus-retainer"
  | "monthly-license"
  | "exclusive-custom";

export interface IndicativeRange {
  currency: "EUR";
  min: number;
  max: number;
  unit: "one-off" | "monthly";
}

export interface ReportSolutionOption {
  id: string;
  problemId: string;
  title: string;
  kind: SolutionKind;
  principle: string;
  expectedBenefit: string;
  dataAndIntegrations: string[];
  effort: "Low" | "Medium" | "High";
  risks: string[];
  timingWeeks: { min: number; max: number };
  pricingModel: PricingModel;
  indicativeRanges: IndicativeRange[];
  confidence: number;
  evidenceRefs: string[];
  assumptions: string[];
}

export interface FullDiagnosticReport {
  schemaVersion: 1;
  caseId: string;
  generatedAt: string;
  investmentPosture: {
    value: string;
    label: string;
    isAssumption: boolean;
  };
  solutionOptions: ReportSolutionOption[];
  recommendedNextStep: string;
  deliveryModel: string;
  roadmap: Array<{
    window: string;
    objective: string;
    output: string;
  }>;
}

export interface LeadRequestPayload {
  schemaVersion: 1;
  requestId: string;
  caseId: string;
  caseRevision: number;
  contact: {
    workEmail: string;
    organisation: string;
    name?: string;
  };
  consent: {
    accepted: true;
    version: typeof LEAD_CONSENT_VERSION;
  };
  snapshot: DiscoverySnapshot;
}

export interface LeadSuccessResponse {
  ok: true;
  requestId: string;
  handoffId: string;
  caseId: string;
  confirmedAt: string;
  persistence: "ephemeral" | "supabase";
  reportAccess: {
    status: "confirmed";
    delivery: "one-shot-response";
  };
  fullReport: FullDiagnosticReport;
}

export type LeadErrorCode =
  | "VALIDATION_ERROR"
  | "CONSENT_REQUIRED"
  | "CASE_NOT_READY"
  | "IDEMPOTENCY_CONFLICT"
  | "RATE_LIMITED"
  | "HANDOFF_UNAVAILABLE"
  | "CONFIGURATION_ERROR";

export interface LeadErrorResponse {
  ok: false;
  error: {
    code: LeadErrorCode;
    message: string;
    retryable: boolean;
  };
}

export type LeadResponse = LeadSuccessResponse | LeadErrorResponse;
