type FetchLike = typeof fetch;

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
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const baseUrl = (env.OPENAI_API_BASE_URL?.trim() || "https://api.openai.com").replace(
    /\/$/,
    "",
  );
  const model = env.OPENAI_DISCOVERY_MODEL?.trim() || "gpt-5.6-luna";
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
      ...(request.webSearch ? { tools: [{ type: "web_search" }] } : {}),
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
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}`);
  }
  const body = (await response.json()) as OpenAiResponse;
  const outputText = extractOutputText(body);
  if (!outputText) throw new Error("OpenAI response did not contain structured output");
  return {
    value: JSON.parse(outputText) as T,
    sourceUrls: extractSourceUrls(body),
  };
}

interface OpenAiResponse {
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
      if (content.type === "refusal") {
        throw new Error(content.refusal || "OpenAI refused the request");
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
