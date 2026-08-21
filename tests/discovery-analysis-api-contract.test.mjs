import assert from "node:assert/strict";
import test from "node:test";

import {
  DISCOVERY_RELEASE_CONSENT_VERSION,
  buildFallbackCompanyContext,
  buildFallbackReleaseReport,
  workflowChoicesFor,
} from "../src/lib/discovery-release.ts";
import { handleDiscoveryAnalysisRequest } from "../src/server/discovery-analysis-handler.ts";
import { createDiscoveryContextToken } from "../src/server/discovery-context-token.ts";

function validPayload(email = `alex-${crypto.randomUUID()}@example.com`) {
  const company = buildFallbackCompanyContext({
    website: "https://example-insurance.test/",
    title: "Example Insurance | Commercial cover",
    description: "Commercial insurance and claims services.",
    text: "Underwriting, policy administration and claims.",
    sourceUrls: ["https://example-insurance.test/"],
  });
  return {
    schemaVersion: 1,
    requestId: crypto.randomUUID(),
    website: company.website,
    situation: "Reduce manual underwriting preparation.",
    company,
    companyContextToken: createDiscoveryContextToken(company, { NODE_ENV: "test" }),
    answers: {
      workflow: workflowChoicesFor(company).slice(0, 2).map((choice) => choice.value),
      friction: ["document-review"],
      scale: "daily",
      systems: ["email", "documents"],
      controls: ["audit", "human-approval"],
    },
    contact: { workEmail: email, organisation: "Example Insurance" },
    competitorView: { enabled: false, names: [] },
    consent: { accepted: true, version: DISCOVERY_RELEASE_CONSENT_VERSION },
  };
}

function analysisRequest(payload, origin = "http://localhost:4321") {
  return new Request("http://localhost:4321/api/discovery-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(payload),
  });
}

