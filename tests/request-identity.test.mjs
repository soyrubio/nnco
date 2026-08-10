import assert from "node:assert/strict";
import test from "node:test";

import {
  createRequestIdentity,
  isValidRequestId,
  resolveRequestIdentity,
} from "../src/lib/request-identity.ts";

test("request IDs use one shared UUID boundary", () => {
  for (const requestId of [
    "11111111-1111-1111-8111-111111111111",
    "AAAAAAAA-AAAA-4AAA-BAAA-AAAAAAAAAAAA",
    "55555555-5555-5555-9555-555555555555",
  ]) {
    assert.equal(isValidRequestId(requestId), true, requestId);
  }

  for (const requestId of [
    "",
    "11111111-1111-4111-8111-11111111111",
    "11111111-1111-0111-8111-111111111111",
    "11111111-1111-6111-8111-111111111111",
    "11111111-1111-4111-7111-111111111111",
    "{11111111-1111-4111-8111-111111111111}",
    1,
    null,
  ]) {
    assert.equal(isValidRequestId(requestId), false, String(requestId));
  }
});

test("request identity reuses an unchanged signature and rotates on change", () => {
  let created = 0;
  const createId = () => `request-${++created}`;
  const initial = createRequestIdentity("signature-a", createId);
  const reused = resolveRequestIdentity(initial, "signature-a", createId);
  const rotated = resolveRequestIdentity(reused, "signature-b", createId);

  assert.deepEqual(initial, {
    requestId: "request-1",
    payloadSignature: "signature-a",
  });
  assert.equal(reused, initial);
  assert.deepEqual(rotated, {
    requestId: "request-2",
    payloadSignature: "signature-b",
  });
  assert.equal(created, 2);
});

test("request identity can be created synchronously from an empty state", () => {
  const identity = resolveRequestIdentity(null, "signature", () => "request-id");

  assert.deepEqual(identity, {
    requestId: "request-id",
    payloadSignature: "signature",
  });
});
