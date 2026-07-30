import {
  buildReportPreview,
  type DiscoverySnapshot,
  type ReportProblem,
} from "./discovery.ts";
import type {
  FullDiagnosticReport,
  IndicativeRange,
  PricingModel,
  ReportSolutionOption,
  SolutionKind,
} from "./lead-contract.ts";

type OptionTemplate = {
  suffix: string;
  title: string;
  kind: SolutionKind;
  principle: string;
  expectedBenefit: string;
  effort: ReportSolutionOption["effort"];
  risks: string[];
  timingWeeks: ReportSolutionOption["timingWeeks"];
  pricingModel: PricingModel;
  indicativeRanges: IndicativeRange[];
};

const TEMPLATES: Record<string, OptionTemplate[]> = {
  "problem-manual-work": [
    {
      suffix: "process",
      title: "Standardise the workflow before automating it",
      kind: "process-change",
      principle:
        "Define one owned process, exception taxonomy and control checklist before adding software.",
      expectedBenefit:
        "Lower variation quickly and create a measurable baseline for later automation.",
      effort: "Low",
      risks: ["Adoption may fade without an accountable process owner."],
      timingWeeks: { min: 2, max: 4 },
      pricingModel: "fixed-implementation",
      indicativeRanges: [
        { currency: "EUR", min: 5_000, max: 15_000, unit: "one-off" },
      ],
    },
    {
      suffix: "automation",
      title: "Automate the repeated preparation steps",
      kind: "workflow-automation",
      principle:
        "Trigger a controlled workflow that validates inputs, normalises files and routes exceptions to a human owner.",
      expectedBenefit:
        "Reduce recurring preparation effort while retaining approval at material decision points.",
      effort: "Medium",
      risks: [
        "Inconsistent inputs can move manual work into exception handling.",
        "Control ownership must remain explicit.",
      ],
      timingWeeks: { min: 4, max: 8 },
      pricingModel: "implementation-plus-retainer",
      indicativeRanges: [
        { currency: "EUR", min: 18_000, max: 45_000, unit: "one-off" },
        { currency: "EUR", min: 1_000, max: 3_000, unit: "monthly" },
      ],
    },
  ],
  "problem-exceptions": [
    {
      suffix: "agent",
      title: "Deploy an exception triage agent",
      kind: "agent-skill",
      principle:
        "Classify incoming exceptions against agreed rules, assemble evidence and propose the next action for human approval.",
      expectedBenefit:
        "Shorten exception resolution time and create a consistent, auditable queue.",
      effort: "Medium",
      risks: [
        "Poorly defined exception classes reduce precision.",
        "Sensitive cases require role-aware access and human approval.",
      ],
      timingWeeks: { min: 5, max: 9 },
      pricingModel: "implementation-plus-retainer",
      indicativeRanges: [
        { currency: "EUR", min: 25_000, max: 60_000, unit: "one-off" },
        { currency: "EUR", min: 1_500, max: 5_000, unit: "monthly" },
      ],
    },
    {
      suffix: "saas",
      title: "Configure an existing case-management layer",
      kind: "saas",
      principle:
        "Use an established queue or case tool for assignment, evidence, escalation and service-level tracking.",
      expectedBenefit:
        "Introduce ownership and measurement quickly without building a new core application.",
      effort: "Low",
      risks: [
        "Licensing and integration limits may constrain the desired workflow.",
      ],
      timingWeeks: { min: 3, max: 6 },
      pricingModel: "saas-plus-integration",
      indicativeRanges: [
        { currency: "EUR", min: 8_000, max: 25_000, unit: "one-off" },
        { currency: "EUR", min: 500, max: 2_500, unit: "monthly" },
      ],
    },
  ],
  "problem-fragmentation": [
    {
      suffix: "integration",
      title: "Create a governed source-to-output integration",
      kind: "integration",
      principle:
        "Connect the minimum authoritative systems through a traceable canonical data model and reconciliation layer.",
      expectedBenefit:
        "Reduce re-keying and make every output traceable to an owned source.",
      effort: "Medium",
      risks: [
        "Source access and identifiers may be less consistent than reported.",
        "Data ownership must be agreed before go-live.",
      ],
      timingWeeks: { min: 6, max: 12 },
      pricingModel: "implementation-plus-retainer",
      indicativeRanges: [
        { currency: "EUR", min: 30_000, max: 85_000, unit: "one-off" },
        { currency: "EUR", min: 1_500, max: 4_500, unit: "monthly" },
      ],
    },
    {
      suffix: "custom",
      title: "Build a reusable operational intelligence layer",
      kind: "custom",
      principle:
        "Implement reusable connectors, lineage, control rules and agent skills around the existing system landscape.",
      expectedBenefit:
        "Create a durable platform for additional workflows instead of a one-off point solution.",
      effort: "High",
      risks: [
        "Scope can expand unless the first workflow and reuse boundary are fixed.",
        "Exclusive requirements materially increase cost.",
      ],
      timingWeeks: { min: 10, max: 18 },
      pricingModel: "implementation-plus-retainer",
      indicativeRanges: [
        { currency: "EUR", min: 70_000, max: 180_000, unit: "one-off" },
        { currency: "EUR", min: 3_000, max: 10_000, unit: "monthly" },
      ],
    },
  ],
};

