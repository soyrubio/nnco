import assert from "node:assert/strict";
import test from "node:test";

import {
  DISCOVERY_RELEASE_CONSENT_VERSION,
  buildFallbackCompanyContext,
  buildFallbackReleaseReport,
  workflowChoicesFor,
  buildManualCompanyContext,
  isDiscoveryReleaseReport,
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
  const submission = payload.schemaVersion === 1 ? {
    requestId: payload.requestId,
    contextToken: payload.companyContextToken,
    sector: payload.company.sector,
    answers: payload.answers,
    workEmail: payload.contact.workEmail,
    includeCompetitors: payload.competitorView.enabled,
    consent: payload.consent,
  } : payload;
  return new Request("http://localhost:4321/api/discovery-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(submission),
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

test("analysis requires AI configuration instead of returning a rules report", async () => {
  await withLocalRepository(async () => {
    const payload = validPayload();
    const response = await handleDiscoveryAnalysisRequest(
      analysisRequest(payload),
      `analysis-rules-${crypto.randomUUID()}`,
      { env: { NODE_ENV: "test" } },
    );
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "CONFIGURATION_ERROR");
    assert.equal(body.report, undefined);
  });
});

test("analysis rejects a company context that does not match its signature", async () => {
  const payload = validPayload();
  const [claims, signature] = payload.companyContextToken.split(".");
  const forged = JSON.parse(Buffer.from(claims, "base64url").toString());
  forged.company.summary = "Forged public context";
  payload.companyContextToken = `${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${signature}`;
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
    assert.deepEqual(Object.keys(body).sort(), ["ok", "report"]);
    assert.equal(String(upstream.input), "https://api.example.test/v1/responses");
    assert.equal(upstream.body.model, "test-model");
    assert.equal(upstream.body.store, false);
    assert.equal(upstream.body.max_output_tokens, 2_500);
    assert.equal(upstream.body.text.format.type, "json_schema");
    assert.equal(upstream.body.text.format.strict, true);
    assert.equal(upstream.body.tools, undefined);
    const system = upstream.body.input.find((message) => message.role === "system").content;
    assert.match(system, /where AI could improve the existing work/);
    assert.match(system, /Establish the information and our understanding before discussing AI opportunities/);
    assert.match(system, /say that no answers came from the company/);
    assert.match(system, /Always mention the supplied company name/);
    assert.match(system, /Label that example explicitly as 'Sector example'/);
    assert.match(system, /Choose the strongest connection to a reported problem and the clearest concrete example/);
    assert.match(system, /Deepen one of the listed opportunities, never introduce a third/);
    assert.match(system, /begin with 'Sector example:'/);
    assert.equal(upstream.body.text.format.schema.properties.pageOne.properties.findings.minItems, 2);
    assert.match(system, /If the company already uses AI in this area, acknowledge that/);
    assert.match(system, /zero, one or two distinct AI opportunities/);
    assert.match(system, /AI cannot recover absent facts/);
    assert.match(system, /Do not recommend named tools, vendors/);
    assert.doesNotMatch(system, /Do not recommend tools, vendors, platforms, agents, automation/);
    assert.equal(upstream.body.text.format.schema.properties.pageTwo.properties.opportunities.minItems, 0);
    assert.equal(upstream.body.text.format.schema.properties.executiveSummary.maxLength, 900);
    assert.equal(upstream.body.text.format.schema.properties.pageTwo.properties.firstMove.maxLength, 100);
    assert.equal(upstream.body.text.format.schema.properties.pageTwo.properties.opportunities.items.properties.action.maxLength, 220);
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
    const long = "Long model copy. ".repeat(100);
    report.executiveSummary = long;
    report.pageOne.systems = long;
    report.pageOne.findings = Array.from({ length: 3 }, (_, index) => ({
      title: `**Finding ${index}** ${long}`,
      explanation: long,
      evidence: long,
      basis: "Inferred",
    }));
    report.pageTwo.opportunities = Array.from({ length: 3 }, (_, index) => ({
      title: `**Opportunity ${index}** ${long}`,
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
    assert.equal([...bounded.pageOne.findings, ...bounded.pageTwo.opportunities].some((item) => item.title.includes("**")), false);
    assert.equal(bounded.pageTwo.opportunities.length, 2);
    assert.equal(bounded.executiveSummary.length > 600 && bounded.executiveSummary.length <= 900, true);
    assert.equal(bounded.pageOne.findings.every((item) => item.explanation.length <= 220 && item.evidence.length <= 80), true);
    assert.equal(bounded.pageTwo.opportunities.every((item) => item.action.length > 200 && item.action.length <= 220 && item.humanBoundary.length <= 120 && item.requires.length <= 120), true);
    assert.equal(bounded.pageTwo.firstMove.length <= 100, true);
    assert.equal(bounded.pageTwo.constraints.length <= 240, true);
    assert.equal(bounded.executiveSummary.endsWith("."), true);
    assert.equal(bounded.executiveSummary.endsWith("..."), false);
    assert.equal(bounded.pageTwo.validationQuestions.every((item) => item.length <= 120), true);
  });
});

for (const count of [0, 1]) {
  test(`analysis accepts ${count} supported AI opportunities without filling a quota`, async () => {
    await withLocalRepository(async () => {
      const payload = validPayload();
      const report = buildFallbackReleaseReport(payload);
      report.pageTwo.opportunities = report.pageTwo.opportunities.slice(0, count);
      report.pageOne.findings = report.pageOne.findings.slice(0, 2);
      report.pageTwo.firstMove = count ? "AI assistance may be useful if the source information can be checked." : "The supplied information does not establish a clear use for AI.";
      const response = await handleDiscoveryAnalysisRequest(analysisRequest(payload), `analysis-fit-${crypto.randomUUID()}`, {
        env: { NODE_ENV: "test", OPENAI_API_KEY: "test-key" },
        fetchImpl: async () => Response.json({ output_text: JSON.stringify(report) }),
      });
      assert.equal(response.status, 201);
      const result = (await response.json()).report;
      assert.equal(result.pageTwo.opportunities.length, count);
      assert.equal(result.pageOne.findings.length, 2);
      assert.equal(result.pageTwo.firstMove, report.pageTwo.firstMove);
    });
  });
}

test("invalid opportunity output is not treated as a conclusion that AI is unsuitable", async () => {
  await withLocalRepository(async () => {
    const payload = validPayload();
    const report = buildFallbackReleaseReport(payload);
    report.pageTwo.opportunities = [{ title: "Incomplete model output" }];
    const response = await handleDiscoveryAnalysisRequest(analysisRequest(payload), `analysis-invalid-fit-${crypto.randomUUID()}`, {
      env: { NODE_ENV: "test", OPENAI_API_KEY: "test-key" },
      fetchImpl: async () => Response.json({ output_text: JSON.stringify(report) }),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "ANALYSIS_UNAVAILABLE");
  });
});

test("saved reports remain readable when current print budgets are reduced", () => {
  const report = buildFallbackReleaseReport(validPayload());
  report.executiveSummary = "A".repeat(600);
  report.pageOne.findings[0].explanation = "B".repeat(320);
  report.pageOne.findings[0].evidence = "C".repeat(120);
  report.pageTwo.opportunities[0].action = "D".repeat(260);
  assert.equal(isDiscoveryReleaseReport(report), true);
});

test("new reports fail safely if cleanup loses the concrete example", async () => {
  await withLocalRepository(async () => {
    const payload = validPayload();
    const report = buildFallbackReleaseReport(payload);
    report.pageOne.findings = report.pageOne.findings.slice(0, 2);
    report.pageOne.findings[0].explanation = "Unfinished example ".repeat(30);
    const response = await handleDiscoveryAnalysisRequest(analysisRequest(payload), `analysis-missing-example-${crypto.randomUUID()}`, {
      env: { NODE_ENV: "test", OPENAI_API_KEY: "test-key" },
      fetchImpl: async () => Response.json({ output_text: JSON.stringify(report) }),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.retryable, true);
  });
});

test("a model sentence cut off at the schema limit is not shown as finished prose", async () => {
  await withLocalRepository(async () => {
    const payload = validPayload();
    const report = buildFallbackReleaseReport(payload);
    const complete = "You described document review.";
    report.executiveSummary = `${complete} This sentence has no ending`.padEnd(900, "x");
    const response = await handleDiscoveryAnalysisRequest(analysisRequest(payload), `analysis-prose-${crypto.randomUUID()}`, {
      env: { NODE_ENV: "test", OPENAI_API_KEY: "test-key" },
      fetchImpl: async () => Response.json({ output_text: JSON.stringify(report) }),
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).report.executiveSummary, complete);
  });
});

test("compact manual submissions carry text-only answers into AI and replay identity", async () => {
  await withLocalRepository(async () => {
    const payload = validPayload();
    const report = buildFallbackReleaseReport(payload);
    payload.company = buildManualCompanyContext("insurance");
    payload.companyContextToken = null;
    payload.answers = {
      workflow: [], friction: [], scale: "daily", systems: [], controls: [],
      context: { workflow: "  Fleet renewals  ", friction: "Late signatures", systems: "Internal tool", controls: "Legal sign-off" },
    };
    let calls = 0;
    let aiInput;
    const options = {
      env: { NODE_ENV: "test", OPENAI_API_KEY: "test-key" },
      fetchImpl: async (_url, init) => {
        calls++;
        aiInput = JSON.parse(JSON.parse(init.body).input[1].content);
        return Response.json({ output_text: JSON.stringify(report) });
      },
    };
    const first = await handleDiscoveryAnalysisRequest(analysisRequest(payload), crypto.randomUUID(), options);
    assert.equal(first.status, 201);
    assert.equal(aiInput.reportedAnswers.context.workflow, "Fleet renewals");
    assert.deepEqual(aiInput.reportedAnswers.workflow, []);
    assert.match(aiInput.answerContext, /user's own answer/);
    assert.ok(aiInput.answerOptions.workflow.some(option => option.value === "claims"));
    const replay = await handleDiscoveryAnalysisRequest(analysisRequest(payload), crypto.randomUUID(), options);
    assert.equal(replay.status, 200);
    payload.answers.context.workflow = "A different process";
    const conflict = await handleDiscoveryAnalysisRequest(analysisRequest(payload), crypto.randomUUID(), options);
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).error.code, "IDEMPOTENCY_CONFLICT");
    assert.equal(calls, 1);
  });
});

test("analysis retries after an incomplete AI report instead of filling missing sections with rules", async () => {
  await withLocalRepository(async () => {
    const payload = validPayload();
    const report = buildFallbackReleaseReport(payload);
    let calls = 0;
    const options = {
      env: { NODE_ENV: "test", OPENAI_API_KEY: "test-key" },
      fetchImpl: async () => Response.json({ output_text: JSON.stringify(++calls === 1 ? { title: "Incomplete report" } : report) }),
    };
    const first = await handleDiscoveryAnalysisRequest(analysisRequest(payload), crypto.randomUUID(), options);
    assert.equal(first.status, 503);
    const body = await first.json();
    assert.equal(body.error.code, "ANALYSIS_UNAVAILABLE");
    assert.equal(body.error.retryable, true);
    assert.equal(body.report, undefined);
    const retry = await handleDiscoveryAnalysisRequest(analysisRequest(payload), crypto.randomUUID(), options);
    assert.equal(retry.status, 200);
    assert.equal(calls, 2);
  });
});

test("new analysis rejects expired context, unknown choices and redundant client company data", async () => {
  for (const variant of ["expired", "unknown-choice", "extra-company", "oversized-text"]) {
    const payload = validPayload();
    const input = JSON.parse(await analysisRequest(payload).text());
    if (variant === "expired") input.contextToken = createDiscoveryContextToken(payload.company, { NODE_ENV: "test" }, Date.now() - 25 * 60 * 60 * 1000);
    if (variant === "unknown-choice") input.answers.workflow = ["custom-forged-workflow"];
    if (variant === "extra-company") input.company = payload.company;
    if (variant === "oversized-text") input.answers.context = { workflow: "x".repeat(1001) };
    const response = await handleDiscoveryAnalysisRequest(analysisRequest(input), crypto.randomUUID(), { env: { NODE_ENV: "test" } });
    assert.equal(response.status, 400, variant);
    assert.equal((await response.json()).error.code, "VALIDATION_ERROR", variant);
  }
});
