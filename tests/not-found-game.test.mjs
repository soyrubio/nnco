import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [pageSource, gameSource, stylesSource] = await Promise.all([
  readFile(new URL("../src/pages/404.astro", import.meta.url), "utf8"),
  readFile(
    new URL("../src/components/NotFoundGame.astro", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/styles/global.css", import.meta.url), "utf8"),
]);

test("not-found route fills the viewport and preserves useful recovery links", () => {
  assert.match(
    pageSource,
    /<main class="not-found-page"[\s\S]*?<h1 id="page-title">Page not found<\/h1>[\s\S]*?<NotFoundGame \/>/,
  );
  for (const href of ["/", "/ai-first-enterprise", "/banking", "/blog", "/contact"]) {
    assert.match(pageSource, new RegExp(`href="${href}"`), href);
  }
  assert.match(
    stylesSource,
    /\.not-found-page\s*\{[^}]*min-height:\s*100dvh;/s,
  );
  assert.match(
    stylesSource,
    /\.not-found-page__inner\s*\{[^}]*grid-template-columns:\s*minmax\(0, 2fr\) minmax\(0, 4fr\);/s,
  );
  assert.match(
    stylesSource,
    /@media \(max-width: 767px\)[\s\S]*?\.not-found-page__inner\s*\{[^}]*grid-template-columns:\s*1fr;/s,
  );
});

test("missing-page game is interaction-driven and keyboard accessible", () => {
  assert.match(gameSource, /aria-live="polite"/);
  assert.match(gameSource, /<button[\s\S]*?data-not-found-game-target/);
  assert.match(
    gameSource,
    /const positions = \[\s*\[4, 1\],[\s\S]*?\[2, 0\],\s*\] as const;/,
  );
  assert.match(
    gameSource,
    /target\.addEventListener\("click",[\s\S]*?catches === positions\.length[\s\S]*?Page recovered\. Wrong page, unfortunately\./,
  );
  assert.doesNotMatch(gameSource, /setInterval|setTimeout|requestAnimationFrame/);
  assert.match(
    gameSource,
    /document\.addEventListener\("astro:page-load", initialiseNotFoundGames\);/,
  );
  assert.match(
    stylesSource,
    /\.not-found-game__board\s*\{[^}]*aspect-ratio:\s*3 \/ 2;[^}]*background-size:[^}]*calc\(100% \/ 6\) 100%,[^}]*100% calc\(100% \/ 4\);/s,
  );
});
