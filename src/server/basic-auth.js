const AUTH_REALM = "nnco stage";

export function getStageAuthResponse(request, env) {
  const expectedUser = env.BASIC_AUTH_USER;
  const expectedPass = env.BASIC_AUTH_PASS;

  if (!expectedUser || !expectedPass) {
    return new Response("Stage auth is not configured.", {
      status: 503,
      headers: privateResponseHeaders(),
    });
  }

  const credentials = readBasicCredentials(request.headers.get("Authorization"));
  if (
    credentials &&
    safeEqual(credentials.user, expectedUser) &&
    safeEqual(credentials.pass, expectedPass)
  ) {
    return null;
  }

  const headers = privateResponseHeaders();
  headers.set(
    "WWW-Authenticate",
    `Basic realm="${AUTH_REALM}", charset="UTF-8"`,
  );
  return new Response("Authentication required.", {
    status: 401,
    headers,
  });
}

export function isLocalAstroPrerenderRequest(request) {
  if (request.method !== "POST") return false;

  const url = new URL(request.url);
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return false;
  }

  return new Set([
    "/__astro_static_paths",
    "/__astro_prerender",
    "/__astro_static_images",
    "/__astro_image_transform",
  ]).has(url.pathname);
}

export function safeEqual(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);

  if (ab.byteLength !== bb.byteLength) {
    crypto.subtle.timingSafeEqual(ab, ab);
    return false;
  }

  return crypto.subtle.timingSafeEqual(ab, bb);
}

function readBasicCredentials(header) {
  const match = /^Basic\s+(.+)$/i.exec(header || "");
  if (!match) return null;

  let decoded;
  try {
    const binary = atob(match[1]);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    decoded = new TextDecoder().decode(bytes);
  } catch {
    return null;
  }

  const separator = decoded.indexOf(":");
  if (separator === -1) return null;

  return {
    user: decoded.slice(0, separator),
    pass: decoded.slice(separator + 1),
  };
}

function privateResponseHeaders() {
  return new Headers({
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
  });
}
