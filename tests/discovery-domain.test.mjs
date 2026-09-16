import assert from "node:assert/strict";
import test from "node:test";

import {
  DISCOVERY_LONG_TEXT_MAX_LENGTH,
  DISCOVERY_MAX_REVISION,
  DISCOVERY_MESSAGE_MAX_LENGTH,
  buildReportPreview,
  calculateCoverage,
  calculateJourneyProgress,
  containsSensitiveDataCue,
  createInitialSnapshot,
  discoveryReducer,
  getQuestions,
  isDiscoverySnapshot,
  proposeChatPatches,
} from "../src/lib/discovery-domain.ts";

function answer(snapshot, questionId, value, source = "form") {
  return discoveryReducer(snapshot, {
    type: "ANSWER_QUESTION",
    questionId,
    value,
    source,
    occurredAt: "2026-07-29T12:00:00.000Z",
  });
}

test("guided and chat actions write through the same answer model", () => {
  const guided = answer(
    createInitialSnapshot(),
    "context.sector",
    "finance",
    "form",
  );
  const chatted = discoveryReducer(createInitialSnapshot(), {
    type: "ANSWER_QUESTION",
    questionId: "context.sector",
    value: "finance",
    source: "chat",
    confidence: 0.82,
    occurredAt: "2026-07-29T12:00:00.000Z",
  });

  assert.equal(guided.profile.sector, "finance");
  assert.equal(chatted.profile.sector, "finance");
  assert.equal(
    guided.answers["context.sector"].value,
    chatted.answers["context.sector"].value,
  );
});

test("helper messages cannot mutate diagnostic answers", () => {
  const initial = createInitialSnapshot();
  const next = discoveryReducer(initial, {
    type: "ADD_MESSAGE",
    role: "agent",
    content: "Here is an example that does not become evidence.",
    occurredAt: "2026-07-29T12:00:01.000Z",
  });

  assert.deepEqual(next.answers, initial.answers);
  assert.equal(next.messages.length, initial.messages.length + 1);
});

test("unknown critical answers unlock a lower-confidence preview", () => {
  let snapshot = createInitialSnapshot();
  for (const question of getQuestions(snapshot)) {
    if (!question.required) continue;
    const value = question.allowUnknown
      ? "Unknown / validate next"
      : question.options?.[0]?.value ?? "Representative answer";
    snapshot = answer(snapshot, question.id, value);
  }

  assert.equal(calculateCoverage(snapshot).readyForPreview, true);
  assert.ok(calculateCoverage(snapshot).validationSignals > 0);
  assert.ok(snapshot.evidence.length > 0);
});

test("changing sector clears sector-dependent workflow input evidence", () => {
  let snapshot = answer(createInitialSnapshot(), "context.sector", "finance");
  snapshot = answer(
    snapshot,
    "workflow.scope",
    "The monthly close runs from source intake through controller approval.",
  );
  snapshot = answer(snapshot, "workflow.inputs", ["email", "spreadsheet"]);
  snapshot = discoveryReducer(snapshot, {
    type: "APPLY_CHAT_PROPOSAL",
    answers: [],
    observations: [
      {
        questionId: "workflow.inputs",
        statement: "Bank portal files are re-keyed into the finance ERP.",
        confidence: 0.7,
      },
    ],
    occurredAt: "2026-07-29T12:00:01.000Z",
  });
  assert.ok(snapshot.answers["workflow.inputs"]);

  snapshot = answer(snapshot, "context.sector", "healthcare");
  assert.equal(
    snapshot.answers["workflow.scope"].value,
    "The monthly close runs from source intake through controller approval.",
  );
  assert.equal(snapshot.answers["workflow.inputs"], undefined);
  assert.equal(
    snapshot.observations.some(
      (item) => item.questionId === "workflow.inputs",
    ),
    false,
  );
  assert.equal(
    snapshot.evidence.some((item) => item.questionId === "workflow.inputs"),
    false,
  );
  assert.equal(snapshot.dataAssets.length, 0);
});

