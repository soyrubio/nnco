import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hero = await readFile(
  new URL("../src/components/Hero.astro", import.meta.url),
  "utf8",
);

test("homepage hero frames play once after page load instead of following scroll", () => {
  assert.doesNotMatch(hero, /import \{ scroll \} from "motion"/);
  assert.doesNotMatch(hero, /scroll\(/);
  assert.match(
    hero,
    /const frameDurationsMs = \[140, 145, 150, 160, 175, 190, 210, 235, 265, 300\];/,
  );
  assert.match(hero, /const frameTransitionTimesMs = frameDurationsMs\.map/);
  assert.match(
    hero,
    /elapsedMs >= frameTransitionTimesMs\[desiredFrame\][\s\S]*?desiredFrame \+= 1;/,
  );
  assert.match(hero, /window\.requestAnimationFrame\(advanceFrame\)/);
  assert.match(hero, /window\.addEventListener\("nnco:page-ready", handlePageReady/);
  assert.match(hero, /hasPlayed = true;/);
  assert.match(hero, /desiredFrame < frameTransitionTimesMs\.length/);
  assert.match(hero, /prefers-reduced-motion: reduce/);
  assert.match(hero, /window\.cancelAnimationFrame\(animationFrameId\)/);
  assert.match(hero, /desiredFrame = 0;[\s\S]*?applyFrame\(0\)/s);

  assert.doesNotMatch(hero, /syncFrameToScroll|startScrollSequence/);
  assert.doesNotMatch(hero, /addEventListener\(["']scroll/);
  assert.doesNotMatch(hero, /setTimeout/);
});
