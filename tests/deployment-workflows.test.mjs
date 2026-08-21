import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [ci, stage, production, packageJson, wrangler] = await Promise.all([
  readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"),
  readFile(
    new URL("../.github/workflows/deploy-stage.yml", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../.github/workflows/deploy-production.yml", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8").then(JSON.parse),
]);

test("only stage and main have deployment workflows", () => {
  assert.match(ci, /pull_request:[\s\S]*?- stage[\s\S]*?- main/);
  assert.match(ci, /push:[\s\S]*?branches:[\s\S]*?- development/);
  assert.match(stage, /push:[\s\S]*?branches:[\s\S]*?- stage/);
  assert.match(stage, /environment:[\s\S]*?name: stage/);
  assert.match(stage, /command: deploy --env stage/);
  assert.match(production, /push:[\s\S]*?branches:[\s\S]*?- main/);
  assert.match(production, /environment:[\s\S]*?name: production/);
  assert.match(production, /command: deploy\s*$/m);
  assert.doesNotMatch(production, /--env stage/);
});

test("deployment credentials are referenced without copying runtime secrets", () => {
  for (const workflow of [stage, production]) {
    assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
    assert.match(workflow, /vars\.CLOUDFLARE_ACCOUNT_ID/);
    assert.doesNotMatch(workflow, /OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(workflow, /^\s+secrets:\s*\|/m);
  }
});

test("Wrangler keeps stage and production deployment targets explicit", () => {
  assert.equal(
    packageJson.scripts["deploy:stage"],
    "pnpm build:stage && wrangler deploy --env stage",
  );
  assert.equal(wrangler.vars.PUBLIC_APP_URL, "https://nnco.ai");
  assert.equal(wrangler.env.stage.vars.PUBLIC_APP_URL, "https://stage.nnco.ai");
  assert.equal(wrangler.env.stage.vars.BASIC_AUTH_USER, "stage");
});
