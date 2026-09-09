import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { homeBuildGlyphs } from "../src/data/glyphs.ts";
import { glyphLibrary } from "../src/data/glyph-references.ts";
import { homeBuildItems } from "../src/data/home.ts";
import {
  assertGlyphPattern,
  hasGlyphSymmetry,
} from "../src/lib/glyph-generator.ts";
import { homePhases } from "../src/data/programme.ts";

const sources = Object.fromEntries(
  await Promise.all(
    Object.entries({
      component: "../src/components/ExpandedDetailList.astro",
      card: "../src/components/EditorialCard.astro",
      cardAffordance: "../src/components/CardAffordance.astro",
      cardLayer: "../src/components/EditorialCardLayer.astro",
      glyph: "../src/components/ModularGlyph.astro",
      home: "../src/pages/index.astro",
      company: "../src/pages/company.astro",
      marketing: "../src/components/MarketingPage.astro",
      layout: "../src/layouts/BaseLayout.astro",
      anatomy: "../src/components/SectionAnatomy.astro",
      data: "../src/data/site.ts",
      styles: "../src/styles/global.css",
    }).map(async ([name, path]) => [
      name,
      await readFile(new URL(path, import.meta.url), "utf8"),
    ]),
  ),
);

test("expanded detail list keeps every title and body statically visible", () => {
  assert.match(
    sources.component,
    /items\.map\(\(item\) => \(\s*<article class="expanded-detail-list__item">[\s\S]*?<h3>\{item\.title\}<\/h3>\s*<p>\{item\.description\}<\/p>/,
  );
  assert.doesNotMatch(
    sources.component,
    /<details|<summary|DisclosureChevron|addEventListener|<script/,
  );
});

test("expanded detail media is optional and requires accessible image metadata", () => {
  assert.match(sources.component, /alt:\s*string;/);
  assert.match(sources.component, /width:\s*number;/);
  assert.match(sources.component, /height:\s*number;/);
  assert.match(sources.component, /kind\?:\s*"image" \| "icon";/);
  assert.match(
    sources.component,
    /\{item\.media && \(\s*<img[\s\S]*?src=\{item\.media\.src\}[\s\S]*?alt=\{item\.media\.alt\}[\s\S]*?width=\{item\.media\.width\}[\s\S]*?height=\{item\.media\.height\}/,
  );
});

test("editorial cards compose the shared bounded SVG grammar", () => {
  assert.match(
    sources.card,
    /glyph\?:\s*\{\s*gridSize:\s*number;\s*cells:\s*readonly ModularGlyphCell\[\];\s*symmetry:\s*ModularGlyphSymmetry;\s*\};/s,
  );
  assert.match(
    sources.card,
    /\{\s*glyph && \([\s\S]*?<ModularGlyph[\s\S]*?gridSize=\{glyph\.gridSize\}[\s\S]*?cells=\{glyph\.cells\}[\s\S]*?symmetry=\{glyph\.symmetry\}/,
  );
  assert.match(sources.glyph, /assertGlyphPattern\(\{ gridSize, cells \}\)/);
  assert.match(sources.glyph, /buildGlyphPath\(\{ gridSize, cells \}, cellSize, cellSize \/ 2\)/);
  assert.match(sources.glyph, /fill="currentColor"/);
  assert.match(sources.glyph, /fill-rule="evenodd"/);
  assert.match(sources.glyph, /shape-rendering="geometricPrecision"/);
  assert.match(sources.glyph, /aria-hidden=\{isLabelled \? undefined : "true"\}/);
  assert.match(sources.glyph, /cells must follow \$\{symmetry\} symmetry/);
  assert.doesNotMatch(sources.glyph, /<rect/);
  assert.doesNotMatch(sources.glyph, /<script|animate|transition:/);
});

test("editorial card layers own columns, surfaces and responsive collapse", () => {
  assert.match(sources.cardLayer, /colSize\?:\s*1 \| 2 \| 3;/);
  assert.match(sources.cardLayer, /surface\?:\s*"solid" \| "bordered";/);
  assert.match(sources.cardLayer, /colSize = 3,/);
  assert.match(sources.cardLayer, /surface = "solid",/);
  assert.match(
    sources.cardLayer,
    /grid-template-columns:\s*repeat\(var\(--editorial-card-columns\), minmax\(0, 1fr\)\);/,
  );
  assert.match(
    sources.cardLayer,
    /\.editorial-card-layer--solid\s*\{\s*--editorial-card-surface:\s*var\(--surface\);\s*gap:\s*clamp\(0\.75rem, 1\.5vw, 1\.25rem\);/s,
  );
  assert.match(
    sources.cardLayer,
    /\.editorial-card-layer--bordered\s*\{\s*--editorial-card-surface:\s*transparent;\s*gap:\s*0;/s,
  );
  assert.match(
    sources.styles,
    /\.editorial-card-layer--bordered\s*\{[^}]*border-top:\s*var\(--fine-rule-thickness\) solid currentColor;[^}]*border-left:\s*var\(--fine-rule-thickness\) solid currentColor;/s,
  );
  assert.match(
    sources.styles,
    /\.editorial-card-layer--bordered > \.editorial-card\s*\{[^}]*border-right:\s*var\(--fine-rule-thickness\) solid currentColor;[^}]*border-bottom:\s*var\(--fine-rule-thickness\) solid currentColor;/s,
  );
  assert.match(
    sources.cardLayer,
    /@media \(max-width: 767px\)[\s\S]*?--editorial-card-columns:\s*1;/s,
  );
  assert.match(
    sources.styles,
    /\.editorial-card\s*\{[^}]*padding:\s*clamp\(2rem, 3vw, 3rem\);[^}]*border:\s*0;[^}]*background:\s*var\(--editorial-card-surface, transparent\);/s,
  );
  assert.match(
    sources.styles,
    /\.editorial-card__glyph\s*\{[^}]*margin-bottom:\s*auto;[^}]*padding-bottom:\s*clamp\(3rem, 5vw, 5rem\);/s,
  );
  assert.doesNotMatch(sources.styles, /\.company-work \.editorial-card__glyph/);
  assert.doesNotMatch(
    sources.cardLayer,
    /:global\(\.editorial-card\)\s*\{[^}]*background:/s,
  );
  assert.doesNotMatch(sources.card, /surface\?:/);
  assert.doesNotMatch(sources.styles, /\.editorial-card-grid/);
});

test("expanded detail items use the shared medium separator and responsive stack", () => {
  assert.match(
    sources.component,
    /\.expanded-detail-list__item \+ \.expanded-detail-list__item\s*\{\s*border-top:\s*var\(--content-rule-thickness\) solid var\(--ink\);/s,
  );
  assert.match(
    sources.component,
    /@media \(max-width: 767px\)[\s\S]*?\.expanded-detail-list__item\s*\{[^}]*padding-block:\s*1\.75rem;/s,
  );
  assert.doesNotMatch(sources.component, /background:\s*var\(--ink\)/);
});

test("detail h3 stays smaller than the left-hand section title", () => {
  assert.match(
    sources.styles,
    /\.section-row\s*\{[^}]*--section-heading-size:\s*var\(--type-size-section-heading\);/s,
  );
  assert.match(
    sources.styles,
    /--type-size-section-heading:\s*clamp\(1\.375rem, 1\.85vw, 1\.75rem\);[\s\S]*?--type-size-section-title:\s*clamp\(1\.75rem, 2\.5vw, 2\.5rem\);/s,
  );
  assert.match(
    sources.styles,
    /\.section-anatomy__title\s*\{[^}]*color:\s*currentColor;[^}]*font-size:\s*var\(--type-size-section-title\);/s,
  );
  assert.match(
    sources.component,
    /\.expanded-detail-list h3\s*\{[^}]*color:\s*var\(--ink-soft\);[^}]*font-size:\s*var\(--section-heading-size\);/s,
  );
  assert.doesNotMatch(sources.styles, /(?:^|\n)h3\s*\{[^}]*--section-heading-size/s);
});

test("section anatomy uses a two-to-four default and keeps explicit content widths", () => {
  assert.doesNotMatch(sources.anatomy, /layout\?:/);
  assert.match(
    sources.anatomy,
    /contentWidth\?:\s*"50" \| "75" \| "100";/,
  );
  assert.match(
    sources.styles,
    /--section-grid-columns:\s*minmax\(0, 2fr\) minmax\(0, 4fr\);/,
  );
  assert.match(
    sources.styles,
    /\.section-anatomy--content-50 \.section-row\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/s,
  );
  assert.match(
    sources.styles,
    /\.section-anatomy--content-75 \.section-row\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 3fr\);/s,
  );
  assert.match(
    sources.styles,
    /\.section-anatomy--content-100 \.section-row\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);/s,
  );
  assert.match(
    sources.styles,
    /@media \(max-width: 767px\)[\s\S]*?\.section-anatomy--content-50 \.section-row,[\s\S]*?\.section-anatomy--content-75 \.section-row,[\s\S]*?\.section-anatomy--content-100 \.section-row\s*\{\s*grid-template-columns:\s*1fr;/s,
  );
  assert.match(
    sources.company,
    /<SectionAnatomy title="How we work" titleId="work-title" contentWidth="50">/,
  );
  assert.match(
    sources.home,
    /<SectionAnatomy title="What we build" titleId="build-title">/,
  );
  assert.match(
    sources.marketing,
    /const contentWidth = section\.contentWidth\s*\?\? \(section\.render === "ways-of-working" \? "50" : undefined\);[\s\S]*?contentWidth=\{contentWidth\}/,
  );
});

test("multi-column section headings stick within their row on desktop only", () => {
  assert.match(
    sources.styles,
    /@media \(min-width: 768px\)\s*\{[\s\S]*?\.section-row__heading\s*\{[^}]*position:\s*sticky;[^}]*top:\s*calc\(var\(--header-height\) \+ 1\.5rem\);[^}]*align-self:\s*start;[^}]*\}[\s\S]*?\.section-anatomy--content-100 \.section-row__heading\s*\{[^}]*position:\s*static;/s,
  );
  assert.doesNotMatch(sources.anatomy, /<script|client:/);
});

