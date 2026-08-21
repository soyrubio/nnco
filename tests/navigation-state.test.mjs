import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isExactNavigationPage,
  isNavigationSection,
} from "../src/lib/navigation.ts";

const headerUrl = new URL("../src/components/Header.astro", import.meta.url);
const sectionFrameUrl = new URL("../src/components/SectionFrame.astro", import.meta.url);
const marketingBehaviorUrl = new URL("../src/components/MarketingBehavior.astro", import.meta.url);
const stylesUrl = new URL("../src/styles/global.css", import.meta.url);
const blogArticleUrl = new URL("../src/pages/blog/[slug].astro", import.meta.url);
const [headerSource, sectionFrameSource, marketingBehaviorSource, stylesSource, blogArticleSource] = await Promise.all([
  readFile(headerUrl, "utf8"),
  readFile(sectionFrameUrl, "utf8"),
  readFile(marketingBehaviorUrl, "utf8"),
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
  assert.match(
    headerSource,
    /class="site-nav-dropdown-trigger"[\s\S]*?data-current-section=/,
  );
  assert.match(headerSource, /class="site-nav-dropdown-trigger"[\s\S]*?aria-expanded="false"/);
  assert.doesNotMatch(
    headerSource,
    /DisclosureChevron/,
  );
  assert.match(stylesSource, /\[data-current-section="true"\]/);
  assert.doesNotMatch(blogArticleSource, /<Header\s+currentPath="\/blog"/);
});

test("dropdown entry cancels any pending pointerleave close before applying state", () => {
  assert.match(
    headerSource,
    /const openMegaMenu = \(trigger: HTMLButtonElement\) => \{[\s\S]*?cancelMegaMenuClose\(\);[\s\S]*?megaMenu\.dataset\.navigationState = "open";/,
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
  assert.match(stylesSource, /--nav-surface:\s*var\(--paper\);/);
  assert.match(
    stylesSource,
    /--nav-dropdown-surface:\s*var\(--nav-surface\);/,
  );
  assert.match(
    stylesSource,
    /\.site-header--over-hero:not\(\.is-scrolled\),\s*\.site-header\.is-over-dark\s*\{[^}]*--nav-surface:\s*var\(--ink\);/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav-mega__clip\s*\{[^}]*background:\s*var\(--nav-dropdown-surface\);/s,
  );
  assert.match(
    stylesSource,
    /\.site-header\s*\{[^}]*background:\s*var\(--nav-surface\);[^}]*color:\s*var\(--nav-text\);[^}]*backdrop-filter:\s*none;/s,
  );
  assert.match(
    stylesSource,
    /\.site-header--over-hero\s*\{[^}]*background:\s*var\(--nav-surface\);[^}]*color:\s*var\(--nav-text\);[^}]*backdrop-filter:\s*none;/s,
  );
  assert.match(
    stylesSource,
    /\.site-header--over-hero\.is-scrolled\s*\{[^}]*background:\s*var\(--nav-surface\);[^}]*color:\s*var\(--nav-text\);[^}]*backdrop-filter:\s*none;/s,
  );
  assert.doesNotMatch(stylesSource, /\.site-nav-mega__clip\s*\{[^}]*backdrop-filter:/s);
  assert.match(
    stylesSource,
    /\.site-nav-mega a:is\(:hover, :focus-visible\) strong,[\s\S]*?> span:not\(\.card-affordance\)\s*\{[^}]*opacity:\s*0\.62;/s,
  );
  assert.doesNotMatch(
    stylesSource,
    /\.site-nav-mega a:is\(:hover, :focus-visible\)[^{}]*\{[^}]*(?:background|color):/s,
  );
  assert.doesNotMatch(
    stylesSource,
    /\.site-header\.is-over-dark \.site-nav a,/,
  );
});

test("every dark section frame switches the shared marketing header tone", () => {
  assert.match(
    sectionFrameSource,
    /data-header-tone=\{tone === "dark" \? "dark" : undefined\}/,
  );
  assert.match(
    headerSource,
    /querySelectorAll<HTMLElement>\('\[data-header-tone="dark"\]'\)/,
  );
  assert.match(headerSource, /new IntersectionObserver\(/);
  assert.match(
    headerSource,
    /header\.classList\.toggle\("is-over-dark", activeDarkSections\.size > 0\)/,
  );
  assert.doesNotMatch(marketingBehaviorSource, /private-ai-section|is-over-dark/);
  assert.match(
    stylesSource,
    /\.site-header\.is-over-dark\s*\{[^}]*background:\s*var\(--nav-surface\);[^}]*color:\s*var\(--nav-text\);/s,
  );
  assert.match(
    stylesSource,
    /\.site-header\.is-over-dark \.site-nav > a:is\(:hover, :focus-visible\),/,
  );
});

