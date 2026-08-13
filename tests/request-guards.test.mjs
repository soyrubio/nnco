import assert from "node:assert/strict";
import test from "node:test";

import {
  checkSlidingWindowRateLimit,
  isSameOrigin,
  readBoundedBody,
} from "../src/server/request-guards.ts";

const REQUEST_URL = "http://localhost:4321/api/example";

function bodyRequest(bytes, headers = {}) {
  return new Request(REQUEST_URL, {
    method: "POST",
    headers,
    body: new Uint8Array(bytes),
  });
}

test("same-origin validation preserves missing, matching, and rejected origins", () => {
  assert.equal(isSameOrigin(new Request(REQUEST_URL)), true);
  assert.equal(
    isSameOrigin(
      new Request(REQUEST_URL, { headers: { Origin: "http://localhost:4321" } }),
    ),
    true,
  );
  assert.equal(
    isSameOrigin(
      new Request(REQUEST_URL, { headers: { Origin: "https://example.com" } }),
    ),
    false,
  );
  assert.equal(
    isSameOrigin(
      new Request(REQUEST_URL, { headers: { Origin: "not a valid origin" } }),
    ),
    false,
  );
});

test("sliding-window rate limits prefer the trusted adapter address and preserve retry timing", () => {
  const primaryStore = new Map();
  const separateStore = new Map();
  const request = new Request(REQUEST_URL, {
    headers: { "X-Forwarded-For": "198.51.100.10, 203.0.113.20" },
  });

  assert.equal(
    checkSlidingWindowRateLimit(request, "192.0.2.10", primaryStore, 2, 10_000, 1_000),
    null,
  );
  assert.equal(
    checkSlidingWindowRateLimit(request, "192.0.2.10", primaryStore, 2, 10_000, 1_500),
    null,
  );
  assert.equal(
    checkSlidingWindowRateLimit(request, "192.0.2.10", primaryStore, 2, 10_000, 2_000),
    9,
  );
  assert.deepEqual(primaryStore.get("192.0.2.10"), [1_000, 1_500]);

  assert.equal(
    checkSlidingWindowRateLimit(request, "192.0.2.10", separateStore, 2, 10_000, 2_000),
    null,
  );
  assert.equal(
    checkSlidingWindowRateLimit(request, "192.0.2.10", primaryStore, 2, 10_000, 11_001),
    null,
  );
  assert.deepEqual(primaryStore.get("192.0.2.10"), [1_500, 11_001]);
});

test("bounded body reading accepts the exact limit without Content-Length", async () => {
  const result = await readBoundedBody(bodyRequest(32), 32);

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.bytes.byteLength, 32);
});

test("bounded body reading rejects streamed overflow with missing or understated Content-Length", async () => {
  const missingLength = await readBoundedBody(bodyRequest(33), 32);
  const understatedLength = await readBoundedBody(
    bodyRequest(33, { "Content-Length": "1" }),
    32,
  );

  assert.deepEqual(missingLength, { ok: false, reason: "too_large" });
  assert.deepEqual(understatedLength, { ok: false, reason: "too_large" });
});

test("bounded body reading rejects an oversized declared Content-Length", async () => {
  const result = await readBoundedBody(
    bodyRequest(1, { "Content-Length": "33" }),
    32,
  );

  assert.deepEqual(result, { ok: false, reason: "too_large" });
});

test("bounded body reading reports a locked request body as unreadable", async () => {
  const request = bodyRequest(1);
  const lock = request.body.getReader();

  try {
    const result = await readBoundedBody(request, 32);
    assert.deepEqual(result, { ok: false, reason: "unreadable" });
  } finally {
    lock.releaseLock();
  }
});
