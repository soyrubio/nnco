import { isOpportunityDiscoveryReport, type OpportunityDiscoveryReport } from "./discovery-report.ts";

export const DISCOVERY_RELEASE_CONSENT_VERSION = "2026-08-10";

export const DISCOVERY_RELEASE_LIMITS = {
  website: 2_048,
  situation: 500,
  answer: 240,
  answerList: 8,
  context: 1_000,
  competitorNames: 3,
  name: 120,
  organisation: 160,
  workEmail: 254,
} as const;

// Shared limits keep new analysis and previously saved reports within the A4 layout.
export const DISCOVERY_REPORT_LIMITS = {
  points: 2, company: 80, heading: 56, summary: 900,
  explanation: 220, evidence: 80, action: 220, humanBoundary: 120,
  requires: 120, constraints: 240, firstMove: 100, validationQuestion: 100,
  competitorName: 40, competitorFinding: 60, sourceLabel: 40,
} as const;

export function limitReportText(value: string, maximum: number): string {
  const text = value.replace(/[—–]/g, "-").replace(/\s+/g, " ").trim();
  if (text.length <= maximum) return text;
  const prefix = text.slice(0, maximum - 3);
  return `${prefix.replace(/\s+\S*$/, "").trimEnd()}...`;
}

export type ReleaseSector =
  | "banking"
  | "insurance"
  | "healthcare"
  | "capital-markets"
  | "other";

export interface ReleaseSource {
  url: string;
  label: string;
}

export interface CompanyContext {
  website: string | null;
  domain: string | null;
  name: string;
  sector: ReleaseSector;
  summary: string;
  offerings: string[];
  suggestedWorkflows: string[];
  workflowOptions?: ReleaseChoice[];
  sources: ReleaseSource[];
  analysisMode: "ai" | "rules";
}

export interface DiscoveryResearch {
  company: { name: string; sector: ReleaseSector };
  workflowOptions: ReleaseChoice[];
  prefill: { workflow: string[]; systems: string[]; controls: string[] };
  sources: ReleaseSource[];
  contextToken: string;
}

export type DiscoveryEnrichmentResponse =
  | ({ ok: true } & DiscoveryResearch)
  | {
      ok: false;
      error: {
        code: "VALIDATION_ERROR" | "RATE_LIMITED" | "ENRICHMENT_UNAVAILABLE";
        message: string;
        retryable: boolean;
      };
    };

export interface ReleaseAnswers {
  workflow: string[];
  friction: string[];
  scale: string;
  systems: string[];
  controls: string[];
  context?: Partial<Record<MultiAnswerId, string>>;
}

export type MultiAnswerId = "workflow" | "friction" | "systems" | "controls";

export interface DiscoverySubmission {
  requestId: string;
  contextToken: string | null;
  sector: ReleaseSector;
  answers: ReleaseAnswers;
  workEmail: string;
  includeCompetitors: boolean;
  followUp?: boolean;
  personalResponseRequested?: true;
  consent: { accepted: true; version: typeof DISCOVERY_RELEASE_CONSENT_VERSION };
}

export interface DiscoveryReleasePayload {
  schemaVersion: 1;
  requestId: string;
  website: string | null;
  situation: string;
  company: CompanyContext;
  companyContextToken: string | null;
  answers: ReleaseAnswers;
  contact: {
    workEmail: string;
    organisation: string;
    name?: string;
  };
  competitorView: {
    enabled: boolean;
    names: string[];
  };
  consent: {
    accepted: true;
    version: typeof DISCOVERY_RELEASE_CONSENT_VERSION;
  };
}

export interface ReleaseFinding {
  title: string;
  explanation: string;
  evidence: string;
  basis: "Reported" | "Public source" | "Inferred";
}

export interface ReleaseOpportunity {
  title: string;
  action: string;
  humanBoundary: string;
  requires: string;
}

export interface ReleaseCompetitorNote {
  company: string;
  finding: string;
  sourceUrl: string;
}

