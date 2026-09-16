import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../src/components/PageLoader.astro", import.meta.url), "utf8");
const script = stripTypeScriptTypes(source.match(/<script>([\s\S]*?)<\/script>/)[1]);

function mount({ readyState = "interactive", seen = false, reduced = true } = {}) {
  let now = 0;
  let timerId = 0;
  let removed = false;
  let inert = true;
  let remembered = false;
  const timers = new Map();
  const document = new EventTarget();
  const window = new EventTarget();
  const motion = Object.assign(new EventTarget(), { matches: reduced });
  const loader = {
    dataset: { frameCadence: "240", minimumVisible: "650", exitDuration: "0", loadSafety: "4000" },
    querySelectorAll: () => [],
    classList: { add() {} },
    remove() { removed = true; },
  };
  Object.assign(document, {
    readyState,
    documentElement: { classList: { contains: () => seen } },
    body: { classList: { remove() {} } },
    querySelector: (selector) => selector === "[data-page-loader]" ? loader : { removeAttribute() { inert = false; } },
  });
  Object.assign(window, {
    matchMedia: () => motion,
    setTimeout: (fn, delay) => { timers.set(++timerId, { fn, at: now + delay }); return timerId; },
    clearTimeout: (id) => timers.delete(id),
    clearInterval() {},
  });
  let readyEvents = 0;
  window.addEventListener("nnco:page-ready", () => readyEvents++);
  runInNewContext(script, {
    document, window, Event, performance: { now: () => now },
    sessionStorage: { setItem() { remembered = true; } },
  });
  return {
    document, window,
    state: () => ({ removed, inert, remembered, readyEvents, timers: timers.size }),
    advance(ms) {
      const end = now + ms;
      while (true) {
        const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].fn();
      }
      now = end;
    },
  };
}

for (const reduced of [true, false]) {
  test(`ready documents unlock after 650ms without waiting for images (reduced motion: ${reduced})`, () => {
    const page = mount({ reduced });
    page.advance(649);
    assert.equal(page.state().inert, true);
    page.advance(1);
    assert.deepEqual(page.state(), { removed: true, inert: false, remembered: true, readyEvents: 1, timers: 0 });
    page.window.dispatchEvent(new Event("load"));
    page.advance(5000);
    assert.equal(page.state().readyEvents, 1);
  });
}

test("a still-parsing document waits for readiness and honors the elapsed minimum", () => {
  const page = mount({ readyState: "loading" });
  page.advance(900);
  assert.equal(page.state().removed, false);
  page.document.dispatchEvent(new Event("DOMContentLoaded"));
  page.advance(0);
  assert.equal(page.state().inert, false);
});

test("repeat visits skip the cover and page swaps cancel pending dismissal", () => {
  const repeat = mount({ seen: true });
  assert.equal(repeat.state().removed, true);
  assert.equal(repeat.state().timers, 0);
  const page = mount({ readyState: "loading" });
  page.document.dispatchEvent(new Event("astro:before-swap"));
  page.document.dispatchEvent(new Event("DOMContentLoaded"));
  page.advance(5000);
  assert.equal(page.state().inert, false);
  assert.equal(page.state().readyEvents, 0);
  assert.equal(page.state().timers, 0);
});

test("the safety timeout still releases the page if readiness is never delivered", () => {
  const page = mount({ readyState: "loading" });
  page.advance(4000);
  assert.equal(page.state().inert, false);
  assert.equal(page.state().readyEvents, 1);
});
