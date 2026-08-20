import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getStageAuthResponse,
  isLocalAstroPrerenderRequest,
  safeEqual,
} from "../src/server/basic-auth.js";

const originalTimingSafeEqual = crypto.subtle.timingSafeEqual;
crypto.subtle.timingSafeEqual = (left, right) => {
  if (left.byteLength !== right.byteLength) {
    throw new TypeError("Buffers must have equal length");
  }

  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
};

test.after(() => {
  if (originalTimingSafeEqual) {
    crypto.subtle.timingSafeEqual = originalTimingSafeEqual;
  } else {
    delete crypto.subtle.timingSafeEqual;
  }
});

const credentials = (user, pass) =>
  `Basic ${Buffer.from(`${user}:${pass}`, "utf8").toString("base64")}`;

test("stage auth fails closed when either credential secret is absent", () => {
  const request = new Request("https://stage.example/");

  for (const env of [
    {},
    { BASIC_AUTH_USER: "reviewer" },
    { BASIC_AUTH_PASS: "secret" },
  ]) {
    const response = getStageAuthResponse(request, env);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
  }
});

test("stage auth challenges missing and invalid credentials", () => {
  const env = { BASIC_AUTH_USER: "reviewer", BASIC_AUTH_PASS: "secret" };

  for (const authorization of [
    undefined,
    "Bearer value",
    "Basic not-base64!",
    credentials("reviewer", "wrong"),
  ]) {
    const headers = authorization ? { Authorization: authorization } : {};
    const response = getStageAuthResponse(
      new Request("https://stage.example/", { headers }),
      env,
    );
    assert.equal(response.status, 401);
    assert.equal(
      response.headers.get("WWW-Authenticate"),
      'Basic realm="nnco stage", charset="UTF-8"',
    );
  }
});

test("stage auth accepts UTF-8 credentials and colons in the password", () => {
  const env = {
    BASIC_AUTH_USER: "návštěva",
    BASIC_AUTH_PASS: "secret:with:colons",
  };
  const request = new Request("https://stage.example/", {
    headers: {
      Authorization: credentials(env.BASIC_AUTH_USER, env.BASIC_AUTH_PASS),
    },
  });

  assert.equal(getStageAuthResponse(request, env), null);
});

test("safe comparison handles unequal lengths without throwing", () => {
  assert.equal(safeEqual("short", "a-longer-secret"), false);
  assert.equal(safeEqual("same", "same"), true);
  assert.equal(safeEqual("same", "diff"), false);
});

test("only local Astro prerender endpoints bypass the deployed gate", () => {
  assert.equal(
    isLocalAstroPrerenderRequest(
      new Request("http://localhost/__astro_prerender", { method: "POST" }),
    ),
    true,
  );
  assert.equal(
    isLocalAstroPrerenderRequest(
      new Request("https://stage.example/__astro_prerender", {
        method: "POST",
      }),
    ),
    false,
  );
  assert.equal(
    isLocalAstroPrerenderRequest(
      new Request("http://localhost/", { method: "GET" }),
    ),
    false,
  );
});

test("stage Wrangler environment runs the auth Worker before every asset", async () => {
  const config = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
  const workerSource = await readFile("src/server/stage-worker.js", "utf8");
  const workflowSource = await readFile(
    ".github/workflows/deploy-stage.yml",
    "utf8",
  );

  assert.equal(config.main, "@astrojs/cloudflare/entrypoints/server");
  assert.equal(config.env.stage.main, "./src/server/stage-worker.js");
  assert.equal(config.env.stage.assets.binding, "ASSETS");
  assert.equal(config.env.stage.assets.run_worker_first, true);
  assert.match(workerSource, /getStageAuthResponse\(request, env\)/);
  assert.match(workerSource, /return handle\(request, env, ctx\)/);
  assert.match(workflowSource, /CLOUDFLARE_API_TOKEN/);
  assert.match(workflowSource, /BASIC_AUTH_USER/);
  assert.match(workflowSource, /BASIC_AUTH_PASS/);
});