export type ReleaseCompetitorStatus =
  | "not-requested"
  | "included"
  | "not-found";

export interface LegacyDiscoveryReleaseReport {
  schemaVersion: 1;
  generatedAt: string;
  title: string;
  executiveSummary: string;
  pageOne: {
    workflow: string;
    baseline: string;
    systems: string;
    findings: ReleaseFinding[];
  };
  pageTwo: {
    opportunities: ReleaseOpportunity[];
    constraints: string;
    firstMove: string;
    validationQuestions: string[];
    competitorStatus: ReleaseCompetitorStatus;
    competitorNotes: ReleaseCompetitorNote[];
  };
}

export type DiscoveryReleaseReport = LegacyDiscoveryReleaseReport | OpportunityDiscoveryReport;

export interface DiscoveryReleaseSuccessResponse {
  ok: true;
}

export interface DiscoveryReleaseErrorResponse {
  ok: false;
  error: {
    code:
      | "VALIDATION_ERROR"
      | "RATE_LIMITED"
      | "ANALYSIS_UNAVAILABLE"
      | "HANDOFF_UNAVAILABLE"
      | "CONFIGURATION_ERROR"
      | "IDEMPOTENCY_CONFLICT";
    message: string;
    retryable: boolean;
  };
}

export type DiscoveryReleaseResponse =
  | DiscoveryReleaseSuccessResponse
  | DiscoveryReleaseErrorResponse;

export interface ReleaseChoice {
  value: string;
  label: string;
  description?: string;
}

export const WORKFLOW_CHOICES: Record<ReleaseSector, ReleaseChoice[]> = {
  banking: [
    { value: "customer-onboarding", label: "Customer onboarding and KYC" },
    { value: "credit-lending", label: "Credit and lending" },
    { value: "reconciliation", label: "Reconciliation and reporting" },
    { value: "financial-crime", label: "Financial crime case review" },
    { value: "servicing", label: "Customer servicing" },
  ],
  insurance: [
    { value: "underwriting", label: "Underwriting" },
    { value: "claims", label: "Claims handling" },
    { value: "policy-servicing", label: "Policy servicing" },
    { value: "broker-submissions", label: "Broker submissions" },
    { value: "document-intake", label: "Document intake" },
  ],
  healthcare: [
    { value: "patient-intake", label: "Patient intake" },
    { value: "referrals", label: "Referrals and triage" },
    { value: "billing", label: "Billing and insurer administration" },
    { value: "scheduling", label: "Scheduling" },
    { value: "back-office", label: "Back-office operations" },
  ],
  "capital-markets": [
    { value: "fund-investor-reporting", label: "Fund and investor reporting" },
    { value: "due-diligence-review", label: "Due diligence document review" },
    { value: "ddq-rfp-responses", label: "DDQ and RFP responses" },
    { value: "portfolio-reporting", label: "Portfolio company reporting" },
    { value: "compliance-monitoring", label: "Compliance monitoring" },
  ],
  other: [
    { value: "document-intake", label: "Document intake" },
    { value: "case-handling", label: "Case handling" },
    { value: "reporting", label: "Reporting" },
    { value: "customer-operations", label: "Customer operations" },
    { value: "back-office", label: "Back-office operations" },
  ],
};

