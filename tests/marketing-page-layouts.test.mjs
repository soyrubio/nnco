import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { cardGlyphSets } from "../src/data/glyphs.ts";
import { homeBuildItems } from "../src/data/home.ts";
import { industries } from "../src/data/industries.ts";
import {
  programmePage,
  programmeSubpages,
} from "../src/data/programme.ts";

const section = (page, title) => {
  const match = page.sections.find((candidate) => candidate.title === title);
  assert.ok(match, `Missing section: ${title}`);
  return match;
};

const sources = Object.fromEntries(
  await Promise.all(
    Object.entries({
      marketing: "../src/components/MarketingPage.astro",
      layout: "../src/layouts/BaseLayout.astro",
      footer: "../src/components/Footer.astro",
      styles: "../src/styles/global.css",
    }).map(async ([name, path]) => [
      name,
      await readFile(new URL(path, import.meta.url), "utf8"),
    ]),
  ),
);

test("programme and audit sections use the requested shared card patterns", () => {
  const phases = section(programmePage, "Four phases");
  assert.equal(phases.contentWidth, "50");
  assert.deepEqual(phases.cards, {
    columns: 1,
    className: "home-operation-sequence",
  });
  assert.deepEqual(
    phases.items.map((item) => item.title.slice(0, 2)),
    ["1/", "2/", "3/", "4/"],
  );

  const capabilities = section(programmePage, "Core AI capabilities");
  assert.equal(capabilities.paragraphs, undefined);
  assert.deepEqual(capabilities.cards, { columns: 2, surface: "bordered" });
  const startingPoints = section(programmePage, "Common starting points");
  assert.equal(startingPoints.cards.columns, 1);
  assert.strictEqual(
    startingPoints.cards.glyphs,
    cardGlyphSets.commonStartingPoints,
  );
  assert.equal(startingPoints.cards.glyphs.length, startingPoints.items.length);

  const audit = programmeSubpages["ai-audit"];
  assert.deepEqual(section(audit, "What we examine").cards, {
    columns: 2,
    surface: "bordered",
  });
  const rankedPlan = section(audit, "Ranked build plan");
  assert.equal(rankedPlan.paragraphs, undefined);
  assert.equal(rankedPlan.contentWidth, "50");
  assert.equal(rankedPlan.cards.columns, 1);
  assert.strictEqual(rankedPlan.cards.glyphs, cardGlyphSets.rankedBuildPlan);
  assert.equal(rankedPlan.cards.glyphs.length, rankedPlan.items.length);
  const process = section(audit, "Audit process");
  assert.equal(process.contentWidth, "50");
  assert.deepEqual(process.cards, {
    columns: 1,
    className: "home-operation-sequence",
  });
  assert.deepEqual(
    process.items.map((item) => item.title.slice(0, 2)),
    ["1/", "2/", "3/", "4/", "5/", "6/"],
  );
});

test("Private AI and operation use their requested page and section treatments", () => {
  const privateAi = programmeSubpages["private-ai"];
  assert.equal(privateAi.tone, "dark");
  const lead = section(privateAi, "Private AI scope");
  assert.equal(lead.render, "highlighted-lead");
  assert.equal(lead.paragraphs, undefined);
  assert.ok(lead.lead.filter((segment) => segment.highlight).length >= 3);
  for (const segment of lead.lead.filter((candidate) => candidate.highlight)) {
    assert.ok(
      segment.text.trim().split(/\s+/).length <= 3,
      `Highlight is too long: ${segment.text}`,
    );
  }
  const criteria = section(privateAi, "Deployment criteria");
  assert.equal(criteria.groupLayout, "stacked-numbered");
  assert.deepEqual(
    criteria.groups.map((group) => group.title.slice(0, 2)),
    ["1/", "2/"],
  );
  assert.deepEqual(section(privateAi, "Inside the boundary").cards, {
    columns: 2,
    surface: "bordered",
  });

  const ongoing = section(programmeSubpages.operation, "Ongoing operation");
  assert.equal(ongoing.contentWidth, "50");
  assert.equal(ongoing.cards.columns, 1);
  assert.strictEqual(ongoing.cards.glyphs, cardGlyphSets.ongoingOperation);
  assert.equal(ongoing.cards.glyphs.length, ongoing.items.length);
});

