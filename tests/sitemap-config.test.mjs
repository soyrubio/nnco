import assert from "node:assert/strict";
import test from "node:test";

import { shouldIncludeInSitemap } from "../astro.config.mjs";

test("the sitemap excludes internal and non-indexable routes", () => {
  assert.equal(shouldIncludeInSitemap("https://nnco.ai/glyphs"), false);
  assert.equal(shouldIncludeInSitemap("https://nnco.ai/glyphs/"), false);
  assert.equal(shouldIncludeInSitemap("https://nnco.ai/privacy"), false);
  assert.equal(shouldIncludeInSitemap("https://nnco.ai/api/contact"), false);
  assert.equal(shouldIncludeInSitemap("https://nnco.ai/contact"), true);
});
