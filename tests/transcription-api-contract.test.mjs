import assert from "node:assert/strict";
import { test } from "node:test";

import { handleTranscriptionRequest } from "../src/server/transcription-handler.ts";

const API_URL = "http://localhost:4321/api/transcriptions";

function audioRequest({
  bytes = 32,
  mimeType = "audio/webm;codecs=opus",
  origin = "http://localhost:4321",
} = {}) {
  const form = new FormData();
  form.append(
    "audio",
    new Blob([new Uint8Array(bytes)], { type: mimeType }),
    "recording.webm",
  );
  return new Request(API_URL, {
    method: "POST",
    headers: { Origin: origin },
    body: form,
  });
}

test("transcription endpoint rejects a cross-origin request", async () => {
  const response = await handleTranscriptionRequest(
    audioRequest({ origin: "https://untrusted.example" }),
    "transcription-cross-origin",
    { env: { OPENAI_API_KEY: "test-key" } },
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.error.code, "VALIDATION_ERROR");
});

test("transcription endpoint validates audio MIME type and size", async () => {
  const invalidMime = await handleTranscriptionRequest(
    audioRequest({ mimeType: "text/plain" }),
    "transcription-mime",
    { env: { OPENAI_API_KEY: "test-key" } },
  );
  assert.equal(invalidMime.status, 415);
  assert.equal((await invalidMime.json()).error.code, "UNSUPPORTED_AUDIO");

  const oversized = await handleTranscriptionRequest(
    audioRequest({ bytes: 4 * 1024 * 1024 + 1 }),
    "transcription-size",
    { env: { OPENAI_API_KEY: "test-key" } },
  );
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).error.code, "AUDIO_TOO_LARGE");
});

test("transcription endpoint fails closed without an API key", async () => {
  const response = await handleTranscriptionRequest(
    audioRequest(),
    "transcription-missing-key",
    { env: {} },
  );
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.error.code, "TRANSCRIPTION_UNAVAILABLE");
});

test("transcription endpoint returns only normalized text", async () => {
  let upstreamRequest;
  const response = await handleTranscriptionRequest(
    audioRequest(),
    "transcription-success",
    {
      env: {
        OPENAI_API_KEY: "test-key",
        OPENAI_TRANSCRIPTION_MODEL: "test-transcription-model",
        OPENAI_API_BASE_URL: "https://api.example.test",
      },
      fetchImpl: async (input, init) => {
        upstreamRequest = { input, init };
        return Response.json({ text: "  A useful   workflow note.  ", extra: 1 });
      },
    },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { text: "A useful workflow note." });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(
    String(upstreamRequest.input),
    "https://api.example.test/v1/audio/transcriptions",
  );
  assert.equal(
    upstreamRequest.init.headers.Authorization,
    "Bearer test-key",
  );
  assert.equal(
    upstreamRequest.init.body.get("model"),
    "test-transcription-model",
  );
  assert.match(
    upstreamRequest.init.body.get("file").type,
    /^audio\/webm(?:;|$)/,
  );
});
