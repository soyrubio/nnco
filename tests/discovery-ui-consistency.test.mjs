import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { discoveryIntroGlyph } from "../src/data/glyphs.ts";
import { assertGlyphPattern, buildGlyphPath, hasGlyphSymmetry } from "../src/lib/glyph-generator.ts";

const styles = await readFile(
  new URL("../src/styles/discovery.css", import.meta.url),
  "utf8",
);
const release = await readFile(
  new URL("../src/components/DiscoveryRelease.tsx", import.meta.url),
  "utf8",
);
const copy = await readFile(new URL("../src/data/discovery.ts", import.meta.url), "utf8");

test("the report explains its purpose and evidence before offering AI opportunities", () => {
  const report = release.slice(release.indexOf("function DiscoveryReleaseReportView"), release.indexOf("function DiscoveryReportActions"));
  const order = ["discoveryReportCopy.purpose", "discoveryReportCopy.context", "current?.providedContext", "discoveryReportCopy.sectorOpportunities", "<DiscoveryReportFooter page={1}", "discoveryReportCopy.opportunities", "current.areasIntro", "areas.map", "current.detail.paragraphs"];
  const positions = order.map((item) => report.indexOf(item));
  assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])));
  assert.match(copy, /summary: "About this report"/);
  assert.match(copy, /context: "Provided context"/);
  assert.match(copy, /sectorOpportunities: "Sector opportunities"/);
  assert.match(copy, /opportunities: "Potential areas for improvement"/);
  assert.match(report, /discoveryReportCopy.detail}: \$\{current.detail.areaName}/);
  assert.equal(report.match(/<DiscoveryReportHeader label=\{discoveryReportCopy.title\}/g)?.length, 2);
  assert.match(copy, /closerLook: "One area in more detail"/);
  assert.match(copy, /suitability: "What we still need to know"/);
});

