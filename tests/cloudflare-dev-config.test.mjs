import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const config = await readFile(
  new URL("../astro.config.mjs", import.meta.url),
  "utf8",
);
const deployment = await readFile(
  new URL("../DEPLOYMENT.md", import.meta.url),
  "utf8",
);

test("Cloudflare development pre-bundles late server imports", () => {
  assert.match(config, /adapter: cloudflare\(\{ imageService: "passthrough" \}\)/);
  assert.match(config, /output: "server"/);
  assert.match(
    config,
    /optimizeDeps:\s*\{[\s\S]*?noDiscovery:\s*false,[\s\S]*?include:\s*\["astro\/assets\/services\/noop", "astro\/logger\/json"\]/,
  );
  assert.doesNotMatch(config, /optimizeDeps:\s*\{[\s\S]*?exclude:/);
  assert.doesNotMatch(config, /noDiscovery:\s*true/);
});

test("deployment notes keep local workerd parity explicit", () => {
  assert.match(deployment, /Local development uses the Cloudflare adapter's `workerd` runtime/);
  assert.match(deployment, /renderer integrations contribute\s+their complete server dependency lists/);
  assert.match(deployment, /withastro\/astro#17456/);
  assert.match(deployment, /do not replace it\s+with broad Astro exclusions or a separate Node-only development adapter/);
});
