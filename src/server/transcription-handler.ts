import {
  checkSlidingWindowRateLimit,
  isSameOrigin,
  readBoundedBody,
} from "./request-guards.ts";
import { DISCOVERY_MESSAGE_MAX_LENGTH } from "../lib/discovery.ts";

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_AUDIO_BYTES + 64 * 1024;
const RATE_WINDOW_MS = 10 * 60 * 1_000;
const RATE_LIMIT = 15;
const UPSTREAM_TIMEOUT_MS = 30_000;
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
]);

type TranscriptionEnvironment = {
  OPENAI_API_KEY?: string;
  OPENAI_TRANSCRIPTION_MODEL?: string;
  OPENAI_API_BASE_URL?: string;
};

type TranscriptionHandlerOptions = {
  env?: TranscriptionEnvironment;
  fetchImpl?: typeof fetch;
};

const globalRateStore = globalThis as typeof globalThis & {
  __nncoTranscriptionRateLimits?: Map<string, number[]>;
};
const rateLimits =
  globalRateStore.__nncoTranscriptionRateLimits ?? new Map<string, number[]>();
globalRateStore.__nncoTranscriptionRateLimits = rateLimits;

export async function handleTranscriptionRequest(
  request: Request,
  clientAddress?: string,
  options: TranscriptionHandlerOptions = {},
): Promise<Response> {
  if (!isSameOrigin(request)) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "The request origin could not be verified.",
      false,
    );
  }

  const retryAfter = checkSlidingWindowRateLimit(
    request,
    clientAddress,
    rateLimits,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );
  if (retryAfter !== null) {
    const response = errorResponse(
      429,
      "RATE_LIMITED",
      "Too many transcription attempts. Wait briefly and retry.",
      true,
    );
    response.headers.set("Retry-After", String(retryAfter));
    return response;
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "Send the recording as multipart form data.",
      false,
    );
  }

  const body = await readBoundedBody(request, MAX_REQUEST_BYTES);
  if (!body.ok && body.reason === "too_large") {
    return errorResponse(
      413,
      "AUDIO_TOO_LARGE",
      "The recording must be 4 MB or smaller.",
      false,
    );
  }
  if (!body.ok) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "The recording could not be read.",
      false,
    );
  }

  let formData: FormData;
  try {
    formData = await new Response(body.bytes, {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "The recording could not be read.",
      false,
    );
  }

  const audio = formData.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "Add an audio recording and try again.",
      false,
    );
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return errorResponse(
      413,
      "AUDIO_TOO_LARGE",
      "The recording must be 4 MB or smaller.",
      false,
    );
  }

  const audioType = normalizeMimeType(audio.type);
  if (!ALLOWED_AUDIO_TYPES.has(audioType)) {
    return errorResponse(
      415,
      "UNSUPPORTED_AUDIO",
      "Use a WebM, MP4, MP3, or WAV recording.",
      false,
    );
  }

  const env = options.env ?? process.env;
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return errorResponse(
      503,
      "TRANSCRIPTION_UNAVAILABLE",
      "Voice transcription is not configured.",
      false,
    );
  }

  const model = env.OPENAI_TRANSCRIPTION_MODEL?.trim() || "gpt-transcribe";
  const baseUrl =
    env.OPENAI_API_BASE_URL?.trim() || "https://api.openai.com";
  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(
      `${baseUrl.replace(/\/+$/, "")}/v1/audio/transcriptions`,
    );
  } catch {
    return errorResponse(
      503,
      "TRANSCRIPTION_UNAVAILABLE",
      "Voice transcription is not configured.",
      false,
    );
  }

  const upstreamBody = new FormData();
  upstreamBody.append("file", audio, `recording.${extensionFor(audioType)}`);
  upstreamBody.append("model", model);

  const timeoutSignal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  const signal = AbortSignal.any([request.signal, timeoutSignal]);
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const upstream = await fetchImpl(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: upstreamBody,
      signal,
    });
    if (!upstream.ok) {
      return errorResponse(
        upstream.status === 429 ? 429 : 502,
        upstream.status === 429
          ? "RATE_LIMITED"
          : "TRANSCRIPTION_UPSTREAM_ERROR",
        upstream.status === 429
          ? "Voice transcription is busy. Wait briefly and retry."
          : "The recording could not be transcribed. Try again.",
        true,
      );
    }

    const payload = (await upstream.json()) as { text?: unknown };
    const text =
      typeof payload.text === "string" ? normalizeTranscript(payload.text) : "";
    if (!text) {
      return errorResponse(
        502,
        "TRANSCRIPTION_UPSTREAM_ERROR",
        "No speech was detected. Try again.",
        true,
      );
    }

    return Response.json(
      { text },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return errorResponse(
      503,
      "TRANSCRIPTION_UNAVAILABLE",
      error instanceof DOMException && error.name === "TimeoutError"
        ? "Transcription timed out. Try a shorter recording."
        : "Voice transcription is temporarily unavailable.",
      true,
    );
  }
}

function normalizeMimeType(value: string): string {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function extensionFor(mimeType: string): string {
  if (mimeType === "audio/mp4") return "m4a";
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/wav") return "wav";
  return "webm";
}

function normalizeTranscript(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DISCOVERY_MESSAGE_MAX_LENGTH)
    .trimEnd();
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  retryable: boolean,
): Response {
  return Response.json(
    {
      ok: false,
      error: { code, message, retryable },
    },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