test("back within a chapter clears the destination and every downstream answer", () => {
  let snapshot = createInitialSnapshot("2026-07-29T12:00:00.000Z");
  for (const [questionId, value] of [
    ["context.sector", "finance"],
    ["context.organisationType", "financial-institution"],
    ["context.role", "operations"],
    ["context.focusArea", "Monthly close"],
    ["context.sizeBand", "101-500"],
    ["workflow.scope", "A report arrives and the approved close completes."],
    ["workflow.inputs", ["email", "spreadsheet"]],
  ]) {
    snapshot = answer(snapshot, questionId, value);
  }
  snapshot = discoveryReducer(snapshot, {
    type: "APPLY_CHAT_PROPOSAL",
    answers: [],
    observations: [
      {
        questionId: "workflow.inputs",
        statement: "Two shared inboxes feed the workflow.",
        confidence: 0.7,
      },
    ],
    occurredAt: "2026-07-29T12:00:01.000Z",
  });

  snapshot = discoveryReducer(snapshot, {
    type: "TRUNCATE_FROM_QUESTION",
    questionId: "workflow.scope",
    milestone: "workflow",
    occurredAt: "2026-07-29T12:00:02.000Z",
  });

  assert.equal(snapshot.answers["context.focusArea"].value, "Monthly close");
  assert.equal(snapshot.answers["workflow.scope"], undefined);
  assert.equal(snapshot.answers["workflow.inputs"], undefined);
  assert.equal(snapshot.observations.length, 0);
  assert.equal(snapshot.evidence.some((item) => item.questionId === "workflow.inputs"), false);
  assert.equal(snapshot.activeMilestone, "workflow");
});

test("back across a chapter boundary clears the destination and later chapters", () => {
  let snapshot = createInitialSnapshot("2026-07-29T12:00:00.000Z");
  for (const [questionId, value] of [
    ["context.sector", "insurance"],
    ["workflow.scope", "A claim arrives and closes after approval."],
    ["workflow.inputs", ["messages", "claims-policy"]],
    ["readiness.systems", "Claims system"],
    ["workflow.handoffs", "Claims to underwriting"],
    ["friction.repetition", "Policy data is copied by hand."],
    ["friction.exceptions", "Missing documents delay review."],
  ]) {
    snapshot = answer(snapshot, questionId, value);
  }

  snapshot = discoveryReducer(snapshot, {
    type: "TRUNCATE_FROM_QUESTION",
    questionId: "workflow.handoffs",
    milestone: "workflow",
    occurredAt: "2026-07-29T12:00:03.000Z",
  });

  assert.equal(snapshot.answers["readiness.systems"], undefined);
  assert.equal(snapshot.answers["workflow.handoffs"], undefined);
  assert.equal(snapshot.answers["friction.repetition"], undefined);
  assert.equal(snapshot.answers["friction.exceptions"], undefined);
  assert.equal(snapshot.painPoints.length, 0);
  assert.equal(snapshot.activeMilestone, "workflow");
});

test("journey progress follows question position, rewinds after truncation, and completes on review", () => {
  let snapshot = createInitialSnapshot("2026-07-29T12:00:00.000Z");
  assert.ok(calculateJourneyProgress(snapshot, "context.sector") >= 10);

  for (const [questionId, value] of [
    ["context.sector", "finance"],
    ["context.organisationType", "financial-institution"],
    ["context.role", "operations"],
    ["context.focusArea", "Monthly close"],
    ["context.sizeBand", "101-500"],
    ["workflow.scope", "A report arrives and the approved close completes."],
    ["workflow.inputs", ["email", "spreadsheet"]],
  ]) {
    snapshot = answer(snapshot, questionId, value);
  }

  const forwardProgress = calculateJourneyProgress(
    snapshot,
    "readiness.systems",
  );
  snapshot = discoveryReducer(snapshot, {
    type: "TRUNCATE_FROM_QUESTION",
    questionId: "workflow.scope",
    milestone: "workflow",
    occurredAt: "2026-07-29T12:00:02.000Z",
  });
  const rewoundProgress = calculateJourneyProgress(
    snapshot,
    "workflow.scope",
  );

  assert.ok(forwardProgress > rewoundProgress);
  assert.ok(rewoundProgress >= 10);
  assert.equal(calculateJourneyProgress(snapshot, undefined, true), 100);
});