test("Home What we build renders the canonical data in original order", () => {
  assert.match(
    sources.home,
    /import EditorialCard[\s\S]*?import EditorialCardLayer[\s\S]*?import \{ homeBuildItems \} from "@\/data\/home";[\s\S]*?<SectionAnatomy title="What we build" titleId="build-title">\s*<EditorialCardLayer colSize=\{1\}>[\s\S]*?homeBuildItems\.map\(\(item\) => \(\s*<EditorialCard[\s\S]*?title=\{item\.title\}[\s\S]*?text=\{item\.description\}[\s\S]*?glyph=\{item\.glyph\}/,
  );

  assert.deepEqual(
    homeBuildItems.map(({ title, description }) => ({ title, description })),
    [
    {
      title: "Agents that run whole workflows",
      description:
        "An agent takes a process end to end: onboarding checks, document review, preparing a case for a human decision. It works inside your systems, not next to them.",
    },
    {
      title: "Documents and case files",
      description:
        "It reads contracts, statements and case files, pulls out the data and drafts the output. This is the work whole departments sit on today.",
    },
    {
      title: "Data that sits unused",
      description:
        "Data your teams never had time to use becomes an answer in seconds, with a link back to the record it came from.",
    },
    ],
  );
  assert.deepEqual(
    homeBuildItems.map((item) => item.glyph),
    homeBuildGlyphs,
  );
  assert.deepEqual(
    homeBuildGlyphs.map(({ libraryId, cells }) => ({ libraryId, cells })),
    ["cross-bridge", "parallel-rails", "dormant-data"].map((libraryId) => {
      const source = glyphLibrary.find((glyph) => glyph.id === libraryId);
      assert.ok(source);
      return { libraryId, cells: source.cells };
    }),
  );
  for (const { glyph, ...item } of homeBuildItems) {
    assert.equal("media" in item, false);
    assert.equal("href" in item, false);
    assert.equal(glyph.gridSize, 5);
    assert.doesNotThrow(() => assertGlyphPattern(glyph));
    if (glyph.symmetry !== "none") {
      assert.ok(hasGlyphSymmetry(glyph, glyph.symmetry));
    }
  }
});

test("Home audit-to-operation sequence uses the 50% single-column layout", () => {
  assert.match(
    sources.home,
    /<SectionAnatomy\s+title="From audit to operation"\s+titleId="sequence-title"\s+contentWidth="50"\s*>\s*<EditorialCardLayer colSize=\{1\}>[\s\S]*?homePhases\.map/,
  );
  assert.deepEqual(
    homePhases.map((phase) => phase.title),
    ["1/ AI Audit", "2/ Pilot in Production", "3/ Scale", "4/ Operation"],
  );
});

test("Home pilot-to-production section is text only", () => {
  assert.match(
    sources.home,
    /<SectionAnatomy title="From pilot to production" titleId="production-title">[\s\S]*?We build the part that gets it past the pilot:[\s\S]*?<\/SectionAnatomy>/,
  );
  assert.doesNotMatch(
    sources.home,
    /nnco-approach-frosted-figure-pixelated\.png|class="approach-layout"/,
  );
});

test("linked cards share the outlined arrow and complete inversion state", () => {
  assert.match(
    sources.home,
    /<SectionAnatomy title="Industries" titleId="industries-title">\s*<EditorialCardLayer colSize=\{2\} surface="bordered">[\s\S]*?sectors\.map\(\(sector\) => \(\s*<EditorialCard[\s\S]*?href=\{sector\.href\}[\s\S]*?<\/EditorialCardLayer>/,
  );
  assert.doesNotMatch(sources.card, /affordance\?:|variant=\{affordance\}/);
  assert.match(
    sources.card,
    /href && <CardAffordance \/>/,
  );
  assert.match(
    sources.cardAffordance,
    /class="card-affordance material-symbols-outlined"[\s\S]*?arrow_forward/,
  );
  assert.match(
    sources.layout,
    /icon_names=arrow_forward,keyboard_arrow_down,keyboard_arrow_up/,
  );
  assert.match(
    sources.styles,
    /\.card-affordance\s*\{[^}]*width:\s*2\.5rem;[^}]*height:\s*2\.5rem;[^}]*color:\s*currentColor;[^}]*font-size:\s*2\.5rem;[^}]*"FILL" 0,[^}]*"wght" 400,[^}]*"GRAD" 0,[^}]*"opsz" 40;/s,
  );
  assert.match(
    sources.styles,
    /a\.editorial-card:hover,\s*a\.editorial-card:focus-visible\s*\{\s*background:\s*var\(--ink\);\s*color:\s*var\(--paper\);/s,
  );
  assert.match(
    sources.styles,
    /a\.editorial-card p\s*\{[^}]*margin-bottom:\s*auto;[^}]*padding-bottom:\s*clamp\(2rem, 4vw, 3rem\);/s,
  );
  assert.doesNotMatch(sources.styles, /\.card-affordance\s*\{[^}]*filter:/s);
  assert.doesNotMatch(sources.home, /sector-panel-grid|variant="sector"/);
  assert.doesNotMatch(sources.styles, /\.sector-panel/);
});

