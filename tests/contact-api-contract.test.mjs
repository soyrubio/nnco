import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTACT_AREAS,
  CONTACT_CONSENT_VERSION,
  CONTACT_EMAIL_PATTERN_SOURCE,
  CONTACT_FIELD_LIMITS,
  CONTACT_SECTORS,
  isContactArea,
  isContactSector,
  isContactTextWithinLimits,
  isValidContactEmail,
  normalizeContactEmail,
} from "../src/lib/contact-contract.ts";
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

function rawRequest(body, { contentLength, origin = "http://localhost" } = {}) {
  const headers = {
    "Content-Type": "application/json",
    Origin: origin,
  };
  if (contentLength !== undefined) headers["Content-Length"] = contentLength;
  return new Request("http://localhost/api/contact-requests", {
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

function restoreEnvironmentVariable(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

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

test("contact validation uses the shared field and option contract", () => {
  const maximumPayload = validPayload();
  maximumPayload.name = "n".repeat(CONTACT_FIELD_LIMITS.name.maxLength);
  maximumPayload.workEmail = `${"e".repeat(CONTACT_FIELD_LIMITS.workEmail.maxLength - 5)}@a.co`;
  maximumPayload.organisation = "o".repeat(
    CONTACT_FIELD_LIMITS.organisation.maxLength,
  );
  maximumPayload.message = "m".repeat(CONTACT_FIELD_LIMITS.message.maxLength);
  assert.equal(validateContactPayload(maximumPayload).ok, true);

  for (const [field, value] of [
    ["name", "n".repeat(CONTACT_FIELD_LIMITS.name.maxLength + 1)],
    ["workEmail", `${"e".repeat(CONTACT_FIELD_LIMITS.workEmail.maxLength - 4)}@a.co`],
    [
      "organisation",
      "o".repeat(CONTACT_FIELD_LIMITS.organisation.maxLength + 1),
    ],
    ["message", "m".repeat(CONTACT_FIELD_LIMITS.message.maxLength + 1)],
    ["sector", "Unknown sector"],
    ["area", "Unknown area"],
  ]) {
    assert.equal(
      validateContactPayload({ ...validPayload(), [field]: value }).ok,
      false,
      `${field} should reject values outside the shared contract`,
    );
  }
});

test("contact helpers enforce trimmed minimums and an HTML-compatible email pattern", () => {
  assert.equal(
    isContactTextWithinLimits("  ", CONTACT_FIELD_LIMITS.name),
    false,
  );
  assert.equal(isValidContactEmail(" alex@example.com "), true);
  assert.equal(isValidContactEmail("alex@example"), false);
  assert.equal(
    new RegExp(`^(?:${CONTACT_EMAIL_PATTERN_SOURCE})$`).test("alex@example.com"),
    true,
  );
  assert.equal(CONTACT_SECTORS.every(isContactSector), true);
  assert.equal(CONTACT_AREAS.every(isContactArea), true);
  assert.equal(isContactSector("Unknown"), false);
  assert.equal(isContactArea("Unknown"), false);
  assert.equal(
    normalizeContactEmail(" Alex.Example@EXAMPLE.COM "),
    "alex.example@example.com",
  );
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
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(body.ok, true);
    assert.equal(body.persistence, "ephemeral");
  } finally {
    restoreEnvironmentVariable("LEAD_HANDOFF_MODE", previousMode);
    restoreEnvironmentVariable("NODE_ENV", previousNodeEnv);
  }
});

test("contact retry hashing uses canonical email identity", async () => {
  const previousMode = process.env.LEAD_HANDOFF_MODE;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.LEAD_HANDOFF_MODE = "local";
  process.env.NODE_ENV = "test";
  try {
    const requestId = crypto.randomUUID();
    const firstPayload = {
      ...validPayload(),
      requestId,
      workEmail: " Alex@EXAMPLE.COM ",
    };
    const retryPayload = {
      ...firstPayload,
      workEmail: "alex@example.com",
    };
    const first = await handleContactRequest(
      rawRequest(JSON.stringify(firstPayload)),
      "contact-canonical-email",
    );
    const retry = await handleContactRequest(
      rawRequest(JSON.stringify(retryPayload)),
      "contact-canonical-email",
    );
    const firstBody = await first.json();
    const retryBody = await retry.json();

    assert.equal(first.status, 201);
    assert.equal(retry.status, 200);
    assert.equal(firstBody.handoffId, retryBody.handoffId);
  } finally {
    restoreEnvironmentVariable("LEAD_HANDOFF_MODE", previousMode);
    restoreEnvironmentVariable("NODE_ENV", previousNodeEnv);
  }
});

test("contact endpoint rejects cross-origin requests without caching the response", async () => {
  const response = await handleContactRequest(
    rawRequest(JSON.stringify(validPayload()), {
      origin: "https://untrusted.example",
    }),
    "contact-cross-origin",
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.error.message, "The request origin could not be verified.");
});

test("contact endpoint enforces the 32 KiB body limit on actual bytes", async () => {
  const previousMode = process.env.LEAD_HANDOFF_MODE;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.LEAD_HANDOFF_MODE = "local";
  process.env.NODE_ENV = "test";
  try {
    const maximumBytes = 32 * 1024;
    const boundaryPayload = validPayload();
    const boundary = await handleContactRequest(
      rawRequest(padJsonToBytes(boundaryPayload, maximumBytes)),
      "contact-boundary",
    );
    assert.equal(boundary.status, 201);
    assert.equal(boundary.headers.get("cache-control"), "no-store");

    for (const [label, contentLength] of [
      ["missing", undefined],
      ["understated", "1"],
    ]) {
      const oversized = await handleContactRequest(
        rawRequest(
          padJsonToBytes({ ...validPayload(), requestId: crypto.randomUUID() }, maximumBytes + 1),
          { contentLength },
        ),
        `contact-overflow-${label}`,
      );
      const body = await oversized.json();
      assert.equal(oversized.status, 400);
      assert.equal(oversized.headers.get("cache-control"), "no-store");
      assert.equal(body.error.message, "The request is too large.");
    }
  } finally {
    restoreEnvironmentVariable("LEAD_HANDOFF_MODE", previousMode);
    restoreEnvironmentVariable("NODE_ENV", previousNodeEnv);
  }
});

test("contact endpoint reports an already locked body as unreadable", async () => {
  const request = rawRequest(JSON.stringify(validPayload()));
  const lock = request.body.getReader();

  try {
    const response = await handleContactRequest(request, "contact-locked-body");
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(body.error.message, "The request could not be read.");
  } finally {
    lock.releaseLock();
  }
});
