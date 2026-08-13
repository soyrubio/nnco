export interface RequestIdentity {
  requestId: string;
  payloadSignature: string;
}

export type RequestIdFactory = () => string;

const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidRequestId(value: unknown): value is string {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value);
}

export function createRequestIdentity(
  payloadSignature: string,
  createRequestId: RequestIdFactory,
): RequestIdentity {
  return {
    requestId: createRequestId(),
    payloadSignature,
  };
}

export function resolveRequestIdentity(
  current: RequestIdentity | null,
  payloadSignature: string,
  createRequestId: RequestIdFactory,
): RequestIdentity {
  if (current?.payloadSignature === payloadSignature) return current;
  return createRequestIdentity(payloadSignature, createRequestId);
}