test("industry workload and constraint inventories follow the inferred system", () => {
  const workloadGlyphs = {
    banking: cardGlyphSets.bankingWorkloads,
    insurance: cardGlyphSets.insuranceWorkloads,
    healthcare: cardGlyphSets.healthcareWorkloads,
    capitalMarkets: cardGlyphSets.capitalMarketsWorkloads,
  };

  for (const [key, page] of Object.entries(industries)) {
    const workload = page.sections.find((candidate) =>
      candidate.title.startsWith("AI-supported"),
    );
    assert.ok(workload, `${page.title} needs an AI-supported workload section`);
    assert.equal(workload.cards.columns, key === "insurance" ? 2 : 1);
    assert.strictEqual(workload.cards.glyphs, workloadGlyphs[key]);
    assert.equal(workload.cards.glyphs.length, workload.items.length);
    assert.deepEqual(section(page, "Design constraints").cards, {
      columns: 2,
      surface: "bordered",
    });
  }
});

test("the shared renderer applies data controls and the complete dark route", () => {
  assert.match(sources.marketing, /surface=\{section\.cards\?\.surface\}/);
  assert.match(sources.marketing, /class=\{section\.cards\?\.className\}/);
  assert.match(sources.marketing, /glyph=\{section\.cards\?\.glyphs\?\.\[itemIndex\]\}/);
  assert.match(sources.marketing, /section\.render === "highlighted-lead"/);
  assert.doesNotMatch(sources.marketing, /PrivateAiBoundary/);
  assert.match(sources.marketing, /<Header overHero=\{isDarkPage\} \/>/);
  assert.match(sources.marketing, /<Footer tone=\{page\.tone\} \/>/);
  assert.match(sources.layout, /tone === "dark" && "page-tone-dark"/);
  assert.match(sources.footer, /tone === "dark" && "site-footer--dark"/);
  assert.match(
    sources.styles,
    /\.editorial-page--dark \.editorial-hero,[\s\S]*?\.editorial-page--dark \.section-frame,[\s\S]*?\.editorial-page--dark \.terminal-section\s*\{[^}]*background:\s*var\(--ink\);/s,
  );
  assert.match(
    sources.styles,
    /\.private-ai-lead__copy\s*\{[^}]*grid-column:\s*2;[^}]*text-align:\s*justify;/s,
  );
  assert.match(
    sources.styles,
    /\.editorial-page--dark \.editorial-hero__inner\s*\{[^}]*padding-bottom:\s*clamp\(1\.25rem, 2vw, 1\.75rem\);/s,
  );
  assert.match(
    sources.styles,
    /\.editorial-group-grid--stacked-numbered ul\s*\{[^}]*padding-left:\s*0;[^}]*list-style:\s*none;/s,
  );
  assert.match(
    sources.styles,
    /\.editorial-group-grid--stacked-numbered li\s*\{[^}]*border-top:\s*var\(--fine-rule-thickness\) solid var\(--rule\);/s,
  );
  assert.match(
    sources.styles,
    /\.section-frame--dark :is\(p, li\),\s*\.editorial-page--dark :is\(p, li\)\s*\{\s*color:\s*var\(--dark-body\);/s,
  );
});

test("card glyph assignments are globally unique and bounded", () => {
  const glyphs = [
    ...homeBuildItems.map((item) => item.glyph),
    ...Object.values(cardGlyphSets).flat(),
  ];
  const signatures = glyphs.map((glyph) =>
    glyph.cells
      .map(([column, row]) => `${column}:${row}`)
      .sort()
      .join("|"),
  );

  assert.equal(glyphs.length, 46);
  assert.equal(new Set(signatures).size, glyphs.length);
  for (const glyph of glyphs) {
    assert.ok(glyph.cells.length >= 5 && glyph.cells.length <= 9);
  }
});
