import assert from "node:assert/strict";
import test from "node:test";
import { discoveryProgress } from "../src/lib/discovery-progress.ts";

test("discovery starts at zero until website or sector context is confirmed", () => {
  for (const screen of ["intro", "entry", "enriching", "context", "sector"]) {
    assert.equal(discoveryProgress(screen, 0, 6), 0, screen);
  }
});

test("question progress counts preceding steps rather than the unanswered question", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4].map(index => discoveryProgress("questions", index, 6)),
    [17, 33, 50, 67, 83],
  );
});

test("discovery reaches completion after the last question and follows back navigation", () => {
  for (const screen of ["contact", "analyzing", "report"]) {
    assert.equal(discoveryProgress(screen, 4, 6), 100, screen);
  }
  assert.equal(discoveryProgress("questions", 4, 6), 83);
  assert.equal(discoveryProgress("questions", 0, 6), 17);
  assert.equal(discoveryProgress("entry", 4, 6), 0);
  assert.equal(discoveryProgress("intro", 4, 6), 0);
});
