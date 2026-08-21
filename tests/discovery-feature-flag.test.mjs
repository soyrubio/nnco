import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isDiscoveryEnabled } from "../src/lib/feature-flags.ts";

const read = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("Discovery is disabled unless the build-time value is exactly true", () => {
  for (const value of [undefined, null, "", "false", "TRUE", "1", true]) {
    assert.equal(isDiscoveryEnabled(value), false, String(value));
  }

  assert.equal(isDiscoveryEnabled("true"), true);
});

test("public hero and navigation surfaces use the Discovery feature flag", async () => {
  const [header, hero, pageHero, footer] = await Promise.all([
    read("../src/components/Header.astro"),
    read("../src/components/Hero.astro"),
    read("../src/components/PageHero.astro"),
    read("../src/components/Footer.astro"),
  ]);

  for (const [name, source] of Object.entries({
    header,
    hero,
    pageHero,
    footer,
  })) {
    assert.match(
      source,
      /isDiscoveryEnabled\(\s*import\.meta\.env\.DISCOVERY_ENABLED,?\s*\)/,
      name,
    );
  }

  assert.match(header, /discoveryEnabled && \([\s\S]*?href="\/discovery"/);
  assert.match(hero, /discoveryEnabled && \([\s\S]*?href="\/discovery"/);
  assert.match(
    pageHero,
    /visibleActions = actions\.filter\([\s\S]*?action\.href !== "\/discovery"/,
  );
  assert.match(
    footer,
    /\.filter\(\(link\) => discoveryEnabled \|\| link\.href !== "\/discovery"\)/,
  );
});