async function withLocalRepository(run) {
  const previousMode = process.env.LEAD_HANDOFF_MODE;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.LEAD_HANDOFF_MODE = "local";
  process.env.NODE_ENV = "test";
  try {
    await run();
  } finally {
    if (previousMode === undefined) delete process.env.LEAD_HANDOFF_MODE;
    else process.env.LEAD_HANDOFF_MODE = previousMode;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
}

test("analysis requires the final work email and consent contract", async () => {
  const payload = validPayload();
  payload.contact.workEmail = "not-an-email";
  const response = await handleDiscoveryAnalysisRequest(
    analysisRequest(payload),
    `analysis-invalid-${crypto.randomUUID()}`,
    { env: { NODE_ENV: "test" } },
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
});

test("analysis persists the lead and returns a two-page local rules report", async () => {
  await withLocalRepository(async () => {
    const payload = validPayload();
    const response = await handleDiscoveryAnalysisRequest(
      analysisRequest(payload),
      `analysis-rules-${crypto.randomUUID()}`,
      { env: { NODE_ENV: "test" } },
    );
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(body.ok, true);
    assert.equal(body.persistence, "ephemeral");
    assert.equal(body.analysisMode, "rules");
    assert.ok(body.report.pageOne);
    assert.ok(body.report.pageTwo);
    assert.equal(body.report.pageTwo.competitorStatus, "not-requested");
  });
});

test("analysis rejects a company context that does not match its signature", async () => {
  const payload = validPayload();
  payload.company = { ...payload.company, summary: "Forged public context" };
  const response = await handleDiscoveryAnalysisRequest(
    analysisRequest(payload),
    `analysis-forged-${crypto.randomUUID()}`,
    { env: { NODE_ENV: "test" } },
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
});

test("analysis uses non-stored strict Responses output with a token ceiling", async () => {
  await withLocalRepository(async () => {
    const payload = validPayload();
    const generatedAt = "2026-08-10T12:00:00.000Z";
    const report = buildFallbackReleaseReport(payload, generatedAt);
    let upstream;
    const response = await handleDiscoveryAnalysisRequest(
      analysisRequest(payload),
      `analysis-ai-${crypto.randomUUID()}`,
      {
        now: Date.parse(generatedAt),
        env: {
          NODE_ENV: "test",
          OPENAI_API_KEY: "test-key",
          OPENAI_DISCOVERY_MODEL: "test-model",
          OPENAI_API_BASE_URL: "https://api.example.test",
        },
        fetchImpl: async (input, init) => {
          upstream = { input, body: JSON.parse(init.body) };
          return Response.json({
            output: [{
              type: "message",
              content: [{ type: "output_text", text: JSON.stringify(report) }],
            }],
          });
        },
      },
    );
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.analysisMode, "ai");
    assert.equal(String(upstream.input), "https://api.example.test/v1/responses");
    assert.equal(upstream.body.model, "test-model");
    assert.equal(upstream.body.store, false);
    assert.equal(upstream.body.max_output_tokens, 2_500);
    assert.equal(upstream.body.text.format.type, "json_schema");
    assert.equal(upstream.body.text.format.strict, true);
    assert.equal(upstream.body.tools, undefined);
  });
});

test("analysis replays a completed request without a second model call", async () => {
  await withLocalRepository(async () => {
    const payload = validPayload();
    const report = buildFallbackReleaseReport(payload, "2026-08-10T12:00:00.000Z");
    let upstreamCalls = 0;
    const options = {
      env: {
        NODE_ENV: "test",
        OPENAI_API_KEY: "test-key",
        OPENAI_API_BASE_URL: "https://api.example.test",
      },
      fetchImpl: async () => {
        upstreamCalls += 1;
        return Response.json({ output_text: JSON.stringify(report) });
      },
    };

    const first = await handleDiscoveryAnalysisRequest(
      analysisRequest(payload),
      `analysis-replay-first-${crypto.randomUUID()}`,
      options,
    );
    const replays = [];
    for (let index = 0; index < 5; index += 1) {
      replays.push(await handleDiscoveryAnalysisRequest(
        analysisRequest(payload),
        `analysis-replay-${index}-${crypto.randomUUID()}`,
        options,
      ));
    }
    const expiredTokenReplay = await handleDiscoveryAnalysisRequest(
      analysisRequest(payload),
      `analysis-replay-expired-token-${crypto.randomUUID()}`,
      { ...options, now: Date.now() + 25 * 60 * 60 * 1_000 },
    );

    assert.equal(first.status, 201);
    assert.equal(replays.every((response) => response.status === 200), true);
    assert.equal(expiredTokenReplay.status, 200);
    assert.equal(upstreamCalls, 1);
    assert.deepEqual((await replays[4].json()).report, (await first.json()).report);
  });
});

test("concurrent identical submissions acquire one analysis claim", async () => {
  await withLocalRepository(async () => {
    const payload = validPayload();
    const report = buildFallbackReleaseReport(payload, "2026-08-10T12:00:00.000Z");
    let upstreamCalls = 0;
    let signalStarted;
    let releaseUpstream;
    const started = new Promise((resolve) => { signalStarted = resolve; });
    const gate = new Promise((resolve) => { releaseUpstream = resolve; });
    const options = {
      env: {
        NODE_ENV: "test",
        OPENAI_API_KEY: "test-key",
        OPENAI_API_BASE_URL: "https://api.example.test",
      },
      fetchImpl: async () => {
        upstreamCalls += 1;
        signalStarted();
        await gate;
        return Response.json({ output_text: JSON.stringify(report) });
      },
    };

    const firstPromise = handleDiscoveryAnalysisRequest(
      analysisRequest(payload),
      `analysis-concurrent-first-${crypto.randomUUID()}`,
      options,
    );
    await started;
    const competing = [];
    for (let index = 0; index < 5; index += 1) {
      competing.push(await handleDiscoveryAnalysisRequest(
        analysisRequest(payload),
        `analysis-concurrent-${index}-${crypto.randomUUID()}`,
        options,
      ));
    }
    releaseUpstream();
    const first = await firstPromise;
    const replay = await handleDiscoveryAnalysisRequest(
      analysisRequest(payload),
      `analysis-concurrent-replay-${crypto.randomUUID()}`,
      options,
    );

    assert.equal(first.status, 201);
    assert.equal(competing.every((response) => response.status === 503), true);
    assert.equal(competing.every((response) => response.headers.get("retry-after") === "2"), true);
    assert.equal(replay.status, 200);
    assert.equal(upstreamCalls, 1);
    assert.deepEqual((await replay.json()).report, (await first.json()).report);
  });
});

test("competitor notes require returned web-search citation metadata", async () => {
  await withLocalRepository(async () => {
    const payload = validPayload();
    payload.competitorView.enabled = true;
    const report = buildFallbackReleaseReport(payload, "2026-08-10T12:00:00.000Z");
    report.pageTwo.competitorStatus = "included";
    report.pageTwo.competitorNotes = [
      {
        company: "Cited competitor",
        finding: "Publishes a structured public intake flow.",
        sourceUrl: "https://competitor.example/public-flow",
      },
      {
        company: "Unverified competitor",
        finding: "This model-authored URL is not evidence.",
        sourceUrl: "https://hallucinated.example/claim",
      },
    ];
    let upstreamBody;
    const response = await handleDiscoveryAnalysisRequest(
      analysisRequest(payload),
      `analysis-citations-${crypto.randomUUID()}`,
      {
        env: {
          NODE_ENV: "test",
          OPENAI_API_KEY: "test-key",
          OPENAI_API_BASE_URL: "https://api.example.test",
        },
        fetchImpl: async (_input, init) => {
          upstreamBody = JSON.parse(init.body);
          return Response.json({
            output: [{
              type: "message",
              content: [{
                type: "output_text",
                text: JSON.stringify(report),
                annotations: [{
                  type: "url_citation",
                  url: "https://competitor.example/public-flow",
                }],
              }],
            }],
          });
        },
      },
    );
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.deepEqual(upstreamBody.tools, [{ type: "web_search" }]);
    assert.equal(body.report.pageTwo.competitorStatus, "included");
    assert.equal(body.report.pageTwo.competitorNotes.length, 1);
    assert.equal(body.report.pageTwo.competitorNotes[0].company, "Cited competitor");
  });
});

test("analysis bounds maximum model copy for the two A4 report pages", async () => {
  await withLocalRepository(async () => {
    const payload = validPayload();
    const report = buildFallbackReleaseReport(payload, "2026-08-10T12:00:00.000Z");
    const long = "Long model copy ".repeat(100);
    report.executiveSummary = long;
    report.pageOne.systems = long;
    report.pageOne.findings = Array.from({ length: 3 }, (_, index) => ({
      title: `Finding ${index} ${long}`,
      explanation: long,
      evidence: long,
      basis: "Inferred",
    }));
    report.pageTwo.opportunities = Array.from({ length: 3 }, (_, index) => ({
      title: `Opportunity ${index} ${long}`,
      action: long,
      humanBoundary: long,
      requires: long,
    }));
    report.pageTwo.constraints = long;
    report.pageTwo.firstMove = long;
    report.pageTwo.validationQuestions = [long, long, long, long];

    const response = await handleDiscoveryAnalysisRequest(
      analysisRequest(payload),
      `analysis-a4-budget-${crypto.randomUUID()}`,
      {
        env: {
          NODE_ENV: "test",
          OPENAI_API_KEY: "test-key",
          OPENAI_API_BASE_URL: "https://api.example.test",
        },
        fetchImpl: async () => Response.json({ output_text: JSON.stringify(report) }),
      },
    );
    const bounded = (await response.json()).report;

    assert.equal(bounded.pageOne.findings.length, 2);
    assert.equal(bounded.pageTwo.opportunities.length, 2);
    assert.equal(bounded.executiveSummary.length <= 320, true);
    assert.equal(bounded.pageOne.findings.every((item) => item.explanation.length <= 220), true);
    assert.equal(bounded.pageTwo.opportunities.every((item) => item.action.length <= 200), true);
    assert.equal(bounded.pageTwo.validationQuestions.every((item) => item.length <= 120), true);
  });
});
