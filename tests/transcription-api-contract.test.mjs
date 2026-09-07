import assert from "node:assert/strict";
import { test } from "node:test";

import { DISCOVERY_MESSAGE_MAX_LENGTH } from "../src/lib/discovery-domain.ts";
import { handleTranscriptionRequest } from "../src/server/transcription-handler.ts";

const API_URL = "http://localhost:4321/api/transcriptions";

function audioRequest({
  bytes = 32,
  contentLength,
  mimeType = "audio/webm;codecs=opus",
  origin = "http://localhost:4321",
  paddingBytes = 0,
} = {}) {
  const form = new FormData();
  form.append(
    "audio",
    new Blob([new Uint8Array(bytes)], { type: mimeType }),
    "recording.webm",
  );
  if (paddingBytes > 0) form.append("padding", "x".repeat(paddingBytes));
  const headers = { Origin: origin };
  if (contentLength !== undefined) headers["Content-Length"] = contentLength;
  return new Request(API_URL, {
    method: "POST",
    headers,
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

test("transcription endpoint bounds the aggregate multipart body before parsing", async () => {
  const maximumRequestBytes = 4 * 1024 * 1024 + 64 * 1024;
  for (const [label, contentLength] of [
    ["missing", undefined],
    ["understated", "1"],
  ]) {
    const response = await handleTranscriptionRequest(
      audioRequest({ paddingBytes: maximumRequestBytes, contentLength }),
      `transcription-aggregate-${label}`,
      { env: { OPENAI_API_KEY: "test-key" } },
    );
    const body = await response.json();

    assert.equal(response.status, 413);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(body.error.code, "AUDIO_TOO_LARGE");
    assert.equal(body.error.message, "The recording must be 4 MB or smaller.");
  }
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

test("transcription endpoint distinguishes upstream timeout from request cancellation", async () => {
  for (const [name, message] of [
    ["TimeoutError", "Transcription timed out. Try a shorter recording."],
    ["AbortError", "Voice transcription is temporarily unavailable."],
  ]) {
    const response = await handleTranscriptionRequest(
      audioRequest(),
      `transcription-${name}`,
      {
        env: { OPENAI_API_KEY: "test-key" },
        fetchImpl: async () => {
          throw new DOMException("Injected fetch failure", name);
        },
      },
    );
    const body = await response.json();

    assert.equal(response.status, 503, name);
    assert.equal(response.headers.get("cache-control"), "no-store", name);
    assert.equal(body.ok, false, name);
    assert.equal(body.error.code, "TRANSCRIPTION_UNAVAILABLE", name);
    assert.equal(body.error.retryable, true, name);
    assert.equal(body.error.message, message, name);
  }
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

test("transcription output uses the discovery message boundary without trailing space", async () => {
  for (const [label, text, expectedLength] of [
    [
      "exact cap",
      "x".repeat(DISCOVERY_MESSAGE_MAX_LENGTH + 1),
      DISCOVERY_MESSAGE_MAX_LENGTH,
    ],
    [
      "whitespace boundary",
      `${"x".repeat(DISCOVERY_MESSAGE_MAX_LENGTH - 1)} y`,
      DISCOVERY_MESSAGE_MAX_LENGTH - 1,
    ],
  ]) {
    const response = await handleTranscriptionRequest(
      audioRequest(),
      `transcription-boundary-${label}`,
      {
        env: { OPENAI_API_KEY: "test-key" },
        fetchImpl: async () => Response.json({ text }),
      },
    );
    const body = await response.json();

    assert.equal(response.status, 200, label);
    assert.equal(body.text.length, expectedLength, label);
    assert.equal(body.text, body.text.trim(), label);
  }
});