test("desktop under-nav spans the viewport and keeps a ruled vertical link sequence", () => {
  assert.match(
    stylesSource,
    /\.site-nav-mega\s*\{[^}]*position:\s*absolute;[^}]*top:\s*100%;[^}]*right:\s*0;[^}]*left:\s*0;[^}]*display:\s*grid;/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav-mega__inner\s*\{[^}]*grid-template-columns:\s*minmax\(0, 2fr\) minmax\(0, 4fr\);/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav-mega__inner\[hidden\]\s*\{[^}]*display:\s*none;/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav-mega__links\s*\{[^}]*display:\s*grid;/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav-mega a \+ a\s*\{[^}]*border-top:\s*var\(--fine-rule-thickness\) solid currentColor;/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav-mega a\s*\{[^}]*padding:\s*1\.5rem 0;/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav-mega a\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;[^}]*grid-template-areas:\s*"title arrow"\s*"description arrow";[^}]*align-items:\s*start;[^}]*row-gap:\s*0\.75rem;/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav-mega a:first-child\s*\{[^}]*padding-top:\s*0;[^}]*\}[\s\S]*?\.site-nav-mega a:last-child\s*\{[^}]*padding-bottom:\s*0;/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav-mega a strong\s*\{[^}]*grid-area:\s*title;[^}]*font-size:\s*var\(--type-size-item-heading\);[^}]*font-weight:\s*var\(--type-weight-medium\);/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav-mega a > span:not\(\.card-affordance\)\s*\{[^}]*grid-area:\s*description;[^}]*font-size:\s*var\(--type-size-body\);[^}]*font-weight:\s*var\(--type-weight-regular\);/s,
  );
  assert.doesNotMatch(
    stylesSource,
    /\.site-nav-mega a > span:not\(\.card-affordance\)\s*\{[^}]*max-width:/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav-mega \.card-affordance\s*\{[^}]*grid-area:\s*arrow;[^}]*align-self:\s*center;[^}]*justify-self:\s*end;/s,
  );
  assert.match(
    headerSource,
    /class="site-nav-mega"[\s\S]*?class="content-rail site-nav-mega__inner"[\s\S]*?class="site-nav-mega__title"[\s\S]*?class="site-nav-mega__links"[\s\S]*?<CardAffordance \/>[\s\S]*?class="nnco-header-rule site-nav-mega__rule"/,
  );
  assert.doesNotMatch(
    stylesSource,
    /\.site-nav-mega\s+a:is\(\[aria-current="page"\], \[data-current-section="true"\]\)/,
  );
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
    /\.site-nav > a:is\(\[aria-current="page"\], \[data-current-section="true"\]\),\s*\.site-nav-dropdown-trigger\[data-current-section="true"\]\s*\{[^}]*font-weight:\s*var\(--type-weight-regular\);/s,
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
    /\.site-menu__content > a\s*\{[^}]*font-size:\s*var\(--type-size-body\);[^}]*font-weight:\s*var\(--type-weight-regular\);/s,
  );
});

