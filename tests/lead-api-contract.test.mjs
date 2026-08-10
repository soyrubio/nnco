import assert from "node:assert/strict";
import { after, test } from "node:test";

import {
  createInitialSnapshot,
  discoveryReducer,
  getQuestions,
} from "../src/lib/discovery.ts";
import { LEAD_CONSENT_VERSION } from "../src/lib/lead-contract.ts";
import {
  handleLeadRequest,
  validateLeadPayload,
} from "../src/server/lead-handler.ts";

const previousMode = process.env.LEAD_HANDOFF_MODE;
const previousNodeEnv = process.env.NODE_ENV;
process.env.LEAD_HANDOFF_MODE = "local";
process.env.NODE_ENV = "test";

after(() => {
  if (previousMode === undefined) delete process.env.LEAD_HANDOFF_MODE;
  else process.env.LEAD_HANDOFF_MODE = previousMode;
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
});

function answer(snapshot, questionId, value) {
  return discoveryReducer(snapshot, {
    type: "ANSWER_QUESTION",
    questionId,
    value,
    source: "form",
    occurredAt: "2026-07-30T12:00:00.000Z",
  });
}

function readySnapshot() {
  let snapshot = createInitialSnapshot("2026-07-30T11:00:00.000Z");
  for (const question of getQuestions(snapshot)) {
    if (!question.required) continue;
    const value = question.allowUnknown
      ? "Unknown / validate next"
      : question.options?.[0]?.value ?? "Representative answer";
    snapshot = answer(snapshot, question.id, value);
  }
  return snapshot;
}

function payload() {
  const snapshot = readySnapshot();
  return {
    schemaVersion: 1,
    requestId: "11111111-1111-4111-8111-111111111111",
    caseId: snapshot.caseId,
    caseRevision: snapshot.revision,
    contact: {
      workEmail: "operator@example.com",
      organisation: "Example Institution",
      name: "Example Operator",
    },
    consent: {
      accepted: true,
      version: LEAD_CONSENT_VERSION,
    },
    snapshot,
  };
}

function request(body, origin = "http://localhost:4321") {
  return new Request("http://localhost:4321/api/lead-requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: JSON.stringify(body),
  });
}

function rawRequest(body, { contentLength, origin = "http://localhost:4321" } = {}) {
  const headers = {
    "Content-Type": "application/json",
    Origin: origin,
  };
  if (contentLength !== undefined) headers["Content-Length"] = contentLength;
  return new Request("http://localhost:4321/api/lead-requests", {
    method: "POST",
    headers,
    body,
  });
}

function padJsonToBytes(value, byteLength) {
  const json = JSON.stringify(value);
  const currentLength = new TextEncoder().encode(json).byteLength;
  assert.ok(currentLength <= byteLength);
  return `${json}${" ".repeat(byteLength - currentLength)}`;
}

test("lead validation preserves consent and case revision rules", () => {
  const valid = payload();
  assert.equal(validateLeadPayload(valid).ok, true);

  const missingConsent = {
    ...valid,
    consent: { accepted: false, version: LEAD_CONSENT_VERSION },
  };
  const consentResult = validateLeadPayload(missingConsent);
  assert.equal(consentResult.ok, false);
  assert.equal(consentResult.code, "CONSENT_REQUIRED");

  const staleRevision = { ...valid, caseRevision: valid.caseRevision - 1 };
  const revisionResult = validateLeadPayload(staleRevision);
  assert.equal(revisionResult.ok, false);
  assert.equal(revisionResult.code, "IDEMPOTENCY_CONFLICT");
});

test("lead validation applies the shared optional name contract", () => {
  for (const [label, name, expected] of [
    ["omitted", undefined, true],
    ["empty", "", true],
    ["trim-empty", "   ", true],
    ["one character", "A", false],
    ["minimum", "AB", true],
    ["maximum", "n".repeat(120), true],
    ["over maximum", "n".repeat(121), false],
  ]) {
    const candidate = payload();
    if (name === undefined) delete candidate.contact.name;
    else candidate.contact.name = name;
    assert.equal(validateLeadPayload(candidate).ok, expected, label);
  }
});

