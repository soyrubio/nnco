import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fitTextarea } from "../src/components/discovery/fit-textarea.ts";

function textareaFixture(contentHeight = 50) {
  return {
    style: { height: "auto" },
    contentHeight,
    get clientHeight() {
      return this.style.height === "auto" ? 66 : Number.parseFloat(this.style.height) - 1;
    },
    get offsetHeight() { return this.clientHeight + 1; },
    get scrollHeight() { return Math.max(this.contentHeight, this.clientHeight); },
  };
}

test("an empty or short answer keeps the single-line minimum height", () => {
  const field = textareaFixture();
  fitTextarea(field);
  assert.equal(field.style.height, "67px");
});

test("wrapped and pasted text grows the field with room for its border", () => {
  const field = textareaFixture(94);
  fitTextarea(field);
  assert.equal(field.style.height, "95px");
  field.contentHeight = 126;
  fitTextarea(field);
  assert.equal(field.style.height, "127px");
});

test("deleting text or widening the field shrinks it back to one line", () => {
  const field = textareaFixture(180);
  fitTextarea(field);
  assert.equal(field.style.height, "181px");
  field.contentHeight = 50;
  fitTextarea(field);
  assert.equal(field.style.height, "67px");
});

test("restored answers size before paint and respond to width and font changes", async () => {
  const source = await readFile(new URL("../src/components/discovery/AutoExpandingTextarea.tsx", import.meta.url), "utf8");
  assert.match(source, /rows=\{1\}/);
  assert.match(source, /useLayoutEffect\([\s\S]*?fitTextarea\(fieldRef.current\);[\s\S]*?\[value\]/);
  assert.match(source, /new ResizeObserver\(/);
  assert.match(source, /if \(width === field.clientWidth\) return;/);
  assert.match(source, /fonts.ready.then\([\s\S]*?if \(active\) fitTextarea\(field\)/);
  assert.match(source, /active = false;\s*observer.disconnect\(\)/);
});

test("answer fields share single-line input typography without a resize handle", async () => {
  const styles = await readFile(new URL("../src/styles/discovery.css", import.meta.url), "utf8");
  assert.match(styles, /\.discovery-release-field input,\s*\.discovery-release-field textarea\s*\{[^}]*min-height: 4\.2rem;[^}]*font-size: var\(--type-size-item-heading\);/);
  const textareaOnly = styles.match(/\.discovery-release-field textarea\s*\{[^}]*\}/g)?.at(-1);
  assert.ok(textareaOnly);
  assert.match(textareaOnly, /resize: none;/);
  assert.match(textareaOnly, /overflow: hidden;/);
  assert.doesNotMatch(textareaOnly, /font-size:|font-weight:|min-height:|line-height:/);
});
