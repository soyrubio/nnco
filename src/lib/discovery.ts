/**
 * Shared discovery domain model.
 *
 * The cockpit form and the agent conversation intentionally write through the
 * same reducer. This module has no React, storage, server, or database
 * dependencies, so snapshots can be safely serialized into localStorage and
 * later moved to a persistence adapter without changing the product model.
 */

export type Segment = "finance" | "insurance" | "healthcare" | "other";

type MilestoneId = "context" | "workflow" | "friction" | "readiness" | "review";
type DiscoveryStatus =
  | "segmenting"
  | "discovering"
  | "review"
  | "analyzing"
  | "preview_ready"
  | "lead_submitted";
type SettableDiscoveryStatus = "analyzing" | "preview_ready";
type EvidenceStatus = "reported" | "inferred" | "confirmed";
type AnswerSource = "form" | "chat";

export interface Milestone {
  id: MilestoneId;
  label: string;
  index: number;
  description: string;
  estimatedMinutes: number;
}

export type DiscoveryValue = string | number | boolean | string[] | null;

export const DISCOVERY_SHORT_TEXT_MAX_LENGTH = 240;
export const DISCOVERY_LONG_TEXT_MAX_LENGTH = 1_200;
export const DISCOVERY_MESSAGE_MAX_LENGTH = 1_200;
export const DISCOVERY_MAX_REVISION = 2_147_483_647;

const DISCOVERY_MAX_MESSAGES = 128;
const DISCOVERY_MAX_OBSERVATIONS = 64;
const DISCOVERY_MAX_MANUAL_WORKFLOWS = 16;
const DISCOVERY_MAX_IDENTIFIER_LENGTH = 128;
const DISCOVERY_MAX_DERIVED_ITEMS = 128;

export interface ChatEvidencePatch {
  kind: "answer" | "observation";
  questionId: string;
  value: DiscoveryValue;
  confidence: number;
  sourceExcerpt: string;
}

interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

export interface DiscoveryQuestion {
  id: string;
  milestone: MilestoneId;
  sector: Segment | "all";
  prompt: string;
  shortLabel: string;
  help?: string;
  fieldType:
    | "single_select"
    | "multi_select"
    | "short_text"
    | "long_text"
    | "number";
  options?: QuestionOption[];
  required: boolean;
  allowUnknown: boolean;
  placeholder?: string;
}

interface Profile {
  organisationType: string;
  sizeBand: string;
  sector: Segment | "";
  role: string;
  focusArea: string;
}

interface DiscoveryAnswer {
  questionId: string;
  value: DiscoveryValue;
  source: AnswerSource;
  status: EvidenceStatus;
  confidence: number;
  updatedAt: string;
}

interface DiscoveryMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  createdAt: string;
}

interface DiscoveryFact {
  id: string;
  label: string;
  detail: string;
  evidenceRefs: string[];
  status: EvidenceStatus;
  confidence: number;
}

interface DiscoveryEvidence {
  id: string;
  label: string;
  statement: string;
  questionId: string;
  source: AnswerSource;
  status: EvidenceStatus;
  confidence: number;
}

export interface DiscoveryObservation {
  id: string;
  questionId: string;
  statement: string;
  source: "chat";
  status: "reported";
  confidence: number;
  createdAt: string;
}

export interface LeadConfirmation {
  handoffId: string;
  confirmedAt: string;
}

export interface DiscoverySnapshot {
  schemaVersion: 2;
  caseId: string;
  status: DiscoveryStatus;
  leadRequestStatus: "not_started" | "confirmed";
  leadConfirmation: LeadConfirmation | null;
  activeMilestone: MilestoneId;
  profile: Profile;
  answers: Record<string, DiscoveryAnswer>;
  observations: DiscoveryObservation[];
  messages: DiscoveryMessage[];
  workflows: DiscoveryFact[];
  systems: DiscoveryFact[];
  dataAssets: DiscoveryFact[];
  painPoints: DiscoveryFact[];
  constraints: DiscoveryFact[];
  goals: DiscoveryFact[];
  evidence: DiscoveryEvidence[];
  createdAt: string;
  updatedAt: string;
  revision: number;
}

interface Coverage {
  answered: number;
  total: number;
  percentage: number;
  completedMilestones: number;
  totalMilestones: number;
  currentMilestone: MilestoneId;
  estimatedMinutesRemaining: number;
  knownCoreSignals: number;
  validationSignals: number;
  readyForPreview: boolean;
}

export interface ReportProblem {
  id: string;
  priority: "Priority 1" | "Priority 2" | "Priority 3";
  title: string;
  finding: string;
  impact: "High" | "Medium" | "Low";
  feasibility: "High" | "Medium" | "Low";
  urgency: "High" | "Medium" | "Low";
  confidence: number;
  evidenceRefs: string[];
  assumptions: string[];
}

interface ReportPage {
  pageNumber: 1 | 2;
  title: string;
  sections: Array<{
    label: string;
    content: string;
  }>;
}

export interface ReportPreview {
  caseId: string;
  generatedAt: string;
  classification: "Preview / Confidential";
  title: string;
  scope: {
    organisation: string;
    sector: string;
    workflow: string;
    focus: string;
  };
  summary: string;
  readiness: {
    band: "High" | "Medium" | "Low" | "Validate next";
    statement: string;
    confidence: number;
  };
  keyEvidence: Array<{
    id: string;
    label: string;
    statement: string;
    status: EvidenceStatus;
    confidence: number;
  }>;
  problems: ReportProblem[];
  matrix: Array<{
    problemId: string;
    label: string;
    impact: number;
    feasibility: number;
    confidence: number;
  }>;
  pages: ReportPage[];
  lockedSections: string[];
  disclaimer: string;
}

export type DiscoveryAction = (
  | {
      type: "SET_PROFILE";
      field: keyof Profile;
      value: string;
      source?: AnswerSource;
    }
  | {
      type: "ANSWER_QUESTION";
      questionId: string;
      value: DiscoveryValue;
      source?: AnswerSource;
      confidence?: number;
    }
  | {
      type: "ADD_MESSAGE";
      role: "user" | "agent";
      content: string;
    }
  | {
      type: "MARK_UNKNOWN_AND_ADVANCE";
      questionIds: string[];
      milestone: MilestoneId;
    }
  | {
      type: "APPLY_CHAT_PROPOSAL";
      answers: Array<{
        questionId: string;
        value: DiscoveryValue;
        confidence: number;
      }>;
      observations: Array<{
        questionId: string;
        statement: string;
        confidence: number;
      }>;
    }
  | {
      type: "TRUNCATE_FROM_QUESTION";
      questionId: string;
      milestone: MilestoneId;
    }
  | { type: "SET_MILESTONE"; milestone: MilestoneId }
  | { type: "SET_STATUS"; status: SettableDiscoveryStatus }
  | {
      type: "CONFIRM_LEAD_REQUEST";
      handoffId: string;
      confirmedAt: string;
    }
  | { type: "ADD_WORKFLOW"; name: string; detail?: string }
) & { occurredAt: string };

export type DiscoveryCommand = DiscoveryAction extends infer Action
  ? Action extends DiscoveryAction
    ? Omit<Action, "occurredAt">
    : never
  : never;

const MILESTONES: readonly Milestone[] = [
  {
    id: "context",
    label: "Context",
    index: 1,
    description: "Who you are and which part of the operation we are looking at.",
    estimatedMinutes: 3,
  },
  {
    id: "workflow",
    label: "Workflow",
    index: 2,
    description: "The process as it runs today, start to finish.",
    estimatedMinutes: 4,
  },
  {
    id: "friction",
    label: "Friction",
    index: 3,
    description: "Where the manual work, the exceptions and the waiting are.",
    estimatedMinutes: 3,
  },
  {
    id: "readiness",
    label: "Constraints",
    index: 4,
    description: "Systems, data boundaries and what has to be evidenced.",
    estimatedMinutes: 4,
  },
  {
    id: "review",
    label: "Review",
    index: 5,
    description: "Check what you told us before we analyse it.",
    estimatedMinutes: 1,
  },
];