test("lead validation consumes the shared email and organisation boundaries", () => {
  for (const [label, contact, expected] of [
    ["invalid email", { workEmail: "operator@example" }, false],
    ["maximum email", { workEmail: `${"e".repeat(249)}@a.co` }, true],
    ["over maximum email", { workEmail: `${"e".repeat(250)}@a.co` }, false],
    ["short organisation", { organisation: " A " }, false],
    ["minimum organisation", { organisation: "AB" }, true],
    ["maximum organisation", { organisation: "o".repeat(160) }, true],
    ["over maximum organisation", { organisation: "o".repeat(161) }, false],
  ]) {
    const candidate = payload();
    Object.assign(candidate.contact, contact);
    assert.equal(validateLeadPayload(candidate).ok, expected, label);
  }
});

test("lead validation rejects non-canonical discovery snapshots", async () => {
  const cases = [
    (candidate) => {
      candidate.snapshot.answers["unknown.question"] = {
        questionId: "unknown.question",
        value: "Injected answer",
        source: "form",
        status: "reported",
        confidence: 1,
        updatedAt: candidate.snapshot.updatedAt,
      };
    },
    (candidate) => {
      candidate.snapshot.answers["context.organisationType"].value =
        "invalid-option";
      candidate.snapshot.profile.organisationType = "invalid-option";
    },
    (candidate) => {
      candidate.snapshot.profile.sector = "healthcare";
    },
    (candidate) => {
      candidate.snapshot.evidence[0].statement = "Forged evidence";
    },
  ];

  for (const [index, mutate] of cases.entries()) {
    const candidate = structuredClone(payload());
    candidate.requestId = crypto.randomUUID();
    mutate(candidate);
    const validation = validateLeadPayload(candidate);
    assert.equal(validation.ok, false);
    assert.equal(validation.code, "VALIDATION_ERROR");

    const response = await handleLeadRequest(
      request(candidate),
      `lead-canonical-${index}`,
    );
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(body.error.code, "VALIDATION_ERROR");
    assert.equal(
      body.error.message,
      "Check the contact fields and diagnostic before retrying.",
    );
  }
});

test("lead endpoint rejects a cross-origin request", async () => {
  const response = await handleLeadRequest(
    request(payload(), "https://untrusted.example"),
    "test-cross-origin",
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "VALIDATION_ERROR");
});

test("local handoff is idempotent and returns the full report contract", async () => {
  const lead = payload();
  const first = await handleLeadRequest(request(lead), "test-idempotency");
  const firstBody = await first.json();
  const second = await handleLeadRequest(request(lead), "test-idempotency");
  const secondBody = await second.json();

  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(first.headers.get("cache-control"), "no-store");
  assert.equal(second.headers.get("cache-control"), "no-store");
  assert.equal(firstBody.ok, true);
  assert.equal(firstBody.persistence, "ephemeral");
  assert.equal(firstBody.handoffId, secondBody.handoffId);
  assert.equal(firstBody.fullReport.schemaVersion, 1);
  assert.equal(firstBody.fullReport.caseId, lead.caseId);
});

test("lead retry hashing uses canonical email identity", async () => {
  const requestId = crypto.randomUUID();
  const firstLead = payload();
  firstLead.requestId = requestId;
  firstLead.contact.workEmail = " Operator@EXAMPLE.COM ";
  const retryLead = structuredClone(firstLead);
  retryLead.contact.workEmail = "operator@example.com";

  const first = await handleLeadRequest(
    request(firstLead),
    "lead-canonical-email",
  );
  const retry = await handleLeadRequest(
    request(retryLead),
    "lead-canonical-email",
  );
  const firstBody = await first.json();
  const retryBody = await retry.json();

  assert.equal(first.status, 201);
  assert.equal(retry.status, 200);
  assert.equal(firstBody.handoffId, retryBody.handoffId);
});

test("lead endpoint enforces the 128 KiB body limit on actual bytes", async () => {
  const maximumBytes = 128 * 1024;
  const boundaryPayload = { ...payload(), requestId: crypto.randomUUID() };
  const boundary = await handleLeadRequest(
    rawRequest(padJsonToBytes(boundaryPayload, maximumBytes)),
    "lead-boundary",
  );
  assert.equal(boundary.status, 201);
  assert.equal(boundary.headers.get("cache-control"), "no-store");

  for (const [label, contentLength] of [
    ["missing", undefined],
    ["understated", "1"],
  ]) {
    const oversized = await handleLeadRequest(
      rawRequest(
        padJsonToBytes({ ...payload(), requestId: crypto.randomUUID() }, maximumBytes + 1),
        { contentLength },
      ),
      `lead-overflow-${label}`,
    );
    const body = await oversized.json();
    assert.equal(oversized.status, 400);
    assert.equal(oversized.headers.get("cache-control"), "no-store");
    assert.equal(body.error.message, "The diagnostic request is too large.");
  }
});