test("insurance is a first-class persisted sector with its own input pack", () => {
  const snapshot = answer(
    createInitialSnapshot("2026-07-29T12:00:00.000Z"),
    "context.sector",
    "insurance",
  );
  const inputs = getQuestions(snapshot).find(
    (question) => question.id === "workflow.inputs",
  );

  assert.equal(snapshot.profile.sector, "insurance");
  assert.equal(isDiscoverySnapshot(snapshot), true);
  assert.equal(inputs?.sector, "insurance");
  assert.ok(
    inputs?.options?.some((option) => option.value === "claims-policy"),
  );
  assert.ok(inputs?.options?.some((option) => option.value === "crm-case"));
});

test("organisation size is optional and does not reduce required coverage", () => {
  const snapshot = createInitialSnapshot();
  const size = getQuestions(snapshot).find(
    (question) => question.id === "context.sizeBand",
  );

  assert.equal(size?.required, false);
  assert.equal(calculateCoverage(snapshot).total, 12);
});

test("server-confirmed lead handoff is canonical and survives report editing", () => {
  let snapshot = discoveryReducer(createInitialSnapshot(), {
    type: "SET_STATUS",
    status: "preview_ready",
    occurredAt: "2026-07-29T12:00:01.000Z",
  });
  snapshot = discoveryReducer(snapshot, {
    type: "CONFIRM_LEAD_REQUEST",
    handoffId: "handoff-123",
    confirmedAt: "2026-07-29T12:00:02.000Z",
    occurredAt: "2026-07-29T12:00:02.000Z",
  });
  snapshot = discoveryReducer(snapshot, {
    type: "SET_MILESTONE",
    milestone: "review",
    occurredAt: "2026-07-29T12:00:03.000Z",
  });

  assert.equal(snapshot.leadRequestStatus, "confirmed");
  assert.equal(snapshot.leadConfirmation.handoffId, "handoff-123");
  assert.equal(snapshot.status, "review");
});

test("only analysis statuses can be set without a confirmed lead handoff", () => {
  const initial = createInitialSnapshot("2026-07-29T12:00:00.000Z");
  const analyzing = discoveryReducer(initial, {
    type: "SET_STATUS",
    status: "analyzing",
    occurredAt: "2026-07-29T12:00:01.000Z",
  });
  const previewReady = discoveryReducer(analyzing, {
    type: "SET_STATUS",
    status: "preview_ready",
    occurredAt: "2026-07-29T12:00:02.000Z",
  });
  const directLeadSubmission = discoveryReducer(initial, {
    type: "SET_STATUS",
    status: "lead_submitted",
    occurredAt: "2026-07-29T12:00:01.000Z",
  });

  assert.equal(analyzing.status, "analyzing");
  assert.equal(previewReady.status, "preview_ready");
  assert.equal(isDiscoverySnapshot(previewReady), true);
  assert.equal(directLeadSubmission, initial);
});

test("lead confirmation enforces the canonical handoff identifier boundary", () => {
  const initial = createInitialSnapshot("2026-07-29T12:00:00.000Z");
  const boundaryHandoff = "h".repeat(128);
  const confirmed = discoveryReducer(initial, {
    type: "CONFIRM_LEAD_REQUEST",
    handoffId: ` ${boundaryHandoff} `,
    confirmedAt: "2026-07-29T12:00:01.000Z",
    occurredAt: "2026-07-29T12:00:01.000Z",
  });
  const oversized = discoveryReducer(initial, {
    type: "CONFIRM_LEAD_REQUEST",
    handoffId: "h".repeat(129),
    confirmedAt: "2026-07-29T12:00:01.000Z",
    occurredAt: "2026-07-29T12:00:01.000Z",
  });
  const blank = discoveryReducer(initial, {
    type: "CONFIRM_LEAD_REQUEST",
    handoffId: "   ",
    confirmedAt: "2026-07-29T12:00:01.000Z",
    occurredAt: "2026-07-29T12:00:01.000Z",
  });
  const numericConfirmationTime = discoveryReducer(initial, {
    type: "CONFIRM_LEAD_REQUEST",
    handoffId: "handoff-123",
    confirmedAt: 1,
    occurredAt: "2026-07-29T12:00:01.000Z",
  });

  assert.equal(confirmed.leadConfirmation.handoffId, boundaryHandoff);
  assert.equal(isDiscoverySnapshot(confirmed), true);
  assert.equal(oversized, initial);
  assert.equal(blank, initial);
  assert.equal(numericConfirmationTime, initial);
});

