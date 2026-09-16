import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sources = Object.fromEntries(
  await Promise.all(
    Object.entries({
      contact: "../src/components/ContactForm.astro",
      control: "../src/components/form/FormControl.astro",
      checkbox: "../src/components/form/FormCheckbox.astro",
      page: "../src/pages/contact.astro",
      styles: "../src/styles/global.css",
    }).map(async ([name, path]) => [
      name,
      await readFile(new URL(path, import.meta.url), "utf8"),
    ]),
  ),
);

test("contact fields compose reusable labelled Astro controls", () => {
  assert.match(sources.contact, /import FormCheckbox[\s\S]*?import FormControl/);
  assert.equal(sources.contact.match(/<FormControl\b/g)?.length, 6);
  assert.equal(sources.contact.match(/<FormCheckbox\b/g)?.length, 1);

  assert.match(
    sources.control,
    /<label class:list=\{\["form-control", className\]\}>[\s\S]*?<span class="form-control__label">\{label\}<\/span>[\s\S]*?<slot \/>[\s\S]*?<small id=\{errorId\} data-error-for=\{name\}><\/small>/,
  );
  assert.match(
    sources.checkbox,
    /<div class:list=\{\["form-checkbox", className\]\}>[\s\S]*?<input\s+id=\{id\}[\s\S]*?type="checkbox"[\s\S]*?aria-describedby=\{errorId\}[\s\S]*?<label for=\{id\}><slot name="label" \/><\/label>\{" "\}<slot \/>[\s\S]*?data-error-for=\{name\}/,
  );
  assert.doesNotMatch(sources.checkbox, /<label[^>]*>[\s\S]*?<slot \/>[\s\S]*?<\/label>/);
  assert.match(
    sources.contact,
    /<FormCheckbox\s+id="contact-consent"[\s\S]*?<Fragment slot="label">I agree that NNCo may use these details to respond to my enquiry\.<\/Fragment>\s*<a href="\/privacy">Privacy<\/a>/,
  );

  for (const name of ["name", "email", "institution", "sector", "area", "message"]) {
    assert.match(sources.contact, new RegExp(`name="${name}"`), name);
  }
  assert.match(sources.contact, /autocomplete="name"/);
  assert.match(sources.contact, /type="email"[\s\S]*?autocomplete="email"[\s\S]*?inputmode="email"/);
  assert.match(sources.contact, /autocomplete="organization"/);
  assert.match(sources.contact, /<textarea[\s\S]*?rows="6"[\s\S]*?required/);
  assert.match(
    sources.contact,
    /<Button type="submit">\s*<span data-submit-label>Send<\/span> <BlockArrow \/>\s*<\/Button>/,
  );
  assert.match(
    sources.contact,
    /const submitLabel = submit\?\.querySelector<HTMLElement>\("\[data-submit-label\]"\);[\s\S]*?submitLabel\.textContent = "Send";[\s\S]*?submitLabel\.textContent = "Sending\.";/,
  );
  assert.doesNotMatch(
    sources.contact,
    /submit\.textContent = "(?:Send|Sending\.)"/,
  );
});

test("terminal contact form has no outer box and native controls use one bottom rule", () => {
  assert.match(
    sources.page,
    /<FaqSection items=\{faq\} \/>\s*<TerminalSection[\s\S]*?title="Book a call"[\s\S]*?<ContactForm \/>\s*<\/TerminalSection>\s*<\/main>\s*<Footer \/>/,
  );
  assert.match(
    sources.styles,
    /\.contact-form\s*\{[^}]*padding:\s*0;[^}]*border:\s*0;/s,
  );
  assert.match(
    sources.styles,
    /\.form-control > :is\(input, select, textarea\)\s*\{[^}]*border:\s*0;[^}]*border-bottom:\s*1px solid var\(--rule-strong\);[^}]*background:\s*transparent;[^}]*outline:\s*0;/s,
  );
  assert.doesNotMatch(sources.styles, /\.field\s+(?:input|select|textarea)/);
});

test("form controls expose focus, error, disabled and autofill states", () => {
  assert.match(
    sources.styles,
    /\.form-control > :is\(input, select, textarea\):focus-visible\s*\{[^}]*border-bottom-color:\s*var\(--ink\);[^}]*border-bottom-width:\s*3px;[^}]*outline:\s*0;/s,
  );
  assert.match(
    sources.styles,
    /\.form-control > \[aria-invalid="true"\]\s*\{[^}]*border-bottom-color:\s*var\(--danger\);[^}]*border-bottom-width:\s*3px;/s,
  );
  assert.match(
    sources.styles,
    /\.form-control > \[aria-invalid="true"\]:focus-visible\s*\{\s*border-bottom-color:\s*var\(--danger\);/s,
  );
  assert.match(
    sources.styles,
    /\.form-control > :is\(input, select, textarea\):disabled,[\s\S]*?cursor:\s*not-allowed;[^}]*opacity:\s*0\.62;/s,
  );
  assert.match(
    sources.styles,
    /\.form-control > input:-webkit-autofill,[\s\S]*?-webkit-text-fill-color:\s*var\(--ink\);[^}]*box-shadow:\s*0 0 0 1000px var\(--surface\) inset;/s,
  );
  assert.match(sources.contact, /field\.setAttribute\("aria-invalid", "true"\);/);
  assert.match(sources.contact, /target\.textContent = errorMessageFor\(field\);/);
});
