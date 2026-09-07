import { createHash } from "node:crypto";
import {
  workflowChoicesFor, frictionChoicesFor, labelForChoice, labelForReleaseSector,
  RELEASE_SCALE_CHOICES, RELEASE_SYSTEM_CHOICES, RELEASE_CONTROL_CHOICES,
  type DiscoveryReleasePayload,
} from "../lib/discovery-release.ts";
import {
  OPPORTUNITY_REPORT_LIMITS as limits, opportunityReportIssues, isOpportunityReportContent,
  type OpportunityDiscoveryReport,
} from "../lib/discovery-report.ts";
import { normalizeContactEmail } from "../lib/contact-contract.ts";
import { requestStructuredOutputWithMetadata, type OpenAiStructuredEnvironment } from "./openai-structured.ts";
import { DISCOVERY_REPORT_PROMPT } from "./discovery-report-prompt.ts";

const text = (maximum: number) => ({ type: "string", minLength: 1, maxLength: maximum });
const REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    providedContext: text(limits.providedContext),
    sectorOpportunities: text(limits.sectorOpportunities),
    areasIntro: text(limits.areasIntro),
    areas: {
      type: "array", minItems: 2, maxItems: 3,
      items: {
        type: "object", additionalProperties: false,
        properties: { name: text(limits.areaName), explanation: text(limits.areaExplanation) },
        required: ["name", "explanation"],
      },
    },
    detail: {
      type: "object", additionalProperties: false,
      properties: {
        areaName: text(limits.areaName),
        paragraphs: { type: "array", minItems: 2, maxItems: 3, items: text(limits.detailParagraph) },
      },
      required: ["areaName", "paragraphs"],
    },
  },
  required: ["providedContext", "sectorOpportunities", "areasIntro", "areas", "detail"],
} as const;

export async function generateDiscoveryReport(
  payload: DiscoveryReleasePayload,
  generatedAt: string,
  { env, fetchImpl }: { env: OpenAiStructuredEnvironment; fetchImpl: typeof fetch },
): Promise<OpportunityDiscoveryReport> {
  const { company, answers } = payload;
  const providedInputs = {
    companyName: company.website ? company.name : null,
    sector: labelForReleaseSector(company.sector),
    providedCompanyContext: company.website ? company.summary : null,
    providedOfferings: company.offerings,
    companyContextBasis: company.website ? "Context supplied by the earlier website step" : "No company website or name was provided",
    answers: {
      workToExplore: { selected: answers.workflow.map(value => labelForChoice(workflowChoicesFor(company), value)), context: answers.context?.workflow ?? null },
      reportedProblems: { selected: answers.friction.map(value => labelForChoice(frictionChoicesFor(company.sector), value)), context: answers.context?.friction ?? null },
      frequency: labelForChoice(RELEASE_SCALE_CHOICES, answers.scale),
      systems: { selected: answers.systems.map(value => labelForChoice(RELEASE_SYSTEM_CHOICES, value)), context: answers.context?.systems ?? null },
      requirements: { selected: answers.controls.map(value => labelForChoice(RELEASE_CONTROL_CHOICES, value)), context: answers.context?.controls ?? null },
    },
    answerContext: "Selected labels and written context are the user's reviewed answers. They supersede earlier website suggestions. They are not public website evidence.",
  };
  const safetyIdentifier = createHash("sha256").update(normalizeContactEmail(payload.contact.workEmail)).digest("hex");
  const deadline = Date.now() + 48_000;
  let previousDraft: unknown;
  let revisionIssues: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const timeoutMs = deadline - Date.now();
    if (timeoutMs <= 0) break;
    const result = await requestStructuredOutputWithMetadata<unknown>({
      name: "opportunity_discovery",
      schema: REPORT_SCHEMA,
      system: DISCOVERY_REPORT_PROMPT,
      user: JSON.stringify({ providedInputs, textLimits: limits, ...(attempt ? { previousDraft, revisionIssues } : {}) }),
      maxOutputTokens: 2_500,
      safetyIdentifier,
      webSearch: false,
    }, { env, fetchImpl, timeoutMs });
    previousDraft = result.value;
    revisionIssues = opportunityReportIssues(previousDraft);
    if (isOpportunityReportContent(previousDraft)) {
      if (providedInputs.companyName && !previousDraft.providedContext.toLocaleLowerCase("en").includes(providedInputs.companyName.toLocaleLowerCase("en"))) {
        revisionIssues.push("providedContext must include the supplied company name.");
      }
      if (!revisionIssues.length) {
        return {
          schemaVersion: 2, generatedAt, title: "Opportunity Discovery",
          providedContext: previousDraft.providedContext,
          sectorOpportunities: previousDraft.sectorOpportunities,
          areasIntro: previousDraft.areasIntro,
          areas: previousDraft.areas.map(({ name, explanation }) => ({ name, explanation })),
          detail: { areaName: previousDraft.detail.areaName, paragraphs: previousDraft.detail.paragraphs },
        };
      }
    }
  }
  throw new Error("The report did not meet the content and length requirements.");
}