test("preview model exposes only two report pages and locked section names", () => {
  const preview = buildReportPreview(createInitialSnapshot());
  assert.equal(preview.pages.length, 2);
  assert.equal("fullPayload" in preview, false);
  assert.equal("solutionOptions" in preview, false);
  assert.ok(preview.lockedSections.every((section) => typeof section === "string"));
});

test("persisted snapshot validation rejects malformed same-version data", () => {
  assert.equal(isDiscoverySnapshot({ schemaVersion: 1, caseId: "SIG-BAD" }), false);
  assert.equal(
    isDiscoverySnapshot({
      ...createInitialSnapshot(),
      workflows: undefined,
    }),
    false,
  );
  assert.equal(isDiscoverySnapshot(createInitialSnapshot()), true);
});

test("persisted snapshot validation rejects non-string timestamps", () => {
  let snapshot = answer(
    createInitialSnapshot("2026-07-29T11:00:00.000Z"),
    "workflow.scope",
    "A representative workflow",
  );
  snapshot = discoveryReducer(snapshot, {
    type: "APPLY_CHAT_PROPOSAL",
    answers: [],
    observations: [
      {
        questionId: "workflow.scope",
        statement: "A reported observation.",
        confidence: 0.64,
      },
    ],
    occurredAt: "2026-07-29T12:00:01.000Z",
  });
  snapshot = discoveryReducer(snapshot, {
    type: "CONFIRM_LEAD_REQUEST",
    handoffId: "handoff-123",
    confirmedAt: "2026-07-29T12:00:02.000Z",
    occurredAt: "2026-07-29T12:00:02.000Z",
  });
  assert.equal(isDiscoverySnapshot(snapshot), true);

  const mutations = [
    (candidate) => {
      candidate.createdAt = 1;
    },
    (candidate) => {
      candidate.updatedAt = 1;
    },
    (candidate) => {
      candidate.answers["workflow.scope"].updatedAt = 1;
    },
    (candidate) => {
      candidate.messages[0].createdAt = 1;
    },
    (candidate) => {
      candidate.observations[0].createdAt = 1;
    },
    (candidate) => {
      candidate.leadConfirmation.confirmedAt = 1;
    },
  ];

  for (const mutate of mutations) {
    const candidate = structuredClone(snapshot);
    mutate(candidate);
    assert.equal(isDiscoverySnapshot(candidate), false);
  }

  const numericActionTime = discoveryReducer(snapshot, {
    type: "ADD_MESSAGE",
    role: "user",
    content: "This action must not be accepted.",
    occurredAt: 1,
  });
  assert.equal(numericActionTime, snapshot);
});

