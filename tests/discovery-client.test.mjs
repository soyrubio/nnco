import assert from "node:assert/strict";
import test from "node:test";

import { appendBoundedDraft } from "../src/lib/discovery-client.ts";

test("transcript composition preserves the draft within the shared bound", () => {
  assert.equal(
    appendBoundedDraft("  Existing detail.  ", "  Added transcript.  ", 1_200),
    "Existing detail.\nAdded transcript.",
  );

  const bounded = appendBoundedDraft("Existing", "x".repeat(1_200), 1_200);
  assert.equal(bounded.length, 1_200);
  assert.ok(bounded.startsWith("Existing\n"));
});

test("transcript composition handles empty and zero-length bounds", () => {
  assert.equal(appendBoundedDraft("", " Transcript only. ", 1_200), "Transcript only.");
  assert.equal(appendBoundedDraft("Draft", "Transcript", 0), "");
});
