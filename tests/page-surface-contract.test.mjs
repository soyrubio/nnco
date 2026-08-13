import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sources = Object.fromEntries(
  await Promise.all(
    Object.entries({
      terminal: "../src/components/TerminalSection.astro",
      closing: "../src/components/ClosingSection.astro",
      faq: "../src/components/FaqSection.astro",
      frame: "../src/components/SectionFrame.astro",
      marketing: "../src/components/MarketingPage.astro",
      home: "../src/pages/index.astro",
      company: "../src/pages/company.astro",
      contact: "../src/pages/contact.astro",
      privacy: "../src/pages/privacy.astro",
      security: "../src/pages/security.astro",
      blogIndex: "../src/pages/blog/index.astro",
      blogPost: "../src/pages/blog/[slug].astro",
      notFound: "../src/pages/404.astro",
      discovery: "../src/pages/discovery.astro",
      styles: "../src/styles/global.css",
    }).map(async ([name, path]) => [
      name,
      await readFile(new URL(path, import.meta.url), "utf8"),
    ]),
  ),
);

test("terminal section has a full-width surface and the shared rule-aligned anatomy", () => {
  assert.match(
    sources.terminal,
    /import SectionAnatomy from "\.\/SectionAnatomy\.astro";[\s\S]*?<section[\s\S]*?<div class="content-rail terminal-section__inner">\s*<SectionAnatomy title=\{title\} titleId=\{titleId\}>/,
  );
  assert.match(
    sources.styles,
    /--section-space-block:\s*clamp\(5rem, 9\.45vw, 8\.5rem\);/,
  );
  assert.match(
    sources.styles,
    /\.section-frame__inner,\s*\.terminal-section__inner\s*\{\s*padding-block:\s*var\(--section-space-block\);/s,
  );
  assert.match(
    sources.styles,
    /\.terminal-section\s*\{[^}]*background:\s*var\(--surface\);[^}]*color:\s*var\(--ink\);/s,
  );
  assert.match(
    sources.styles,
    /\.section-anatomy__rule\s*\{[^}]*height:\s*var\(--structural-rule-thickness\);[^}]*grid-column:\s*1 \/ -1;[^}]*margin-bottom:\s*clamp\(2rem, 4vw, 3\.5rem\);[^}]*background:\s*currentColor;/s,
  );
  assert.doesNotMatch(sources.styles, /\.terminal-section__(?:rail|surface)\b/);
  assert.doesNotMatch(sources.styles, /\.section-frame--surface\b/);
  assert.doesNotMatch(sources.frame, /"surface"/);
});

test("standard page heroes use the shared four-fifths viewport height", () => {
  assert.match(
    sources.styles,
    /--page-hero-height:\s*clamp\(40rem, 80dvh, 56rem\);/,
  );
  assert.match(
    sources.styles,
    /\.editorial-hero\s*\{[^}]*min-height:\s*var\(--page-hero-height\);/s,
  );
});

test("shared terminal content composes the terminal section primitive", () => {
  assert.match(
    sources.closing,
    /<TerminalSection[\s\S]*?class="closing-section closing-section--surface"[\s\S]*?<div class="closing-callout">/,
  );
  assert.doesNotMatch(sources.closing, /SectionAnatomy|SectionFrame|tone/);
});

test("FAQ has one standard section composition", () => {
  assert.match(
    sources.faq,
    /<SectionFrame id=\{id\} labelledBy=\{titleId\} class="faq-section">\s*<SectionAnatomy title=\{title\} titleId=\{titleId\}>\s*<FaqList items=\{items\} groupName=\{`\$\{id\}-questions`\} \/>/,
  );
  assert.doesNotMatch(sources.faq, /TerminalSection|\bterminal\b|\btone\b/);
});

