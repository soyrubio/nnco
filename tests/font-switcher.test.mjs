import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import {
  FONT_PREFERENCE_STORAGE_KEY,
  fontPreferenceOptions,
  isStoredFontPreference,
  storedFontPreferenceValues,
} from "../src/lib/font-preference.ts";

const sources = Object.fromEntries(
  await Promise.all(
    Object.entries({
      component: "../src/components/FontSwitcher.astro",
      footer: "../src/components/Footer.astro",
      layout: "../src/layouts/BaseLayout.astro",
      globalStyles: "../src/styles/global.css",
      discoveryStyles: "../src/styles/discovery.css",
      ronzinoLicense: "../public/fonts/ronzino/ofl.txt",
      package: "../package.json",
      lockfile: "../pnpm-lock.yaml",
    }).map(async ([name, path]) => [
      name,
      await readFile(new URL(path, import.meta.url), "utf8"),
    ]),
  ),
);

test("font options keep Helvetica as the empty default and allow three explicit alternatives", () => {
  assert.equal(FONT_PREFERENCE_STORAGE_KEY, "nnco:font:v1");
  assert.deepEqual(fontPreferenceOptions, [
    { value: "", label: "Helvetica" },
    { value: "geist", label: "Geist" },
    { value: "poppins", label: "Poppins" },
    { value: "ronzino", label: "Ronzino" },
  ]);
  assert.deepEqual(storedFontPreferenceValues, ["geist", "poppins", "ronzino"]);
  assert.equal(isStoredFontPreference("geist"), true);
  assert.equal(isStoredFontPreference("poppins"), true);
  assert.equal(isStoredFontPreference("ronzino"), true);
  for (const invalidValue of [undefined, null, "", "current", "other", "GEIST"]) {
    assert.equal(isStoredFontPreference(invalidValue), false);
  }
});

test("BaseLayout applies an allowlisted preference before font styles load", () => {
  assert.match(
    sources.layout,
    /<meta name="viewport"[^>]*\/>\s*<script[\s\S]*?localStorage\.getItem\(fontPreferenceStorageKey\)[\s\S]*?fontPreferenceValues\.includes\(storedFont\)[\s\S]*?document\.documentElement\.dataset\.font = storedFont;[\s\S]*?<meta name="generator"/,
  );
  assert.match(sources.layout, /try \{[\s\S]*?localStorage\.getItem[\s\S]*?\} catch \{\}/);
  assert.match(sources.layout, /<html lang="en">/);
  assert.doesNotMatch(sources.layout, /<html[^>]+data-font/);
});

test("Google Fonts connections and the combined text-font request are separate from symbols", () => {
  assert.match(
    sources.layout,
    /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com" \/>/,
  );
  assert.match(
    sources.layout,
    /<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin \/>/,
  );
  assert.ok(
    sources.layout.includes(
      'href="https://fonts.googleapis.com/css2?family=Geist:ital,wght@0,100..900;1,100..900&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"',
    ),
  );
  assert.equal(sources.layout.match(/family=Geist:/g)?.length, 1);
  assert.equal(sources.layout.match(/family=Poppins:/g)?.length, 1);
  assert.match(
    sources.layout,
    /href="https:\/\/fonts\.googleapis\.com\/css2\?family=Material\+Symbols\+Outlined:/,
  );
  assert.doesNotMatch(sources.layout, /@fontsource-variable\/geist/);
  assert.doesNotMatch(sources.package, /@fontsource-variable\/geist/);
  assert.doesNotMatch(sources.lockfile, /@fontsource-variable\/geist/);
});

