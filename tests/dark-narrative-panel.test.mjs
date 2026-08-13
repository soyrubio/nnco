import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const company = await readFile(
  new URL("../src/pages/company.astro", import.meta.url),
  "utf8",
);
const styles = await readFile(
  new URL("../src/styles/global.css", import.meta.url),
  "utf8",
);
const implementationGlyphAsset = await readFile(
  new URL("../public/assets/company-implementation-glyph.svg", import.meta.url),
  "utf8",
);

test("Company confidentiality uses the standard full-width dark section", () => {
  assert.match(
    company,
    /<SectionFrame id="team"[\s\S]*?<\/SectionFrame>\s*<SectionFrame tone="dark" labelledBy="discretion-title" class="editorial-section">\s*<SectionAnatomy title="Client confidentiality" titleId="discretion-title">[\s\S]*?We sign an NDA before you describe anything internal\.[\s\S]*?We are precise about how we work and quiet about who we work for\.[\s\S]*?<\/SectionAnatomy>\s*<\/SectionFrame>\s*<SectionFrame labelledBy="where-title"[\s\S]*?<FaqSection[\s\S]*?<ClosingSection/,
  );
  assert.doesNotMatch(company, /DarkNarrativePanel|dark-narrative-panel/);
  assert.equal(company.match(/<ClosingSection\b/g)?.length, 1);
  assert.match(
    styles,
    /\.section-frame--dark \.editorial-section__body\s*\{\s*color:\s*inherit;/s,
  );
});

test("Company Implementation gap keeps its copy in a nested 60/40 grey panel", () => {
  const section = company.match(
    /<SectionAnatomy title="Implementation gap" titleId="why-title">([\s\S]*?)<\/SectionAnatomy>/,
  )?.[1];
  assert.ok(section);
  const paragraphs = [
    ...section.matchAll(/<p(?:\s+[^>]*)?>([\s\S]*?)<\/p>/g),
  ].map((match) => match[1].replace(/\s+/g, " ").trim());
  assert.deepEqual(paragraphs, [
    "Large institutions have been running AI pilots for two years. Very few of them run anything in production. The pattern is consistent enough to be boring: a workshop picks a use case, an agency builds a convincing demonstration, and then the project meets the systems it would have to integrate with, the data it is not allowed to move, the evidence somebody has to be able to produce afterwards, and the question of who owns it once the agency leaves. The demonstration was never wrong. It was just the easy tenth of the work.",
    "That gap is an implementation problem, and it looks exactly like the problems we spent the last decade solving: integrating with systems nobody wants to touch, shipping into an environment with real users and real consequences, and staying responsible for it afterwards. We had done that inside a licensed lending platform, inside a software company delivering for banks and insurers, and in security audits where being approximately right is the same as being wrong.",
    "So NNCO does the whole arc. We find where AI is worth building, we build it, we deploy it inside your constraints, and we run it after launch. Strategy without deployment is a document. Deployment without an understanding of the rules is a pilot that gets stopped.",
  ]);
  assert.match(section, /class="company-about__lead"/);
  assert.match(section, /class="company-about__panel"/);
  assert.match(section, /class="company-about__panel-copy"/);
  assert.match(section, /class="company-about__panel-glyph" aria-hidden="true"/);
  assert.match(section, /class="company-implementation-glyph"/);
  assert.match(section, /src="\/assets\/company-implementation-glyph\.svg"/);
  assert.match(section, /width="1100"/);
  assert.match(section, /height="1100"/);
  assert.doesNotMatch(company, /PRIMARY_LOGO/);
  assert.doesNotMatch(company, /nnco-operational-field\.png/);
  assert.doesNotMatch(company, /company-about__layout/);
  assert.doesNotMatch(styles, /\.company-about__layout/);
  const copyRules = [...styles.matchAll(/\.company-about__copy[^,{]*\{([^}]*)\}/g)];
  assert.ok(copyRules.length > 0);
  for (const rule of copyRules) {
    assert.doesNotMatch(rule[1], /max-width/);
  }
  assert.match(
    styles,
    /\.company-about__copy\s*\{[^}]*gap:\s*clamp\(3\.5rem, 6vw, 6rem\);/s,
  );
  assert.match(
    styles,
    /\.company-about__panel\s*\{[^}]*grid-template-columns:\s*minmax\(0, 3fr\) minmax\(0, 2fr\);[^}]*background:\s*var\(--surface\);[^}]*color:\s*var\(--ink\);/s,
  );
  assert.match(
    styles,
    /\.company-about__panel-copy p\s*\{[^}]*color:\s*var\(--ink-soft\);/s,
  );
  assert.match(
    styles,
    /\.company-about__lead\s*\{[^}]*letter-spacing:\s*-0\.035em;[^}]*line-height:\s*1\.2;/s,
  );
  assert.match(
    styles,
    /\.company-about__panel-glyph\s*\{[^}]*position:\s*relative;[^}]*min-height:\s*0;[^}]*align-self:\s*stretch;/s,
  );
  assert.match(
    styles,
    /\.company-implementation-glyph\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*width:\s*100%;[^}]*height:\s*100%;/s,
  );
});

test("Company implementation glyph repeats the logo across a 3x3 field", () => {
  assert.match(implementationGlyphAsset, /viewBox="0 0 1100 1100"/);
  assert.equal(
    implementationGlyphAsset.match(/fill="black"/g)?.length,
    4,
  );
  assert.equal(
    implementationGlyphAsset.match(/stroke="#2d2d2d"/g)?.length,
    5,
  );
  assert.equal(
    implementationGlyphAsset.match(/stroke-width="4"/g)?.length,
    5,
  );
  const glyphRule = styles.match(/\.company-implementation-glyph\s*\{([^}]*)\}/);
  assert.ok(glyphRule);
  assert.match(glyphRule[1], /object-fit:\s*contain;/);
  assert.doesNotMatch(glyphRule[1], /filter:/);
});
