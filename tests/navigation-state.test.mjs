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

test("header stacking keeps navigation overlays above the structural rule", () => {
  assert.match(stylesSource, /--header-layer-rule:\s*0;/);
  assert.match(stylesSource, /--header-layer-content:\s*1;/);
  assert.match(stylesSource, /--header-layer-navigation:\s*2;/);
  assert.match(
    stylesSource,
    /\.nnco-header-rule\s*\{[^}]*z-index:\s*var\(--header-layer-rule, 0\);/s,
  );
  assert.match(
    stylesSource,
    /\.site-header__inner\s*\{[^}]*z-index:\s*var\(--header-layer-content\);/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav\s*\{[^}]*z-index:\s*var\(--header-layer-navigation\);/s,
  );
  assert.doesNotMatch(stylesSource, /z-index:\s*(?:19|20);/);
});

test("desktop dropdown palette follows the header tone", () => {
  assert.match(stylesSource, /--nav-dropdown-surface:\s*var\(--paper\);/);
  assert.match(
    stylesSource,
    /\.site-header--over-hero:not\(\.is-scrolled\),\s*\.site-header\.is-over-dark\s*\{[^}]*--nav-dropdown-surface:\s*var\(--ink\);/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav-dropdown__panel\s*\{[^}]*background-color:\s*var\(--nav-dropdown-surface\);[^}]*color:\s*var\(--nav-dropdown-text\);/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav-dropdown__panel a:is\(:hover, :focus-visible\)\s*\{[^}]*background:\s*var\(--nav-dropdown-active-surface\);[^}]*color:\s*var\(--nav-dropdown-active-text\);/s,
  );
  assert.doesNotMatch(
    stylesSource,
    /\.site-header--over-hero\.is-over-dark \.site-nav a,/,
  );
});

test("desktop dropdown outer border and item separators share one rule", () => {
  assert.match(
    stylesSource,
    /\.site-nav-dropdown__panel\s*\{[^}]*border:\s*1px solid var\(--nav-dropdown-rule\);/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav-dropdown__panel a:nth-child\(odd\)\s*\{[^}]*border-right:\s*1px solid var\(--nav-dropdown-rule\);/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav-dropdown__panel a:nth-child\(-n \+ 2\)\s*\{[^}]*border-bottom:\s*1px solid var\(--nav-dropdown-rule\);/s,
  );
  assert.doesNotMatch(stylesSource, /--nav-dropdown-border:/);
});

test("desktop navigation and diagnosis action remain vertically centered", () => {
  assert.match(
    headerSource,
    /<Button href="\/discovery" size="small" class="site-header__cta">/,
  );
  assert.match(stylesSource, /--header-height:\s*80px;/);
  assert.match(stylesSource, /--header-logo-height:\s*60px;/);
  assert.match(
    stylesSource,
    /\.site-header__inner\s*\{[^}]*align-items:\s*center;/s,
  );
  assert.doesNotMatch(stylesSource, /--header-control-bottom-inset:/);
  assert.doesNotMatch(
    stylesSource,
    /\.site-nav,\s*\.site-header__cta\s*\{[^}]*(?:align-self|margin-block-end):/s,
  );
});

test("primary navigation is larger and lighter across desktop and mobile", () => {
  assert.match(
    stylesSource,
    /\.site-nav\s*\{[^}]*font-size:\s*var\(--type-size-control\);[^}]*font-weight:\s*var\(--type-weight-regular\);/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav > a:is\(\[aria-current="page"\], \[data-current-section="true"\]\),[\s\S]*?> summary:is\(\[aria-current="page"\], \[data-current-section="true"\]\)\s*\{[^}]*font-weight:\s*var\(--type-weight-regular\);/s,
  );
  assert.match(
    stylesSource,
    /\.site-menu summary\s*\{[^}]*font-size:\s*var\(--type-size-control\);[^}]*font-weight:\s*var\(--type-weight-regular\);/s,
  );
  assert.match(
    stylesSource,
    /\.site-menu__links a\s*\{[^}]*font-size:\s*var\(--type-size-body\);[^}]*font-weight:\s*var\(--type-weight-regular\);/s,
  );
  assert.match(
    stylesSource,
    /\.site-menu__panel > a\s*\{[^}]*font-size:\s*var\(--type-size-body\);[^}]*font-weight:\s*var\(--type-weight-regular\);/s,
  );
});

test("desktop dropdown and pointer bridge share the canonical gap", () => {
  assert.match(stylesSource, /--nav-dropdown-gap:\s*0\.75rem;/);
  assert.doesNotMatch(stylesSource, /--nav-dropdown-offset:/);
  assert.match(
    stylesSource,
    /\.site-nav-dropdown\[open\]::after\s*\{[^}]*height:\s*var\(--nav-dropdown-gap\);/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav-dropdown__panel\s*\{[^}]*top:\s*calc\(100% \+ var\(--nav-dropdown-gap\)\);/s,
  );
});

test("mobile header keeps the menu and hides the diagnosis action", () => {
  const responsiveHeaderStart = stylesSource.indexOf(
    "@media (max-width: 1180px)",
  );
  const responsiveHeaderEnd = stylesSource.indexOf(
    "@media (min-width: 768px) and (max-width: 1180px)",
    responsiveHeaderStart,
  );
  const responsiveHeader = stylesSource.slice(
    responsiveHeaderStart,
    responsiveHeaderEnd,
  );

  assert.notEqual(responsiveHeaderStart, -1);
  assert.notEqual(responsiveHeaderEnd, -1);
  assert.match(
    responsiveHeader,
    /\.site-header__inner\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;/s,
  );
  assert.match(
    responsiveHeader,
    /\.site-menu\s*\{[^}]*display:\s*block;/s,
  );
  assert.match(
    responsiveHeader,
    /\.site-header__cta\s*\{[^}]*display:\s*none;/s,
  );
});
