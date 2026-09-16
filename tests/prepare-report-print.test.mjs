import assert from "node:assert/strict";
import test from "node:test";
import { prepareReportPrint } from "../src/lib/prepare-report-print.ts";

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test("print preparation waits for both fonts and every report image", async () => {
  const fonts = deferred();
  const firstLogo = deferred();
  const secondLogo = deferred();
  const report = {
    ownerDocument: { fonts: { ready: fonts.promise } },
    querySelectorAll: () => [
      { decode: () => firstLogo.promise },
      { decode: () => secondLogo.promise },
    ],
  };
  let ready = false;
  const preparation = prepareReportPrint(report).then(() => { ready = true; });
  fonts.resolve();
  firstLogo.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ready, false);
  secondLogo.resolve();
  await preparation;
  assert.equal(ready, true);
});

test("a blocked or broken logo fails preparation instead of printing an incomplete report", async () => {
  const error = new Error("Image request blocked");
  const report = {
    ownerDocument: { fonts: { ready: Promise.resolve() } },
    querySelectorAll: () => [{ decode: () => Promise.reject(error) }],
  };
  await assert.rejects(prepareReportPrint(report), error);
});
