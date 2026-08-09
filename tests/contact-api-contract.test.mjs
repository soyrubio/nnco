import assert from "node:assert/strict";
import test from "node:test";

import { CONTACT_CONSENT_VERSION } from "../src/lib/contact-contract.ts";
import {
  handleContactRequest,
  validateContactPayload,
} from "../src/server/contact-handler.ts";

const validPayload = () => ({
  schemaVersion: 1,
  requestId: crypto.randomUUID(),
  name: "Alex Example",
  workEmail: "alex@example.com",
  organisation: "Example Bank",
  sector: "Banking",
  area: "An AI audit",
  message: "We want to review the onboarding workflow.",
  consent: { accepted: true, version: CONTACT_CONSENT_VERSION },
});

test("contact validation accepts the public form contract", () => {
  const result = validateContactPayload(validPayload());
  assert.equal(result.ok, true);
});

test("contact validation rejects missing consent and short messages", () => {
  const payload = validPayload();
  payload.message = "short";
  payload.consent.accepted = false;
  assert.equal(validateContactPayload(payload).ok, false);
});

test("contact enquiries persist through the shared lead repository", async () => {
  const previousMode = process.env.LEAD_HANDOFF_MODE;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.LEAD_HANDOFF_MODE = "local";
  process.env.NODE_ENV = "test";
  try {
    const request = new Request("http://localhost/api/contact-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost",
      },
      body: JSON.stringify(validPayload()),
    });
    const response = await handleContactRequest(request, "contact-test");
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.ok, true);
    assert.equal(body.persistence, "ephemeral");
  } finally {
    process.env.LEAD_HANDOFF_MODE = previousMode;
    process.env.NODE_ENV = previousNodeEnv;
  }
});