test("desktop under-nav uses a shared, reversible grid reveal below the header", () => {
  assert.match(stylesSource, /--nav-control-height:\s*36px;/);
  assert.match(
    stylesSource,
    /\.site-nav-mega\s*\{[^}]*top:\s*100%;[^}]*grid-template-rows:\s*0fr;/s,
  );
  assert.match(
    stylesSource,
    /transition:\s*grid-template-rows 300ms ease-in-out 200ms;/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav-mega\[data-navigation-state="open"\]\s*\{[^}]*grid-template-rows:\s*1fr;/s,
  );
  assert.match(
    stylesSource,
    /transition:\s*grid-template-rows 300ms ease-in-out;/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav-mega__clip\s*\{[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav-mega__fade\s*\{[^}]*opacity:\s*0;[^}]*transition:\s*opacity 200ms ease-in-out;[^}]*\}[\s\S]*?\.site-nav-mega\[data-navigation-state="open"\] \.site-nav-mega__fade\s*\{[^}]*opacity:\s*1;[^}]*transition-delay:\s*200ms;/s,
  );
  assert.match(
    stylesSource,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.site-nav-mega,[\s\S]*?\.site-nav-mega__fade,[\s\S]*?transition:\s*none;/s,
  );
  assert.match(
    headerSource,
    /const scheduleMegaMenuClose = \(\) => \{[\s\S]*?window\.setTimeout\(closeMegaMenu, 120\);/,
  );
  assert.match(
    headerSource,
    /trigger\.addEventListener\("pointerenter", \(\) => \{[\s\S]*?openMegaMenu\(trigger\);[\s\S]*?trigger\.addEventListener\("pointerleave", \(\) => \{[\s\S]*?scheduleMegaMenuClose\(\);/,
  );
  assert.match(
    headerSource,
    /megaMenu\?\.addEventListener\("pointerenter", \(\) => \{[\s\S]*?cancelMegaMenuClose\(\);[\s\S]*?megaMenu\?\.addEventListener\("pointerleave", \(\) => \{[\s\S]*?scheduleMegaMenuClose\(\);/,
  );
});

test("moving between desktop dropdowns quickly fades swapped content without replaying the panel", () => {
  assert.match(
    headerSource,
    /const applyMegaMenuPanel = \([\s\S]*?const currentHeight = megaMenuClip\?\.getBoundingClientRect\(\)\.height[\s\S]*?panel\.hidden = panel\.dataset\.navigationPanel !== navigationKey;[\s\S]*?const nextHeight = megaMenuFade\.scrollHeight;/,
  );
  assert.match(
    headerSource,
    /megaMenuHeightAnimation = megaMenuClip\.animate\([\s\S]*?height: `\$\{currentHeight\}px`[\s\S]*?height: `\$\{nextHeight\}px`[\s\S]*?duration: 300, easing: "ease-in-out"/,
  );
  assert.match(
    headerSource,
    /!reducedNavigationMotion\.matches/,
  );
  assert.match(
    headerSource,
    /const outgoingAnimation = megaMenuFade\.animate\([\s\S]*?opacity: 0[\s\S]*?duration: 90, easing: "ease-in"[\s\S]*?const incomingAnimation = megaMenuFade\.animate\([\s\S]*?opacity: 1[\s\S]*?duration: 120, easing: "ease-out"/,
  );
  assert.match(
    headerSource,
    /selectMegaMenuPanel\(\s*navigationKey,\s*megaMenu\.dataset\.navigationState === "open",\s*\);/,
  );
  assert.match(
    stylesSource,
    /\.site-nav-mega__fade\s*\{[^}]*padding-bottom:\s*var\(--header-rule-height\);/s,
  );
  assert.match(
    stylesSource,
    /\.site-nav-mega__rule\s*\{[^}]*position:\s*absolute;[^}]*bottom:\s*0;[^}]*left:\s*50%;[^}]*transform:\s*translateX\(-50%\);/s,
  );
  assert.doesNotMatch(
    stylesSource,
    /\.site-nav-mega\[data-navigation-state="open"\]\s*\{[^}]*background:/s,
  );
  assert.match(
    headerSource,
    /dropdownTriggers\.forEach\(\(trigger\) => \{[\s\S]*?trigger\.addEventListener\("pointerenter",[\s\S]*?openMegaMenu\(trigger\);/,
  );
  assert.match(
    headerSource,
    /trigger\.addEventListener\("click", \(\) => openMegaMenu\(trigger\)\);/,
  );
  assert.doesNotMatch(
    headerSource,
    /activeDropdownTrigger === trigger[\s\S]*?closeMegaMenu\(\)/,
  );
});

test("phone navigation uses the same full-width ruled motion surface", () => {
  assert.match(
    headerSource,
    /class="site-menu__panel"[\s\S]*?class="site-menu__surface"[\s\S]*?class="content-rail site-menu__content"[\s\S]*?class="nnco-header-rule site-menu__rule"/,
  );
  assert.match(
    stylesSource,
    /\.site-menu__surface\s*\{[^}]*transform:\s*translateY\(-100%\);[^}]*transition:\s*transform 500ms ease-in-out;/s,
  );
  assert.match(
    stylesSource,
    /@media \(max-width: 767px\)[\s\S]*?\.site-menu__panel\s*\{[^}]*top:\s*calc\(100% \+ var\(--header-rule-height\)\);[^}]*left:\s*50%;[^}]*width:\s*100vw;[^}]*transform:\s*translateX\(-50%\);/s,
  );
  assert.match(
    stylesSource,
    /\.site-menu__content > \* \+ \*\s*\{[^}]*border-top:\s*var\(--fine-rule-thickness\) solid currentColor;/s,
  );
  assert.match(
    stylesSource,
    /\.site-menu__content > :first-child\s*\{[^}]*padding-top:\s*0;[^}]*\}[\s\S]*?\.site-menu__content > :last-child\s*\{[^}]*padding-bottom:\s*0;/s,
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

test("phone navigation uses a compact row and inset ruled subitems", () => {
  const phoneStart = stylesSource.indexOf("@media (max-width: 767px)");
  const phoneNavigationStart = stylesSource.indexOf(
    "@media (max-width: 767px)",
    stylesSource.indexOf("/* Marketing information architecture v2 */"),
  );

  assert.notEqual(phoneStart, -1);
  assert.notEqual(phoneNavigationStart, -1);
  assert.match(
    stylesSource.slice(phoneStart),
    /:root\s*\{[^}]*--header-height:\s*54px;[^}]*--header-logo-height:\s*40px;/s,
  );

  const phoneNavigation = stylesSource.slice(phoneNavigationStart);
  assert.match(
    phoneNavigation,
    /\.site-menu summary\s*\{[^}]*min-height:\s*44px;/s,
  );
  assert.match(
    phoneNavigation,
    /\.site-menu__links\s*\{[^}]*margin-inline-start:\s*1\.25rem;[^}]*border-top:\s*var\(--fine-rule-thickness\) solid var\(--nav-rule\);/s,
  );
  assert.match(
    phoneNavigation,
    /\.site-menu__links a \+ a\s*\{[^}]*border-top:\s*var\(--fine-rule-thickness\) solid var\(--nav-rule\);/s,
  );
});
