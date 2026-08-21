import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const styles = await readFile(
  new URL("../src/styles/discovery.css", import.meta.url),
  "utf8",
);
const release = await readFile(
  new URL("../src/components/DiscoveryRelease.tsx", import.meta.url),
  "utf8",
);

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

test("release diagnostic uses URL entry followed by choices without free text", () => {
  assert.doesNotMatch(release, /<textarea/);
  assert.doesNotMatch(release, /What are you trying to improve/);
  assert.match(release, /body: JSON\.stringify\(\{ website, situation: "" \}\)/);
  const contactScreen = release.slice(release.indexOf('if (screen === "contact"'));
  assert.match(contactScreen, /type="email"/);
  assert.doesNotMatch(contactScreen, /autoComplete="name"/);
  assert.doesNotMatch(contactScreen, /autoComplete="organization"/);
});

test("release exposes capital markets and bounds workflow multiselect to two", () => {
  assert.match(release, /\{ value: "capital-markets", label: "Capital Markets" \}/);
  assert.match(release, /prompt: "Which workflows should we examine\?"/);
  assert.match(release, /help: "Choose up to two related processes\. We will assess them together\."/);
  assert.match(
    release,
    /id: "workflow",[\s\S]*?kind: "multi",[\s\S]*?maximum: 2,[\s\S]*?choices: workflowChoicesFor\(company\)/,
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

test("release supports skipping enrichment and confirms fetched context", () => {
  assert.match(release, />Continue without a website<\/button>/);
  assert.match(release, /if \(screen === "sector"\)/);
  assert.match(release, /if \(screen === "context" && company\)/);
  assert.match(release, /<h1 ref=\{headingRef\} tabIndex=\{-1\}>We found \{company\.name\}\.<\/h1>/);
  assert.match(release, /<dt>Pages read<\/dt>/);
});

test("release progress text is rendered below the progress rule", () => {
  const frame = release.slice(release.indexOf("function DiscoveryIntakeFrame"));
  assert.ok(
    frame.indexOf('className="discovery-progress-track"') <
      frame.indexOf('className="discovery-progress-labels"'),
  );
  assert.match(
    styles,
    /\.discovery-release-intake \.discovery-progress-labels \{\s+margin-top: 0\.7rem;\s+margin-bottom: 0;/s,
  );
  assert.match(
    styles,
    /\.discovery-progress-track\s*\{[^}]*height:\s*var\(--structural-rule-thickness\);/s,
  );
  assert.match(
    styles,
    /\.discovery-report-page > header\s*\{[^}]*border-top:\s*var\(--structural-rule-thickness\) solid var\(--discovery-black\);/s,
  );
});

test("release moves focus through loading states and onto the final report", () => {
  assert.match(release, /transitionRef\.current\?\.focus\(\)/);
  assert.match(release, /role="status" aria-live="polite"/);
  assert.match(release, /reportHeadingRef\.current\?\.focus\(\)/);
  assert.match(release, /<h1 ref=\{reportHeadingRef\} tabIndex=\{-1\}>/);
});

test("print report fields expose bounded line budgets instead of silent free growth", () => {
  assert.match(
    styles,
    /\.discovery-release-report \.discovery-report-title h1,[\s\S]*-webkit-line-clamp: 2;/,
  );
  assert.match(
    styles,
    /\.discovery-release-report \.discovery-report-title p,[\s\S]*-webkit-line-clamp: 3;/,
  );
});
