import type {
  DiscoveryQuestion,
  DiscoverySnapshot,
  Segment,
} from "./discovery";

type WorkflowOption = readonly [value: string, label: string];

const WORKFLOWS: Record<Segment, readonly WorkflowOption[]> = {
  finance: [
    ["kyc-onboarding", "KYC and onboarding"],
    ["credit-preparation", "Credit assessment and preparation"],
    ["regulatory-reporting", "Regulatory reporting"],
    ["reconciliation-close", "Reconciliation and close"],
    ["document-intake", "Document intake and review"],
    ["internal-knowledge", "Internal knowledge access"],
  ],
  insurance: [
    ["claims", "Claims handling"],
    ["underwriting", "Underwriting"],
    ["policy-servicing", "Policy servicing"],
    ["fraud-investigation", "Fraud investigation"],
    ["document-intake", "Document intake and review"],
    ["internal-knowledge", "Internal knowledge access"],
  ],
  healthcare: [
    ["patient-administration", "Patient administration"],
    ["scheduling", "Scheduling and coordination"],
    ["document-processing", "Document and referral processing"],
    ["billing", "Billing and reimbursement"],
    ["internal-reporting", "Internal reporting"],
    ["internal-knowledge", "Internal knowledge access"],
  ],
  other: [
    ["document-intake", "Document intake and review"],
    ["reporting", "Reporting"],
    ["case-handling", "Case handling"],
    ["approvals", "Approvals and coordination"],
    ["internal-knowledge", "Internal knowledge access"],
    ["other-workflow", "Another operational workflow"],
  ],
};

const INPUTS: Record<Segment, readonly WorkflowOption[]> = {
  finance: [
    ["email-documents", "Email and documents"],
    ["spreadsheets", "Spreadsheets"],
    ["core-banking", "Core banking or payment system"],
    ["erp-accounting", "ERP or accounting system"],
    ["crm-loan", "CRM or loan system"],
    ["database", "Database or warehouse"],
  ],
  insurance: [
    ["email-documents", "Email and documents"],
    ["spreadsheets", "Spreadsheets"],
    ["claims-policy", "Claims or policy system"],
    ["crm-case", "CRM or case system"],
    ["external-portals", "External portals"],
    ["database", "Database or warehouse"],
  ],
  healthcare: [
    ["messages-documents", "Messages and documents"],
    ["structured-forms", "Structured forms"],
    ["practice-system", "Practice or clinical system"],
    ["scheduling", "Scheduling system"],
    ["billing", "Billing or insurer portal"],
    ["back-office", "Back-office systems"],
  ],
  other: [
    ["email-documents", "Email and documents"],
    ["spreadsheets", "Spreadsheets"],
    ["business-system", "Business system"],
    ["external-portals", "External portals"],
    ["database", "Database or warehouse"],
    ["other-source", "Other source"],
  ],
};

const SECTOR_LABELS: Record<Segment, string> = {
  finance: "banking",
  insurance: "insurance",
  healthcare: "healthcare",
  other: "operational",
};

function options(entries: readonly WorkflowOption[]) {
  return entries.map(([value, label]) => ({ value, label }));
}

function choice(
  question: Omit<DiscoveryQuestion, "required" | "allowUnknown">,
): DiscoveryQuestion {
  return {
    ...question,
    required: true,
    allowUnknown: true,
  };
}

export function getRapidDiscoveryQuestions(
  snapshot: DiscoverySnapshot,
): DiscoveryQuestion[] {
  const sector = snapshot.profile.sector || "other";
  const questions: DiscoveryQuestion[] = [
    choice({
      id: "workflow.scope",
      milestone: "workflow",
      sector,
      prompt: `Which ${SECTOR_LABELS[sector]} workflow should we examine?`,
      shortLabel: "Workflow",
      fieldType: "single_select",
      options: options(WORKFLOWS[sector]),
    }),
    choice({
      id: "workflow.volumeBand",
      milestone: "workflow",
      sector: "all",
      prompt: "Approximately how many items pass through this workflow each month?",
      shortLabel: "Monthly volume",
      help: "An item may be a case, document, request or transaction.",
      fieldType: "single_select",
      options: options([
        ["under-100", "Fewer than 100"],
        ["100-499", "100-499"],
        ["500-1999", "500-1,999"],
        ["2000-9999", "2,000-9,999"],
        ["10000-plus", "10,000 or more"],
      ]),
    }),
    choice({
      id: "workflow.effortBand",
      milestone: "workflow",
      sector: "all",
      prompt: "How much human time does one item typically require?",
      shortLabel: "Human effort",
      fieldType: "single_select",
      options: options([
        ["under-5m", "Less than 5 minutes"],
        ["5-15m", "5-15 minutes"],
        ["15-30m", "15-30 minutes"],
        ["30-60m", "30-60 minutes"],
        ["1-4h", "1-4 hours"],
        ["4h-plus", "More than 4 hours"],
      ]),
    }),
    {
      ...choice({
        id: "friction.repetition",
        milestone: "friction",
        sector: "all",
        prompt: "Where does the workflow lose the most capacity?",
        shortLabel: "Primary friction",
        help: "Select up to two.",
        fieldType: "multi_select",
        options: options([
          ["manual-entry", "Manual data entry"],
          ["document-review", "Document review"],
          ["missing-inputs", "Missing or inconsistent inputs"],
          ["handoffs", "Handoffs and approvals"],
          ["exceptions", "Exceptions and rework"],
          ["reconciliation", "Reconciliation and checking"],
        ]),
      }),
      maxSelections: 2,
    },
    choice({
      id: "workflow.inputs",
      milestone: "readiness",
      sector,
      prompt: "Which systems or sources are involved?",
      shortLabel: "Systems and sources",
      fieldType: "multi_select",
      options: options(INPUTS[sector]),
    }),
    choice({
      id: "goal.outcome",
      milestone: "readiness",
      sector: "all",
      prompt: "Which result matters most?",
      shortLabel: "Priority result",
      fieldType: "single_select",
      options: options([
        ["throughput", "Faster throughput"],
        ["manual-effort", "Less manual effort"],
        ["quality", "Fewer errors and exceptions"],
        ["auditability", "Stronger auditability"],
        ["service", "Better customer or patient service"],
        ["capacity", "More capacity without additional headcount"],
      ]),
    }),
  ];

  if (sector !== "other") {
    questions.push(
      choice({
        id: "readiness.constraints",
        milestone: "readiness",
        sector,
        prompt: "Which controls are non-negotiable?",
        shortLabel: "Controls",
        fieldType: "multi_select",
        options: options([
          ["personal-data", "Personal or sensitive data protection"],
          ["residency", "Data residency"],
          ["access", "Role-based access"],
          ["audit", "Complete audit trail"],
          ["retention", "Retention and deletion rules"],
          ["human-approval", "Human approval"],
        ]),
      }),
    );
  }

  return questions;
}

