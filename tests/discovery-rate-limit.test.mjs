import assert from "node:assert/strict";
import test from "node:test";

import {
  checkDiscoveryRateLimit,
  trustedClientKey,
} from "../src/server/discovery-rate-limit.ts";

test("local discovery quotas preserve sliding-window retry timing", async () => {
  const store = new Map();
  const options = {
    env: { NODE_ENV: "test" },
    key: "client-a",
    limit: 2,
    localStore: store,
    scope: "test",
    windowMs: 10_000,
  };

  assert.equal(await checkDiscoveryRateLimit({ ...options, now: 1_000 }), null);
  assert.equal(await checkDiscoveryRateLimit({ ...options, now: 1_500 }), null);
  assert.equal(await checkDiscoveryRateLimit({ ...options, now: 2_000 }), 9);
  assert.equal(await checkDiscoveryRateLimit({ ...options, now: 11_001 }), null);
});

test("production client identity does not trust a caller forwarding header", () => {
  const request = new Request("https://nnco.ai/api/discovery-analysis", {
    headers: { "X-Forwarded-For": "198.51.100.9" },
  });
  assert.equal(trustedClientKey(request, "203.0.113.7", true), "203.0.113.7");
  assert.equal(trustedClientKey(request, undefined, true), "unresolved-client");
  assert.equal(trustedClientKey(request, undefined, false), "198.51.100.9");
});

test("production shared limiting fails closed without its HMAC secret", async () => {
  await assert.rejects(
    checkDiscoveryRateLimit({
      env: {
        NODE_ENV: "production",
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SECRET_KEY: "sb_secret_server-only-test-key",
      },
      key: "203.0.113.7",
      limit: 5,
      localStore: new Map(),
      scope: "analysis-ip-hour",
      windowMs: 60 * 60 * 1_000,
    }),
    /hashing is not configured/,
  );
});
