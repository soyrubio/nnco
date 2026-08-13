import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("private AI sections share the view-triggered boundary scene", async () => {
  const [component, home, marketingPage, design, styles] = await Promise.all([
    read("../src/components/PrivateAiBoundary.astro"),
    read("../src/pages/index.astro"),
    read("../src/components/MarketingPage.astro"),
    read("../DESIGN.md"),
    read("../src/styles/global.css"),
  ]);

  assert.match(home, /import PrivateAiBoundary/);
  assert.match(home, /<PrivateAiBoundary\s*\/>/);
  assert.match(marketingPage, /import PrivateAiBoundary/);
  assert.match(marketingPage, /<PrivateAiBoundary\s*\/>/);
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
  assert.match(component, /0, -92, 238/);
  assert.match(component, /79\.67, 46, 119/);
  assert.match(component, /-79\.67, 46, 184/);
  assert.match(component, /rangeProgress\(coverProgress, 0\.18, 1\)/);
  assert.match(component, /outline\.style\.stroke = `rgb/);
  assert.match(component, /stroke-linecap: round/);
  assert.match(component, /stroke-linejoin: round/);
  assert.match(component, /private-ai-boundary__final-frame/);
  assert.match(component, /import \{ scroll \} from "motion"/);
  assert.match(component, /scroll\(render/);
  assert.match(component, /offset: \["start 60%", "start 10%"\]/);
  assert.match(component, /rangeProgress\(sceneProgress, 0\.84, 1\)/);
  assert.match(component, /outline\.style\.opacity = String\(1 - frameProgress\)/);
  assert.doesNotMatch(component, /perspective|rotate[XY]\(/);
  assert.doesNotMatch(component, /IntersectionObserver/);
  assert.doesNotMatch(component, /animation-timeline/);
  assert.doesNotMatch(component, /addEventListener\(["']scroll/);
  assert.doesNotMatch(component, /requestAnimationFrame/);
  assert.match(component, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(design, /`PrivateAiBoundary`/);
  assert.match(
    styles,
    /\.infrastructure-plate\s*\{[^}]*grid-template-columns:\s*minmax\(0, 3fr\) minmax\(0, 2fr\)/s,
  );
});