export function buildFullDiagnosticReport(
  snapshot: DiscoverySnapshot,
): FullDiagnosticReport {
  const preview = buildReportPreview(snapshot);
  const investmentValue = answerValue(snapshot, "goal.investmentPosture");
  const investment = investmentLabel(investmentValue);
  const dataAndIntegrations = integrationInputs(snapshot);
  const postureAssumption = investmentValue
    ? []
    : [
        "Investment posture was not supplied. Commercial ranges are calibrated to a focused, non-exclusive implementation.",
      ];

  const solutionOptions = preview.problems.flatMap((problem) =>
    buildOptionsForProblem(
      problem,
      dataAndIntegrations,
      postureAssumption,
      Boolean(investmentValue),
    ),
  );

  return {
    schemaVersion: 1,
    caseId: snapshot.caseId,
    generatedAt: new Date().toISOString(),
    investmentPosture: {
      value: investmentValue || "not-supplied",
      label: investment,
      isAssumption: !investmentValue,
    },
    solutionOptions,
    recommendedNextStep:
      "Run a 90-minute evidence review with the workflow owner, technology lead and control owner; validate volumes, exception classes, access and the authoritative source before selecting a solution path.",
    deliveryModel:
      investmentValue === "implementation-budget-approved"
        ? "Start with a fixed discovery sprint, then use implementation plus a support retainer for reusable agents, connectors and controls."
        : "Start with a fixed-scope validation sprint. Convert only the proven workflow into an implementation, licence or managed retainer.",
    roadmap: [
      {
        window: "Days 0-14",
        objective: "Validate the operating truth",
        output: "Confirmed workflow, evidence ledger, baseline and control boundary.",
      },
      {
        window: "Days 15-45",
        objective: "Prove the smallest intervention",
        output: "Working pilot against representative data with human approval.",
      },
      {
        window: "Days 46-90",
        objective: "Operationalise and reuse",
        output: "Measured rollout, monitoring and reusable connector or skill.",
      },
    ],
  };
}

function buildOptionsForProblem(
  problem: ReportProblem,
  dataAndIntegrations: string[],
  postureAssumption: string[],
  hasInvestmentSignal: boolean,
): ReportSolutionOption[] {
  const templates = TEMPLATES[problem.id] ?? TEMPLATES["problem-manual-work"];
  return templates.map((template) => ({
    id: `${problem.id}-${template.suffix}`,
    problemId: problem.id,
    title: template.title,
    kind: template.kind,
    principle: template.principle,
    expectedBenefit: template.expectedBenefit,
    dataAndIntegrations,
    effort: template.effort,
    risks: template.risks,
    timingWeeks: template.timingWeeks,
    pricingModel: template.pricingModel,
    indicativeRanges: template.indicativeRanges,
    confidence: Math.max(
      0.25,
      Math.min(0.92, problem.confidence * (hasInvestmentSignal ? 0.92 : 0.78)),
    ),
    evidenceRefs: problem.evidenceRefs,
    assumptions: [
      ...problem.assumptions,
      ...postureAssumption,
      "Ranges exclude third-party licences, tax and exclusive reuse rights.",
    ],
  }));
}

function answerValue(snapshot: DiscoverySnapshot, questionId: string): string {
  const value = snapshot.answers[questionId]?.value;
  return typeof value === "string" && value !== "Unknown / validate next"
    ? value
    : "";
}

function investmentLabel(value: string): string {
  const labels: Record<string, string> = {
    exploring: "Exploring / no budget yet",
    "business-case-required": "Needs an approved business case",
    "pilot-budget-approved": "Pilot budget available",
    "implementation-budget-approved": "Implementation budget available",
  };
  return labels[value] ?? "Not supplied / validate commercially";
}

function integrationInputs(snapshot: DiscoverySnapshot): string[] {
  const values = [
    snapshot.answers["workflow.inputs"]?.value,
    snapshot.answers["readiness.systems"]?.value,
  ]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(
      (value): value is string =>
        typeof value === "string" &&
        value.trim().length > 0 &&
        value !== "Unknown / validate next",
    )
    .map((value) => value.trim());
  return values.length > 0
    ? Array.from(new Set(values)).slice(0, 8)
    : ["Source systems and access to be validated"];
}
