export type BoundedBodyResult =
  | { ok: true; bytes: Uint8Array<ArrayBuffer> }
  | { ok: false; reason: "too_large" | "unreadable" };

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function checkSlidingWindowRateLimit(
  request: Request,
  clientAddress: string | undefined,
  store: Map<string, number[]>,
  limit: number,
  windowMs: number,
  now = Date.now(),
): number | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const key = forwarded?.split(",")[0]?.trim() || clientAddress || "local";
  const recent = (store.get(key) ?? []).filter(
    (timestamp) => timestamp > now - windowMs,
  );

  if (recent.length >= limit) {
    store.set(key, recent);
    return Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1_000));
  }

  recent.push(now);
  store.set(key, recent);
  return null;
}

export async function readBoundedBody(
  request: Request,
  maximumBytes: number,
): Promise<BoundedBodyResult> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > maximumBytes) {
    return { ok: false, reason: "too_large" };
  }

  if (!request.body) {
    return { ok: true, bytes: new Uint8Array() };
  }

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = request.body.getReader();
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  const chunks: Uint8Array<ArrayBufferLike>[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      if (totalBytes + value.byteLength > maximumBytes) {
        try {
          await reader.cancel();
        } catch {
          // The size result is already known even if cancellation fails.
        }
        return { ok: false, reason: "too_large" };
      }

      chunks.push(value);
      totalBytes += value.byteLength;
    }
  } catch {
    return { ok: false, reason: "unreadable" };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}
