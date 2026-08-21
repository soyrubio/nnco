import assert from "node:assert/strict";
import test from "node:test";

import {
  DISCOVERY_RELEASE_CONSENT_VERSION,
  buildFallbackCompanyContext,
  buildFallbackReleaseReport,
  buildManualCompanyContext,
  frictionChoicesFor,
  isDiscoveryReleaseReport,
  isDiscoveryReleasePayload,
  normalizeWebsiteInput,
  workflowChoicesFor,
} from "../src/lib/discovery-release.ts";
import { createDiscoveryContextToken } from "../src/server/discovery-context-token.ts";

function validPayload() {
  const company = buildFallbackCompanyContext({
    website: "https://example-insurance.test/",
    title: "Example Insurance | Commercial cover",
    description: "Commercial insurance and claims services.",
    text: "Underwriting, policies and claims for commercial clients.",
    sourceUrls: ["https://example-insurance.test/"],
  });
  return {
    schemaVersion: 1,
    requestId: crypto.randomUUID(),
    website: company.website,
    situation: "We want to reduce manual underwriting preparation.",
    company,
    companyContextToken: createDiscoveryContextToken(company, { NODE_ENV: "test" }),
    answers: {
      workflow: workflowChoicesFor(company).slice(0, 2).map((choice) => choice.value),
      friction: ["document-review"],
      scale: "daily",
      systems: ["email", "documents"],
      controls: ["audit", "human-approval"],
    },
    contact: {
      workEmail: "alex@example.com",
      organisation: "Example Insurance",
      name: "Alex Example",
    },
    competitorView: { enabled: false, names: [] },
    consent: { accepted: true, version: DISCOVERY_RELEASE_CONSENT_VERSION },
  };
}

test("release URL input accepts a bare domain and keeps only its origin", () => {
  assert.equal(
    normalizeWebsiteInput("example.com/services?source=test#detail")?.toString(),
    "https://example.com/",
  );
  assert.equal(normalizeWebsiteInput("ftp://example.com"), null);
  assert.equal(normalizeWebsiteInput("https://user:pass@example.com"), null);
  assert.equal(normalizeWebsiteInput("https://example.com:8443"), null);
  assert.equal(
    normalizeWebsiteInput("https://example.com:443")?.toString(),
    "https://example.com/",
  );
});

test("release context infers a sector and routes its workflow choices", () => {
  const payload = validPayload();
  assert.equal(payload.company.sector, "insurance");
  assert.equal(
    workflowChoicesFor(payload.company).some((choice) => choice.value === "underwriting"),
    true,
  );
});

test("capital markets is a first-class inferred and manual sector", () => {
  const company = buildFallbackCompanyContext({
    website: "https://example-fund.test/",
    title: "Example Asset Management | Funds",
    description: "Fund and investor reporting for institutional portfolios.",
    text: "Due diligence, portfolio company reporting, AIFMD and SFDR compliance.",
    sourceUrls: ["https://example-fund.test/"],
  });

  assert.equal(company.sector, "capital-markets");
  assert.equal(
    workflowChoicesFor(company).some(
      (choice) => choice.label === "Fund and investor reporting",
    ),
    true,
  );
  assert.equal(
    frictionChoicesFor(company.sector).some(
      (choice) => choice.value === "reconciling-figures",
    ),
    true,
  );
  assert.equal(buildManualCompanyContext("capital-markets").sector, "capital-markets");
});

test("release contract requires all five answers, work email data and consent", () => {
  const payload = validPayload();
  assert.equal(isDiscoveryReleasePayload(payload), true);
  assert.equal(
    isDiscoveryReleasePayload({
      ...payload,
      answers: { ...payload.answers, controls: [] },
    }),
    false,
  );
  assert.equal(
    isDiscoveryReleasePayload({
      ...payload,
      consent: { accepted: false, version: DISCOVERY_RELEASE_CONSENT_VERSION },
    }),
    false,
  );
});

test("fallback report always maps to exactly two report objects", () => {
  const payload = validPayload();
  const report = buildFallbackReleaseReport(payload, "2026-08-10T12:00:00.000Z");
  assert.deepEqual(Object.keys(report).sort(), [
    "executiveSummary",
    "generatedAt",
    "pageOne",
    "pageTwo",
    "schemaVersion",
    "title",
  ]);
  assert.equal(report.pageOne.findings.length >= 2, true);
  assert.equal(report.pageTwo.opportunities.length >= 2, true);
  assert.equal(payload.answers.workflow.length, 2);
  assert.match(report.pageOne.workflow, /Underwriting/);
  assert.match(report.pageOne.workflow, /Claims handling/);
  assert.equal(isDiscoveryReleaseReport(report), true);
  assert.equal(
    isDiscoveryReleaseReport({ ...report, pageTwo: { ...report.pageTwo, competitorStatus: "invalid" } }),
    false,
  );
});

test("manual context keeps the diagnostic valid without a company website", () => {
  const payload = validPayload();
  payload.website = null;
  payload.company = buildManualCompanyContext("banking");
  payload.companyContextToken = null;
  payload.answers.workflow = [workflowChoicesFor(payload.company)[0].value];
  payload.answers.friction = [frictionChoicesFor(payload.company.sector)[0].value];
  payload.contact.organisation = "Not provided";

  assert.equal(payload.company.website, null);
  assert.equal(payload.company.domain, null);
  assert.equal(payload.company.sources.length, 0);
  assert.equal(isDiscoveryReleasePayload(payload), true);
});

test("payload cannot mix manual and website-derived company contexts", () => {
  const payload = validPayload();
  payload.website = null;
  assert.equal(isDiscoveryReleasePayload(payload), false);
});

test("release contract rejects client-authored answers outside its choice sets", () => {
  const payload = validPayload();
  payload.answers.workflow = ["forged-workflow"];
  assert.equal(isDiscoveryReleasePayload(payload), false);
});

test("release contract accepts at most two distinct workflows", () => {
  const payload = validPayload();
  const choices = workflowChoicesFor(payload.company);
  assert.equal(isDiscoveryReleasePayload(payload), true);

  payload.answers.workflow = choices.slice(0, 3).map((choice) => choice.value);
  assert.equal(isDiscoveryReleasePayload(payload), false);

  payload.answers.workflow = [choices[0].value, choices[0].value];
  assert.equal(isDiscoveryReleasePayload(payload), false);
});

test("manual context must be the deterministic server contract", () => {
  const payload = validPayload();
  payload.website = null;
  payload.company = {
    ...buildManualCompanyContext("banking"),
    summary: "Client-authored public claim",
  };
  payload.companyContextToken = null;
  payload.answers.workflow = [workflowChoicesFor(payload.company)[0].value];
  payload.answers.friction = [frictionChoicesFor(payload.company.sector)[0].value];
  payload.contact.organisation = "Not provided";
  assert.equal(isDiscoveryReleasePayload(payload), false);
});
