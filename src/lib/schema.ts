import type { FaqItem } from "@/data/faq";

const SITE_ORIGIN = "https://nnco.ai";

export function buildFaqSchema(
  items: readonly FaqItem[],
  canonicalPath: string,
): Record<string, unknown> {
  return {
    "@type": "FAQPage",
    "@id": `${SITE_ORIGIN}${canonicalPath}#faq`,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
