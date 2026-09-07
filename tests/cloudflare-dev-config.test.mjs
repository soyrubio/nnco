import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkDiscoveryRateLimit, DiscoveryRateLimitError } from "../src/server/discovery-rate-limit.ts";

const config = await readFile(
  new URL("../astro.config.mjs", import.meta.url),
  "utf8",
);
const deployment = await readFile(
  new URL("../DEPLOYMENT.md", import.meta.url),
  "utf8",
);
const wrangler = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("pnpm dev explicitly selects an isolated local Cloudflare profile", () => {
  assert.equal(manifest.scripts.dev, "CLOUDFLARE_ENV=local astro dev");
  assert.equal(wrangler.env.local.name, "nnco-local");
  assert.equal(wrangler.env.local.vars.NODE_ENV, "development");
  assert.equal(wrangler.env.local.vars.LEAD_HANDOFF_MODE, "local");
  assert.equal(wrangler.env.local.vars.DISCOVERY_RATE_LIMIT_MODE, "local");
  assert.equal(wrangler.env.local.vars.PUBLIC_APP_URL, "http://localhost:4321");
  assert.equal(wrangler.env.local.vars.OPENAI_API_KEY, undefined);
  assert.equal(wrangler.env.local.main, undefined); // Inherit the same Astro Worker entrypoint.
  assert.doesNotMatch(manifest.scripts.build, /CLOUDFLARE_ENV=local/);
  assert.match(manifest.scripts["build:stage"], /CLOUDFLARE_ENV=stage/);
  for (const vars of [wrangler.vars, wrangler.env.stage.vars]) {
    assert.equal(vars.NODE_ENV, "production");
    assert.equal(vars.LEAD_HANDOFF_MODE, "supabase");
    assert.equal(vars.DISCOVERY_RATE_LIMIT_MODE, "supabase");
  }
});

test("the local profile uses bounded in-memory quotas without Supabase secrets", async () => {
  const input = {
    env: wrangler.env.local.vars, key: "local-config-test", limit: 1,
    localStore: new Map(), now: 1000, scope: "config-test", windowMs: 10000,
  };
  assert.equal(await checkDiscoveryRateLimit(input), null);
  assert.equal(await checkDiscoveryRateLimit(input), 10);
  for (const env of [wrangler.vars, wrangler.env.stage.vars]) {
    await assert.rejects(checkDiscoveryRateLimit({ ...input, env }), DiscoveryRateLimitError);
  }
});

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
