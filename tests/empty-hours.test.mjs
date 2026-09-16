import assert from "node:assert/strict";
import test from "node:test";
import { estimateEmptyHours, formatRevenueInput } from "../src/lib/empty-hours.ts";

test("currency input groups whole digits while preserving decimal entry", () => {
  assert.equal(formatRevenueInput("2500"), "2,500");
  assert.equal(formatRevenueInput("1234567.125"), "1,234,567.125");
  assert.equal(formatRevenueInput("2500."), "2,500.");
  assert.equal(formatRevenueInput(""), "");
});

const example = { doctors: 40, hoursPerWeek: 30, emptyPercent: 8, revenuePerHour: 2500, weeksPerYear: 48 };

test("clinic example calculates annual empty capacity and gross revenue", () => {
  assert.deepEqual(estimateEmptyHours(example), { annualHours: 4608, annualRevenue: 11520000 });
  assert.deepEqual(estimateEmptyHours({ ...example, emptyPercent: 0 }), { annualHours: 0, annualRevenue: 0 });
  assert.deepEqual(estimateEmptyHours({ ...example, emptyPercent: 100 }), { annualHours: 57600, annualRevenue: 144000000 });
});

test("clinic estimate rejects invalid quantities and non-finite results", () => {
  for (const invalid of [
    { doctors: -1 }, { doctors: 1.5 }, { hoursPerWeek: 169 },
    { emptyPercent: 101 }, { weeksPerYear: 53 },
    { revenuePerHour: NaN }, { doctors: Infinity },
    { doctors: Number.MAX_VALUE, revenuePerHour: Number.MAX_VALUE },
  ]) assert.equal(estimateEmptyHours({ ...example, ...invalid }), null);
});

test("clinic article includes the calculator and excludes internal draft material", async () => {
  const { readFile } = await import("node:fs/promises");
  const article = await readFile(new URL("../src/content/blog/the-most-expensive-hour-in-a-clinic-is-the-empty-one.mdx", import.meta.url), "utf8");
  assert.match(article, /<EmptyHoursCalculator client:visible \/>/);
  assert.match(article, /className="clinic-byline"><em>- Marek Kříž, CEO<\/em>/);
  assert.match(article, /Our \$10k solution/);
  assert.match(article, /Overbooking scheduler for 1,000\+ patients/);
  assert.ok(article.indexOf("Our $10k solution") < article.indexOf("## How we would start"));
  assert.doesNotMatch(article, /## The setup/);
  assert.doesNotMatch(article.split("---").slice(2).join("---"), /^---$/m);
  assert.doesNotMatch(article, /NOT TO PUBLISH|\[BOX|\[PUBLIC|linear-comment|8 patients on the phone/);
});
