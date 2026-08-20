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

test("Company confidentiality uses the standard full-width dark section", () => {
  assert.match(
    company,
    /<SectionFrame id="team"[\s\S]*?<\/SectionFrame>\s*<SectionFrame tone="dark" labelledBy="discretion-title" class="editorial-section">\s*<SectionAnatomy title="Client confidentiality" titleId="discretion-title">[\s\S]*?We sign an NDA before you describe anything internal\.[\s\S]*?We are precise about how we work and quiet about who we work for\.[\s\S]*?<\/SectionAnatomy>\s*<\/SectionFrame>\s*<SectionFrame labelledBy="where-title"[\s\S]*?<FaqSection[\s\S]*?<ClosingSection/,
  );
  assert.doesNotMatch(company, /DarkNarrativePanel|dark-narrative-panel/);
  assert.equal(company.match(/<ClosingSection\b/g)?.length, 1);
  assert.match(
    styles,
    /\.section-frame--dark \.editorial-section__body\s*\{\s*color:\s*var\(--dark-body\);/s,
  );
});

test("Company separates its highlighted thesis from the standard Implementation gap", () => {
  assert.match(
    company,
    /<SectionFrame>\s*<div class="company-about__lead-section">[\s\S]*?<p class="company-about__lead">[\s\S]*?<\/div>\s*<\/SectionFrame>\s*<SectionFrame labelledBy="why-title">/,
  );
  assert.equal(company.match(/class="company-about__highlight"/g)?.length, 5);
  assert.doesNotMatch(company, /<mark\b/);
  for (let index = 0; index < 5; index += 1) {
    assert.match(company, new RegExp(`--highlight-index: ${index}`));
  }

  const section = company.match(
    /<SectionAnatomy title="Implementation gap" titleId="why-title">([\s\S]*?)<\/SectionAnatomy>/,
  )?.[1];
  assert.ok(section);
  const paragraphs = [
    ...section.matchAll(/<p(?:\s+[^>]*)?>([\s\S]*?)<\/p>/g),
  ].map((match) => match[1].replace(/\s+/g, " ").trim());
  assert.deepEqual(paragraphs, [
    "That gap is an implementation problem, and it looks exactly like the problems we spent the last decade solving: integrating with systems nobody wants to touch, shipping into an environment with real users and real consequences, and staying responsible for it afterwards. We had done that inside a licensed lending platform, inside a software company delivering for banks and insurers, and in security audits where being approximately right is the same as being wrong.",
    "So NNCo. does the whole arc. We find where AI is worth building, we build it, we deploy it inside your constraints, and we run it after launch. Strategy without deployment is a document. Deployment without an understanding of the rules is a pilot that gets stopped.",
  ]);
  assert.match(section, /class="company-about__supporting"/);
  assert.equal(section.match(/class="editorial-section__body"/g)?.length, 2);
  assert.doesNotMatch(company, /company-about__panel|company-implementation-glyph/);
  assert.match(
    styles,
    /\.company-about__lead-section\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 5fr\);/s,
  );
  assert.match(
    styles,
    /\.company-about__lead\s*\{[^}]*letter-spacing:\s*-0\.035em;[^}]*line-height:\s*1\.3;[^}]*text-align:\s*justify;/s,
  );
  assert.match(
    styles,
    /\.has-js \.company-about__lead \.company-about__highlight > span\s*\{\s*transform:\s*translateY\(120%\);/s,
  );
  assert.match(
    styles,
    /@keyframes company-highlight-enter\s*\{\s*from\s*\{\s*transform:\s*translateY\(120%\);[\s\S]*?to\s*\{\s*transform:\s*translateY\(0\);/s,
  );
  assert.match(
    company,
    /IntersectionObserver[\s\S]*?nnco:page-ready[\s\S]*?astro:before-swap/,
  );
});

test("Company Meet the team follows Implementation gap with wide portrait cards", () => {
  assert.match(
    company,
    /<SectionAnatomy title="Implementation gap"[\s\S]*?<\/SectionFrame>\s*<SectionFrame id="team" labelledBy="team-title" class="team-section">/,
  );
  assert.equal(company.match(/<article class="team-card">/g)?.length, 1);
  assert.match(company, /team\.map\(\(person\) =>/);
  assert.match(company, /src=\{person\.image\}/);
  assert.match(company, /alt=\{`Portrait of \$\{person\.name\}`\}/);
  assert.match(
    styles,
    /\.team-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);[^}]*width:\s*100%;/s,
  );
  assert.match(
    styles,
    /\.team-card\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[^}]*background:\s*var\(--surface\);/s,
  );
  assert.match(
    styles,
    /\.team-card__portrait\s*\{[^}]*padding:\s*clamp\(0\.75rem, 1\.25vw, 1\.25rem\) clamp\(0\.75rem, 1\.25vw, 1\.25rem\) 0;/s,
  );
  assert.match(
    styles,
    /\.team-card__content\s*\{[^}]*justify-content:\s*flex-start;/s,
  );
  assert.match(
    styles,
    /\.team-grid h3\s*\{[^}]*font-size:\s*var\(--type-size-card-heading\);/s,
  );
});