const FRICTION_CHOICES: Record<ReleaseSector, ReleaseChoice[]> = {
  banking: [
    { value: "manual-checks", label: "Manual checks and re-keying" },
    { value: "missing-evidence", label: "Missing evidence" },
    { value: "handoffs", label: "Waiting between teams" },
    { value: "exceptions", label: "Exception handling" },
    { value: "audit", label: "Audit preparation" },
  ],
  insurance: [
    { value: "document-review", label: "Reviewing submissions and documents" },
    { value: "missing-evidence", label: "Chasing missing evidence" },
    { value: "re-keying", label: "Copying data between systems" },
    { value: "referrals", label: "Referrals and approvals" },
    { value: "exceptions", label: "Handling non-standard cases" },
  ],
  healthcare: [
    { value: "document-review", label: "Reviewing forms and attachments" },
    { value: "re-keying", label: "Copying data between systems" },
    { value: "handoffs", label: "Waiting between teams" },
    { value: "scheduling", label: "Scheduling and coordination" },
    { value: "exceptions", label: "Handling incomplete cases" },
  ],
  "capital-markets": [
    { value: "reconciling-figures", label: "Locating and reconciling figures" },
    { value: "document-review", label: "Reviewing large document sets" },
    { value: "missing-inputs", label: "Chasing portfolio inputs" },
    { value: "repeated-responses", label: "Repeating DDQ and RFP answers" },
    { value: "compliance-exceptions", label: "Reviewing compliance exceptions" },
  ],
  other: [
    { value: "manual-checks", label: "Manual checks" },
    { value: "re-keying", label: "Copying data between systems" },
    { value: "handoffs", label: "Waiting between teams" },
    { value: "exceptions", label: "Exception handling" },
    { value: "reporting", label: "Preparing reports" },
  ],
};

export const RELEASE_SCALE_CHOICES: ReleaseChoice[] = [
  { value: "daily-high", label: "Many times each day" },
  { value: "daily", label: "A few times each day" },
  { value: "weekly", label: "A few times each week" },
  { value: "monthly", label: "A few times each month" },
  { value: "unknown", label: "I do not know yet" },
];

export const RELEASE_SYSTEM_CHOICES: ReleaseChoice[] = [
  { value: "email", label: "Email or messages" },
  { value: "documents", label: "Documents or PDF" },
  { value: "spreadsheets", label: "Spreadsheets" },
  { value: "core-system", label: "Core business system" },
  { value: "crm-case", label: "CRM or case system" },
  { value: "portals", label: "External portals" },
  { value: "database", label: "Database or warehouse" },
];

export const RELEASE_CONTROL_CHOICES: ReleaseChoice[] = [
  { value: "personal-data", label: "Personal or sensitive data" },
  { value: "residency", label: "Data residency" },
  { value: "access", label: "Role-based access" },
  { value: "audit", label: "Audit trail" },
  { value: "retention", label: "Retention and deletion" },
  { value: "human-approval", label: "Human approval" },
  { value: "unknown", label: "Needs review" },
];

export function workflowChoicesFor(company: CompanyContext): ReleaseChoice[] {
  if (company.workflowOptions) return company.workflowOptions;
  const base = WORKFLOW_CHOICES[company.sector];
  const generated = company.suggestedWorkflows
    .filter((value) => value.trim().length > 2)
    .slice(0, 3)
    .map((label) => base.find(choice => choice.label === label) ?? { value: slugify(label), label: boundText(label, 72) });
  return uniqueChoices([...generated, ...base]).slice(0, 6);
}

export function frictionChoicesFor(sector: ReleaseSector): ReleaseChoice[] {
  return FRICTION_CHOICES[sector];
}

export function labelForChoice(
  choices: readonly ReleaseChoice[],
  value: string,
): string {
  return choices.find((choice) => choice.value === value)?.label ?? value;
}

export function labelForReleaseSector(sector: ReleaseSector): string {
  const labels: Record<ReleaseSector, string> = {
    banking: "Banking",
    insurance: "Insurance",
    healthcare: "Healthcare",
    "capital-markets": "Capital Markets",
    other: "Another sector",
  };
  return labels[sector];
}

export function normalizeWebsiteInput(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > DISCOVERY_RELEASE_LIMITS.website) return null;
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (
      !/^https?:$/.test(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.port
    ) {
      return null;
    }
    parsed.pathname = "/";
    parsed.search = "";
    parsed.hash = "";
    return parsed;
  } catch {
    return null;
  }
}