test("BaseLayout exposes one labelled native select on every route", () => {
  assert.match(
    sources.layout,
    /<div data-page-content>\s*<slot \/>\s*<FontSwitcher \/>\s*<\/div>/,
  );
  assert.doesNotMatch(sources.footer, /FontSwitcher|font-switcher/);
  assert.match(
    sources.component,
    /<label for="font-switcher-typeface">Typeface<\/label>\s*<select id="font-switcher-typeface" data-font-select>/,
  );
  assert.match(
    sources.component,
    /fontPreferenceOptions\.map\(\(option\) => \([\s\S]*?<option value=\{option\.value\}>\{option\.label\}<\/option>/,
  );
  assert.doesNotMatch(sources.component, /role="(?:listbox|option)"/);
});

test("font changes persist safely, synchronize across tabs, and ignore invalid values", () => {
  assert.match(
    sources.component,
    /if \(value !== "" && !isStoredFontPreference\(value\)\) \{[\s\S]*?return;/,
  );
  assert.match(
    sources.component,
    /root\.removeAttribute\("data-font"\)[\s\S]*?root\.dataset\.font = preference/,
  );
  assert.match(
    sources.component,
    /localStorage\.removeItem\(FONT_PREFERENCE_STORAGE_KEY\)[\s\S]*?localStorage\.setItem\(FONT_PREFERENCE_STORAGE_KEY, preference\)[\s\S]*?\} catch \{\}/,
  );
  assert.match(
    sources.component,
    /window\.addEventListener\("storage", \(event\) => \{[\s\S]*?event\.key !== FONT_PREFERENCE_STORAGE_KEY[\s\S]*?event\.newValue === null[\s\S]*?isStoredFontPreference\(event\.newValue\)/,
  );
});

test("Ronzino ships only licensed normal WOFF2 faces used by the site", async () => {
  const fontDirectory = new URL("../public/fonts/ronzino/", import.meta.url);
  const expectedFaces = [
    {
      file: "ronzino-regular.woff2",
      weight: 400,
      sha256: "09db749b24418d4e82df2ca476f800d52c69e163b3d8120191db01f92fad45b1",
    },
    {
      file: "ronzino-medium.woff2",
      weight: 500,
      sha256: "27f171925cd2ad209df79ceb0c9eeb33b774b4229a15bec1018399a0d339052f",
    },
    {
      file: "ronzino-bold.woff2",
      weight: 700,
      sha256: "f686a12c16f629ceeb71996830ae7c899b6524bc724030f7a97fec63b4d4e625",
    },
  ];
  assert.deepEqual((await readdir(fontDirectory)).sort(), [
    "ofl.txt",
    "ronzino-bold.woff2",
    "ronzino-medium.woff2",
    "ronzino-regular.woff2",
  ]);
  assert.match(sources.ronzinoLicense, /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.match(
    sources.ronzinoLicense,
    /Permission is hereby granted, free of charge,[\s\S]*?merge, embed, modify,\s*redistribute/,
  );

  const faceBlocks = [
    ...sources.globalStyles.matchAll(/@font-face\s*\{([^}]+)\}/gs),
  ].map((match) => match[1]);
  assert.equal(faceBlocks.length, 3);
  assert.doesNotMatch(sources.globalStyles, /Ronzino-[^")]*Oblique|font-style:\s*oblique/);
  for (const face of expectedFaces) {
    const asset = await readFile(new URL(face.file, fontDirectory));
    assert.equal(asset.subarray(0, 4).toString("ascii"), "wOF2", face.file);
    assert.equal(
      createHash("sha256").update(asset).digest("hex"),
      face.sha256,
      face.file,
    );
    const block = faceBlocks.find((candidate) =>
      candidate.includes("/fonts/ronzino/" + face.file),
    );
    assert.ok(block, face.file + ": @font-face");
    assert.match(block, /font-family:\s*"Ronzino";/);
    assert.match(block, new RegExp("font-weight:\\s*" + face.weight + ";"));
    assert.match(block, /font-style:\s*normal;/);
    assert.match(block, /font-display:\s*swap;/);
  }
});

test("shared token covers marketing, discovery, print, focus, and mobile sizing without motion", () => {
  assert.match(
    sources.globalStyles,
    /--font-sans:\s*"Helvetica Neue", Helvetica, Arial, sans-serif;/,
  );
  assert.match(
    sources.globalStyles,
    /html\[data-font="geist"\]\s*\{\s*--font-sans:\s*"Geist", "Helvetica Neue", Helvetica, Arial, sans-serif;/,
  );
  assert.match(
    sources.globalStyles,
    /html\[data-font="poppins"\]\s*\{\s*--font-sans:\s*"Poppins", "Helvetica Neue", Helvetica, Arial, sans-serif;/,
  );
  assert.match(
    sources.globalStyles,
    /html\[data-font="ronzino"\]\s*\{\s*--font-sans:\s*"Ronzino", "Helvetica Neue", Helvetica, Arial, sans-serif;/,
  );
  assert.match(sources.globalStyles, /body\s*\{[^}]*font-family:\s*var\(--font-sans\);/s);
  assert.match(
    sources.discoveryStyles,
    /\.discovery-app\s*\{[^}]*font-family:\s*var\(--font-sans\);/s,
  );
  assert.doesNotMatch(
    sources.discoveryStyles,
    /font-family:\s*"(?:Geist|Poppins|Ronzino)"/,
  );
  assert.match(
    sources.component,
    /\.font-switcher\s*\{[^}]*position:\s*fixed;[^}]*z-index:\s*90;[^}]*right:\s*max\(var\(--gutter\), env\(safe-area-inset-right\)\);[^}]*bottom:\s*max\(1rem, env\(safe-area-inset-bottom\)\);/s,
  );
  assert.match(sources.component, /\.font-switcher select:focus-visible/);
  assert.match(
    sources.component,
    /@media \(max-width: 767px\)[\s\S]*?\.font-switcher select\s*\{[^}]*min-height:\s*3rem;/s,
  );
  assert.match(
    sources.component,
    /@media print\s*\{\s*\.font-switcher\s*\{\s*display:\s*none !important;/s,
  );
  assert.doesNotMatch(sources.component, /\banimation\b|\btransition\b/);
});
