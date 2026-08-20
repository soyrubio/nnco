import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contactUrl = new URL("../src/pages/contact.astro", import.meta.url);
const stylesUrl = new URL("../src/styles/global.css", import.meta.url);
const [contactSource, stylesSource] = await Promise.all([
  readFile(contactUrl, "utf8"),
  readFile(stylesUrl, "utf8"),
]);

test("contact hero omits the removed introduction only", () => {
  assert.match(contactSource, /<PageHero title="Contact" \/>/);
  assert.doesNotMatch(
    contactSource,
    /Thirty minutes, no slides\. We go through the workflow/,
  );
});

test("direct contacts keep their copy in one ordered right-column stack", () => {
  assert.match(
    contactSource,
    /<SectionAnatomy title="Direct"[^>]*>[\s\S]*?<div class="alternate-contact-grid__row">\s*<h3>General<\/h3>\s*<div class="alternate-contact-grid__details">\s*<a class="alternate-contact-grid__email" href="mailto:general@nnco\.ai">general@nnco\.ai<\/a>[\s\S]*?<hr class="alternate-contact-grid__separator" \/>[\s\S]*?<div class="alternate-contact-grid__row">\s*<h3>Security<\/h3>\s*<div class="alternate-contact-grid__details">\s*<a class="alternate-contact-grid__email" href="mailto:security@nnco\.ai">security@nnco\.ai<\/a>\s*<p>\s*Vulnerability reports and security questions\. See our[\s\S]*?href="\/security">disclosure policy<\/a>\.[\s\S]*?<hr class="alternate-contact-grid__separator" \/>\s*<div class="alternate-contact-grid__row">\s*<h3>Mutual NDA<\/h3>[\s\S]*?We can sign a mutual NDA before the first call\.[\s\S]*?<Button href="mailto:general@nnco\.ai\?subject=NDA" variant="secondary">[\s\S]*?Request an NDA <BlockArrow \/>[\s\S]*?<\/Button>/,
  );
  assert.equal(contactSource.match(/<div class="alternate-contact-grid__row">/g)?.length, 3);
  assert.doesNotMatch(
    contactSource,
    /class="[^"]*\balternate-contact-grid__nda(?:\s|\")|<article class="alternate-contact-grid__row"|<section class="alternate-contact-grid__row"/,
  );
  assert.match(
    stylesSource,
    /--fine-rule-thickness:\s*1px;/,
  );
  assert.match(
    stylesSource,
    /--content-rule-thickness:\s*var\(--fine-rule-thickness\);/,
  );
  assert.match(
    stylesSource,
    /\.alternate-contact-grid__separator\s*\{[^}]*width:\s*100%;[^}]*height:\s*var\(--content-rule-thickness\);[^}]*border:\s*0;[^}]*background:\s*var\(--ink\);/s,
  );
  assert.match(
    stylesSource,
    /\.alternate-contact-grid__row\s*\{[^}]*grid-template-columns:\s*minmax\(8rem, 0\.28fr\) minmax\(0, 1fr\);/s,
  );
  assert.match(
    stylesSource,
    /\.alternate-contact-grid__details\s*\{[^}]*display:\s*grid;[^}]*gap:\s*0\.75rem;/s,
  );
  assert.match(
    stylesSource,
    /\.alternate-contact-grid a\.alternate-contact-grid__email,\s*\.alternate-contact-grid\s+a\.alternate-contact-grid__email:is\(:hover, :focus-visible\)\s*\{[^}]*color:\s*var\(--ink-soft\);[^}]*font-size:\s*1\.25rem;[^}]*text-decoration:\s*none;/s,
  );
  assert.match(
    stylesSource,
    /\.contact-form__consent a,\s*\.alternate-contact-grid a:not\(\.button\)\s*\{[^}]*text-decoration:\s*underline;/s,
  );
  assert.match(
    stylesSource,
    /@media \(max-width: 767px\)[\s\S]*?\.alternate-contact-grid__row\s*\{[^}]*grid-template-columns:\s*1fr;/s,
  );
});

test("contact separator does not change the shared section rule", () => {
  assert.match(stylesSource, /--structural-rule-thickness:\s*5px;/);
  assert.match(
    stylesSource,
    /\.section-anatomy__rule\s*\{[^}]*height:\s*var\(--structural-rule-thickness\);/s,
  );
  assert.match(
    stylesSource,
    /\.alternate-contact-grid__separator\s*\{[^}]*height:\s*var\(--content-rule-thickness\);[^}]*background:\s*var\(--ink\);/s,
  );
});

test("contact embeds NDA in Direct and makes the form the sole terminal section", () => {
  assert.match(
    contactSource,
    /<SectionFrame labelledBy="direct-title" class="alternate-contacts">/,
  );
  assert.match(
    contactSource,
    /<h3>Mutual NDA<\/h3>[\s\S]*?<\/SectionFrame>\s*<FaqSection items=\{faq\} \/>\s*<TerminalSection\s+title="Book a call"\s+titleId="contact-form-title"[\s\S]*?<ContactForm \/>\s*<\/TerminalSection>\s*<\/main>\s*<Footer \/>/,
  );
  assert.equal(contactSource.match(/<TerminalSection\b/g)?.length, 1);
  assert.doesNotMatch(contactSource, /<SectionFrame labelledBy="nda-title"|tone="surface"/);
});