const SEGMENT_QUESTIONS: readonly DiscoveryQuestion[] = [
  {
    id: "context.organisationType",
    milestone: "context",
    sector: "all",
    prompt: "Which type of organisation do you represent?",
    shortLabel: "Organisation",
    fieldType: "single_select",
    options: [
      { value: "company", label: "Company" },
      { value: "professional-services", label: "Professional services" },
      { value: "healthcare-provider", label: "Healthcare provider" },
      { value: "financial-institution", label: "Financial institution" },
      { value: "public-nonprofit", label: "Public or non-profit" },
    ],
    required: true,
    allowUnknown: false,
  },
  {
    id: "context.sizeBand",
    milestone: "context",
    sector: "all",
    prompt: "Approximately how many people work in the organisation?",
    shortLabel: "Size",
    fieldType: "single_select",
    options: [
      { value: "1-20", label: "1-20" },
      { value: "21-100", label: "21-100" },
      { value: "101-500", label: "101-500" },
      { value: "501-2000", label: "501-2,000" },
      { value: "2000+", label: "2,000+" },
    ],
    required: false,
    allowUnknown: true,
  },
  {
    id: "context.sector",
    milestone: "context",
    sector: "all",
    prompt: "Which area best describes your work?",
    shortLabel: "Sector",
    fieldType: "single_select",
    options: [
      {
        value: "finance",
        label: "Banking",
        description: "Reconciliation, lending, reporting and compliance.",
      },
      {
        value: "insurance",
        label: "Insurance",
        description: "Claims, policies, underwriting and case handling.",
      },
      {
        value: "healthcare",
        label: "Healthcare",
        description: "Intake, administration, billing and operations.",
      },
      {
        value: "other",
        label: "Other",
        description: "A workflow outside the sectors above.",
      },
    ],
    required: true,
    allowUnknown: false,
  },
  {
    id: "context.role",
    milestone: "context",
    sector: "all",
    prompt: "What is your role in this workflow?",
    shortLabel: "Your role",
    fieldType: "single_select",
    options: [
      { value: "executive", label: "Executive or owner" },
      { value: "operations", label: "Operations" },
      { value: "finance-risk", label: "Finance, risk or compliance" },
      { value: "technology", label: "Technology or data" },
      { value: "clinical", label: "Clinical leadership" },
      { value: "other", label: "Other" },
    ],
    required: true,
    allowUnknown: false,
  },
  {
    id: "context.focusArea",
    milestone: "context",
    sector: "all",
    prompt: "Which area should this diagnostic examine first?",
    shortLabel: "Focus area",
    fieldType: "short_text",
    required: true,
    allowUnknown: true,
    placeholder: "e.g. monthly reporting or patient intake",
  },
];

const COMMON_DISCOVERY: readonly DiscoveryQuestion[] = [
  {
    id: "workflow.scope",
    milestone: "workflow",
    sector: "all",
    prompt: "Where does this workflow start, and what marks it as complete?",
    shortLabel: "Start and finish",
    fieldType: "long_text",
    required: true,
    allowUnknown: true,
    placeholder: "Approximate answers are enough. Map one workflow first.",
  },
  {
    id: "workflow.handoffs",
    milestone: "workflow",
    sector: "all",
    prompt: "Which teams or roles touch the work, and where does ownership change?",
    shortLabel: "Handoffs",
    fieldType: "long_text",
    required: false,
    allowUnknown: true,
    placeholder: "List the main owners and approvals",
  },
  {
    id: "friction.repetition",
    milestone: "friction",
    sector: "all",
    prompt: "What is repeated, copied or checked by hand?",
    shortLabel: "Manual work",
    fieldType: "long_text",
    required: true,
    allowUnknown: true,
    placeholder: "Describe recurring work; estimates are fine",
  },
  {
    id: "friction.exceptions",
    milestone: "friction",
    sector: "all",
    prompt: "Which errors, exceptions or delays consume the most attention?",
    shortLabel: "Exceptions",
    fieldType: "long_text",
    required: true,
    allowUnknown: true,
    placeholder: "What breaks, who notices, and what happens next?",
  },
  {
    id: "friction.impact",
    milestone: "friction",
    sector: "all",
    prompt: "What is the operational impact when this goes wrong or runs late?",
    shortLabel: "Impact",
    fieldType: "multi_select",
    options: [
      { value: "time", label: "Team time" },
      { value: "revenue", label: "Revenue or cash flow" },
      { value: "customer", label: "Customer or patient experience" },
      { value: "compliance", label: "Compliance or audit exposure" },
      { value: "decision", label: "Delayed decisions" },
      { value: "quality", label: "Quality or error risk" },
    ],
    required: true,
    allowUnknown: true,
  },
  {
    id: "readiness.systems",
    milestone: "readiness",
    sector: "all",
    prompt: "Which systems currently hold or move this work?",
    shortLabel: "Systems",
    help: "Names or categories are enough. Do not paste credentials or data.",
    fieldType: "long_text",
    required: true,
    allowUnknown: true,
    placeholder: "Email, spreadsheets, ERP, CRM, portals…",
  },
  {
    id: "readiness.constraints",
    milestone: "readiness",
    sector: "all",
    prompt: "Which security, regulatory or operational controls must any change respect?",
    shortLabel: "Controls",
    fieldType: "multi_select",
    options: [
      { value: "personal-data", label: "Personal data" },
      { value: "residency", label: "Data residency" },
      { value: "access", label: "Role-based access" },
      { value: "audit", label: "Audit trail" },
      { value: "retention", label: "Retention or deletion" },
      { value: "human-approval", label: "Human approval" },
      { value: "unknown", label: "Needs review" },
    ],
    required: true,
    allowUnknown: true,
  },
  {
    id: "goal.outcome",
    milestone: "readiness",
    sector: "all",
    prompt: "What would a materially better outcome look like?",
    shortLabel: "Desired outcome",
    fieldType: "long_text",
    required: true,
    allowUnknown: true,
    placeholder: "Faster close, fewer exceptions, clearer traceability…",
  },
  {
    id: "goal.horizon",
    milestone: "readiness",
    sector: "all",
    prompt: "How soon would you act if the evidence supports an intervention?",
    shortLabel: "Horizon",
    fieldType: "single_select",
    options: [
      { value: "now", label: "Now / active priority" },
      { value: "quarter", label: "Within one quarter" },
      { value: "half-year", label: "Within six months" },
      { value: "exploring", label: "Exploring only" },
    ],
    required: false,
    allowUnknown: true,
  },
  {
    id: "goal.investmentPosture",
    milestone: "readiness",
    sector: "all",
    prompt:
      "If the evidence supports a change, what funding position best describes you?",
    shortLabel: "Investment posture",
    help: "A range is not a commitment. It only calibrates realistic solution paths.",
    fieldType: "single_select",
    options: [
      { value: "exploring", label: "Exploring / no budget yet" },
      {
        value: "business-case-required",
        label: "Needs an approved business case",
      },
      { value: "pilot-budget-approved", label: "Pilot budget available" },
      {
        value: "implementation-budget-approved",
        label: "Implementation budget available",
      },
    ],
    required: false,
    allowUnknown: true,
  },
];

const FINANCE_INPUTS: DiscoveryQuestion = {
  id: "workflow.inputs",
  milestone: "workflow",
  sector: "finance",
  prompt: "Which sources feed this finance workflow?",
  shortLabel: "Sources",
  help: "Select every recurring input. Source lineage matters more than volume.",
  fieldType: "multi_select",
  options: [
    { value: "email", label: "Email" },
    { value: "pdf", label: "PDF or reports" },
    { value: "spreadsheet", label: "Spreadsheets" },
    { value: "bank", label: "Bank or payment portals" },
    { value: "erp", label: "ERP or accounting system" },
    { value: "crm", label: "CRM or loan system" },
    { value: "warehouse", label: "Warehouse or database" },
  ],
  required: true,
  allowUnknown: true,
};

const HEALTHCARE_INPUTS: DiscoveryQuestion = {
  id: "workflow.inputs",
  milestone: "workflow",
  sector: "healthcare",
  prompt: "Which sources feed this healthcare operations workflow?",
  shortLabel: "Sources",
  help: "Select categories only. Do not enter patient or clinical records.",
  fieldType: "multi_select",
  options: [
    { value: "messages", label: "Messages or email" },
    { value: "attachments", label: "Attachments or referrals" },
    { value: "forms", label: "Structured forms" },
    { value: "practice-system", label: "Practice or clinical system" },
    { value: "calendar", label: "Scheduling system" },
    { value: "billing", label: "Billing or insurer portal" },
    { value: "back-office", label: "Accounting, HR or attendance" },
  ],
  required: true,
  allowUnknown: true,
};

const INSURANCE_INPUTS: DiscoveryQuestion = {
  id: "workflow.inputs",
  milestone: "workflow",
  sector: "insurance",
  prompt: "Which sources feed this insurance workflow?",
  shortLabel: "Sources",
  help: "Select categories only. Do not enter claim or policy records.",
  fieldType: "multi_select",
  options: [
    { value: "messages", label: "Email or messages" },
    { value: "documents", label: "Documents or PDF" },
    { value: "claims-policy", label: "Claims or policy system" },
    { value: "crm-case", label: "CRM or case system" },
    { value: "spreadsheet", label: "Spreadsheets" },
    { value: "portal", label: "External portals" },
    { value: "warehouse", label: "Database or warehouse" },
  ],
  required: true,
  allowUnknown: true,
};

