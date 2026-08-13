import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL(
  "../src/components/ContactForm.astro",
  import.meta.url,
);
const source = await readFile(componentUrl, "utf8");

test("contact form scopes listeners and requests to its connection lifecycle", () => {
  assert.match(source, /this\.connectionController\?\.abort\(\);/);
  assert.match(source, /disconnectedCallback\(\)/);
  assert.equal(
    source.match(/\{ signal: connectionController\.signal \}/g)?.length,
    2,
  );
  assert.match(source, /signal: requestController\.signal/);
  assert.match(source, /activeRequest\?\.abort\(\)/);
  assert.match(source, /this\.requestController === requestController/);
});

test("contact form binds a successful response to the submitted request", () => {
  assert.match(source, /result\?\.ok !== true/);
  assert.match(source, /result\.requestId !== payload\.requestId/);
});

test("contact form preserves retry identity across disconnect and reconnect", () => {
  assert.match(
    source,
    /private requestIdentity: RequestIdentity \| null = null;/,
  );
  assert.doesNotMatch(source, /let requestIdentity/);
  assert.equal(source.match(/this\.requestIdentity = null;/g)?.length, 3);

  const disconnectedCallback = source.slice(
    source.indexOf("disconnectedCallback()"),
    source.indexOf("if (!customElements.get"),
  );
  assert.doesNotMatch(disconnectedCallback, /requestIdentity/);
});

test("contact form clears only stale status and the edited field error on input", () => {
  const inputHandler = source.slice(
    source.indexOf('form.addEventListener(\n        "input"'),
    source.indexOf('form.addEventListener(\n        "submit"'),
  );

  assert.match(inputHandler, /clearFieldError\(field\);/);
  assert.match(inputHandler, /clearTerminalStatus\(\);/);
  assert.match(inputHandler, /activeRequest\?\.abort\(\);/);
  assert.match(inputHandler, /if \(!isSubmitting\) return;/);
  assert.doesNotMatch(inputHandler, /clearErrors\(\);/);
});

test("contact form uses ordered validation messages without a nested ternary", () => {
  const helper = source.slice(
    source.indexOf("const errorMessageFor"),
    source.indexOf("const clearFieldError"),
  );

  assert.doesNotMatch(helper, /\?/);
  for (const message of [
    "We need this to be able to reply.",
    "Enter a valid work email address.",
    "Add a sentence or two so we can come prepared.",
    "This field is required.",
  ]) {
    assert.ok(helper.includes(message), message);
  }
  assert.match(source, /target\.textContent = errorMessageFor\(field\);/);
});
