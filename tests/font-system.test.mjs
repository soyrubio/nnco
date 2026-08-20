import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

const sources = Object.fromEntries(
  await Promise.all(
    Object.entries({
      layout: "../src/layouts/BaseLayout.astro",
      globalStyles: "../src/styles/global.css",
      discoveryStyles: "../src/styles/discovery.css",
      package: "../package.json",
      lockfile: "../pnpm-lock.yaml",
    }).map(async ([name, path]) => [name, await read(path)]),
  ),
);

test("Geist is the sole site text typeface", () => {
  assert.ok(
    sources.layout.includes(
      'href="https://fonts.googleapis.com/css2?family=Geist:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700&display=swap"',
    ),
  );
  assert.equal(sources.layout.match(/family=Geist:/g)?.length, 1);
  assert.doesNotMatch(sources.layout, /family=(?:Poppins|Ronzino|Inter):/);
  assert.match(
    sources.layout,
    /href="https:\/\/fonts\.googleapis\.com\/css2\?family=Material\+Symbols\+Outlined:/,
  );
  assert.match(sources.globalStyles, /--font-sans:\s*"Geist", sans-serif;/);
  assert.match(
    sources.globalStyles,
    /body\s*\{[^}]*font-family:\s*var\(--font-sans\);/s,
  );
  assert.match(
    sources.discoveryStyles,
    /\.discovery-app\s*\{[^}]*font-family:\s*var\(--font-sans\);/s,
  );
  assert.doesNotMatch(
    sources.globalStyles,
    /@font-face|Ronzino|Poppins|Helvetica|data-font/,
  );
  const removedTypefaceDependency = /@fontsource[^\n]*(?:ronzino|poppins)|\bronzino\b|\bpoppins\b/i;
  assert.doesNotMatch(sources.package, removedTypefaceDependency);
  assert.doesNotMatch(sources.lockfile, removedTypefaceDependency);
});

test("the typeface switcher and preference state are fully removed", async () => {
  assert.doesNotMatch(
    sources.layout,
    /FontSwitcher|font-preference|fontPreference|FONT_PREFERENCE|data-font|localStorage\.getItem\("nnco:font/,
  );
  for (const relativePath of [
    "../src/components/FontSwitcher.astro",
    "../src/lib/font-preference.ts",
    "../public/fonts/ronzino",
  ]) {
    await assert.rejects(access(new URL(relativePath, import.meta.url)), {
      code: "ENOENT",
    });
  }
});
