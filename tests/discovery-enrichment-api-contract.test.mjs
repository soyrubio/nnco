import assert from "node:assert/strict";
import test from "node:test";

import {
  handleDiscoveryEnrichmentRequest,
  isPublicIpAddress,
  pruneWebsiteCache,
} from "../src/server/discovery-enrichment-handler.ts";
import { verifyDiscoveryContextToken } from "../src/server/discovery-context-token.ts";

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

test("enrichment uses mandatory sourced AI research and returns questionnaire prefills", async () => {
  const hostname = `insurer-${crypto.randomUUID()}.example`;
  const sourceUrl = `https://${hostname}/services`;
  let upstream;
  let calls = 0;
  const env = { NODE_ENV: "test", OPENAI_API_KEY: "test-key" };
  const options = {
    env,
    resolveHost: async () => ["company.cdn.example.", "93.184.216.34", "2606:4700:4700::1111"],
    fetchImpl: async (_input, init) => {
      calls++;
      upstream = JSON.parse(init.body);
      return Response.json({
        status: "completed",
        output: [
          { type: "web_search_call", action: { sources: [{ url: sourceUrl }] } },
          { type: "message", content: [{ type: "output_text", text: JSON.stringify({
            name: "Example Insurance", sector: "insurance", summary: "Commercial insurance and claims services.",
            workflows: [
              { existingId: "claims", label: "Claims handling", selected: true, sourceUrl },
              { existingId: null, label: "Fleet renewal preparation", selected: true, sourceUrl },
              { existingId: null, label: "Invented process", selected: true, sourceUrl: "https://unverified.example/" },
            ],
            systems: [{ value: "documents", sourceUrl }],
            controls: [{ value: "audit", sourceUrl }, { value: "unknown-id", sourceUrl }],
          }) }] },
        ],
      });
    },
  };
  const response = await handleDiscoveryEnrichmentRequest(
    enrichmentRequest({ website: hostname }),
    `enrichment-success-${crypto.randomUUID()}`,
    options,
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.company.sector, "insurance");
  assert.deepEqual(Object.keys(body).sort(), ["company", "contextToken", "ok", "prefill", "sources", "workflowOptions"]);
  assert.deepEqual(Object.keys(body.company).sort(), ["name", "sector"]);
  assert.deepEqual(body.prefill, { workflow: ["claims", "custom-fleet-renewal-preparation"], systems: ["documents"], controls: ["audit"] });
  assert.equal(body.workflowOptions.some(option => option.label === "Invented process"), false);
  assert.equal(new Set(body.workflowOptions.map(option => option.value)).size, body.workflowOptions.length);
  assert.equal(body.workflowOptions.filter(option => option.value === "claims").length, 1);
  assert.equal(typeof body.contextToken, "string");
  const signed = verifyDiscoveryContextToken(body.contextToken, env);
  assert.equal(signed.analysisMode, "ai");
  assert.deepEqual(signed.workflowOptions, body.workflowOptions);
  assert.deepEqual(body.sources.map(source => source.url), [sourceUrl]);
  assert.equal(upstream.store, false);
  assert.equal(upstream.max_output_tokens, 2500);
  assert.equal(upstream.max_tool_calls, 3);
  assert.equal(upstream.tool_choice, "required");
  assert.deepEqual(upstream.tools, [{ type: "web_search", filters: { allowed_domains: [hostname] } }]);
  assert.deepEqual(upstream.include, ["web_search_call.action.sources"]);
  assert.equal(upstream.text.format.strict, true);
  assert.ok(JSON.parse(upstream.input[1].content).workflowOptionsBySector.insurance.length);
  const cached = await handleDiscoveryEnrichmentRequest(enrichmentRequest({ website: hostname }), crypto.randomUUID(), options);
  assert.equal(cached.status, 200);
  assert.equal(calls, 1);
  assert.equal(pruneWebsiteCache(Date.now() + 25 * 60 * 60 * 1_000) >= 1, true);
});

test("enrichment never substitutes a rules result when AI or its sources are unavailable", async () => {
  for (const variant of ["missing-key", "no-search", "no-sources", "incomplete", "upstream-error", "private-host", "alias-only", "mixed-private-host"]) {
    let calls = 0;
    const response = await handleDiscoveryEnrichmentRequest(
      enrichmentRequest({ website: `${variant}-${crypto.randomUUID()}.example` }), crypto.randomUUID(), {
        env: { NODE_ENV: "test", ...(variant === "missing-key" ? {} : { OPENAI_API_KEY: "test-key" }) },
        resolveHost: async () => variant === "alias-only" ? ["company.cdn.example."]
          : variant === "mixed-private-host" ? ["company.cdn.example.", "93.184.216.34", "127.0.0.1"]
          : [variant === "private-host" ? "127.0.0.1" : "93.184.216.34"],
        fetchImpl: async () => {
          calls++;
          if (variant === "upstream-error") return new Response(null, { status: 503 });
          return Response.json({
            status: variant === "incomplete" ? "incomplete" : "completed",
            output: variant === "no-search" ? [] : [{ type: "web_search_call", action: { sources: [] } }],
            output_text: JSON.stringify({ name: "Company", sector: "insurance", summary: "Company summary", workflows: [], systems: [], controls: [] }),
          });
        },
      },
    );
    const body = await response.json();
    assert.equal(response.status, variant === "missing-key" ? 503 : 422, variant);
    assert.equal(body.ok, false, variant);
    assert.equal(body.company, undefined, variant);
    assert.equal(body.error.retryable, true, variant);
    if (["private-host", "missing-key", "alias-only", "mixed-private-host"].includes(variant)) assert.equal(calls, 0, variant);
  }
});