test("discovery error notices span the form column instead of inheriting the prose width", () => {
  assert.match(styles, /\.discovery-question > \.discovery-notice\s*\{\s*width: 100%;\s*max-width: none;/);
});

test("discovery fields use instructional placeholders", () => {
  assert.match(copy, /placeholder: "Provide your company URL"/);
  assert.match(copy, /placeholder: "Provide your work email"/);
  assert.match(copy, /placeholder: "Provide your own answer"/);
  assert.match(release, /placeholder=\{discoveryCopy.website.placeholder\}/);
  assert.match(release, /placeholder=\{discoveryCopy.contact.placeholder\}/);
  assert.doesNotMatch(release, /placeholder="(?:company\.com|name@company\.com)"/);
});

test("website entry uses short and distinct action labels", () => {
  assert.match(copy, /action: "Find company"/);
  assert.match(copy, /skip: "Skip website"/);
  assert.doesNotMatch(copy, /Find company information|Continue without a website/);
});

test("analysis loading uses the shorter diagnostic message", () => {
  assert.match(copy, /buildingReport: "Building the diagnostic\."/);
  assert.match(release, /<p>\{discoveryCopy.buildingReport\}<\/p>/);
  assert.doesNotMatch(release, /Building the two-page diagnostic/);
});

test("all discovery questions use full-column copy without stretching heading word spacing", () => {
  assert.match(styles, /\.discovery-question h1\s*\{\s*max-width: none;\s*margin: 0;\s*text-align: start;/);
  assert.match(styles, /\.discovery-question > p\s*\{\s*max-width: none;/);
  assert.doesNotMatch(styles, /text-align:\s*justify/);
  assert.doesNotMatch(styles, /\.discovery-release-website > h1/);
});

test("discovery leaves more space between titles and supporting text", () => {
  assert.match(styles, /\.discovery-question > h1 \+ p\s*\{\s*margin-top: 2rem;/);
  assert.match(styles, /\.discovery-question > p\s*\{\s*max-width: none;\s*margin: 1\.3rem 0 0;/);
});

test("discovery intro reuses a server-rendered modular glyph without decorating questions", async () => {
  const route = await readFile(new URL("../src/pages/discovery.astro", import.meta.url), "utf8");
  const launcher = await readFile(new URL("../src/components/DiscoveryLauncher.tsx", import.meta.url), "utf8");
  assert.match(route, /<DiscoveryLauncher client:load>\s*<ModularGlyph \{\.\.\.discoveryIntroGlyph\} \/>/);
  assert.match(launcher, /<DiscoveryRelease introGlyph=\{children\} \/>/);
  const intro = release.slice(release.indexOf('if (screen === "intro")'), release.indexOf('if (screen === "entry")'));
  assert.match(intro, /className="discovery-intro-glyph" aria-hidden="true">\{introGlyph\}/);
  assert.equal(release.match(/className="discovery-intro-glyph"/g)?.length, 1);
  assert.doesNotMatch(release, /from ["'][^"']*(?:glyph-generator|data\/glyphs)/);
  assert.equal(discoveryIntroGlyph.libraryId, "core-perimeter");
  assert.doesNotThrow(() => assertGlyphPattern(discoveryIntroGlyph));
  const path = buildGlyphPath(discoveryIntroGlyph);
  assert.ok(path.length > 0);
  for (const symmetry of ["horizontal", "vertical", "rotational", "diagonal"]) {
    assert.ok(hasGlyphSymmetry(discoveryIntroGlyph, symmetry));
  }
});

test("discovery right arrows share the canonical hover timing", () => {
  assert.match(
    styles,
    /transition: translate 260ms cubic-bezier\(0\.2, 0, 0, 1\);/,
  );
  assert.match(
    styles,
    /\.discovery-app a:hover \.nnco-arrow--right,\n\.discovery-app button:hover \.nnco-arrow--right \{\n  translate: 1px 0;\n\}/,
  );
  assert.match(styles, /\.discovery-app \.nnco-arrow--down \{\n  transform: rotate\(90deg\);\n\}/);
});

test("release discovery preserves the progress-left and one-question-right frame", () => {
  assert.match(release, /className="discovery-interaction"/);
  assert.match(release, /className="discovery-section-index"/);
  assert.match(release, /className="discovery-form-column"/);
  assert.match(release, /className=\{`discovery-options/);
  assert.match(release, /const WEBSITE_STEPS = \["Website", "Workflow", "Friction", "Frequency", "Systems", "Controls"\]/);
  assert.match(release, /const MANUAL_STEPS = \["Sector", "Workflow", "Friction", "Frequency", "Systems", "Controls"\]/);
  const frame = release.slice(
    release.indexOf("function DiscoveryIntakeFrame"),
    release.indexOf("function DiscoveryReleaseReportView"),
  );
  assert.doesNotMatch(frame, /<small>/);
});

test("release diagnostic supports a separate written answer on every multi-select", () => {
  assert.match(release, /activeQuestion.kind === "multi" &&[\s\S]*?discovery-answer-context[\s\S]*?<AutoExpandingTextarea/);
  assert.match(release, /maxLength=\{DISCOVERY_RELEASE_LIMITS.context\}/);
  assert.match(release, /className="discovery-answer-divider"/);
  assert.match(styles, /\.discovery-answer-context \{\s*margin-top: 3rem;/);
  assert.doesNotMatch(release, /What are you trying to improve/);
  assert.match(release, /body: JSON\.stringify\(\{ website \}\)/);
  const contactScreen = release.slice(release.indexOf('if (screen === "contact"'));
  assert.match(contactScreen, /type="email"/);
  assert.doesNotMatch(contactScreen, /autoComplete="name"/);
  assert.doesNotMatch(contactScreen, /autoComplete="organization"/);
});

test("release exposes capital markets and bounds workflow multiselect to two", () => {
  assert.match(release, /\{ value: "capital-markets", label: "Capital Markets" \}/);
  assert.match(copy, /Which processes would you like to improve\?/);
  assert.match(copy, /Choose up to two related processes, or describe your own\./);
  assert.match(
    release,
    /id: "workflow",[\s\S]*?kind: "multi",[\s\S]*?maximum: 2,[\s\S]*?choices: discoveryWorkflowOptions\(research, manualSector\)/,
  );
  assert.match(
    styles,
    /\.discovery-options--multi \{[\s\S]*?flex-direction: row;[\s\S]*?flex-wrap: wrap;[\s\S]*?border: 0;[\s\S]*?\}/,
  );
  assert.match(
    styles,
    /\.discovery-options--multi button,[\s\S]*?width: auto;[\s\S]*?border-radius: var\(--radius-button\);[\s\S]*?\}/,
  );
});

test("release introduces prefills without confirming answers or skipping review questions", () => {
  assert.match(release, /onClick=\{skipWebsite\}/);
  assert.match(release, /if \(screen === "sector"\)/);
  assert.match(release, /if \(screen === "context" && research\)/);
  assert.match(release, /discoveryCopy.research.message\(companyName\)/);
  assert.match(release, /className="discovery-research-sources"/);
  assert.match(copy, /Review them in the following questions/);
  assert.doesNotMatch(release, /<dt>Pages read<\/dt>/);
});

test("release progress text is rendered below the progress rule", () => {
  const frame = release.slice(release.indexOf("function DiscoveryIntakeFrame"));
  assert.ok(
    frame.indexOf('className="discovery-progress-track"') <
      frame.indexOf('className="discovery-progress-labels"'),
  );
  assert.match(
    styles,
    /\.discovery-bottom-bar \.discovery-progress-labels \{\s+margin-top: 0\.7rem;\s+margin-bottom: 0;/s,
  );
  assert.match(
    styles,
    /\.discovery-progress-track\s*\{[^}]*height:\s*var\(--structural-rule-thickness\);/s,
  );
  assert.match(
    styles,
    /\.discovery-progress-track > span\s*\{[^}]*width: max\(2rem, var\(--discovery-progress\)\);[^}]*transition: width 300ms ease-in-out;/s,
  );
  assert.match(
    styles,
    /\.discovery-report-page > header\s*\{[^}]*border-bottom:\s*var\(--structural-rule-thickness\) solid var\(--discovery-black\);/s,
  );
});

test("release moves focus through loading states and onto the final report", () => {
  assert.match(release, /transitionRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(release, /window.scrollTo\(\{ top: 0, behavior: "instant" \}\)/);
  assert.match(release, /role="status" aria-live="polite"/);
  assert.match(release, /reportHeadingRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(release, /<h1 ref=\{reportHeadingRef\} tabIndex=\{-1\}>/);
});

test("report uses the shared left-right grid with one responsive action group", () => {
  const reportView = release.slice(release.indexOf("function DiscoveryReleaseReportView"), release.indexOf("function DiscoveryReportHeader"));
  assert.match(reportView, /className="discovery-canvas"/);
  assert.match(reportView, /className="discovery-interaction discovery-report-layout"/);
  assert.match(reportView, /<aside className="discovery-report-sidebar" aria-label="Report actions"/);
  assert.match(reportView, /className="discovery-form-column discovery-report-reading"/);
  assert.match(reportView, /className="discovery-report-end">\s*<p className="discovery-report-disclaimer">\{discoveryReportCopy.disclaimer\}<\/p>/);
  assert.equal(reportView.match(/<DiscoveryReportActions onPrint=\{printReport\}/g)?.length, 1);
  assert.ok(reportView.indexOf('className="discovery-report-end"') < reportView.indexOf('<aside className="discovery-report-sidebar"'));
  assert.match(reportView, /href="\/contact">\{discoveryReportCopy.contact\}/);
  assert.doesNotMatch(reportView, /discovery-preview-toolbar|<iframe|<embed/);
  assert.match(release, /await prepareReportPrint\(reportPagesRef\.current\);\s+window\.print\(\);/);
  assert.match(release, /<img src=\{PRIMARY_LOGO\.src\}/);
});

test("report sidebar contains only the two text-only actions", () => {
  const reportView = release.slice(release.indexOf("function DiscoveryReleaseReportView"), release.indexOf("function DiscoveryReportHeader"));
  assert.match(reportView, /<aside className="discovery-report-sidebar" aria-label="Report actions">\s*<DiscoveryReportActions onPrint=\{printReport\} preparingPrint=\{preparingPrint\} \/>\s*<\/aside>/);
  const actions = reportView.slice(reportView.indexOf("function DiscoveryReportActions"));
  assert.doesNotMatch(actions, /BlockArrow|<svg|<img/);
  assert.doesNotMatch(reportView, /discoveryReportCopy\.(?:actionsTitle|pdfHelp)/);
  assert.match(reportView, /className="discovery-report-end">[\s\S]*?\{printError && <p className="discovery-report-error" role="alert">\{printError\}<\/p>\}/);
});

test("screen report is normal dark-page text while its actions remain reachable", () => {
  const screenStyles = styles.slice(styles.indexOf("@media screen"), styles.indexOf("@media print"));
  assert.match(screenStyles, /\.discovery-report-page\s*\{[^}]*min-height: 0;[^}]*padding: 0;[^}]*background: transparent;[^}]*color: inherit;/);
  assert.match(screenStyles, /\.discovery-report-page > header > img,\s*\.discovery-report-page > footer\s*\{\s*display: none;/);
  assert.match(screenStyles, /@media screen and \(min-width: 901px\)\s*\{\s*\.discovery-report-sidebar\s*\{\s*position: sticky;/);
  const desktopStyles = screenStyles.slice(screenStyles.indexOf("@media screen and (min-width: 901px)"), screenStyles.indexOf("@media screen and (max-width: 900px)"));
  assert.match(desktopStyles, /\.discovery-report-sidebar\s*\{[^}]*grid-column: 1;\s*grid-row: 1;/);
  assert.match(desktopStyles, /\.discovery-report-reading\s*\{\s*grid-column: 2;\s*grid-row: 1;/);
  const mobileStyles = screenStyles.slice(screenStyles.indexOf("@media screen and (max-width: 900px)"));
  assert.match(mobileStyles, /\.discovery-interaction\s*\{\s*grid-template-columns: minmax\(0, 1fr\);/);
  assert.doesNotMatch(mobileStyles, /grid-column: [12];|grid-row: 1;/);
  assert.doesNotMatch(screenStyles, /min-height: 690px|overflow-y: (?:auto|scroll)/);
});

test("print preserves report text and isolates the page from site chrome", () => {
  const printStyles = styles.slice(styles.indexOf("@media print"));
  assert.match(printStyles, /@page discovery-report\s*\{\s*size: A4 portrait;\s*margin: 0;/);
  assert.match(printStyles, /page: discovery-report;/);
  assert.match(printStyles, /body:has\(\.discovery-release-report\) \.site-header,/);
  assert.match(printStyles, /\.discovery-report-sidebar,\s*\.discovery-report-end,\s*\.discovery-bottom-bar\s*\{\s*display: none !important;/);
  assert.match(printStyles, /\.discovery-release-report \.discovery-canvas,\s*\.discovery-report-layout,\s*\.discovery-report-reading\s*\{\s*display: block;/);
  assert.doesNotMatch(printStyles, /line-clamp|overflow: hidden/);
  assert.doesNotMatch(styles, /@media \(max-width:/);
});

test("the final questionnaire answer leads to contact without offering report research", () => {
  assert.doesNotMatch(release, /setScreen\("competitor"\)|competitorChoice/);
  assert.doesNotMatch(copy, /Would you like a competitor comparison/);
  assert.match(release, /includeCompetitors: false/);
});