test("persisted snapshot validation enforces the canonical question graph", () => {
  let snapshot = createInitialSnapshot("2026-07-29T11:00:00.000Z");
  for (const question of getQuestions(snapshot)) {
    if (!question.required) continue;
    snapshot = answer(
      snapshot,
      question.id,
      question.allowUnknown
        ? "Unknown / validate next"
        : question.options?.[0]?.value ?? "Representative answer",
    );
  }
  assert.equal(isDiscoverySnapshot(snapshot), true);

  const rejects = (mutate) => {
    const candidate = structuredClone(snapshot);
    mutate(candidate);
    assert.equal(isDiscoverySnapshot(candidate), false);
  };

  rejects((candidate) => {
    candidate.answers["stale.question"] = {
      questionId: "stale.question",
      value: "Stale answer",
      source: "form",
      status: "reported",
      confidence: 0.9,
      updatedAt: candidate.updatedAt,
    };
  });
  rejects((candidate) => {
    candidate.answers["readiness.specificConcern"] = {
      questionId: "readiness.specificConcern",
      value: "A removed question",
      source: "form",
      status: "reported",
      confidence: 0.9,
      updatedAt: candidate.updatedAt,
    };
  });
  rejects((candidate) => {
    candidate.answers["context.organisationType"].value = "invalid-option";
    candidate.profile.organisationType = "invalid-option";
  });
  rejects((candidate) => {
    candidate.answers["workflow.scope"].value = true;
  });
  rejects((candidate) => {
    candidate.profile.sector = "healthcare";
  });
  rejects((candidate) => {
    candidate.profile.sector = "invalid-sector";
  });
  rejects((candidate) => {
    candidate.evidence[0].statement = "Forged evidence";
  });
  rejects((candidate) => {
    candidate.answers["workflow.scope"].value = "x".repeat(
      DISCOVERY_LONG_TEXT_MAX_LENGTH + 1,
    );
  });
  rejects((candidate) => {
    candidate.messages = Array.from({ length: 129 }, (_, index) => ({
      ...candidate.messages[0],
      id: `message-${index}`,
    }));
  });
  rejects((candidate) => {
    candidate.revision = DISCOVERY_MAX_REVISION + 1;
  });
  rejects((candidate) => {
    candidate.status = "lead_submitted";
  });
});

test("discovery reducer enforces shared text and message limits", () => {
  let snapshot = answer(createInitialSnapshot(), "context.sector", "finance");
  const exactAnswer = "x".repeat(DISCOVERY_LONG_TEXT_MAX_LENGTH);
  snapshot = answer(snapshot, "workflow.scope", exactAnswer);
  assert.equal(snapshot.answers["workflow.scope"].value, exactAnswer);

  const beforeOversizedAnswer = snapshot;
  snapshot = answer(
    snapshot,
    "workflow.scope",
    "x".repeat(DISCOVERY_LONG_TEXT_MAX_LENGTH + 1),
  );
  assert.equal(snapshot, beforeOversizedAnswer);

  snapshot = discoveryReducer(snapshot, {
    type: "ADD_MESSAGE",
    role: "user",
    content: "m".repeat(DISCOVERY_MESSAGE_MAX_LENGTH),
    occurredAt: "2026-07-29T12:05:00.000Z",
  });
  assert.equal(
    snapshot.messages.at(-1).content.length,
    DISCOVERY_MESSAGE_MAX_LENGTH,
  );

  const beforeOversizedMessage = snapshot;
  snapshot = discoveryReducer(snapshot, {
    type: "ADD_MESSAGE",
    role: "user",
    content: "m".repeat(DISCOVERY_MESSAGE_MAX_LENGTH + 1),
    occurredAt: "2026-07-29T12:06:00.000Z",
  });
  assert.equal(snapshot, beforeOversizedMessage);
});

test("discovery reducer normalizes values before validating them", () => {
  let snapshot = answer(createInitialSnapshot(), "context.sector", "finance");
  snapshot = answer(snapshot, "workflow.scope", "  Normalized scope  ");
  const inputOptions = getQuestions(snapshot)
    .find((question) => question.id === "workflow.inputs")
    .options.map((option) => option.value);
  snapshot = answer(snapshot, "workflow.inputs", [
    inputOptions[1],
    ` ${inputOptions[0]} `,
    inputOptions[1],
    "",
  ]);

  assert.equal(snapshot.answers["workflow.scope"].value, "Normalized scope");
  assert.deepEqual(snapshot.answers["workflow.inputs"].value, [
    inputOptions[0],
    inputOptions[1],
  ]);

  const beforeInvalidOption = snapshot;
  snapshot = answer(snapshot, "workflow.inputs", ["invalid-option"]);
  assert.equal(snapshot, beforeInvalidOption);
});

test("explicit action time becomes the report generation time", () => {
  const occurredAt = "2026-07-29T14:31:22.000Z";
  const snapshot = discoveryReducer(createInitialSnapshot(), {
    type: "ADD_MESSAGE",
    role: "agent",
    content: "Timestamped event",
    occurredAt,
  });
  assert.equal(snapshot.updatedAt, occurredAt);
  assert.equal(buildReportPreview(snapshot).generatedAt, occurredAt);
});

