import assert from "node:assert/strict";
import test from "node:test";

import {
  handleDiscoveryEnrichmentRequest,
  isPublicIpAddress,
  pruneWebsiteCache,
} from "../src/server/discovery-enrichment-handler.ts";

function enrichmentRequest(body, origin = "http://localhost:4321") {
  return new Request("http://localhost:4321/api/discovery-enrichment", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}

test("enrichment blocks private and reserved network addresses", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "192.168.1.2",
    "::1",
    "fc00::1",
    "2001:db8::1",
    "::ffff:7f00:1",
    "::ffff:a00:1",
    "::ffff:a9fe:a9fe",
    "::ffff:0:7f00:1",
    "64:ff9b::a9fe:a9fe",
    "fec0::1",
    "feff::1",
  ]) {
    assert.equal(isPublicIpAddress(address), false, address);
  }
  assert.equal(isPublicIpAddress("93.184.216.34"), true);
  assert.equal(isPublicIpAddress("2606:4700:4700::1111"), true);
  assert.equal(isPublicIpAddress("::ffff:5db8:d822"), true);
});

test("enrichment rejects cross-origin requests", async () => {
  const response = await handleDiscoveryEnrichmentRequest(
    enrichmentRequest({ website: "example.com", situation: "" }, "https://bad.test"),
    `enrichment-cross-origin-${crypto.randomUUID()}`,
  );
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("enrichment reads only public same-host HTML and returns bounded context", async () => {
  const hostname = `insurer-${crypto.randomUUID()}.example`;
  const pages = [];
  const pinnedAddresses = [];
  const response = await handleDiscoveryEnrichmentRequest(
    enrichmentRequest({
      website: hostname,
      situation: "Improve underwriting preparation",
    }),
    `enrichment-success-${crypto.randomUUID()}`,
    {
      env: {},
      resolveHost: async () => ["93.184.216.34"],
      websiteFetchImpl: async (input, _init, addresses) => {
        pages.push(String(input));
        pinnedAddresses.push(...addresses);
        return new Response(
          `<!doctype html><title>Example Insurance | Home</title>
          <meta name="description" content="Commercial insurance and claims services">
          <a href="/about">About</a><a href="/services">Services</a>
          <p>Underwriting, policy administration and claims.</p>`,
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      },
    },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.company.sector, "insurance");
  assert.equal(body.company.analysisMode, "rules");
  assert.equal(typeof body.contextToken, "string");
  assert.equal(body.company.sources.length, 3);
  assert.equal(pages.length, 3);
  assert.deepEqual(pinnedAddresses, [
    "93.184.216.34",
    "93.184.216.34",
    "93.184.216.34",
  ]);
  assert.equal(pages.every((page) => new URL(page).hostname === hostname), true);
  assert.equal(pruneWebsiteCache(Date.now() + 25 * 60 * 60 * 1_000) >= 1, true);
});
