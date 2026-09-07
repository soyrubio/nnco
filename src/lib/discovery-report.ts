export const OPPORTUNITY_REPORT_LIMITS = {
  providedContext: 900,
  sectorOpportunities: 900,
  areasIntro: 220,
  areaName: 56,
  areaExplanation: 420,
  detailParagraph: 450,
  pageTwo: 2_400,
  sentenceWords: 25,
} as const;

export interface OpportunityReportContent {
  providedContext: string;
  sectorOpportunities: string;
  areasIntro: string;
  areas: { name: string; explanation: string }[];
  detail: { areaName: string; paragraphs: string[] };
}

export interface OpportunityDiscoveryReport extends OpportunityReportContent {
  schemaVersion: 2;
  generatedAt: string;
  title: "Opportunity Discovery";
}

const sentences = new Intl.Segmenter("en", { granularity: "sentence" });

export function opportunityReportIssues(value: unknown): string[] {
  if (!isRecord(value)) return ["Expected a report object."];
  const issues: string[] = [];
  const limits = OPPORTUNITY_REPORT_LIMITS;
  function text(field: string, content: unknown, maximum: number, prose = true): void {
    if (typeof content !== "string" || !content.trim() || content.length > maximum) {
      issues.push(`${field}: use 1-${maximum} characters.`);
      return;
    }
    if (/[\r\n*#]|\.\.\.|…|[—–]/.test(content)) {
      issues.push(`${field}: use plain text without Markdown, line breaks, ellipses or long dashes.`);
    }
    if (!prose) return;
    // Keep complete sentences if the model reaches a field limit mid-sentence.
    // Request a rewrite instead of cutting away the evidence or limitation.
    if (!/[.!?]["'”’)]?$/.test(content.trim())) {
      issues.push(`${field}: finish every sentence.`);
    }
    if ([...sentences.segment(content)].some(({ segment }) => segment.trim().split(/\s+/).length > limits.sentenceWords)) {
      issues.push(`${field}: each sentence must have at most ${limits.sentenceWords} words.`);
    }
  }
  text("providedContext", value.providedContext, limits.providedContext);
  text("sectorOpportunities", value.sectorOpportunities, limits.sectorOpportunities);
  text("areasIntro", value.areasIntro, limits.areasIntro);
  if (!Array.isArray(value.areas) || value.areas.length < 2 || value.areas.length > 3 ||
      !value.areas.every(isRecord) || !isRecord(value.detail) ||
      !Array.isArray(value.detail.paragraphs) || value.detail.paragraphs.length < 2 || value.detail.paragraphs.length > 3) {
    return [...issues, "Return two or three areas and two or three detail paragraphs."];
  }
  const detail = value.detail;
  value.areas.forEach((area, index) => {
    text(`areas[${index}].name`, area.name, limits.areaName, false);
    text(`areas[${index}].explanation`, area.explanation, limits.areaExplanation);
  });
  text("detail.areaName", value.detail.areaName, limits.areaName, false);
  value.detail.paragraphs.forEach((paragraph: unknown, index: number) => text(`detail.paragraphs[${index}]`, paragraph, limits.detailParagraph));
  if (!value.areas.some(area => area.name === detail.areaName)) {
    issues.push("detail.areaName must exactly match one area name.");
  }
  if (new Set(value.areas.map(area => area.name)).size !== value.areas.length) {
    issues.push("Give each distinct area a different name.");
  }
  const pageTwo = [value.areasIntro, ...value.areas.flatMap(area => [area.name, area.explanation]), value.detail.areaName, ...value.detail.paragraphs];
  if (pageTwo.every(entry => typeof entry === "string") && pageTwo.join("").length > limits.pageTwo) {
    issues.push(`Page two: use at most ${limits.pageTwo} characters across the introduction, area names, explanations and detail.`);
  }
  return issues;
}

export function isOpportunityReportContent(value: unknown): value is OpportunityReportContent {
  return opportunityReportIssues(value).length === 0;
}

export function isOpportunityDiscoveryReport(value: unknown): value is OpportunityDiscoveryReport {
  return isRecord(value) && value.schemaVersion === 2 && value.title === "Opportunity Discovery" &&
    typeof value.generatedAt === "string" && value.generatedAt.length <= 64 &&
    Number.isFinite(Date.parse(value.generatedAt)) && isOpportunityReportContent(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