export function buildFallbackCompanyContext({
  website,
  title,
  description,
  text,
  sourceUrls,
}: {
  website: string;
  title: string;
  description: string;
  text: string;
  sourceUrls: string[];
}): CompanyContext {
  const url = new URL(website);
  const haystack = `${title} ${description} ${text}`.toLocaleLowerCase("en");
  const sector = inferSector(haystack);
  const name = inferCompanyName(title, url.hostname);
  return {
    website,
    domain: url.hostname.replace(/^www\./, ""),
    name,
    sector,
    summary:
      boundText(description, 220) ||
      `${name} is a ${sector === "other" ? "company" : labelForReleaseSector(sector).toLocaleLowerCase("en")} organisation.`,
    offerings: fallbackOfferings(sector),
    suggestedWorkflows: WORKFLOW_CHOICES[sector]
      .slice(0, 3)
      .map((choice) => choice.label),
    sources: sourceUrls.slice(0, 3).map((sourceUrl) => ({
      url: sourceUrl,
      label: sourceLabel(sourceUrl),
    })),
    analysisMode: "rules",
  };
}

export function buildManualCompanyContext(sector: ReleaseSector): CompanyContext {
  return {
    website: null,
    domain: null,
    name: "Your organisation",
    sector,
    summary: "No public company website was provided. This diagnostic is based only on the user's answers.",
    offerings: [],
    suggestedWorkflows: [],
    sources: [],
    workflowOptions: WORKFLOW_CHOICES[sector],
    analysisMode: "rules",
  };
}

export function reclassifyCompanyContext(
  company: CompanyContext,
  sector: ReleaseSector,
): CompanyContext {
  if (company.sector === sector) return company;
  return {
    ...company,
    sector,
    workflowOptions: WORKFLOW_CHOICES[sector],
    suggestedWorkflows: WORKFLOW_CHOICES[sector]
      .slice(0, 3)
      .map((choice) => choice.label),
  };
}

export function buildFallbackReleaseReport(
  payload: DiscoveryReleasePayload,
  now = new Date().toISOString(),
): LegacyDiscoveryReleaseReport {
  const workflowChoices = workflowChoicesFor(payload.company);
  const frictionChoices = frictionChoicesFor(payload.company.sector);
  const workflowLabels = payload.answers.workflow.map((value) =>
    labelForChoice(workflowChoices, value),
  );
  const workflow = boundText(formatList(workflowLabels), 100);
  const workflowSubject = workflowLabels.length === 1
    ? workflow
    : "The selected workflows";
  const workflowVerb = workflowLabels.length === 1 ? "appears" : "appear";
  const friction = payload.answers.friction
    .map((value) => labelForChoice(frictionChoices, value))
    .join(", ");
  const systems = payload.answers.systems
    .map((value) => labelForChoice(RELEASE_SYSTEM_CHOICES, value))
    .join(", ");
  const controls = payload.answers.controls
    .map((value) => labelForChoice(RELEASE_CONTROL_CHOICES, value))
    .join(", ");
  const findings: ReleaseFinding[] = [
    {
      title: "Repeated preparation absorbs attention",
      explanation: boundText(
        friction
          ? `${friction} is the clearest reported source of avoidable effort in ${workflow.toLocaleLowerCase("en")}.`
          : `The workflow contains repeated preparation that should be measured before automation.`,
        220,
      ),
      evidence: boundText(payload.situation, 120) || "Selected diagnostic answers",
      basis: "Reported",
    },
    {
      title: "The system boundary is fragmented",
      explanation: boundText(
        systems
          ? `The work crosses ${systems.toLocaleLowerCase("en")}, so traceability and exception ownership matter as much as automation.`
          : "The authoritative source and system handoffs still need to be confirmed.",
        220,
      ),
      evidence: boundText(systems, 120) || "System landscape not yet verified",
      basis: systems ? "Reported" : "Inferred",
    },
  ];

  return {
    schemaVersion: 1,
    generatedAt: now,
    title: boundText(`${payload.company.name} workflow diagnostic`, 80),
    executiveSummary: `${workflowSubject} ${workflowVerb} suitable for a focused validation sprint. The first objective is to reduce repeated preparation while preserving the controls around material decisions.`,
    pageOne: {
      workflow,
      baseline: labelForChoice(RELEASE_SCALE_CHOICES, payload.answers.scale),
      systems: boundText(systems, 180) || "To be validated",
      findings,
    },
    pageTwo: {
      opportunities: [
        {
          title: "Structure the intake and evidence",
          action:
            "Capture incoming information in one controlled schema, identify missing evidence and route exceptions to an owner.",
          humanBoundary: "A person approves material decisions and non-standard cases.",
          requires:
            boundText(systems, 140) || "Access to the authoritative source system",
        },
        {
          title: "Automate the repeated preparation",
          action:
            "Validate inputs, prepare the case and draft the next action with a complete source trail.",
          humanBoundary: "The workflow owner remains accountable for approval and escalation.",
          requires:
            boundText(controls, 140) || "Control requirements to be confirmed",
        },
      ],
      constraints:
        boundText(controls, 240) || "Control ownership needs review before a pilot.",
      firstMove:
        "Run one evidence review with the workflow owner, technology lead and control owner. Confirm volumes, exceptions, access and the authoritative source.",
      validationQuestions: [
        "What is the representative monthly case volume?",
        "Which exception classes need mandatory human review?",
        "Which system is the authoritative source for each output?",
      ],
      competitorStatus: payload.competitorView.enabled
        ? "not-found"
        : "not-requested",
      competitorNotes: [],
    },
  };
}

