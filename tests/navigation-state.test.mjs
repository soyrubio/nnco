import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isExactNavigationPage,
  isNavigationSection,
} from "../src/lib/navigation.ts";

const headerUrl = new URL("../src/components/Header.astro", import.meta.url);
const stylesUrl = new URL("../src/styles/global.css", import.meta.url);
const blogArticleUrl = new URL("../src/pages/blog/[slug].astro", import.meta.url);
const [headerSource, stylesSource, blogArticleSource] = await Promise.all([
  readFile(headerUrl, "utf8"),
  readFile(stylesUrl, "utf8"),
  readFile(blogArticleUrl, "utf8"),
]);

test("navigation page state requires normalized pathname equality", () => {
  const exactCases = [
    ["/", "/"],
    ["/blog", "/blog"],
    ["/blog/", "/blog"],
    ["/ai-first-enterprise/ai-audit", "/ai-first-enterprise/ai-audit/"],
  ];

  for (const [pathname, href] of exactCases) {
    assert.equal(isExactNavigationPage(pathname, href), true, `${pathname} -> ${href}`);
  }

  const nonExactCases = [
    ["/blog/article", "/blog"],
    ["/blogroll", "/blog"],
    ["/ai-first-enterprise/ai-audit", "/ai-first-enterprise"],
    ["/ai-first-enterprise-archive", "/ai-first-enterprise"],
    ["/company", "/"],
  ];

  for (const [pathname, href] of nonExactCases) {
    assert.equal(isExactNavigationPage(pathname, href), false, `${pathname} -> ${href}`);
  }
});

test("navigation section state accepts only exact paths and slash-delimited descendants", () => {
  assert.equal(isNavigationSection("/blog/article", "/blog"), true);
  assert.equal(
    isNavigationSection("/ai-first-enterprise/ai-audit", "/ai-first-enterprise"),
    true,
  );
  assert.equal(isNavigationSection("/blogroll", "/blog"), false);
  assert.equal(
    isNavigationSection("/ai-first-enterprise-archive", "/ai-first-enterprise"),
    false,
  );
  assert.equal(isNavigationSection("/company", "/"), false);
});

test("header keeps ancestor styling separate from exact page semantics", () => {
  assert.match(headerSource, /aria-current=\{isExactPage\(/);
  assert.match(headerSource, /data-current-section=\{isAncestorSection\(/);
  assert.match(headerSource, /<summary\s+data-current-section=/);
  assert.doesNotMatch(headerSource, /<summary\s+aria-current=/);
  assert.match(stylesSource, /\[data-current-section="true"\]/);
  assert.doesNotMatch(blogArticleSource, /<Header\s+currentPath="\/blog"/);
});

test("dropdown toggle cancels any pending pointerleave close before applying state", () => {
  assert.match(
    headerSource,
    /dropdown\.addEventListener\("toggle", \(\) => \{\s+cancelClose\(\);\s+if \(!dropdown\.open\) return;/,
  );
});