const OTHER_INPUTS: DiscoveryQuestion = {
  id: "workflow.inputs",
  milestone: "workflow",
  sector: "other",
  prompt: "Which sources feed this workflow?",
  shortLabel: "Sources",
  fieldType: "multi_select",
  options: [
    { value: "email", label: "Email or messages" },
    { value: "documents", label: "Documents or PDF" },
    { value: "spreadsheet", label: "Spreadsheets" },
    { value: "business-system", label: "Business system" },
    { value: "portal", label: "External portal" },
    { value: "database", label: "Database or warehouse" },
    { value: "other", label: "Other" },
  ],
  required: true,
  allowUnknown: true,
};

const SECTOR_QUESTION_PACKS: Record<Segment, readonly DiscoveryQuestion[]> = {
  finance: [FINANCE_INPUTS],
  insurance: [INSURANCE_INPUTS],
  healthcare: [HEALTHCARE_INPUTS],
  other: [OTHER_INPUTS],
};

const PROFILE_FIELD_BY_QUESTION: Record<string, keyof Profile> = {
  "context.organisationType": "organisationType",
  "context.sizeBand": "sizeBand",
  "context.sector": "sector",
  "context.role": "role",
  "context.focusArea": "focusArea",
};

const SEMANTIC_BUCKET_BY_QUESTION: Record<
  string,
  "workflows" | "systems" | "dataAssets" | "painPoints" | "constraints" | "goals"
> = {
  "workflow.scope": "workflows",
  "workflow.handoffs": "workflows",
  "workflow.inputs": "dataAssets",
  "friction.repetition": "painPoints",
  "friction.exceptions": "painPoints",
  "friction.impact": "painPoints",
  "readiness.systems": "systems",
  "readiness.constraints": "constraints",
  "goal.outcome": "goals",
  "goal.horizon": "goals",
  "goal.investmentPosture": "goals",
};

export function calculateJourneyProgress(
  snapshot: DiscoverySnapshot,
  activeQuestionId: string | undefined,
  isReview = false,
): number {
  if (isReview) return 100;

  const journeyQuestionIds = getQuestions(snapshot).map(
    (question) => question.id,
  );
  const activeIndex = activeQuestionId
    ? journeyQuestionIds.indexOf(activeQuestionId)
    : 0;
  const safeIndex = Math.max(0, activeIndex);
  const currentQuestionComplete =
    activeQuestionId &&
    hasCapturedValue(snapshot.answers[activeQuestionId]?.value)
      ? 1
      : 0;
  const completedPosition = safeIndex + currentQuestionComplete;
  const percentage = Math.round(
    (completedPosition / journeyQuestionIds.length) * 100,
  );

  return Math.min(100, Math.max(10, percentage));
}

export function getDiscoveryQuestionIdsFrom(
  questionId: string,
  snapshot: DiscoverySnapshot,
): string[] {
  const journeyQuestionIds = getQuestions(snapshot).map(
    (question) => question.id,
  );
  const boundaryIndex = journeyQuestionIds.indexOf(questionId);
  return boundaryIndex < 0
    ? []
    : journeyQuestionIds.slice(boundaryIndex);
}

export function createInitialSnapshot(
  occurredAt: string = new Date().toISOString(),
): DiscoverySnapshot {
  const createdAt =
    validTimestamp(occurredAt) ?? new Date(0).toISOString();
  return {
    schemaVersion: 2,
    caseId: createCaseId(createdAt),
    status: "segmenting",
    leadRequestStatus: "not_started",
    leadConfirmation: null,
    activeMilestone: "context",
    profile: {
      organisationType: "",
      sizeBand: "",
      sector: "",
      role: "",
      focusArea: "",
    },
    answers: {},
    observations: [],
    messages: [
      {
        id: "msg-0000",
        role: "agent",
        content:
          "Map one workflow, approximately. You can use the fields or describe the situation here; both update the same diagnostic.",
        createdAt,
      },
    ],
    workflows: [],
    systems: [],
    dataAssets: [],
    painPoints: [],
    constraints: [],
    goals: [],
    evidence: [],
    createdAt,
    updatedAt: createdAt,
    revision: 0,
  };
}

export function getQuestions(snapshot: DiscoverySnapshot): DiscoveryQuestion[] {
  const sector = snapshot.profile.sector || "other";
  const workflowQuestions = COMMON_DISCOVERY.filter(
    (question) => question.milestone === "workflow",
  );
  const frictionQuestions = COMMON_DISCOVERY.filter(
    (question) => question.milestone === "friction",
  );
  const constraintQuestions = COMMON_DISCOVERY.filter(
    (question) => question.milestone === "readiness",
  );

  return [
    ...SEGMENT_QUESTIONS,
    ...workflowQuestions,
    ...SECTOR_QUESTION_PACKS[sector],
    ...frictionQuestions,
    ...constraintQuestions,
  ].map(cloneQuestion);
}

export function isValidDiscoveryQuestionValue(
  question: DiscoveryQuestion,
  value: DiscoveryValue,
): boolean {
  if (isUnknownValue(value)) return question.allowUnknown;

  if (question.fieldType === "single_select") {
    return (
      typeof value === "string" &&
      (value.length === 0 ||
        Boolean(question.options?.some((option) => option.value === value)))
    );
  }
  if (question.fieldType === "multi_select") {
    return (
      Array.isArray(value) &&
      value.length <= (question.options?.length ?? 0) &&
      value.every((entry) =>
        question.options?.some((option) => option.value === entry),
      )
    );
  }
  if (question.fieldType === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }
  if (typeof value !== "string") return false;
  const maximumLength =
    question.fieldType === "long_text"
      ? DISCOVERY_LONG_TEXT_MAX_LENGTH
      : DISCOVERY_SHORT_TEXT_MAX_LENGTH;
  return value.length <= maximumLength;
}