export function isDiscoveryReleasePayload(
  value: unknown,
): value is DiscoveryReleasePayload {
  if (!isRecord(value)) return false;
  const payload = value as Partial<DiscoveryReleasePayload>;
  return (
    payload.schemaVersion === 1 &&
    typeof payload.requestId === "string" &&
    (payload.website === null ||
      (typeof payload.website === "string" &&
        Boolean(normalizeWebsiteInput(payload.website)))) &&
    typeof payload.situation === "string" &&
    payload.situation.length <= DISCOVERY_RELEASE_LIMITS.situation &&
    isCompanyContext(payload.company) &&
    companyWebsiteMatchesPayload(payload.website, payload.company) &&
    hasValidContextTokenShape(payload) &&
    isReleaseAnswersForCompany(payload.answers, payload.company) &&
    isRecord(payload.contact) &&
    typeof payload.contact.workEmail === "string" &&
    payload.contact.workEmail.length <= DISCOVERY_RELEASE_LIMITS.workEmail &&
    typeof payload.contact.organisation === "string" &&
    payload.contact.organisation.trim().length >= 2 &&
    payload.contact.organisation.length <= DISCOVERY_RELEASE_LIMITS.organisation &&
    (payload.contact.name === undefined ||
      (typeof payload.contact.name === "string" &&
        payload.contact.name.length <= DISCOVERY_RELEASE_LIMITS.name)) &&
    isRecord(payload.competitorView) &&
    typeof payload.competitorView.enabled === "boolean" &&
    !(payload.website === null && payload.competitorView.enabled) &&
    stringList(payload.competitorView.names, DISCOVERY_RELEASE_LIMITS.competitorNames) &&
    isRecord(payload.consent) &&
    payload.consent.accepted === true &&
    payload.consent.version === DISCOVERY_RELEASE_CONSENT_VERSION
  );
}

