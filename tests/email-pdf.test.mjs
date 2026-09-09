import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { renderReportPdf } from "../src/server/email/report-pdf.ts";
import { opportunityReportFixture } from "./fixtures/opportunity-report.mjs";
import { opportunityReportIssues } from "../src/lib/discovery-report.ts";
const base = () => ({
  schemaVersion: 2,
  title: "Opportunity Discovery",
  generatedAt: "2026-09-09T12:00:00.000Z",
  ...opportunityReportFixture(),
});

test("email PDF is two A4 pages with metadata, embedded fonts and contact link", async () => {
  const bytes = await renderReportPdf(base(), "Česká pojišťovna");
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 2);
  assert.equal(pdf.getTitle(), "Opportunity Discovery");
  for (const page of pdf.getPages()) {
    assert.ok(Math.abs(page.getWidth() - 595.276) < 0.01);
    assert.ok(Math.abs(page.getHeight() - 841.89) < 0.01);
  }
  assert.ok(pdf.getPages()[1].node.Annots()?.size());
  assert.ok(bytes.length < 200_000);
});
test("long content within the current caps fits without dropping paragraphs", async () => {
  const report = base();
  const fill = (sentence, max) =>
    Array(Math.floor(max / (sentence.length + 1)))
      .fill(sentence)
      .join(" ");
  report.providedContext = fill(
    "Staff review documents and compare the supplied information before making a decision.",
    900,
  );
  report.sectorOpportunities = report.providedContext;
  report.areasIntro = fill(
    "These possibilities follow the supplied context.",
    220,
  );
  report.areas = Array.from({ length: 3 }, (_, i) => ({
    name: `Reviewing the information in submitted documents ${i + 1}`,
    explanation: fill(
      "AI could compare the supplied documents and highlight differences for the reviewer.",
      420,
    ),
  }));
  report.detail = {
    areaName: report.areas[0].name,
    paragraphs: Array(3).fill(
      fill("The reviewer checks the source before making a decision.", 240),
    ),
  };
  assert.deepEqual(opportunityReportIssues(report), []);
  const pdf = await PDFDocument.load(
    await renderReportPdf(report, "Example Insurance"),
  );
  assert.equal(pdf.getPageCount(), 2);
});
test("invalid content is rejected instead of sending a clipped or partial PDF", async () => {
  const report = base();
  report.providedContext = "x".repeat(901);
  await assert.rejects(
    renderReportPdf(report, "Example"),
    /Unsupported report/,
  );
});
