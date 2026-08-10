import assert from "node:assert/strict";
import test from "node:test";

import { faqByPage } from "../src/data/faq.ts";
import { footerGroups } from "../src/data/site.ts";
import { buildFaqSchema } from "../src/lib/schema.ts";

test("FAQ schemas preserve canonical IDs and source question order", () => {
  const cases = [
    ["/", "home"],
    ["/company", "company"],
    ["/contact", "contact"],
    ["/ai-first-enterprise", "programme"],
    ["/ai-first-enterprise/ai-audit", "aiAudit"],
    ["/ai-first-enterprise/private-ai", "privateAi"],
    ["/ai-first-enterprise/operation", "operation"],
    ["/banking", "banking"],
    ["/insurance", "insurance"],
    ["/healthcare", "healthcare"],
    ["/capital-markets", "capitalMarkets"],
  ];

  for (const [path, faqKey] of cases) {
    const items = faqByPage[faqKey];
    const schema = buildFaqSchema(items, path);

    assert.equal(schema["@id"], `https://nnco.ai${path}#faq`);
    assert.deepEqual(
      schema.mainEntity,
      items.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    );
  }
});

test("footer data preserves group, label, href, and link order", () => {
  assert.deepEqual(
    footerGroups.map((group) => ({
      label: group.label,
      links: group.links.map(({ href, label }) => ({ href, label })),
    })),
    [
      {
        label: "Company",
        links: [
          { href: "/company", label: "About" },
          { href: "/blog", label: "Blog" },
          { href: "/privacy", label: "Privacy" },
          { href: "/security", label: "Security" },
        ],
      },
      {
        label: "Programme",
        links: [
          { href: "/ai-first-enterprise", label: "AI-First Enterprise" },
          { href: "/ai-first-enterprise/ai-audit", label: "AI Audit" },
          { href: "/ai-first-enterprise/private-ai", label: "Private AI" },
          { href: "/ai-first-enterprise/operation", label: "Operation" },
        ],
      },
      {
        label: "Industries",
        links: [
          { href: "/banking", label: "Banking" },
          { href: "/insurance", label: "Insurance" },
          { href: "/healthcare", label: "Healthcare" },
          { href: "/capital-markets", label: "Capital Markets" },
        ],
      },
      {
        label: "Contact",
        links: [
          { href: "/contact", label: "Book a call" },
          { href: "/discovery", label: "Start the diagnostic" },
          {
            href: "mailto:general@nnco.ai",
            label: "general@nnco.ai",
          },
        ],
      },
    ],
  );
});