export function isDiscoveryReleaseReport(
  value: unknown,
): value is DiscoveryReleaseReport {
  if (isOpportunityDiscoveryReport(value)) return true;
  if (!isRecord(value) || !isRecord(value.pageOne) || !isRecord(value.pageTwo)) {
    return false;
  }
  const pageOne = value.pageOne;
  const pageTwo = value.pageTwo;
  return (
    value.schemaVersion === 1 &&
    boundedReportText(value.generatedAt, 64) &&
    Number.isFinite(Date.parse(value.generatedAt)) &&
    boundedReportText(value.title, 80) &&
    boundedReportText(value.executiveSummary, DISCOVERY_REPORT_LIMITS.summary) &&
    boundedReportText(pageOne.workflow, 100) &&
    boundedReportText(pageOne.baseline, 80) &&
    boundedReportText(pageOne.systems, 180) &&
    Array.isArray(pageOne.findings) &&
    pageOne.findings.length >= 1 &&
    pageOne.findings.length <= 3 &&
    pageOne.findings.every(isReleaseFinding) &&
    Array.isArray(pageTwo.opportunities) &&
    pageTwo.opportunities.length <= 3 &&
    pageTwo.opportunities.every(isReleaseOpportunity) &&
    boundedReportText(pageTwo.constraints, 240) &&
    boundedReportText(pageTwo.firstMove, 240) &&
    Array.isArray(pageTwo.validationQuestions) &&
    pageTwo.validationQuestions.length >= 2 &&
    pageTwo.validationQuestions.length <= 4 &&
    pageTwo.validationQuestions.every((entry) => boundedReportText(entry, 120)) &&
    (pageTwo.competitorStatus === "not-requested" ||
      pageTwo.competitorStatus === "included" ||
      pageTwo.competitorStatus === "not-found") &&
    Array.isArray(pageTwo.competitorNotes) &&
    pageTwo.competitorNotes.length <= 3 &&
    pageTwo.competitorNotes.every(isReleaseCompetitorNote) &&
    (pageTwo.competitorStatus === "included"
      ? pageTwo.competitorNotes.length > 0
      : pageTwo.competitorNotes.length === 0)
  );
}

function isReleaseFinding(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    boundedReportText(value.title, 80) &&
    boundedReportText(value.explanation, 320) &&
    boundedReportText(value.evidence, 120) &&
    (value.basis === "Reported" ||
      value.basis === "Public source" ||
      value.basis === "Inferred")
  );
}

function isReleaseOpportunity(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    boundedReportText(value.title, 80) &&
    boundedReportText(value.action, 260) &&
    boundedReportText(value.humanBoundary, 160) &&
    boundedReportText(value.requires, 140)
  );
}

function isReleaseCompetitorNote(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    boundedReportText(value.company, 100) &&
    boundedReportText(value.finding, 160) &&
    typeof value.sourceUrl === "string" &&
    Boolean(normalizePublicSourceUrl(value.sourceUrl))
  );
}

function boundedReportText(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximum
  );
}

export function isCompanyContext(value: unknown): value is CompanyContext {
  if (!isRecord(value)) return false;
  return (
    hasValidCompanyWebsite(value) &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    value.name.length <= 160 &&
    isReleaseSector(value.sector) &&
    typeof value.summary === "string" &&
    value.summary.length <= 500 &&
    stringList(value.offerings, 8) &&
    stringList(value.suggestedWorkflows, 8) &&
    (value.workflowOptions === undefined || (
      Array.isArray(value.workflowOptions) && value.workflowOptions.length <= 9 &&
      value.workflowOptions.every((option) => isRecord(option) &&
        typeof option.value === "string" && /^[a-z0-9-]{1,80}$/.test(option.value) &&
        typeof option.label === "string" && option.label.trim().length > 0 && option.label.length <= 72) &&
      new Set(value.workflowOptions.map((option) => option.value)).size === value.workflowOptions.length
    )) &&
    Array.isArray(value.sources) &&
    value.sources.length <= 3 &&
    value.sources.every(
      (source) =>
        isRecord(source) &&
        typeof source.url === "string" &&
        Boolean(normalizePublicSourceUrl(source.url)) &&
        typeof source.label === "string" &&
        source.label.length <= 80,
    ) &&
    (value.analysisMode === "ai" || value.analysisMode === "rules")
  );
}

