import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hero = await readFile(
  new URL("../src/components/Hero.astro", import.meta.url),
  "utf8",
);

test("homepage hero frames are scrubbed by scroll instead of autoplay", () => {
  assert.match(hero, /import \{ scroll \} from "motion"/);
  assert.match(hero, /scroll\(syncFrameToScroll/);
  assert.match(hero, /target: hero/);
  assert.match(hero, /offset: \["start start", "end start"\]/);
  assert.match(hero, /Math\.round\(progress \* \(frames\.length - 1\)\)/);
  assert.match(hero, /prefers-reduced-motion: reduce/);
  assert.match(hero, /desiredFrame = 0;\s*applyFrame\(0\)/s);

  assert.doesNotMatch(hero, /holdMs|cadenceMs|hasPlayed|playSequence/);
  assert.doesNotMatch(hero, /nnco:page-ready/);
  assert.doesNotMatch(hero, /addEventListener\(["']scroll/);
  assert.doesNotMatch(hero, /setTimeout/);
});
