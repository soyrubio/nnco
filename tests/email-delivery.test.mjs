import assert from "node:assert/strict";
import test from "node:test";
import { deliverEmail, retryDelay } from "../src/server/email/delivery.ts";
import { opportunityReportFixture } from "./fixtures/opportunity-report.mjs";
const secret = "test-dispatch-secret-at-least-32-characters";
const env = {
  EMAIL_DISPATCH_SECRET: secret,
  EMAIL_DELIVERY_ENABLED: "true",
  RESEND_API_KEY: "test-resend",
  SUPABASE_URL: "https://database.test",
  SUPABASE_SECRET_KEY: "sb_secret_test",
};
const request = () =>
  new Request("https://functions.test/deliver-emails", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
const report = {
  schemaVersion: 2,
  title: "Opportunity Discovery",
  generatedAt: "2026-09-09T12:00:00.000Z",
  ...opportunityReportFixture(),
};
function setup(kind = "lead", behavior = {}) {
  const job = {
    id: crypto.randomUUID(),
    lead_id: crypto.randomUUID(),
    kind,
    attempts: 1,
    lock_token: crypto.randomUUID(),
    message: null,
    ...behavior.job,
  };
  const lead = {
    work_email: "visitor@example.com",
    name: "Test Visitor",
    organisation: "Example Insurance",
    created_at: report.generatedAt,
    snapshot: {
      kind: "discovery-release",
      company: { name: "Example Insurance" },
      answers: { workflow: ["document-review"] },
    },
    analysis_result: { report },
  };
  const calls = [];
  const updates = [];
  let pdfCalls = 0;
  const options = {
    renderPdf: async () => {
      pdfCalls++;
      return new TextEncoder().encode("%PDF-test");
    },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith("/rpc/claim_email_job"))
        return Response.json(behavior.empty ? [] : [job]);
      if (url.includes("/lead_requests?")) return Response.json([lead]);
      if (url.includes("/email_jobs?")) {
        const patch = JSON.parse(init.body);
        updates.push(patch);
        if (behavior.failAcceptance && patch.status === "accepted")
          throw Error("database offline");
        return Response.json([{ ...job, ...patch }]);
      }
      if (url === "https://api.resend.com/emails") {
        if (behavior.networkError) throw Error("timeout");
        return Response.json(
          { id: "email-id" },
          { status: behavior.status ?? 200 },
        );
      }
      throw Error(`Unexpected URL ${url}`);
    },
  };
  return { options, calls, updates, pdfCalls: () => pdfCalls, job };
}

test("dispatch rejects unauthorised calls before accessing storage or sending", async () => {
  const s = setup();
  const response = await deliverEmail(
    new Request("https://functions.test", { method: "POST" }),
    env,
    s.options,
  );
  assert.equal(response.status, 401);
  assert.equal(s.calls.length, 0);
});
test("disabled or misconfigured delivery does not claim a job", async () => {
  for (const override of [
    { EMAIL_DELIVERY_ENABLED: "false" },
    { RESEND_API_KEY: "" },
  ]) {
    const s = setup();
    await deliverEmail(request(), { ...env, ...override }, s.options);
    assert.equal(s.calls.length, 0);
  }
});
test("idle queue sends nothing", async () => {
  const s = setup("lead", { empty: true });
  assert.equal(
    (await (await deliverEmail(request(), env, s.options)).json()).result,
    "idle",
  );
  assert.equal(s.calls.length, 1);
});
test("lead notification goes to Marek with visitor Reply-To, before report delivery", async () => {
  const s = setup();
  await deliverEmail(request(), env, s.options);
  const send = s.calls.find((c) => c.url === "https://api.resend.com/emails");
  const message = JSON.parse(send.init.body);
  assert.deepEqual(message.to, ["marek@nnco.ai"]);
  assert.equal(message.reply_to, "visitor@example.com");
  assert.match(message.from, /discovery@nnco.ai/);
  assert.match(message.text, /document-review/);
  assert.equal(s.pdfCalls(), 0);
  assert.ok(s.updates[0].message);
  assert.equal(s.updates.at(-1).status, "accepted");
  assert.equal(s.updates.at(-1).message, null);
  assert.equal(send.init.headers["Idempotency-Key"], `nnco-email/${s.job.id}`);
});
test("report goes only to visitor, as a PDF attachment with Marek as Reply-To", async () => {
  const s = setup("report");
  await deliverEmail(request(), env, s.options);
  const send = s.calls.find((c) => c.url === "https://api.resend.com/emails");
  assert.ok(send);
  const message = JSON.parse(send.init.body);
  assert.deepEqual(message.to, ["visitor@example.com"]);
  assert.equal(message.reply_to, "marek@nnco.ai");
  assert.equal(
    Buffer.from(message.attachments[0].content, "base64").toString(),
    "%PDF-test",
  );
  assert.equal(s.pdfCalls(), 1);
});
test("retry reuses stored message even if recipient configuration changes", async () => {
  const message = {
    from: "NNCo <discovery@nnco.ai>",
    to: ["original@example.com"],
    subject: "Saved",
    text: "Saved bytes",
    reply_to: "marek@nnco.ai",
  };
  const s = setup("report", { job: { message, attempts: 2 } });
  await deliverEmail(
    request(),
    { ...env, EMAIL_FROM: "changed@example.com" },
    s.options,
  );
  const send = s.calls.find((c) => c.url === "https://api.resend.com/emails");
  assert.deepEqual(JSON.parse(send.init.body), message);
  assert.equal(s.pdfCalls(), 0);
  assert.ok(!s.calls.some((c) => c.url.includes("/lead_requests?")));
});
test("temporary provider failures retry; permanent failures stop", async () => {
  for (const [status, expected] of [
    [429, "pending"],
    [500, "pending"],
    [403, "failed"],
    [422, "failed"],
  ]) {
    const s = setup("lead", { status });
    await deliverEmail(request(), env, s.options);
    assert.equal(s.updates.at(-1).status, expected);
    assert.equal(s.updates.at(-1).last_error, `resend_http_${status}`);
  }
});
test("network uncertainty retains exact message; exhausted attempts stop", async () => {
  for (const attempts of [1, 8]) {
    const s = setup("lead", { networkError: true, job: { attempts } });
    await deliverEmail(request(), env, s.options);
    assert.equal(
      s.updates.at(-1).status,
      attempts === 8 ? "failed" : "pending",
    );
    assert.ok(!("message" in s.updates.at(-1)));
  }
});
test("failed acceptance recording retries with same provider key and stored message", async () => {
  const s = setup("lead", { failAcceptance: true });
  await deliverEmail(request(), env, s.options);
  assert.equal(s.updates.at(-1).status, "pending");
  assert.ok(!("message" in s.updates.at(-1)));
});
test("backoff is bounded", () => {
  assert.equal(retryDelay(1), 60_000);
  assert.equal(retryDelay(8), 3_600_000);
});