export function normalizePublicSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function isReleaseSector(value: unknown): value is ReleaseSector {
  return (
    value === "banking" ||
    value === "insurance" ||
    value === "healthcare" ||
    value === "capital-markets" ||
    value === "other"
  );
}

function isReleaseAnswers(value: unknown): value is ReleaseAnswers {
  if (!isRecord(value)) return false;
  if (Object.keys(value).some(key => !["workflow", "friction", "scale", "systems", "controls", "context"].includes(key))) return false;
  if (value.context !== undefined && (!isRecord(value.context) ||
    !Object.entries(value.context).every(([key, text]) =>
      ["workflow", "friction", "systems", "controls"].includes(key) &&
      typeof text === "string" && text.length <= DISCOVERY_RELEASE_LIMITS.context))) return false;
  const context = value.context as ReleaseAnswers["context"];
  return (
    validMultiAnswer(value.workflow, context?.workflow, 2) &&
    validMultiAnswer(value.friction, context?.friction, 2) &&
    boundedAnswer(value.scale) &&
    validMultiAnswer(value.systems, context?.systems, DISCOVERY_RELEASE_LIMITS.answerList) &&
    validMultiAnswer(value.controls, context?.controls, DISCOVERY_RELEASE_LIMITS.answerList)
  );
}

function validMultiAnswer(value: unknown, context: string | undefined, maximum: number): boolean {
  return stringList(value, maximum) && (value.length > 0 || Boolean(context?.trim()));
}

export function hasMultiAnswer(answers: ReleaseAnswers, id: MultiAnswerId): boolean {
  return answers[id].length > 0 || Boolean(answers.context?.[id]?.trim());
}

export function isDiscoverySubmission(value: unknown): value is DiscoverySubmission {
  if (!isRecord(value)) return false;
  const keys = ["requestId", "contextToken", "sector", "answers", "workEmail", "includeCompetitors", "followUp", "personalResponseRequested", "consent"];
  return Object.keys(value).every(key => keys.includes(key)) &&
    typeof value.requestId === "string" && isReleaseSector(value.sector) &&
    (value.contextToken === null || (typeof value.contextToken === "string" && value.contextToken.length >= 32 && value.contextToken.length <= 16_384)) &&
    isReleaseAnswers(value.answers) && typeof value.workEmail === "string" && value.workEmail.length <= DISCOVERY_RELEASE_LIMITS.workEmail &&
    (value.personalResponseRequested === undefined || value.personalResponseRequested === true) &&
    !(value.personalResponseRequested === true && value.followUp !== undefined) &&
    (value.followUp === undefined || typeof value.followUp === "boolean") &&
    typeof value.includeCompetitors === "boolean" && !(value.contextToken === null && value.includeCompetitors) &&
    isRecord(value.consent) && value.consent.accepted === true && value.consent.version === DISCOVERY_RELEASE_CONSENT_VERSION;
}

export function isReleaseAnswersForCompany(
  value: unknown,
  company: CompanyContext,
): value is ReleaseAnswers {
  if (!isReleaseAnswers(value)) return false;
  const answers = value as ReleaseAnswers;
  return (
    choicesInclude(workflowChoicesFor(company), answers.workflow) &&
    choicesInclude(frictionChoicesFor(company.sector), answers.friction) &&
    choiceIncludes(RELEASE_SCALE_CHOICES, answers.scale) &&
    choicesInclude(RELEASE_SYSTEM_CHOICES, answers.systems) &&
    choicesInclude(RELEASE_CONTROL_CHOICES, answers.controls)
  );
}

function boundedAnswer(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= DISCOVERY_RELEASE_LIMITS.answer
  );
}

