import assert from "node:assert/strict";
import test from "node:test";
import { requestStructuredOutput, StructuredOutputError } from "../src/server/openai-structured.ts";
const request = { name: "test", schema: {}, system: "private prompt", user: "private answers", maxOutputTokens: 100 };
const env = { OPENAI_API_KEY: "secret-key" };

test("structured output diagnostics distinguish failures without recording private content", async () => {
  for (const [body, status, code, reason] of [
    [{ error: { message: "private provider detail" } }, 429, "OPENAI_HTTP_ERROR", undefined],
    [{ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }, 200, "OPENAI_INCOMPLETE", "max_output_tokens"],
    [{ status: "failed", error: { code: "server_error", message: "private detail" } }, 200, "OPENAI_FAILED", "server_error"],
    [{ output: [{ content: [{ type: "refusal", refusal: "private refusal" }] }] }, 200, "OPENAI_REFUSAL", undefined],
    [{ output_text: "private invalid json" }, 200, "OPENAI_INVALID_JSON", undefined],
    [{}, 200, "OPENAI_OUTPUT_MISSING", undefined],
  ]) {
    await assert.rejects(requestStructuredOutput(request, { env, fetchImpl: async () => Response.json(body, { status, headers: { "x-request-id": "req_test" } }) }), error => {
      assert.ok(error instanceof StructuredOutputError);
      assert.equal(error.code, code);
      assert.equal(error.diagnostic.httpStatus, status);
      assert.equal(error.diagnostic.upstreamRequestId, "req_test");
      assert.equal(error.diagnostic.reason, reason);
      assert.doesNotMatch(JSON.stringify(error), /private|secret-key/);
      return true;
    });
  }
});

test("network errors are classified without exposing error messages", async () => {
  await assert.rejects(requestStructuredOutput(request, { env, fetchImpl: async () => { throw new Error("private connection detail"); } }), { code: "OPENAI_NETWORK_ERROR" });
});

test("successful structured output keeps response storage disabled", async () => {
  const result = await requestStructuredOutput(request, { env, fetchImpl: async (_url, init) => {
    assert.equal(JSON.parse(init.body).store, false);
    return Response.json({ output_text: '{"ok":true}' });
  } });
  assert.deepEqual(result, { ok: true });
});
