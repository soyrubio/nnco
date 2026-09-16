import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyDiscoveryAnswers, prefillDiscoveryAnswers, discoveryWorkflowOptions, answersAfterSectorChange,
} from "../src/lib/discovery-questionnaire.ts";
import {
  WORKFLOW_CHOICES, buildManualCompanyContext, hasMultiAnswer,
  isReleaseAnswersForCompany, reclassifyCompanyContext, workflowChoicesFor,
} from "../src/lib/discovery-release.ts";
import { normalizeCompanyResearch } from "../src/server/discovery-research.ts";

const research = {
  company: { name: "Example Insurance", sector: "insurance" },
  workflowOptions: [{ value: "custom-fleet-renewals", label: "Fleet renewals" }, ...WORKFLOW_CHOICES.insurance],
  prefill: { workflow: ["custom-fleet-renewals", "claims"], systems: ["documents"], controls: ["audit"] },
  sources: [], contextToken: "test-token",
};

test("research retains cited evidence ahead of unrelated search hits", () => {
  const sources = ["/about", "/contact", "/news", "/annual-report.pdf", "/services"].map(path => `https://example.com${path}`);
  const result = normalizeCompanyResearch({
    name: "Example Insurance", sector: "insurance", summary: "Insurance company.",
    workflows: [{ existingId: "claims", label: "Claims handling", selected: true, sourceUrl: sources[3] }],
    systems: [], controls: [{ value: "audit", sourceUrl: sources[4] }],
  }, new URL("https://example.com/"), sources);
  assert.deepEqual(result.prefill.workflow, ["claims"]);
  assert.deepEqual(result.prefill.controls, ["audit"]);
  assert.deepEqual(result.company.sources.map(source => source.url), [sources[3], sources[4], sources[0]]);
});

test("research prefills editable catalogue choices but not private operating answers", () => {
  const answers = prefillDiscoveryAnswers(research);
  assert.deepEqual(answers.workflow, ["custom-fleet-renewals", "claims"]);
  assert.deepEqual(answers.systems, ["documents"]);
  assert.deepEqual(answers.controls, ["audit"]);
  assert.deepEqual(answers.friction, []);
  assert.equal(answers.scale, "");
  assert.deepEqual(answers.context, {});
  const invalid = prefillDiscoveryAnswers({ ...research, prefill: { workflow: ["claims", "claims", "forged"], systems: ["forged"], controls: [] } });
  assert.deepEqual(invalid.workflow, ["claims"]);
  assert.deepEqual(invalid.systems, []);
});

test("repeating research preserves reviewed selections, free text and frequency", () => {
  const current = { ...emptyDiscoveryAnswers(), workflow: [], friction: ["document-review"], systems: ["email"], scale: "daily", context: { workflow: "Our bespoke renewal process" } };
  const answers = prefillDiscoveryAnswers(research, current, new Set(["workflow", "friction", "systems"]));
  assert.deepEqual(answers.workflow, []);
  assert.deepEqual(answers.friction, current.friction);
  assert.deepEqual(answers.systems, ["email"]);
  assert.equal(answers.context.workflow, current.context.workflow);
  assert.equal(answers.scale, "daily");
  assert.deepEqual(answers.controls, ["audit"]);
});

test("sector corrections remove incompatible selections and retain written context", () => {
  const current = { ...prefillDiscoveryAnswers(research), context: { workflow: "Help with renewals" } };
  const answers = answersAfterSectorChange(current, "banking");
  assert.deepEqual(answers.workflow, []);
  assert.equal(answers.context.workflow, "Help with renewals");
  assert.deepEqual(discoveryWorkflowOptions(research, "banking"), WORKFLOW_CHOICES.banking);
  const repeated = prefillDiscoveryAnswers(research, { ...answers, workflow: ["credit-lending"] }, new Set(["workflow"]), "banking");
  assert.deepEqual(repeated.workflow, ["credit-lending"]);
  const company = reclassifyCompanyContext({ ...buildManualCompanyContext("insurance"), workflowOptions: research.workflowOptions }, "banking");
  assert.deepEqual(workflowChoicesFor(company), discoveryWorkflowOptions(research, "banking"));
  for (const sector of Object.keys(WORKFLOW_CHOICES)) {
    assert.deepEqual(workflowChoicesFor(buildManualCompanyContext(sector)), discoveryWorkflowOptions(null, sector));
  }
});

test("a written answer can replace each multi-select, but blank and oversized text cannot", () => {
  const answers = { ...emptyDiscoveryAnswers(), scale: "daily", context: { workflow: "Renewals", friction: "Late signatures", systems: "Internal case tool", controls: "Legal sign-off" } };
  const company = buildManualCompanyContext("insurance");
  assert.equal(isReleaseAnswersForCompany(answers, company), true);
  for (const id of ["workflow", "friction", "systems", "controls"]) {
    assert.equal(hasMultiAnswer(answers, id), true);
    assert.equal(isReleaseAnswersForCompany({ ...answers, context: { ...answers.context, [id]: "  " } }, company), false);
    assert.equal(isReleaseAnswersForCompany({ ...answers, context: { ...answers.context, [id]: "x".repeat(1001) } }, company), false);
  }
  assert.equal(isReleaseAnswersForCompany({ ...answers, context: { ...answers.context, scale: "Invented" } }, company), false);
});
