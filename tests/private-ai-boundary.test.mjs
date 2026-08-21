import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("the homepage keeps the automatic in-view private AI boundary scene", async () => {
  const [component, home, marketingPage, design] = await Promise.all([
    read("../src/components/PrivateAiBoundary.astro"),
    read("../src/pages/index.astro"),
    read("../src/components/MarketingPage.astro"),
    read("../DESIGN.md"),
  ]);

  assert.match(home, /import PrivateAiBoundary/);
  assert.match(home, /<PrivateAiBoundary\s*\/>/);
  assert.doesNotMatch(home, /<SectionAnatomy title="Private AI"/);
  assert.doesNotMatch(marketingPage, /PrivateAiBoundary/);
  assert.match(marketingPage, /class="private-ai-lead__copy"/);
  assert.doesNotMatch(home, /nnco-private-ai-pixelated\.png/);
  assert.doesNotMatch(marketingPage, /nnco-private-ai-pixelated\.png/);

  assert.match(component, /data-private-ai-boundary/);
  assert.match(component, /<svg/);
  assert.match(component, /id="private-ai-plane"/);
  assert.match(component, /id="private-ai-wireframe"/);
  assert.match(component, /private-ai-boundary__core-plane--top/);
  assert.match(component, /private-ai-boundary__core-plane--right/);
  assert.match(component, /private-ai-boundary__core-plane--left/);
  assert.doesNotMatch(component, /private-ai-boundary__core-frame/);
  assert.match(component, /private-ai-boundary__cover--top/);
  assert.match(component, /private-ai-boundary__cover--right/);
  assert.match(component, /private-ai-boundary__cover--left/);
  assert.doesNotMatch(component, /scale\(0\.62\)/);
  assert.match(component, /fill: var\(--ink\)/);
  assert.match(component, /--private-ai-pane-outline: #eeeeee/);
  assert.match(component, /--private-ai-pane-outline: #777777/);
  assert.match(component, /--private-ai-pane-outline: #b8b8b8/);
  assert.match(component, /stroke: var\(--private-ai-pane-outline\)/);
  assert.match(component, /stroke: #ffffff/);
  assert.match(component, /--private-ai-entry-y: -92px/);
  assert.match(component, /--private-ai-entry-x: 79\.67px/);
  assert.match(component, /--private-ai-entry-x: -79\.67px/);
  assert.match(component, /--private-ai-entry-delay: 200ms/);
  assert.match(component, /--private-ai-entry-delay: 620ms/);
  assert.match(component, /--private-ai-entry-delay: 1040ms/);
  assert.match(component, /stroke-linecap: round/);
  assert.match(component, /stroke-linejoin: round/);
  assert.match(component, /private-ai-boundary__final-frame/);
  assert.match(component, /data-viewport-motion/);
  assert.match(
    component,
    /private-ai-cover-enter 980ms cubic-bezier\(0\.2, 0\.7, 0\.2, 1\)/,
  );
  assert.match(
    component,
    /private-ai-outline-handoff 420ms ease-in-out 2020ms/,
  );
  assert.match(
    component,
    /private-ai-frame-enter 420ms ease-in-out 2020ms/,
  );
  assert.match(component, /@keyframes private-ai-outline-resolve/);
  assert.doesNotMatch(component, /from "motion"|scroll\(render/);
  assert.doesNotMatch(component, /perspective|rotate[XY]\(/);
  assert.doesNotMatch(component, /IntersectionObserver/);
  assert.doesNotMatch(component, /animation-timeline/);
  assert.doesNotMatch(component, /addEventListener\(["']scroll/);
  assert.doesNotMatch(component, /requestAnimationFrame/);
  assert.match(component, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(design, /`PrivateAiBoundary`/);
  assert.match(design, /2\.44-second automatic/);
});
