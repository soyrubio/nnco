import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cockpit = await readFile(
  new URL("../src/components/DiscoveryCockpit.tsx", import.meta.url),
  "utf8",
);
const styles = await readFile(
  new URL("../src/styles/discovery.css", import.meta.url),
  "utf8",
);

test("started discovery keeps one primary question heading", () => {
  assert.match(
    cockpit,
    /<h1 id=\{activeQuestionLabelId\}>\{activeQuestion\.prompt\}<\/h1>/,
  );
  assert.doesNotMatch(
    cockpit,
    /<h2 id=\{activeQuestionLabelId\}>\{activeQuestion\.prompt\}<\/h2>/,
  );
  assert.equal(styles.match(/\.discovery-question h1/g)?.length, 2);
  assert.doesNotMatch(styles, /\.discovery-question h2/);
});

test("multi-select groups avoid unsupported required state", () => {
  const questionField = cockpit.slice(cockpit.indexOf("function QuestionField"));
  const multiSelect = questionField.slice(
    questionField.indexOf('if (question.fieldType === "multi_select")'),
    questionField.indexOf('if (question.fieldType === "long_text")'),
  );
  const radioGroup = questionField.slice(
    questionField.indexOf('if (question.fieldType === "single_select")'),
    questionField.indexOf('if (question.fieldType === "multi_select")'),
  );

  assert.match(multiSelect, /role="group"/);
  assert.doesNotMatch(multiSelect, /aria-required/);
  assert.match(radioGroup, /role="radiogroup"/);
  assert.match(radioGroup, /aria-required=\{question\.required \|\| undefined\}/);
});

test("discovery right arrows share the canonical hover timing", () => {
  assert.match(
    styles,
    /transition: translate 260ms cubic-bezier\(0\.2, 0, 0, 1\);/,
  );
  assert.match(
    styles,
    /\.discovery-app a:hover \.nnco-arrow--right,\n\.discovery-app button:hover \.nnco-arrow--right \{\n  translate: 1px 0;\n\}/,
  );
  assert.match(styles, /\.discovery-app \.nnco-arrow--down \{\n  transform: rotate\(90deg\);\n\}/);
});
