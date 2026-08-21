import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("shared viewport motion replays only after a complete exit", async () => {
  const [controller, layout] = await Promise.all([
    read("../src/components/ViewportMotion.astro"),
    read("../src/layouts/BaseLayout.astro"),
  ]);

  assert.match(layout, /import ViewportMotion/);
  assert.match(layout, /<ViewportMotion \/>/);
  assert.match(controller, /const visibilityThreshold = 0\.15/);
  assert.match(controller, /threshold: \[0, visibilityThreshold\]/);
  assert.match(
    controller,
    /entry\.intersectionRatio >= visibilityThreshold[\s\S]*?classList\.add\("is-in-view"\)/,
  );
  assert.match(
    controller,
    /else if \(!entry\.isIntersecting\)[\s\S]*?classList\.remove\("is-in-view"\)/,
  );
  assert.match(controller, /nnco:page-ready/);
  assert.match(controller, /astro:page-load/);
  assert.match(controller, /astro:before-swap/);
  assert.match(controller, /viewportObserver\?\.disconnect\(\)/);
  assert.match(controller, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(controller, /addEventListener\(["']scroll/);
});

test("page and card copy use the restrained reveal while section titles stay static", async () => {
  const [hero, pageHero, sectionRow, card, company, styles, design] =
    await Promise.all([
      read("../src/components/Hero.astro"),
      read("../src/components/PageHero.astro"),
      read("../src/components/SectionRow.astro"),
      read("../src/components/EditorialCard.astro"),
      read("../src/pages/company.astro"),
      read("../src/styles/global.css"),
      read("../DESIGN.md"),
    ]);

  assert.match(hero, /class="hero__copy" data-viewport-motion/);
  assert.match(
    hero,
    /id="hero-title"[\s\S]*?data-viewport-motion-item[\s\S]*?--viewport-motion-distance: 2rem/,
  );
  assert.match(
    hero,
    /hero__introduction[\s\S]*?data-viewport-motion-item[\s\S]*?140ms/,
  );
  assert.match(pageHero, /editorial-hero__inner" data-viewport-motion/);
  assert.match(pageHero, /<h1 id=\{titleId\} data-viewport-motion-item>/);
  assert.match(pageHero, /editorial-hero__introduction[\s\S]*?140ms/);
  assert.doesNotMatch(sectionRow, /data-viewport-motion/);
  assert.match(sectionRow, /<h2 class="section-anatomy__title"/);
  assert.match(card, /href=\{href\}[\s\S]*?data-viewport-motion/);
  assert.match(
    card,
    /<h3 data-viewport-motion-item>\{title\}<\/h3>/,
  );
  assert.match(card, /<p[\s\S]*?data-viewport-motion-item[\s\S]*?140ms/);
  assert.match(company, /company-about__lead" data-viewport-motion/);

  assert.match(styles, /prefers-reduced-motion: no-preference/);
  assert.match(styles, /var\(--viewport-motion-distance, 1rem\)/);
  assert.match(
    styles,
    /viewport-motion-enter 900ms cubic-bezier\(0\.2, 0\.7, 0\.2, 1\)/,
  );
  assert.match(
    styles,
    /animation-delay: calc\(140ms \+ var\(--viewport-motion-delay, 0ms\)\)/,
  );
  assert.match(design, /after a 140ms entry pause/);
  assert.match(design, /homepage hero title uses a\s+more prominent 32px rise/);
  assert.match(design, /Section\s+titles remain static/);
  assert.match(design, /starts at 15% visibility/);
  assert.match(design, /resets only after the wrapper is fully outside/);
});