test("Company confidentiality composes the standard full-width dark section", () => {
  assert.match(
    sources.company,
    /<SectionFrame tone="dark" labelledBy="discretion-title" class="editorial-section">\s*<SectionAnatomy title="Client confidentiality" titleId="discretion-title">[\s\S]*?We sign an NDA before you describe anything internal\.[\s\S]*?We are precise about how we work and quiet about who we work for\.[\s\S]*?<\/SectionAnatomy>\s*<\/SectionFrame>/,
  );
  assert.doesNotMatch(sources.company, /DarkNarrativePanel|dark-narrative-panel/);
  assert.match(
    sources.styles,
    /\.section-frame--dark \.editorial-section__body\s*\{\s*color:\s*inherit;/s,
  );
});

test("full-width dark sections share generous vertical rhythm", () => {
  assert.match(
    sources.styles,
    /--dark-section-margin-block:\s*clamp\(2rem, 3vw, 3rem\);/,
  );
  assert.match(
    sources.styles,
    /--dark-section-padding-block:\s*clamp\(6rem, 11vw, 10rem\);/,
  );
  assert.match(
    sources.styles,
    /\.section-frame--dark\s*\{[^}]*margin-block:\s*var\(--dark-section-margin-block\);[^}]*background:\s*var\(--ink\);[^}]*color:\s*var\(--paper\);/s,
  );
  assert.match(
    sources.styles,
    /\.section-frame--dark \.section-frame__inner\s*\{\s*padding-block:\s*var\(--dark-section-padding-block\);/s,
  );
});

test("shared marketing pages end with FAQ then terminal ClosingSection", () => {
  assert.doesNotMatch(sources.marketing, /index\s*%\s*3|tone="surface"/);
  assert.match(
    sources.marketing,
    /<FaqSection items=\{faq\} \/>\s*<ClosingSection[\s\S]*?<\/main>\s*<Footer \/>/,
  );
});

test("homepage ends In practice, FAQ, terminal Start here, then Footer", () => {
  assert.doesNotMatch(sources.home, /tone="surface"/);
  assert.match(
    sources.home,
    /<SectionAnatomy title="In practice"[\s\S]*?<\/SectionFrame>\s*<FaqSection items=\{faq\} \/>\s*<ClosingSection[\s\S]*?<\/main>\s*<Footer \/>/,
  );
  assert.doesNotMatch(
    sources.styles,
    /\.home-latest-news \.section-frame__inner\s*\{/,
  );
});

test("standalone pages use the terminal primitive only before Footer", () => {
  assert.match(
    sources.company,
    /<FaqSection items=\{faq\} \/>\s*<ClosingSection[\s\S]*?<\/main>\s*<Footer \/>/,
  );
  assert.match(
    sources.privacy,
    /<TerminalSection\s+title="Retention"\s+titleId="retention-title"[\s\S]*?<\/TerminalSection>\s*<\/main>\s*<Footer \/>/,
  );
  assert.match(
    sources.security,
    /<TerminalSection\s+title="What we do not offer"\s+titleId="bounty-title"[\s\S]*?<\/TerminalSection>\s*<\/main>\s*<Footer \/>/,
  );

  for (const name of ["company", "privacy", "security"]) {
    assert.doesNotMatch(sources[name], /tone="surface"/, name);
  }
});

test("contact ends standalone FAQ then its sole terminal contact form", () => {
  assert.match(
    sources.contact,
    /<SectionFrame labelledBy="direct-title" class="alternate-contacts">[\s\S]*?<h3>Mutual NDA<\/h3>[\s\S]*?<\/SectionFrame>\s*<FaqSection items=\{faq\} \/>\s*<TerminalSection\s+title="Book a call"[\s\S]*?<ContactForm \/>[\s\S]*?<\/main>\s*<Footer \/>/,
  );
  assert.equal(sources.contact.match(/<TerminalSection\b/g)?.length, 1);
  assert.doesNotMatch(sources.contact, /tone="surface"/);
});

test("blog terminals and route exceptions retain their composition", () => {
  for (const name of ["blogIndex", "blogPost"]) {
    assert.match(
      sources[name],
      /<ClosingSection[\s\S]*?<\/main>\s*<Footer \/>/,
      name,
    );
    assert.doesNotMatch(sources[name], /tone="surface"/, name);
  }

  assert.doesNotMatch(sources.notFound, /TerminalSection|tone="surface"/);
  assert.match(sources.notFound, /<\/main>\s*<Footer \/>/);
  assert.doesNotMatch(sources.discovery, /TerminalSection|tone="surface"/);
  assert.doesNotMatch(sources.discovery, /<Footer\b/);
});

test("footer retains the shared surface background", () => {
  assert.match(
    sources.styles,
    /\.site-footer\s*\{[^}]*background:\s*var\(--surface\);/s,
  );
});