export function proposeChatPatches({
  message,
  questions,
  snapshot,
}: {
  message: string;
  questions: DiscoveryQuestion[];
  snapshot: DiscoverySnapshot;
}): ChatEvidencePatch[] {
  const normalized = message.toLocaleLowerCase("en");
  const correctionIntent = /\b(correct|change|update|actually)\b/.test(normalized);
  const explicitEligibleList = questions.length === 1;
  const active = questions.filter(
    (question) =>
      (explicitEligibleList ||
        question.milestone === snapshot.activeMilestone) &&
      (correctionIntent ||
        !hasMeaningfulValue(snapshot.answers[question.id]?.value)),
  );

  const consumedTerms: string[] = [];
  const optionMatches: ChatEvidencePatch[] = active
    .filter((question) => question.options?.length)
    .flatMap((question) => {
      const matches =
        question.options?.filter(
          (option) =>
            normalized.includes(option.value.toLocaleLowerCase("en")) ||
            normalized.includes(option.label.toLocaleLowerCase("en")),
        ) ?? [];
      if (matches.length === 0) return [];
      for (const match of matches) {
        const label = match.label.toLocaleLowerCase("en");
        consumedTerms.push(normalized.includes(label) ? match.label : match.value);
      }
      return [
        {
          kind: "answer" as const,
          questionId: question.id,
          value:
            question.fieldType === "multi_select"
              ? matches.map((option) => option.value)
              : matches[0].value,
          confidence: 0.82,
          sourceExcerpt: matches.map((option) => option.label).join(", "),
        },
      ];
    });

  const textCandidates = active.filter(
    (question) =>
      question.fieldType === "short_text" ||
      question.fieldType === "long_text",
  );
  const textQuestion = correctionIntent
    ? textCandidates.find(
        (question) =>
          normalized.includes(question.shortLabel.toLocaleLowerCase("en")) ||
          normalized.includes(question.id.split(".").at(-1) ?? ""),
      )
    : textCandidates[0];
  const proposedValue =
    correctionIntent && message.includes(":")
      ? message.slice(message.indexOf(":") + 1).trim()
      : message.trim();

  if (optionMatches.length === 0) {
    const target = textQuestion ?? active[0];
    if (!target || proposedValue.length < 4) return [];
    const hasExistingAnswer = hasMeaningfulValue(
      snapshot.answers[target.id]?.value,
    );
    return [
      {
        kind: hasExistingAnswer ? "observation" : "answer",
        questionId: target.id,
        value: proposedValue,
        confidence: hasExistingAnswer ? 0.62 : 0.68,
        sourceExcerpt: proposedValue,
      },
    ];
  }

  let residual = message;
  for (const term of consumedTerms.sort(
    (left, right) => right.length - left.length,
  )) {
    residual = residual.replace(new RegExp(escapeRegExp(term), "gi"), " ");
  }
  residual = residual
    .replace(/[.,;:!?()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const meaningfulResidual = residual
    .replace(
      /\b(and|or|the|a|an|we|our|is|are|use|uses|using|with|in|of|to)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  const observationTarget = textQuestion ?? active[0];
  if (observationTarget && meaningfulResidual.length >= 4) {
    optionMatches.push({
      kind: "observation",
      questionId: observationTarget.id,
      value: residual,
      confidence: 0.64,
      sourceExcerpt: residual,
    });
  }

  return optionMatches;
}

export function getMilestones(): Milestone[] {
  return MILESTONES.map((milestone) => ({ ...milestone }));
}

export function calculateCoverage(snapshot: DiscoverySnapshot): Coverage {
  const questions = getQuestions(snapshot);
  const requiredQuestions = questions.filter((question) => question.required);
  const answered = requiredQuestions.filter((question) =>
    hasCapturedValue(snapshot.answers[question.id]?.value),
  ).length;
  const knownCoreSignals = requiredQuestions.filter((question) =>
    hasMeaningfulValue(snapshot.answers[question.id]?.value),
  ).length;
  const validationSignals = requiredQuestions.filter((question) =>
    isUnknownValue(snapshot.answers[question.id]?.value),
  ).length;
  const total = requiredQuestions.length;
  const percentage = total === 0 ? 0 : Math.round((answered / total) * 100);

  const milestoneCompletion = MILESTONES.map((milestone) => {
    if (milestone.id === "review") {
      return questions
        .filter((question) => question.required)
        .every((question) => hasCapturedValue(snapshot.answers[question.id]?.value));
    }
    const required = questions.filter(
      (question) => question.milestone === milestone.id && question.required,
    );
    return (
      required.length > 0 &&
      required.every((question) => hasCapturedValue(snapshot.answers[question.id]?.value))
    );
  });
  const completedMilestones = milestoneCompletion.filter(Boolean).length;
  const activeIndex = MILESTONES.findIndex(
    (milestone) => milestone.id === snapshot.activeMilestone,
  );
  const estimatedMinutesRemaining = MILESTONES.slice(Math.max(0, activeIndex)).reduce(
    (totalMinutes, milestone, relativeIndex) =>
      totalMinutes +
      (relativeIndex === 0 && milestoneCompletion[activeIndex]
        ? 0
        : milestone.estimatedMinutes),
    0,
  );

  return {
    answered,
    total,
    percentage: clamp(percentage, 0, 100),
    completedMilestones,
    totalMilestones: MILESTONES.length,
    currentMilestone: snapshot.activeMilestone,
    estimatedMinutesRemaining,
    knownCoreSignals,
    validationSignals,
    readyForPreview: requiredQuestions.every((question) =>
      hasCapturedValue(snapshot.answers[question.id]?.value),
    ),
  };
}

export function discoveryReducer(
  snapshot: DiscoverySnapshot,
  action: DiscoveryAction,
): DiscoverySnapshot {
  if (snapshot.revision >= DISCOVERY_MAX_REVISION) return snapshot;
  const nextRevision = snapshot.revision + 1;
  const updatedAt = validTimestamp(action.occurredAt);
  if (!updatedAt) return snapshot;

  switch (action.type) {
    case "SET_PROFILE": {
      const questionId = Object.entries(PROFILE_FIELD_BY_QUESTION).find(
        ([, field]) => field === action.field,
      )?.[0];
      if (!questionId) return snapshot;
      return applyAnswer(
        snapshot,
        questionId,
        action.value,
        action.source ?? "form",
        action.source === "chat" ? 0.74 : 0.9,
        nextRevision,
        updatedAt,
      );
    }
    case "ANSWER_QUESTION":
      return applyAnswer(
        snapshot,
        action.questionId,
        action.value,
        action.source ?? "form",
        action.confidence ?? (action.source === "chat" ? 0.74 : 0.9),
        nextRevision,
        updatedAt,
      );
    case "ADD_MESSAGE":
      if (
        !action.content.trim() ||
        action.content.trim().length > DISCOVERY_MESSAGE_MAX_LENGTH
      ) {
        return snapshot;
      }
      return {
        ...snapshot,
        messages: [
          ...snapshot.messages.slice(-(DISCOVERY_MAX_MESSAGES - 1)),
          {
            id: messageId(nextRevision, action.role),
            role: action.role,
            content: action.content.trim(),
            createdAt: updatedAt,
          },
        ],
        revision: nextRevision,
        updatedAt,
      };
    case "APPLY_CHAT_PROPOSAL": {
      let next = snapshot;
      for (const answer of action.answers) {
        next = applyAnswer(
          next,
          answer.questionId,
          answer.value,
          "chat",
          answer.confidence,
          nextRevision,
          updatedAt,
        );
      }
      const observations = action.observations
        .map((observation, index): DiscoveryObservation | null => {
          const statement = observation.statement.trim();
          if (
            !statement ||
            statement.length > DISCOVERY_LONG_TEXT_MAX_LENGTH ||
            !Number.isFinite(observation.confidence) ||
            !getQuestions(next).some(
              (question) => question.id === observation.questionId,
            )
          ) {
            return null;
          }
          return {
            id: `observation-${nextRevision}-${index + 1}`,
            questionId: observation.questionId,
            statement,
            source: "chat",
            status: "reported",
            confidence: roundConfidence(observation.confidence),
            createdAt: updatedAt,
          };
        })
        .filter(
          (observation): observation is DiscoveryObservation =>
            observation !== null,
        );
      return deriveSemanticState({
        ...next,
        observations: [...next.observations, ...observations].slice(
          -DISCOVERY_MAX_OBSERVATIONS,
        ),
        revision: nextRevision,
        updatedAt,
      });
    }
    case "TRUNCATE_FROM_QUESTION": {
      const clearedQuestionIds = new Set(
        getDiscoveryQuestionIdsFrom(action.questionId, snapshot),
      );
      if (clearedQuestionIds.size === 0) return snapshot;

      const answers = Object.fromEntries(
        Object.entries(snapshot.answers).filter(
          ([questionId]) => !clearedQuestionIds.has(questionId),
        ),
      );
      const profile: Profile = {
        organisationType: valueToText(
          answers["context.organisationType"]?.value ?? null,
        ),
        sizeBand: valueToText(answers["context.sizeBand"]?.value ?? null),
        sector: normalizeSegment(answers["context.sector"]?.value ?? null),
        role: valueToText(answers["context.role"]?.value ?? null),
        focusArea: valueToText(answers["context.focusArea"]?.value ?? null),
      };
      const clearsWorkflowState = clearedQuestionIds.has("workflow.scope");

      return deriveSemanticState({
        ...snapshot,
        status: statusForMilestone(action.milestone),
        activeMilestone: action.milestone,
        leadRequestStatus: "not_started",
        leadConfirmation: null,
        profile,
        answers,
        observations: snapshot.observations.filter(
          (observation) => !clearedQuestionIds.has(observation.questionId),
        ),
        workflows: clearsWorkflowState
          ? snapshot.workflows.filter(
              (fact) => !fact.id.startsWith("workflow-manual-"),
            )
          : snapshot.workflows,
        revision: nextRevision,
        updatedAt,
      });
    }
    case "MARK_UNKNOWN_AND_ADVANCE": {
      let next = snapshot;
      for (const questionId of action.questionIds) {
        next = applyAnswer(
          next,
          questionId,
          "Unknown / validate next",
          "form",
          0.35,
          nextRevision,
          updatedAt,
        );
      }
      return {
        ...next,
        activeMilestone: action.milestone,
        status: statusForMilestone(action.milestone),
        revision: nextRevision,
        updatedAt,
      };
    }
    case "SET_MILESTONE":
      return {
        ...snapshot,
        activeMilestone: action.milestone,
        status: statusForMilestone(action.milestone),
        revision: nextRevision,
        updatedAt,
      };
    case "SET_STATUS":
      if (
        action.status !== "analyzing" &&
        action.status !== "preview_ready"
      ) {
        return snapshot;
      }
      return {
        ...snapshot,
        status: action.status,
        revision: nextRevision,
        updatedAt,
      };
    case "CONFIRM_LEAD_REQUEST": {
      const confirmedAt = validTimestamp(action.confirmedAt);
      const handoffId =
        typeof action.handoffId === "string" ? action.handoffId.trim() : "";
      if (
        !confirmedAt ||
        !handoffId ||
        handoffId.length > DISCOVERY_MAX_IDENTIFIER_LENGTH
      ) {
        return snapshot;
      }
      return {
        ...snapshot,
        status: "lead_submitted",
        leadRequestStatus: "confirmed",
        leadConfirmation: {
          handoffId,
          confirmedAt,
        },
        revision: nextRevision,
        updatedAt,
      };
    }
    case "ADD_WORKFLOW": {
      const manualWorkflows = snapshot.workflows.filter((fact) =>
        fact.id.startsWith("workflow-manual-"),
      );
      if (manualWorkflows.length >= DISCOVERY_MAX_MANUAL_WORKFLOWS) {
        return snapshot;
      }
      const fact: DiscoveryFact = {
        id: `workflow-manual-${nextRevision}`,
        label:
          action.name.trim().slice(0, DISCOVERY_SHORT_TEXT_MAX_LENGTH) ||
          "Additional workflow",
        detail:
          action.detail?.trim().slice(0, DISCOVERY_LONG_TEXT_MAX_LENGTH) ||
          "Scope to be confirmed.",
        evidenceRefs: [],
        status: "reported",
        confidence: 0.7,
      };
      return deriveSemanticState({
        ...snapshot,
        workflows: [...manualWorkflows, fact],
        revision: nextRevision,
        updatedAt,
      });
    }
  }
}

function statusForMilestone(milestone: MilestoneId): DiscoveryStatus {
  if (milestone === "context") return "segmenting";
  if (milestone === "review") return "review";
  return "discovering";
}

export function buildReportPreview(snapshot: DiscoverySnapshot): ReportPreview {
  const sector = snapshot.profile.sector || "other";
  const focus =
    snapshot.profile.focusArea ||
    answerText(snapshot, "workflow.scope") ||
    "Workflow to be confirmed";
  const problems = buildProblems(snapshot);
  const readiness = buildReadiness(snapshot);
  const reportEvidence = snapshot.evidence.filter(
    (item) => !item.questionId.startsWith("context."),
  );
  const keyEvidence = reportEvidence
    .slice(0, 6)
    .map((item) => ({
      id: item.id,
      label: item.label,
      statement: item.statement,
      status: item.status,
      confidence: item.confidence,
    }));
  const organisation =
    labelForOption("context.organisationType", snapshot.profile.organisationType, snapshot) ||
    "Organisation not specified";
  const sectorLabel = sector === "finance" ? "Banking" : titleCase(sector);
  const summary = buildSummary(snapshot, problems, sectorLabel, focus);
  const generatedAt = snapshot.updatedAt;

  return {
    caseId: snapshot.caseId,
    generatedAt,
    classification: "Preview / Confidential",
    title: `Operational intelligence scan: ${focus}`,
    scope: {
      organisation,
      sector: sectorLabel,
      workflow: answerText(snapshot, "workflow.scope") || "Boundary requires confirmation.",
      focus,
    },
    summary,
    readiness,
    keyEvidence,
    problems,
    matrix: problems.map((problem) => ({
      problemId: problem.id,
      label: problem.priority,
      impact: bandScore(problem.impact),
      feasibility: bandScore(problem.feasibility),
      confidence: problem.confidence,
    })),
    pages: [
      {
        pageNumber: 1,
        title: "Where the operation loses signal",
        sections: [
          { label: "Situation", content: summary },
          {
            label: "Scope",
            content: `${sectorLabel} · ${organisation} · ${focus}`,
          },
          {
            label: "Readiness",
            content: `${readiness.band}: ${readiness.statement}`,
          },
          {
            label: "Evidence basis",
            content:
              keyEvidence.length > 0
                ? `${keyEvidence.length} reported signals captured. Conclusions remain unverified until source review.`
                : "No operational evidence has been captured yet. Complete the workflow and friction stages.",
          },
        ],
      },
      {
        pageNumber: 2,
        title: "Three areas to validate first",
        sections: problems.map((problem) => ({
          label: `${problem.priority} · ${problem.impact} impact / ${problem.feasibility} feasibility`,
          content: `${problem.title}. ${problem.finding}`,
        })),
      },
    ],
    lockedSections: [
      "What AI could take over",
      "Constraints",
      "Sequence",
      "What this analysis cannot tell you",
    ],
    disclaimer:
      "This preview is an evidence-led diagnostic, not an offer. Findings are inferred from reported answers and require validation. Estimates are indicative and do not constitute an offer.",
  };
}

function cloneQuestion(question: DiscoveryQuestion): DiscoveryQuestion {
  return {
    ...question,
    options: question.options?.map((option) => ({ ...option })),
  };
}

function applyAnswer(
  snapshot: DiscoverySnapshot,
  questionId: string,
  value: DiscoveryValue,
  source: AnswerSource,
  confidence: number,
  revision: number,
  updatedAt: string,
): DiscoverySnapshot {
  const question = getQuestions(snapshot).find(
    (candidate) => candidate.id === questionId,
  );
  const normalizedValue = normalizeValue(value);
  if (
    !question ||
    !isValidDiscoveryQuestionValue(question, normalizedValue) ||
    !Number.isFinite(confidence)
  ) {
    return snapshot;
  }

  const answer: DiscoveryAnswer = {
    questionId,
    value: normalizedValue,
    source,
    status: "reported",
    confidence: roundConfidence(confidence),
    updatedAt,
  };
  const sectorChanged =
    questionId === "context.sector" &&
    normalizeSegment(normalizedValue) !== snapshot.profile.sector;
  const answers = { ...snapshot.answers };
  let observations = snapshot.observations;
  if (sectorChanged) {
    const sectorQuestionIds = new Set(
      Object.values(SECTOR_QUESTION_PACKS)
        .flat()
        .map((sectorQuestion) => sectorQuestion.id),
    );
    for (const sectorQuestionId of sectorQuestionIds) {
      delete answers[sectorQuestionId];
    }
    observations = observations.filter(
      (observation) => !sectorQuestionIds.has(observation.questionId),
    );
  }
  answers[questionId] = answer;
  const profileField = PROFILE_FIELD_BY_QUESTION[questionId];
  const profile = profileField
    ? {
        ...snapshot.profile,
        [profileField]:
          profileField === "sector"
            ? normalizeSegment(normalizedValue)
            : valueToText(normalizedValue),
      }
    : snapshot.profile;
  const status =
    snapshot.status === "segmenting" && profile.sector
      ? "discovering"
      : snapshot.status;

  return deriveSemanticState({
    ...snapshot,
    answers,
    observations,
    profile,
    status,
    revision,
    updatedAt,
  });
}

function deriveSemanticState(snapshot: DiscoverySnapshot): DiscoverySnapshot {
  const derived: Pick<
    DiscoverySnapshot,
    "workflows" | "systems" | "dataAssets" | "painPoints" | "constraints" | "goals"
  > = {
    workflows: snapshot.workflows.filter((fact) => fact.id.startsWith("workflow-manual-")),
    systems: [],
    dataAssets: [],
    painPoints: [],
    constraints: [],
    goals: [],
  };

  const evidence: DiscoveryEvidence[] = [];
  const questions = getQuestions(snapshot);

  for (const question of questions) {
    const answer = snapshot.answers[question.id];
    if (!answer || !hasMeaningfulValue(answer.value)) continue;
    const statement = humanizeValue(answer.value, question);
    const evidenceId = `ev-${stableHash(`${question.id}:${statement}`)}`;
    evidence.push({
      id: evidenceId,
      label: question.shortLabel,
      statement,
      questionId: question.id,
      source: answer.source,
      status: answer.status,
      confidence: answer.confidence,
    });

    const bucket = SEMANTIC_BUCKET_BY_QUESTION[question.id];
    if (!bucket) continue;
    derived[bucket].push({
      id: `fact-${stableHash(question.id)}`,
      label: question.shortLabel,
      detail: statement,
      evidenceRefs: [evidenceId],
      status: answer.status,
      confidence: answer.confidence,
    });
  }

  for (const observation of snapshot.observations) {
    const question = questions.find(
      (candidate) => candidate.id === observation.questionId,
    );
    if (!question) continue;
    const evidenceId = `ev-${stableHash(`${observation.id}:${observation.statement}`)}`;
    evidence.push({
      id: evidenceId,
      label: `${question.shortLabel} / additional context`,
      statement: observation.statement,
      questionId: observation.questionId,
      source: "chat",
      status: "reported",
      confidence: observation.confidence,
    });

    const bucket = SEMANTIC_BUCKET_BY_QUESTION[observation.questionId];
    if (!bucket) continue;
    derived[bucket].push({
      id: `fact-${stableHash(observation.id)}`,
      label: `${question.shortLabel} / additional context`,
      detail: observation.statement,
      evidenceRefs: [evidenceId],
      status: "reported",
      confidence: observation.confidence,
    });
  }

  return {
    ...snapshot,
    ...derived,
    evidence,
  };
}

function buildProblems(snapshot: DiscoverySnapshot): ReportProblem[] {
  const repetition = answerText(snapshot, "friction.repetition");
  const exceptions = answerText(snapshot, "friction.exceptions");
  const systems = answerText(snapshot, "readiness.systems");
  const inputs = answerText(snapshot, "workflow.inputs");
  const constraints = answerText(snapshot, "readiness.constraints");
  const impacts = answerArray(snapshot, "friction.impact");
  const urgencyAnswer = answerText(snapshot, "goal.horizon");
  const feasibility = scoreFeasibility(systems, constraints);
  const urgency: ReportProblem["urgency"] =
    urgencyAnswer === "now"
      ? "High"
      : urgencyAnswer === "quarter"
        ? "Medium"
        : "Low";
  const impact: ReportProblem["impact"] =
    impacts.length >= 3 ||
    impacts.includes("compliance") ||
    impacts.includes("revenue")
      ? "High"
      : impacts.length > 0
        ? "Medium"
        : "Low";

  const candidates: Array<Omit<ReportProblem, "priority"> & { rawPriority: number }> = [
    {
      id: "problem-manual-work",
      title: repetition ? "Manual work obscures the true process" : "Manual effort is not quantified",
      finding: repetition
        ? `${sentence(repetition)} The frequency, ownership and control points should be verified before intervention.`
        : "The diagnostic does not yet show which repeated steps consume capacity. Quantify one recurring task next.",
      impact,
      feasibility,
      urgency,
      confidence: evidenceConfidence(snapshot, ["friction.repetition", "friction.impact"]),
      evidenceRefs: evidenceRefs(snapshot, ["friction.repetition", "friction.impact"]),
      assumptions: repetition
        ? ["Reported effort has not been compared with system logs or time records."]
        : ["Manual effort is currently an open question."],
      rawPriority:
        0.5 * bandScore(impact) + 0.3 * bandScore(feasibility) + 0.2 * bandScore(urgency),
    },
    {
      id: "problem-exceptions",
      title: exceptions ? "Exceptions operate outside a visible control loop" : "Exception paths are unclear",
      finding: exceptions
        ? `${sentence(exceptions)} Confirm where exceptions are logged, assigned and approved.`
        : "Failure modes and escalation paths have not been described. This limits any reliable automation decision.",
      impact,
      feasibility: systems ? feasibility : "Low",
      urgency,
      confidence: evidenceConfidence(snapshot, ["friction.exceptions", "readiness.systems"]),
      evidenceRefs: evidenceRefs(snapshot, ["friction.exceptions", "readiness.systems"]),
      assumptions: exceptions
        ? ["Exception volume and resolution time are reported, not measured."]
        : ["No exception evidence has been supplied."],
      rawPriority:
        0.5 * bandScore(impact) +
        0.3 * bandScore(systems ? feasibility : "Low") +
        0.2 * bandScore(urgency),
    },
    {
      id: "problem-fragmentation",
      title:
        inputs || systems
          ? "Source-to-output lineage crosses fragmented systems"
          : "System and source lineage is missing",
      finding:
        inputs || systems
          ? `Reported sources include ${withoutTerminalPunctuation(inputs) || "sources not yet enumerated"}; the operating environment includes ${withoutTerminalPunctuation(systems) || "systems not yet enumerated"}. Validate identifiers, access paths and the authoritative record.`
          : "The diagnostic cannot yet trace inputs to outputs. Record the systems and source categories before solution design.",
      impact: impacts.includes("compliance") || impacts.includes("decision") ? "High" : "Medium",
      feasibility,
      urgency,
      confidence: evidenceConfidence(snapshot, ["workflow.inputs", "readiness.systems"]),
      evidenceRefs: evidenceRefs(snapshot, ["workflow.inputs", "readiness.systems"]),
      assumptions: ["Integration access and data quality have not been technically tested."],
      rawPriority:
        0.5 *
          bandScore(
            impacts.includes("compliance") || impacts.includes("decision") ? "High" : "Medium",
          ) +
        0.3 * bandScore(feasibility) +
        0.2 * bandScore(urgency),
    },
  ];

  return candidates
    .sort((a, b) => b.rawPriority - a.rawPriority || a.id.localeCompare(b.id))
    .map(({ rawPriority, ...problem }, index) => {
      void rawPriority;
      return {
        ...problem,
        priority: `Priority ${index + 1}` as ReportProblem["priority"],
      };
    });
}

function buildReadiness(snapshot: DiscoverySnapshot): ReportPreview["readiness"] {
  const systems = answerText(snapshot, "readiness.systems");
  const inputs = answerArray(snapshot, "workflow.inputs");
  const constraints = answerArray(snapshot, "readiness.constraints");
  const dataConfidence = evidenceConfidence(snapshot, [
    "workflow.inputs",
    "readiness.systems",
    "readiness.constraints",
  ]);

  if (!systems || inputs.length === 0) {
    return {
      band: "Validate next",
      statement:
        "Source systems or inputs are incomplete. Establish data ownership and access before estimating implementation.",
      confidence: dataConfidence,
    };
  }

  if (constraints.includes("unknown")) {
    return {
      band: "Low",
      statement:
        "Operational sources are visible, but security and regulatory controls require review.",
      confidence: dataConfidence,
    };
  }

  if (constraints.length >= 2) {
    return {
      band: "Medium",
      statement:
        "The workflow has identifiable sources and explicit controls; access and data quality still require technical validation.",
      confidence: dataConfidence,
    };
  }

  return {
    band: "High",
    statement:
      "The workflow has identifiable sources and no reported blocking control. This is not yet a technical integration assessment.",
    confidence: dataConfidence,
  };
}

function buildSummary(
  snapshot: DiscoverySnapshot,
  problems: ReportProblem[],
  sectorLabel: string,
  focus: string,
): string {
  const scope = answerText(snapshot, "workflow.scope");
  const outcome = answerText(snapshot, "goal.outcome");
  const lead = `This ${sectorLabel.toLocaleLowerCase("en")} diagnostic examines the workflow around ${withoutTerminalPunctuation(focus).toLocaleLowerCase("en")}.`;
  const scopeStatement = scope
    ? sentence(scope)
    : "The workflow boundary still requires confirmation.";
  const finding =
    problems[0]?.finding ??
    "The evidence base is not yet sufficient to identify a priority operational fracture.";
  const target = outcome
    ? `The desired outcome was reported as: ${sentence(outcome)}`
    : "The desired outcome still requires confirmation.";
  return `${lead} ${scopeStatement} ${finding} ${target}`.trim();
}

function evidenceConfidence(snapshot: DiscoverySnapshot, questionIds: string[]): number {
  const answers = questionIds
    .map((questionId) => snapshot.answers[questionId])
    .filter((answer): answer is DiscoveryAnswer => Boolean(answer));
  if (answers.length === 0) return 0.28;
  const evidenceRatio = answers.length / questionIds.length;
  const average =
    answers.reduce((sum, answer) => sum + answer.confidence, 0) / answers.length;
  return roundConfidence(average * (0.65 + 0.35 * evidenceRatio));
}

function evidenceRefs(snapshot: DiscoverySnapshot, questionIds: string[]): string[] {
  return snapshot.evidence
    .filter((item) => questionIds.includes(item.questionId))
    .map((item) => item.id);
}

function scoreFeasibility(
  systems: string,
  constraints: string,
): ReportProblem["feasibility"] {
  if (!systems) return "Low";
  if (/unknown|needs review/i.test(constraints)) return "Low";
  if (/api|database|warehouse|erp|crm|structured|system/i.test(systems)) return "High";
  return "Medium";
}

function answerText(snapshot: DiscoverySnapshot, questionId: string): string {
  const value = valueToText(snapshot.answers[questionId]?.value ?? null);
  const structured = isUnknownValue(value) ? "" : value;
  const observations = snapshot.observations
    .filter((observation) => observation.questionId === questionId)
    .map((observation) => observation.statement.trim())
    .filter(Boolean);
  const combined = [structured, ...observations].filter(Boolean).join(" ");
  return combined.length > 360
    ? `${combined.slice(0, 357).trimEnd()}…`
    : combined;
}

function answerArray(snapshot: DiscoverySnapshot, questionId: string): string[] {
  const value = snapshot.answers[questionId]?.value;
  if (Array.isArray(value)) return value.filter((item) => !isUnknownValue(item));
  return typeof value === "string" && value && !isUnknownValue(value) ? [value] : [];
}

function humanizeValue(value: DiscoveryValue, question: DiscoveryQuestion): string {
  if (Array.isArray(value)) {
    return value
      .map((entry) => labelForQuestionOption(question, entry) || titleCase(entry))
      .join(", ");
  }
  if (typeof value === "string") {
    return labelForQuestionOption(question, value) || value;
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return "Unknown";
}

function labelForOption(
  questionId: string,
  value: string,
  snapshot: DiscoverySnapshot,
): string {
  const question = getQuestions(snapshot).find((item) => item.id === questionId);
  return question ? (labelForQuestionOption(question, value) ?? value) : value;
}

function labelForQuestionOption(
  question: DiscoveryQuestion,
  value: string,
): string | undefined {
  return question.options?.find((option) => option.value === value)?.label;
}

function normalizeValue(value: DiscoveryValue): DiscoveryValue {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => item.trim()).filter(Boolean))].sort();
  }
  return value;
}