function stringList(value: unknown, maximum: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maximum &&
    value.every(
      (entry) =>
        typeof entry === "string" &&
        entry.trim().length > 0 &&
        entry.length <= DISCOVERY_RELEASE_LIMITS.answer,
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasValidCompanyWebsite(value: Record<string, unknown>): boolean {
  if (value.website === null) return value.domain === null;
  if (typeof value.website !== "string" || typeof value.domain !== "string") {
    return false;
  }
  const website = normalizeWebsiteInput(value.website);
  return Boolean(
    website &&
      value.domain.length <= 253 &&
      value.domain === website.hostname.replace(/^www\./, ""),
  );
}

function companyWebsiteMatchesPayload(
  website: string | null,
  company: CompanyContext,
): boolean {
  if (website === null || company.website === null) {
    return website === null && company.website === null;
  }
  return (
    normalizeWebsiteInput(website)?.toString() ===
    normalizeWebsiteInput(company.website)?.toString()
  );
}

function hasValidContextTokenShape(
  payload: Partial<DiscoveryReleasePayload>,
): boolean {
  if (payload.website === null) {
    const company = payload.company;
    return (
      payload.companyContextToken === null &&
      Boolean(company) &&
      stableJson(company) ===
        stableJson(buildManualCompanyContext(company!.sector))
    );
  }
  return (
    typeof payload.companyContextToken === "string" &&
    payload.companyContextToken.length >= 32 &&
    payload.companyContextToken.length <= 16_384
  );
}

function choiceIncludes(choices: readonly ReleaseChoice[], value: string): boolean {
  return choices.some((choice) => choice.value === value);
}

function choicesInclude(
  choices: readonly ReleaseChoice[],
  values: string[],
): boolean {
  return (
    new Set(values).size === values.length &&
    values.every((value) => choiceIncludes(choices, value))
  );
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function inferSector(text: string): ReleaseSector {
  if (
    /asset management|capital markets?|fund manager|fund reporting|investor reporting|portfolio compan|private equity|venture capital|aifmd|sfdr|mifid|due diligence questionnaire|\bddq\b/.test(
      text,
    )
  ) {
    return "capital-markets";
  }
  if (/insurance|underwriting|claims|policyholder|actuar/.test(text)) {
    return "insurance";
  }
  if (/bank|lending|credit|payment|financial institution|fintech/.test(text)) {
    return "banking";
  }
  if (/health|patient|hospital|clinic|medical|care provider/.test(text)) {
    return "healthcare";
  }
  return "other";
}

function inferCompanyName(title: string, hostname: string): string {
  const candidate = title
    .split(/\s[-|:]\s/)[0]
    .replace(/\s+/g, " ")
    .trim();
  if (candidate.length >= 2 && candidate.length <= 80) return candidate;
  const domain = hostname.replace(/^www\./, "").split(".")[0] || hostname;
  return domain.charAt(0).toLocaleUpperCase("en") + domain.slice(1);
}

function sourceLabel(value: string): string {
  const path = new URL(value).pathname.replace(/\/$/, "");
  if (!path) return "Homepage";
  const segment = path.split("/").filter(Boolean).at(-1) || "Public page";
  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toLocaleUpperCase("en"));
}

function fallbackOfferings(sector: ReleaseSector): string[] {
  const offerings: Record<ReleaseSector, string[]> = {
    banking: ["Banking operations", "Risk and compliance", "Customer servicing"],
    insurance: ["Underwriting", "Claims", "Policy operations"],
    healthcare: ["Patient administration", "Billing", "Clinical operations"],
    "capital-markets": [
      "Fund and investor reporting",
      "Due diligence",
      "Compliance monitoring",
    ],
    other: ["Operations", "Customer workflows", "Reporting"],
  };
  return offerings[sector];
}

function uniqueChoices(choices: ReleaseChoice[]): ReleaseChoice[] {
  const seen = new Set<string>();
  return choices.filter((choice) => {
    const key = choice.label.trim().toLocaleLowerCase("en");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatList(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "Selected workflow";
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}

function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("en")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "workflow"
  );
}

function boundText(value: string, maximum: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maximum) return normalized;
  return `${normalized.slice(0, maximum - 3).trimEnd()}...`;
}
