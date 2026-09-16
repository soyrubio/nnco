import assert from "node:assert/strict";
import test from "node:test";
import { isOpportunityReportContent, isOpportunityDiscoveryReport, opportunityReportIssues } from "../src/lib/discovery-report.ts";
import { isDiscoveryReleaseReport } from "../src/lib/discovery-release.ts";
import { opportunityReportFixture } from "./fixtures/opportunity-report.mjs";

const stored = content => ({ ...content, schemaVersion: 2, generatedAt: "2026-09-07T12:00:00.000Z", title: "Opportunity Discovery" });

test("stored report validation accepts the new content contract and valid server metadata", () => {
  const report = stored(opportunityReportFixture());
  assert.equal(isOpportunityReportContent(report), true);
  assert.equal(isDiscoveryReleaseReport(report), true);
  assert.equal(isOpportunityDiscoveryReport({ ...report, generatedAt: "invalid" }), false);
  assert.equal(isOpportunityDiscoveryReport({ ...report, title: "Different report" }), false);
});

test("content validation rejects incomplete, missing or unrelated detail without throwing", () => {
  for (const change of [
    report => { report.areas = report.areas.slice(0, 1); },
    report => { report.areas = [null, null]; },
    report => { report.detail = null; },
    report => { report.detail.paragraphs = ["One paragraph."]; },
    report => { report.detail.paragraphs[0] = "An unfinished example"; },
    report => { report.detail.areaName = "A different opportunity"; },
    report => { report.areas[1].name = report.areas[0].name; },
    report => { report.providedContext = " "; },
    report => { report.areasIntro = null; },
    report => { report.areasIntro = "**Formatted** prose."; },
  ]) {
    const report = opportunityReportFixture();
    change(report);
    assert.equal(isOpportunityReportContent(report), false);
  }
  assert.equal(isOpportunityReportContent(null), false);
});

test("sentence checks respect quoted sentence endings and the 25-word boundary", () => {
  const report = opportunityReportFixture();
  report.detail.paragraphs[0] = `The customer says, “${Array(21).fill("word").join(" ")}. ” AI could compare the statement with the supplied requirement.`.replace('. ”', '.”');
  assert.equal(isOpportunityReportContent(report), true);
  report.areasIntro = `${Array(25).fill("word").join(" ")}.`;
  assert.equal(isOpportunityReportContent(report), true);
  report.areasIntro = `${Array(26).fill("word").join(" ")}.`;
  assert.ok(opportunityReportIssues(report).some(issue => issue.includes("25 words")));
});

test("character caps and the shared page-two budget reject copy rather than truncating it", () => {
  const report = opportunityReportFixture();
  report.providedContext = "Short sentence. ".repeat(70);
  assert.equal(isOpportunityReportContent(report), false);
  assert.ok(report.providedContext.length > 900);
  const page = opportunityReportFixture();
  page.areas = Array.from({ length: 3 }, (_, index) => ({ name: `Area ${index}`, explanation: "A useful explanation. ".repeat(19).trim() }));
  page.detail = { areaName: "Area 0", paragraphs: Array(3).fill("A useful explanation. ".repeat(20).trim()) };
  const issues = opportunityReportIssues(page);
  assert.deepEqual(issues, ["Page two: use at most 2400 characters across the introduction, area names, explanations and detail."]);
});