function isNormalizedDiscoveryValue(value: DiscoveryValue): boolean {
  const normalized = normalizeValue(value);
  if (Array.isArray(value) && Array.isArray(normalized)) {
    return (
      value.length === normalized.length &&
      value.every((entry, index) => entry === normalized[index])
    );
  }
  return value === normalized;
}

function normalizeSegment(value: DiscoveryValue): Segment | "" {
  const text = valueToText(value);
  return text === "finance" ||
    text === "insurance" ||
    text === "healthcare" ||
    text === "other"
    ? text
    : "";
}

function valueToText(value: DiscoveryValue): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null) return "";
  return String(value).trim();
}

function hasMeaningfulValue(value: DiscoveryValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string")
    return value.trim().length > 0 && !isUnknownValue(value);
  return true;
}

function hasCapturedValue(value: DiscoveryValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function isUnknownValue(value: DiscoveryValue | undefined): boolean {
  return typeof value === "string" && value.trim() === "Unknown / validate next";
}

export function isDiscoverySnapshot(value: unknown): value is DiscoverySnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DiscoverySnapshot>;
  const profile = candidate.profile as Partial<Profile> | undefined;
  const answers = candidate.answers as
    | Record<string, Partial<DiscoveryAnswer>>
    | undefined;
  const milestones: MilestoneId[] = [
    "context",
    "workflow",
    "friction",
    "readiness",
    "review",
  ];
  const statuses: DiscoveryStatus[] = [
    "segmenting",
    "discovering",
    "review",
    "analyzing",
    "preview_ready",
    "lead_submitted",
  ];
  if (
    !hasOnlyKeys(candidate, [
      "schemaVersion",
      "caseId",
      "status",
      "leadRequestStatus",
      "leadConfirmation",
      "activeMilestone",
      "profile",
      "answers",
      "observations",
      "messages",
      "workflows",
      "systems",
      "dataAssets",
      "painPoints",
      "constraints",
      "goals",
      "evidence",
      "createdAt",
      "updatedAt",
      "revision",
    ]) ||
    !profile ||
    !hasOnlyKeys(profile, [
      "organisationType",
      "sizeBand",
      "sector",
      "role",
      "focusArea",
    ]) ||
    typeof profile.organisationType !== "string" ||
    typeof profile.sizeBand !== "string" ||
    (profile.sector !== "" &&
      profile.sector !== "finance" &&
      profile.sector !== "insurance" &&
      profile.sector !== "healthcare" &&
      profile.sector !== "other") ||
    typeof profile.role !== "string" ||
    typeof profile.focusArea !== "string"
  ) {
    return false;
  }

  const snapshot = candidate as DiscoverySnapshot;
  const questions = getQuestions(snapshot);
  const questionById = new Map(
    questions.map((question) => [question.id, question]),
  );
  const validAnswers =
    isRecord(answers) &&
    Object.keys(answers).length <= questions.length &&
    Object.entries(answers ?? {}).every(
      ([questionId, answer]) =>
        Boolean(answer) &&
        hasOnlyKeys(answer, [
          "questionId",
          "value",
          "source",
          "status",
          "confidence",
          "updatedAt",
        ]) &&
        answer.questionId === questionId &&
        isDiscoveryValue(answer.value) &&
        isNormalizedDiscoveryValue(answer.value) &&
        Boolean(questionById.get(questionId)) &&
        isValidDiscoveryQuestionValue(
          questionById.get(questionId) as DiscoveryQuestion,
          answer.value,
        ) &&
        (answer.source === "form" || answer.source === "chat") &&
        answer.status === "reported" &&
        isConfidence(answer.confidence) &&
        roundConfidence(answer.confidence) === answer.confidence &&
        Boolean(validTimestamp(answer.updatedAt)),
    );
  const validMessages =
    Array.isArray(candidate.messages) &&
    candidate.messages.length <= DISCOVERY_MAX_MESSAGES &&
    hasUniqueIds(candidate.messages) &&
    candidate.messages.every(
      (message) =>
        Boolean(message) &&
        typeof message === "object" &&
        hasOnlyKeys(message, ["id", "role", "content", "createdAt"]) &&
        typeof (message as DiscoveryMessage).id === "string" &&
        isBoundedText(
          (message as DiscoveryMessage).id,
          1,
          DISCOVERY_MAX_IDENTIFIER_LENGTH,
        ) &&
        ((message as DiscoveryMessage).role === "user" ||
          (message as DiscoveryMessage).role === "agent") &&
        typeof (message as DiscoveryMessage).content === "string" &&
        isBoundedText(
          (message as DiscoveryMessage).content,
          1,
          DISCOVERY_MESSAGE_MAX_LENGTH,
        ) &&
        (message as DiscoveryMessage).content ===
          (message as DiscoveryMessage).content.trim() &&
        Boolean(validTimestamp((message as DiscoveryMessage).createdAt)),
    );
  const validEvidence =
    Array.isArray(candidate.evidence) &&
    candidate.evidence.length <= DISCOVERY_MAX_DERIVED_ITEMS &&
    hasUniqueIds(candidate.evidence) &&
    candidate.evidence.every(
      (item) =>
        Boolean(item) &&
        typeof item === "object" &&
        hasOnlyKeys(item, [
          "id",
          "label",
          "statement",
          "questionId",
          "source",
          "status",
          "confidence",
        ]) &&
        typeof (item as DiscoveryEvidence).id === "string" &&
        isBoundedText(
          (item as DiscoveryEvidence).id,
          1,
          DISCOVERY_MAX_IDENTIFIER_LENGTH,
        ) &&
        typeof (item as DiscoveryEvidence).label === "string" &&
        isBoundedText(
          (item as DiscoveryEvidence).label,
          1,
          DISCOVERY_SHORT_TEXT_MAX_LENGTH,
        ) &&
        typeof (item as DiscoveryEvidence).statement === "string" &&
        isBoundedText(
          (item as DiscoveryEvidence).statement,
          1,
          DISCOVERY_LONG_TEXT_MAX_LENGTH,
        ) &&
        typeof (item as DiscoveryEvidence).questionId === "string" &&
        questionById.has((item as DiscoveryEvidence).questionId) &&
        ((item as DiscoveryEvidence).source === "form" ||
          (item as DiscoveryEvidence).source === "chat") &&
        (item as DiscoveryEvidence).status === "reported" &&
        isConfidence((item as DiscoveryEvidence).confidence) &&
        roundConfidence((item as DiscoveryEvidence).confidence) ===
          (item as DiscoveryEvidence).confidence,
    );
  const validObservations =
    Array.isArray(candidate.observations) &&
    candidate.observations.length <= DISCOVERY_MAX_OBSERVATIONS &&
    hasUniqueIds(candidate.observations) &&
    candidate.observations.every(
      (item) =>
        Boolean(item) &&
        typeof item === "object" &&
        hasOnlyKeys(item, [
          "id",
          "questionId",
          "statement",
          "source",
          "status",
          "confidence",
          "createdAt",
        ]) &&
        typeof (item as DiscoveryObservation).id === "string" &&
        isBoundedText(
          (item as DiscoveryObservation).id,
          1,
          DISCOVERY_MAX_IDENTIFIER_LENGTH,
        ) &&
        typeof (item as DiscoveryObservation).questionId === "string" &&
        questionById.has((item as DiscoveryObservation).questionId) &&
        typeof (item as DiscoveryObservation).statement === "string" &&
        isBoundedText(
          (item as DiscoveryObservation).statement,
          1,
          DISCOVERY_LONG_TEXT_MAX_LENGTH,
        ) &&
        (item as DiscoveryObservation).statement ===
          (item as DiscoveryObservation).statement.trim() &&
        (item as DiscoveryObservation).source === "chat" &&
        (item as DiscoveryObservation).status === "reported" &&
        isConfidence((item as DiscoveryObservation).confidence) &&
        roundConfidence((item as DiscoveryObservation).confidence) ===
          (item as DiscoveryObservation).confidence &&
        Boolean(validTimestamp((item as DiscoveryObservation).createdAt)),
    );
  const validLeadConfirmation =
    candidate.leadConfirmation === null ||
    (candidate.leadConfirmation !== undefined &&
      hasOnlyKeys(candidate.leadConfirmation, ["handoffId", "confirmedAt"]) &&
      typeof candidate.leadConfirmation?.handoffId === "string" &&
      isBoundedText(
        candidate.leadConfirmation.handoffId,
        1,
        DISCOVERY_MAX_IDENTIFIER_LENGTH,
      ) &&
      Boolean(validTimestamp(candidate.leadConfirmation.confirmedAt)));
  const validBase =
    candidate.schemaVersion === 2 &&
    typeof candidate.caseId === "string" &&
    /^SIG-[A-Z0-9]{6}$/.test(candidate.caseId) &&
    typeof profile?.organisationType === "string" &&
    profile.organisationType.length <= DISCOVERY_SHORT_TEXT_MAX_LENGTH &&
    typeof profile.sizeBand === "string" &&
    profile.sizeBand.length <= DISCOVERY_SHORT_TEXT_MAX_LENGTH &&
    (profile.sector === "" ||
      profile.sector === "finance" ||
      profile.sector === "insurance" ||
      profile.sector === "healthcare" ||
      profile.sector === "other") &&
    typeof profile.role === "string" &&
    profile.role.length <= DISCOVERY_SHORT_TEXT_MAX_LENGTH &&
    typeof profile.focusArea === "string" &&
    profile.focusArea.length <= DISCOVERY_SHORT_TEXT_MAX_LENGTH &&
    validAnswers &&
    validObservations &&
    validMessages &&
    validFacts(candidate.workflows) &&
    validFacts(candidate.systems) &&
    validFacts(candidate.dataAssets) &&
    validFacts(candidate.painPoints) &&
    validFacts(candidate.constraints) &&
    validFacts(candidate.goals) &&
    validEvidence &&
    milestones.includes(candidate.activeMilestone as MilestoneId) &&
    statuses.includes(candidate.status as DiscoveryStatus) &&
    (candidate.leadRequestStatus === "not_started" ||
      candidate.leadRequestStatus === "confirmed") &&
    validLeadConfirmation &&
    (candidate.leadRequestStatus === "confirmed"
      ? candidate.leadConfirmation !== null
      : candidate.leadConfirmation === null) &&
    (candidate.status !== "lead_submitted" ||
      candidate.leadRequestStatus === "confirmed") &&
    Number.isSafeInteger(candidate.revision) &&
    (candidate.revision ?? -1) >= 0 &&
    (candidate.revision ?? DISCOVERY_MAX_REVISION + 1) <=
      DISCOVERY_MAX_REVISION &&
    Boolean(validTimestamp(candidate.createdAt)) &&
    Boolean(validTimestamp(candidate.updatedAt));

  if (!validBase) return false;

  const expectedProfile: Profile = {
    organisationType: valueToText(
      snapshot.answers["context.organisationType"]?.value ?? null,
    ),
    sizeBand: valueToText(snapshot.answers["context.sizeBand"]?.value ?? null),
    sector: normalizeSegment(snapshot.answers["context.sector"]?.value ?? null),
    role: valueToText(snapshot.answers["context.role"]?.value ?? null),
    focusArea: valueToText(snapshot.answers["context.focusArea"]?.value ?? null),
  };
  if (!sameProfile(snapshot.profile, expectedProfile)) return false;

  const manualWorkflows = snapshot.workflows.filter((fact) =>
    fact.id.startsWith("workflow-manual-"),
  );
  if (
    manualWorkflows.length > DISCOVERY_MAX_MANUAL_WORKFLOWS ||
    !manualWorkflows.every((fact) => validManualWorkflow(fact, snapshot.revision))
  ) {
    return false;
  }

  const expected = deriveSemanticState(snapshot);
  return (
    sameFactArrays(snapshot.workflows, expected.workflows) &&
    sameFactArrays(snapshot.systems, expected.systems) &&
    sameFactArrays(snapshot.dataAssets, expected.dataAssets) &&
    sameFactArrays(snapshot.painPoints, expected.painPoints) &&
    sameFactArrays(snapshot.constraints, expected.constraints) &&
    sameFactArrays(snapshot.goals, expected.goals) &&
    sameEvidenceArrays(snapshot.evidence, expected.evidence)
  );
}

