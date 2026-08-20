import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sources = Object.fromEntries(
  await Promise.all(
    Object.entries({
      chevron: "../src/components/DisclosureChevron.astro",
      faq: "../src/components/FaqList.astro",
      header: "../src/components/Header.astro",
      styles: "../src/styles/global.css",
    }).map(async ([name, path]) => [
      name,
      await readFile(new URL(path, import.meta.url), "utf8"),
    ]),
  ),
);

test("header and FAQ disclosures compose the same decorative chevron", () => {
  assert.match(
    sources.chevron,
    /<span class="disclosure-chevron" aria-hidden="true">[\s\S]*?class="material-symbols-outlined navigation-caret__down"[\s\S]*?keyboard_arrow_down[\s\S]*?class="material-symbols-outlined navigation-caret__up"[\s\S]*?keyboard_arrow_up/,
  );
  assert.match(
    sources.header,
    /import DisclosureChevron[\s\S]*?<DisclosureChevron \/>[\s\S]*?<DisclosureChevron \/>/,
  );
  assert.match(
    sources.faq,
    /import DisclosureChevron[\s\S]*?<details name=\{groupName\}>\s*<summary>[\s\S]*?<DisclosureChevron \/>[\s\S]*?<div class="faq-list__answer">/,
  );
  assert.doesNotMatch(sources.faq, /BlockArrow|rotate\(|transition:/);
});

test("disclosure chevrons hard-switch glyphs through native open state", () => {
  assert.match(
    sources.styles,
    /\.disclosure-chevron > \.navigation-caret__up\s*\{\s*display:\s*none;/s,
  );
  assert.match(
    sources.styles,
    /details\[open\] > summary \.disclosure-chevron > \.navigation-caret__down\s*\{\s*display:\s*none;/s,
  );
  assert.match(
    sources.styles,
    /details\[open\] > summary \.disclosure-chevron > \.navigation-caret__up\s*\{\s*display:\s*inline-block;/s,
  );
});

test("FAQ and Contact separators share one opaque thickness contract", () => {
  assert.match(sources.styles, /--fine-rule-thickness:\s*1px;/);
  assert.match(
    sources.styles,
    /--content-rule-thickness:\s*var\(--fine-rule-thickness\);/,
  );
  assert.match(
    sources.faq,
    /\.faq-list details \+ details\s*\{\s*border-top:\s*var\(--content-rule-thickness\) solid currentColor;/s,
  );
  assert.doesNotMatch(sources.faq, /border-color:\s*rgba/);
  assert.match(
    sources.styles,
    /\.alternate-contact-grid__separator\s*\{[^}]*height:\s*var\(--content-rule-thickness\);[^}]*background:\s*var\(--ink\);/s,
  );
  assert.match(
    sources.styles,
    /\.news-list > li \+ li\s*\{\s*border-top:\s*var\(--content-rule-thickness\) solid var\(--ink\);/s,
  );
});

test("FAQ summaries remove fixed height while only the first is top-flush", () => {
  assert.match(
    sources.faq,
    /\.faq-list summary\s*\{[^}]*padding:\s*1\.5rem 0;/s,
  );
  assert.match(
    sources.faq,
    /\.faq-list details:first-child summary\s*\{\s*padding-top:\s*0;/s,
  );
  assert.doesNotMatch(sources.faq, /min-height:/);
  assert.match(
    sources.faq,
    /@media \(max-width: 767px\)[\s\S]*?\.faq-list summary\s*\{[^}]*padding:\s*1\.25rem 0;[^}]*\}[\s\S]*?\.faq-list details:first-child summary\s*\{\s*padding-top:\s*0;/s,
  );
  assert.match(
    sources.faq,
    /\.faq-list__answer\s*\{[^}]*padding:\s*0 clamp\(3rem, 8vw, 8rem\) 2\.25rem 0;/s,
  );
});
