import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const globalStyles = await readFile(new URL("../src/styles/global.css", import.meta.url), "utf8");
const discoveryStyles = await readFile(
  new URL("../src/styles/discovery.css", import.meta.url),
  "utf8",
);

async function collectStyleSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const sources = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      sources.push(...(await collectStyleSources(path)));
    } else if ([".astro", ".css"].includes(extname(entry.name))) {
      sources.push({ path, source: await readFile(path, "utf8") });
    }
  }

  return sources;
}

test("marketing typography exposes one semantic scale", () => {
  for (const token of [
    "--type-size-small: 0.875rem;",
    "--type-size-body: 1.0625rem;",
    "--type-size-body-large: clamp(1.0625rem, 1.25vw, 1.2rem);",
    "--type-size-item-heading: clamp(1.15rem, 1.7vw, 1.5rem);",
    "--type-size-section-heading: clamp(1.375rem, 1.85vw, 1.75rem);",
    "--type-size-section-title: clamp(1.75rem, 2.5vw, 2.5rem);",
    "--type-size-card-heading: clamp(1.5rem, 2.2vw, 2.25rem);",
    "--type-weight-regular: 400;",
    "--type-weight-medium: 500;",
    "--type-weight-bold: 700;",
  ]) {
    assert.match(globalStyles, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(
    globalStyles,
    /body\s*\{[^}]*font-size:\s*var\(--type-size-body\);[^}]*font-weight:\s*var\(--type-weight-regular\);[^}]*line-height:\s*var\(--type-leading-body\);/s,
  );
  assert.match(globalStyles, /--faint:\s*#606060;/);
  assert.match(
    globalStyles,
    /\.editorial-card h3\s*\{[^}]*font-size:\s*var\(--type-size-card-heading\);[^}]*font-weight:\s*var\(--type-weight-medium\);/s,
  );
  assert.match(
    globalStyles,
    /\.editorial-group h3\s*\{[^}]*font-size:\s*var\(--type-size-item-heading\);[^}]*font-weight:\s*var\(--type-weight-medium\);/s,
  );
});

test("all stylesheet font weights map to the three available font faces", async () => {
  const sources = await collectStyleSources(
    fileURLToPath(new URL("../src", import.meta.url)),
  );
  const allowed = new Set([
    "400",
    "500",
    "700",
    "var(--type-weight-regular)",
    "var(--type-weight-medium)",
    "var(--type-weight-bold)",
  ]);

  for (const { path, source } of sources) {
    for (const match of source.matchAll(/font-weight:\s*([^;]+);/g)) {
      assert.ok(allowed.has(match[1].trim()), `${path} uses unsupported font weight ${match[1].trim()}`);
    }
  }
});

test("Discovery has a scoped readable UI scale and separate screen report scale", () => {
  assert.match(
    discoveryStyles,
    /\.discovery-app\s*\{[^}]*--discovery-type-size-small:\s*var\(--type-size-small\);[^}]*--discovery-type-size-body:\s*var\(--type-size-control\);[^}]*--discovery-type-size-report-label:\s*0\.8125rem;[^}]*--discovery-type-size-report-meta:\s*0\.875rem;[^}]*--discovery-type-size-report-body:\s*0\.9375rem;/s,
  );
  assert.match(
    discoveryStyles,
    /\.discovery-section-index li\s*\{[^}]*font-size:\s*var\(--discovery-type-size-small\);[^}]*font-weight:\s*var\(--type-weight-medium\);/s,
  );
  assert.match(
    discoveryStyles,
    /@media screen\s*\{[\s\S]*?\.discovery-priorities p,[\s\S]*?font-size:\s*var\(--discovery-type-size-report-body\);/s,
  );
});

test("Discovery print report keeps its fixed A4 typography geometry", () => {
  const printStyles = discoveryStyles.slice(discoveryStyles.indexOf("@media print"));

  assert.match(
    printStyles,
    /\.discovery-report-page\s*\{[^}]*width:\s*210mm !important;[^}]*height:\s*297mm !important;[^}]*min-height:\s*297mm !important;[^}]*padding:\s*14mm !important;[^}]*line-height:\s*1\.5;/s,
  );
  assert.match(
    printStyles,
    /\.discovery-release-report \.discovery-report-title h1,\s*\.discovery-release-report \.discovery-report-title h2\s*\{\s*font-size:\s*12mm;/s,
  );
  assert.match(
    printStyles,
    /\.discovery-release-report \.discovery-report-title p\s*\{[^}]*font-size:\s*3\.6mm;/s,
  );
  assert.match(
    printStyles,
    /\.discovery-release-report \.discovery-priorities h3\s*\{[^}]*font-size:\s*5mm;/s,
  );
  assert.match(
    printStyles,
    /\.discovery-release-report \.discovery-priorities p\s*\{[^}]*font-size:\s*3mm;/s,
  );
  assert.doesNotMatch(printStyles, /var\(--discovery-type-size-report-/);
});