function validFacts(value: unknown): value is DiscoveryFact[] {
  return (
    Array.isArray(value) &&
    value.length <= DISCOVERY_MAX_DERIVED_ITEMS &&
    hasUniqueIds(value) &&
    value.every(
      (fact) =>
        Boolean(fact) &&
        typeof fact === "object" &&
        hasOnlyKeys(fact, [
          "id",
          "label",
          "detail",
          "evidenceRefs",
          "status",
          "confidence",
        ]) &&
        typeof (fact as DiscoveryFact).id === "string" &&
        isBoundedText(
          (fact as DiscoveryFact).id,
          1,
          DISCOVERY_MAX_IDENTIFIER_LENGTH,
        ) &&
        typeof (fact as DiscoveryFact).label === "string" &&
        isBoundedText(
          (fact as DiscoveryFact).label,
          1,
          DISCOVERY_SHORT_TEXT_MAX_LENGTH,
        ) &&
        typeof (fact as DiscoveryFact).detail === "string" &&
        isBoundedText(
          (fact as DiscoveryFact).detail,
          1,
          DISCOVERY_LONG_TEXT_MAX_LENGTH,
        ) &&
        Array.isArray((fact as DiscoveryFact).evidenceRefs) &&
        (fact as DiscoveryFact).evidenceRefs.length <=
          DISCOVERY_MAX_DERIVED_ITEMS &&
        (fact as DiscoveryFact).evidenceRefs.every(
          (reference) =>
            typeof reference === "string" &&
            isBoundedText(reference, 1, DISCOVERY_MAX_IDENTIFIER_LENGTH),
        ) &&
        isEvidenceStatus((fact as DiscoveryFact).status) &&
        isConfidence((fact as DiscoveryFact).confidence) &&
        roundConfidence((fact as DiscoveryFact).confidence) ===
          (fact as DiscoveryFact).confidence,
    )
  );
}

