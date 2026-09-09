type FetchLike = typeof fetch;

type OutputDiagnostic = { httpStatus?: number; upstreamRequestId?: string; reason?: string; issues?: string[] };

export class StructuredOutputError extends Error {
  readonly code: string;
  readonly diagnostic: OutputDiagnostic;

  constructor(code: string, diagnostic: OutputDiagnostic = {}) {
    super(code);
    this.name = "StructuredOutputError";
    this.code = code;
    this.diagnostic = diagnostic;
  }
}

function safeMetadata(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : undefined;
}

export interface OpenAiStructuredEnvironment {
  OPENAI_API_KEY?: string;
  OPENAI_DISCOVERY_MODEL?: string;
  OPENAI_API_BASE_URL?: string;
}

export interface StructuredOutputRequest {
  name: string;
  schema: Record<string, unknown>;
  system: string;
  user: string;
  maxOutputTokens: number;
  safetyIdentifier?: string;
  webSearch?: boolean;
  searchDomains?: string[];
  requireSearch?: boolean;
  maxToolCalls?: number;
}

export async function requestStructuredOutput<T>(
  request: StructuredOutputRequest,
  {
    env = process.env,
    fetchImpl = fetch,
    timeoutMs = 25_000,
  }: {
    env?: OpenAiStructuredEnvironment;
    fetchImpl?: FetchLike;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const result = await requestStructuredOutputWithMetadata<T>(request, {
    env,
    fetchImpl,
    timeoutMs,
  });
  return result.value;
}

export async function requestStructuredOutputWithMetadata<T>(
  request: StructuredOutputRequest,
  {
    env = process.env,
    fetchImpl = fetch,
    timeoutMs = 25_000,
  }: {
    env?: OpenAiStructuredEnvironment;
    fetchImpl?: FetchLike;
    timeoutMs?: number;
  } = {},
): Promise<{ value: T; sourceUrls: string[] }> {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new StructuredOutputError("OPENAI_NOT_CONFIGURED");

  const baseUrl = (env.OPENAI_API_BASE_URL?.trim() || "https://api.openai.com").replace(
    /\/$/,
    "",
  );
  const model = env.OPENAI_DISCOVERY_MODEL?.trim() || "gpt-5.6-luna";
  const signal = AbortSignal.timeout(timeoutMs);
  const response = await fetchImpl(`${baseUrl}/v1/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: request.maxOutputTokens,
      ...(request.safetyIdentifier
        ? { safety_identifier: request.safetyIdentifier }
        : {}),
      ...(request.webSearch ? {
        tools: [{ type: "web_search", ...(request.searchDomains ? { filters: { allowed_domains: request.searchDomains } } : {}) }],
        include: ["web_search_call.action.sources"],
        ...(request.requireSearch ? { tool_choice: "required" } : {}),
        max_tool_calls: request.maxToolCalls ?? 3,
      } : {}),
      input: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
      text: {
        format: {
          type: "json_schema",
          name: request.name,
          strict: true,
          schema: request.schema,
        },
      },
    }),
    signal,
  }).catch(() => {
    throw new StructuredOutputError(signal.aborted ? "OPENAI_TIMEOUT" : "OPENAI_NETWORK_ERROR");
  });

  const metadata = {
    httpStatus: response.status,
    upstreamRequestId: safeMetadata(response.headers.get("x-request-id")),
  };
  if (!response.ok) {
    throw new StructuredOutputError("OPENAI_HTTP_ERROR", metadata);
  }
  const body = (await response.json().catch(() => {
    throw new StructuredOutputError(signal.aborted ? "OPENAI_TIMEOUT" : "OPENAI_INVALID_RESPONSE", metadata);
  })) as OpenAiResponse;
  if (!body || typeof body !== "object") throw new StructuredOutputError("OPENAI_INVALID_RESPONSE", metadata);
  if (body.status === "incomplete" || body.status === "failed") {
    throw new StructuredOutputError(body.status === "incomplete" ? "OPENAI_INCOMPLETE" : "OPENAI_FAILED", {
      ...metadata,
      reason: safeMetadata(body.incomplete_details?.reason ?? body.error?.code),
    });
  }
  if (request.requireSearch && !body.output?.some(item => item.type === "web_search_call")) {
    throw new StructuredOutputError("OPENAI_SEARCH_MISSING", metadata);
  }
  if (body.output?.some(item => item.content?.some(content => content.type === "refusal"))) {
    throw new StructuredOutputError("OPENAI_REFUSAL", metadata);
  }
  const outputText = extractOutputText(body);
  if (!outputText) throw new StructuredOutputError("OPENAI_OUTPUT_MISSING", metadata);
  let value: T;
  try { value = JSON.parse(outputText) as T; }
  catch { throw new StructuredOutputError("OPENAI_INVALID_JSON", metadata); }
  return {
    value,
    sourceUrls: extractSourceUrls(body),
  };
}

interface OpenAiResponse {
  status?: string;
  incomplete_details?: { reason?: string };
  error?: { code?: string };
  output_text?: string;
  output?: Array<{
    type?: string;
    action?: {
      sources?: Array<{ url?: string }>;
    };
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
      annotations?: Array<{ type?: string; url?: string }>;
    }>;
  }>;
}

function extractOutputText(response: OpenAiResponse): string {
  if (typeof response.output_text === "string") return response.output_text;
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  return "";
}

function extractSourceUrls(response: OpenAiResponse): string[] {
  const urls = new Set<string>();
  for (const item of response.output ?? []) {
    for (const source of item.action?.sources ?? []) {
      addSourceUrl(urls, source.url);
    }
    for (const content of item.content ?? []) {
      for (const annotation of content.annotations ?? []) {
        if (annotation.type === "url_citation") addSourceUrl(urls, annotation.url);
      }
    }
  }
  return [...urls];
}

function addSourceUrl(urls: Set<string>, value: unknown): void {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (/^https?:$/.test(url.protocol)) {
      url.hash = "";
      urls.add(url.toString());
    }
  } catch {
    // Ignore malformed upstream citation metadata.
  }
}
