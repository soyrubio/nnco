import assert from "node:assert/strict";
import { after, test } from "node:test";

import {
  createInitialSnapshot,
  discoveryReducer,
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
  for (const questionId of [
    "workflow.scope",
    "friction.repetition",
    "friction.exceptions",
    "goal.outcome",
  ]) {
    snapshot = answer(snapshot, questionId, "Unknown / validate next");
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

test("lead endpoint rejects a cross-origin request", async () => {
  const response = await handleLeadRequest(
    request(payload(), "https://untrusted.example"),
    "test-cross-origin",
  );
  const body = await response.json();

  assert.equal(response.status, 400);
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
  assert.equal(firstBody.ok, true);
  assert.equal(firstBody.persistence, "ephemeral");
  assert.equal(firstBody.handoffId, secondBody.handoffId);
  assert.equal(firstBody.fullReport.schemaVersion, 1);
  assert.equal(firstBody.fullReport.caseId, lead.caseId);
});