function validManualWorkflow(
  fact: DiscoveryFact,
  revision: number,
): boolean {
  const match = /^workflow-manual-(\d+)$/.exec(fact.id);
  return (
    Boolean(match) &&
    Number(match?.[1]) <= revision &&
    fact.evidenceRefs.length === 0 &&
    fact.status === "reported" &&
    fact.confidence === 0.7
  );
}

function sameProfile(left: Profile, right: Profile): boolean {
  return (
    left.organisationType === right.organisationType &&
    left.sizeBand === right.sizeBand &&
    left.sector === right.sector &&
    left.role === right.role &&
    left.focusArea === right.focusArea
  );
}

function sameFactArrays(
  left: DiscoveryFact[],
  right: DiscoveryFact[],
): boolean {
  return (
    left.length === right.length &&
    left.every((fact, index) => {
      const expected = right[index];
      return (
        Boolean(expected) &&
        fact.id === expected.id &&
        fact.label === expected.label &&
        fact.detail === expected.detail &&
        fact.status === expected.status &&
        fact.confidence === expected.confidence &&
        sameStringArrays(fact.evidenceRefs, expected.evidenceRefs)
      );
    })
  );
}

function sameEvidenceArrays(
  left: DiscoveryEvidence[],
  right: DiscoveryEvidence[],
): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => {
      const expected = right[index];
      return (
        Boolean(expected) &&
        item.id === expected.id &&
        item.label === expected.label &&
        item.statement === expected.statement &&
        item.questionId === expected.questionId &&
        item.source === expected.source &&
        item.status === expected.status &&
        item.confidence === expected.confidence
      );
    })
  );
}