test("Company How we work renders canonical data as homepage-style grey cards", () => {
  assert.match(
    sources.company,
    /import EditorialCard[\s\S]*?import EditorialCardLayer[\s\S]*?import \{ cardGlyphSets \} from "@\/data\/glyphs";[\s\S]*?import \{ team, teamIntro, waysOfWorking \}[\s\S]*?<SectionAnatomy title="How we work" titleId="work-title" contentWidth="50">\s*<EditorialCardLayer colSize=\{1\}>[\s\S]*?waysOfWorking\.map\(\(item, index\) => \([\s\S]*?<EditorialCard[\s\S]*?title=\{item\.title\}[\s\S]*?text=\{item\.description\}[\s\S]*?glyph=\{cardGlyphSets\.companyWaysOfWorking\[index\]\}[\s\S]*?<\/EditorialCardLayer>/,
  );
  assert.doesNotMatch(sources.company, /ExpandedDetailList/);
  assert.doesNotMatch(sources.company, /CompanyAccordion/);
  assert.match(
    sources.marketing,
    /import ExpandedDetailList[\s\S]*?import \{ waysOfWorking \} from "@\/data\/site";[\s\S]*?section\.render === "ways-of-working"[\s\S]*?<ExpandedDetailList items=\{waysOfWorking\} \/>/,
  );
  assert.doesNotMatch(sources.marketing, /CompanyAccordion/);

  const expectedTitles = [
    "The audit comes before the proposal",
    "Constraints shape the architecture",
    "We stay after launch",
    "We say when something is not worth building",
  ];
  let cursor = -1;
  for (const title of expectedTitles) {
    const index = sources.data.indexOf(`title: "${title}"`, cursor + 1);
    assert.ok(index > cursor, title);
    cursor = index;
  }
});
