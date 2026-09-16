import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCoverage,
  calculateJourneyProgress,
  createInitialSnapshot,
  discoveryReducer,
  getQuestions,
} from "../src/lib/discovery-domain.ts";

function answer(snapshot, questionId, value) {
  return discoveryReducer(snapshot, {
    type: "ANSWER_QUESTION",
    questionId,
    value,
    occurredAt: "2026-07-31T12:00:00.000Z",
  });
}

function validValue(question) {
  if (question.fieldType === "multi_select") {
    return [question.options[0].value];
  }
  if (question.fieldType === "single_select") {
    return question.options[0].value;
  }
  return "Representative workflow detail";
}

test("detailed discovery includes the evidence fields used by the report", () => {
  const questions = getQuestions(
    answer(createInitialSnapshot(), "context.sector", "finance"),
  );
  const systems = questions.find(
    (question) => question.id === "readiness.systems",
  );
  const exceptions = questions.find(
    (question) => question.id === "friction.exceptions",
  );
  const investment = questions.find(
    (question) => question.id === "goal.investmentPosture",
  );

  assert.equal(systems?.required, true);
  assert.equal(exceptions?.required, true);
  assert.equal(investment?.required, false);
  assert.equal(investment?.fieldType, "single_select");
});

test("optional detail does not block completion and progress reaches review", () => {
  let snapshot = answer(createInitialSnapshot(), "context.sector", "finance");
  const questions = getQuestions(snapshot);
  for (const question of questions) {
    if (question.required && !snapshot.answers[question.id]) {
      snapshot = answer(snapshot, question.id, validValue(question));
    }
  }

  assert.equal(calculateCoverage(snapshot).readyForPreview, true);
  assert.ok(
    calculateJourneyProgress(snapshot, "goal.investmentPosture") < 100,
  );
  assert.equal(calculateJourneyProgress(snapshot, undefined, true), 100);
});

test("back truncation clears optional detail and its downstream evidence", () => {
  let snapshot = answer(createInitialSnapshot(), "context.sector", "finance");
  const questions = getQuestions(snapshot);
  for (const question of questions.slice(1)) {
    snapshot = answer(snapshot, question.id, validValue(question));
  }
  const optional = questions.at(-1);
  const previous = questions.at(-2);
  const beforePrevious = questions.at(-3);

  assert.ok(
    snapshot.evidence.some((item) => item.questionId === optional.id),
  );

  snapshot = discoveryReducer(snapshot, {
    type: "TRUNCATE_FROM_QUESTION",
    questionId: previous.id,
    milestone: previous.milestone,
    occurredAt: "2026-07-31T12:01:00.000Z",
  });

  assert.ok(snapshot.answers[beforePrevious.id]);
  assert.equal(snapshot.answers[previous.id], undefined);
  assert.equal(snapshot.answers[optional.id], undefined);
  assert.equal(
    snapshot.evidence.some((item) => item.questionId === optional.id),
    false,
  );
});