function sameStringArrays(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function hasOnlyKeys(
  value: object,
  allowedKeys: readonly string[],
): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasUniqueIds(value: unknown[]): boolean {
  const ids = value.map((item) =>
    item && typeof item === "object" && "id" in item
      ? (item as { id?: unknown }).id
      : undefined,
  );
  return (
    ids.every((id) => typeof id === "string") &&
    new Set(ids).size === ids.length
  );
}

function isBoundedText(
  value: string,
  minimumLength: number,
  maximumLength: number,
): boolean {
  return value.length >= minimumLength && value.length <= maximumLength;
}

function validTimestamp(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !value ||
    !Number.isFinite(Date.parse(value))
  ) {
    return null;
  }
  return new Date(value).toISOString();
}

function isDiscoveryValue(value: unknown): value is DiscoveryValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

function isEvidenceStatus(value: unknown): value is EvidenceStatus {
  return value === "reported" || value === "inferred" || value === "confirmed";
}

function isConfidence(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function messageId(revision: number, role: "user" | "agent"): string {
  return `msg-${String(revision).padStart(4, "0")}-${role}`;
}

function createCaseId(seed: string): string {
  return `SIG-${stableHash(seed).slice(0, 6).toUpperCase()}`;
}

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function sentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const capitalized = `${trimmed.charAt(0).toLocaleUpperCase("en")}${trimmed.slice(1)}`;
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

function withoutTerminalPunctuation(value: string): string {
  return value.trim().replace(/[.!?]+$/, "");
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toLocaleUpperCase("en"));
}

function bandScore(band: "High" | "Medium" | "Low"): number {
  return band === "High" ? 3 : band === "Medium" ? 2 : 1;
}

function roundConfidence(value: number): number {
  return Math.round(clamp(value, 0, 1) * 100) / 100;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function containsSensitiveDataCue(message: string): boolean {
  const normalized = message.toLocaleLowerCase("en");
  return (
    /\b(patient|customer|client|employee|account|record|case|claim)\s*(name|number|no\.?|id|identifier)\b/.test(
      normalized,
    ) ||
    /\b(date of birth|social security|national id|rodné číslo|birth number|account number|password|passcode|secret|medical record|patient record|api key|access token)\b/.test(
      normalized,
    ) ||
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(message) ||
    /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/i.test(message) ||
    /\b\d{3}-\d{2}-\d{4}\b/.test(message) ||
    /\b\d{6}\/\d{3,4}\b/.test(message) ||
    /(?:\+?\d[\s().-]*){9,15}/.test(message) ||
    /(?:\d[\s-]*){13,19}/.test(message)
  );
}