test("sensitive identifier screening covers common European and account data", () => {
  assert.equal(containsSensitiveDataCue("Contact jan.novak@example.cz"), true);
  assert.equal(containsSensitiveDataCue("IBAN CZ6508000000192000145399"), true);
  assert.equal(containsSensitiveDataCue("Patient ID 785421"), true);
  assert.equal(
    containsSensitiveDataCue("A controller reviews exception categories weekly."),
    false,
  );
});

test("unknown capture and milestone advance are atomic", () => {
  const initial = createInitialSnapshot("2026-07-29T12:00:00.000Z");
  const next = discoveryReducer(initial, {
    type: "MARK_UNKNOWN_AND_ADVANCE",
    questionIds: ["context.sizeBand", "context.focusArea"],
    milestone: "workflow",
    occurredAt: "2026-07-29T12:00:01.000Z",
  });
  assert.equal(next.activeMilestone, "workflow");
  assert.equal(next.answers["context.sizeBand"].value, "Unknown / validate next");
  assert.equal(next.answers["context.focusArea"].value, "Unknown / validate next");
});

test("accepted chat observations survive as evidence and reach the report", () => {
  let snapshot = answer(
    createInitialSnapshot("2026-07-29T12:00:00.000Z"),
    "friction.repetition",
    "Analysts copy figures manually.",
    "chat",
  );
  snapshot = discoveryReducer(snapshot, {
    type: "APPLY_CHAT_PROPOSAL",
    answers: [],
    observations: [
      {
        questionId: "friction.repetition",
        statement: "This takes two days every month and requires controller review.",
        confidence: 0.64,
      },
    ],
    occurredAt: "2026-07-29T12:00:01.000Z",
  });

  assert.equal(snapshot.observations.length, 1);
  assert.ok(
    snapshot.evidence.some((item) =>
      item.statement.includes("two days every month"),
    ),
  );
  const manualProblem = buildReportPreview(snapshot).problems.find(
    (problem) => problem.id === "problem-manual-work",
  );
  assert.match(manualProblem?.finding ?? "", /two days every month/i);
  assert.equal(isDiscoverySnapshot(snapshot), true);
});

test("readiness captures investment posture without blocking the preview", () => {
  const snapshot = createInitialSnapshot();
  const question = getQuestions(snapshot).find(
    (item) => item.id === "goal.investmentPosture",
  );
  assert.equal(question?.required, false);
  assert.equal(question?.allowUnknown, true);
  assert.ok(question?.options?.some((option) => option.value === "pilot-budget-approved"));
});

test("mixed chat proposes structured options and preserves residual context", () => {
  let snapshot = answer(createInitialSnapshot(), "context.sector", "finance");
  snapshot = discoveryReducer(snapshot, {
    type: "SET_MILESTONE",
    milestone: "workflow",
    occurredAt: "2026-07-29T12:00:01.000Z",
  });
  const patches = proposeChatPatches({
    message:
      "Email and PDF arrive first, then analysts copy totals manually for two days.",
    questions: getQuestions(snapshot),
    snapshot,
  });

  const inputs = patches.find(
    (patch) =>
      patch.kind === "answer" && patch.questionId === "workflow.inputs",
  );
  const observation = patches.find(
    (patch) =>
      patch.kind === "observation" && patch.questionId === "workflow.scope",
  );
  assert.deepEqual(inputs?.value, ["email", "pdf"]);
  assert.match(String(observation?.value), /analysts copy totals manually/i);
});

test("an explicit current systems question maps even inside the workflow chapter", () => {
  let snapshot = answer(createInitialSnapshot(), "context.sector", "insurance");
  snapshot = discoveryReducer(snapshot, {
    type: "SET_MILESTONE",
    milestone: "workflow",
    occurredAt: "2026-07-29T12:00:01.000Z",
  });
  const systems = getQuestions(snapshot).find(
    (question) => question.id === "readiness.systems",
  );
  assert.ok(systems);

  const patches = proposeChatPatches({
    message: "The work moves through the claims system and a shared case queue.",
    questions: [systems],
    snapshot,
  });

  assert.equal(patches[0]?.questionId, "readiness.systems");
  assert.match(String(patches[0]?.value), /claims system/i);
});
