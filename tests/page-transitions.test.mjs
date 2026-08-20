import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

const sources = Object.fromEntries(
  await Promise.all(
    Object.entries({
      layout: "../src/layouts/BaseLayout.astro",
      header: "../src/components/Header.astro",
      hero: "../src/components/Hero.astro",
      marketing: "../src/components/MarketingBehavior.astro",
      privateAi: "../src/components/PrivateAiBoundary.astro",
      company: "../src/pages/company.astro",
      styles: "../src/styles/global.css",
      design: "../DESIGN.md",
    }).map(async ([name, path]) => [name, await read(path)]),
  ),
);

test("BaseLayout enables instant Astro navigation without adding React", () => {
  assert.match(
    sources.layout,
    /import \{ ClientRouter \} from "astro:transitions";/,
  );
  assert.match(sources.layout, /<ClientRouter fallback="swap" \/>/);
  assert.match(sources.layout, /<div data-page-content>/);
  assert.doesNotMatch(sources.layout, /\bfade\b|transition:animate/);
  assert.doesNotMatch(sources.layout, /from "react"|from "react-dom"/);
  assert.match(
    sources.styles,
    /::view-transition-old\(root\),\s*::view-transition-new\(root\)\s*\{\s*animation:\s*none !important;/,
  );
});

test("client navigation skips the first-load cover", () => {
  assert.match(
    sources.layout,
    /document\.addEventListener\("astro:before-swap", \(event\) => \{[\s\S]*?event\.newDocument/,
  );
  assert.match(sources.layout, /event\.viewTransition\?\.skipTransition\(\);/);
  assert.match(
    sources.layout,
    /nextRoot\.classList\.add\("has-js", "skip-page-loader", "is-page-swapping"\);/,
  );
  assert.match(
    sources.layout,
    /nextDocument\.querySelector\("\[data-page-loader\]"\)\?\.remove\(\);/,
  );
  assert.match(
    sources.layout,
    /querySelector\("\[data-page-content\]"\)[\s\S]*?removeAttribute\("inert"\)/,
  );
  assert.match(
    sources.layout,
    /document\.addEventListener\("astro:page-load", \(\) => \{[\s\S]*?requestAnimationFrame[\s\S]*?classList\.remove\("is-page-swapping"\)/,
  );
  assert.match(
    sources.styles,
    /\.is-page-swapping \.site-header\s*\{\s*transition:\s*none !important;/,
  );
});

test("page-specific DOM behaviors reinitialize after every Astro swap", () => {
  for (const name of [
    "header",
    "hero",
    "marketing",
    "privateAi",
    "company",
  ]) {
    assert.match(
      sources[name],
      /document\.addEventListener\("astro:page-load",/,
      name,
    );
  }

  assert.match(sources.header, /navigationController\.abort\(\);/);
  assert.match(sources.hero, /dataset\.sequenceReady/);
  assert.match(sources.marketing, /dataset\.marketingBehaviorReady/);
  assert.match(sources.privateAi, /dataset\.privateAiBoundaryReady/);
  assert.match(sources.company, /dataset\.companyThesisReady/);
});

test("the design contract documents the restrained navigation behavior", () => {
  assert.match(
    sources.design,
    /Internal page\s+navigation uses Astro's client router with an immediate,\s+non-animated swap\./,
  );
  assert.match(
    sources.design,
    /client-side\s+behaviors reinitialize after each swap\./,
  );
});
