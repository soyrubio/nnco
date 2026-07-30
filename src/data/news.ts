export interface NewsSection {
  heading: string;
  paragraphs: string[];
}

export interface NewsArticle {
  slug: string;
  title: string;
  category: "Applied AI" | "Regulation" | "Infrastructure" | "Healthcare" | "Company";
  publishedAt: "2026-07-30";
  publishedLabel: "30 July 2026";
  summary: string;
  keyStatement: string;
  sections: NewsSection[];
  relatedSlug: string;
}

export const newsArticles: NewsArticle[] = [
  {
    slug: "why-regulated-ai-projects-stall-before-production",
    title: "Why regulated AI projects stall before production",
    category: "Applied AI",
    publishedAt: "2026-07-30",
    publishedLabel: "30 July 2026",
    summary:
      "The gap between a successful demonstration and a system that can survive security, audit, and daily operations.",
    keyStatement:
      "A convincing demonstration answers whether a capability is possible. Production asks who owns it, how it is controlled, and what happens when it fails.",
    sections: [
      {
        heading: "The demonstration is only one layer",
        paragraphs: [
          "A prototype can show that a model understands a document, classifies a request, or drafts a useful response. That result matters, but it says little about how the capability will behave inside an institution.",
          "Production introduces a wider system: source data, permissions, interfaces, exception paths, human decisions, monitoring, and evidence. If those parts arrive late, the promising demonstration becomes difficult to place into daily work.",
        ],
      },
      {
        heading: "The missing work is operational",
        paragraphs: [
          "The transition becomes clearer when the team defines one workflow boundary, its owners, its inputs and outputs, and the decisions that must remain accountable to people.",
          "From there, technical choices can follow the real constraints. The useful question is not only whether the model performs, but whether the complete workflow can be operated, reviewed, and changed safely.",
        ],
      },
    ],
    relatedSlug: "designing-ai-workflows-that-can-be-audited",
  },
  {
    slug: "designing-ai-workflows-that-can-be-audited",
    title: "Designing AI workflows that can be audited",
    category: "Regulation",
    publishedAt: "2026-07-30",
    publishedLabel: "30 July 2026",
    summary:
      "An overview of evidence, human review, access control, and traceability in operational AI, with attention to how those controls fit together.",
    keyStatement:
      "Auditability is a property of the whole workflow, not a transcript added after the model has acted.",
    sections: [
      {
        heading: "Begin with evidence",
        paragraphs: [
          "An auditable workflow should make it possible to reconstruct the material inputs, transformations, outputs, exceptions, and approvals associated with a case.",
          "That does not require recording every incidental event. It requires deciding which evidence explains a consequential step and retaining it in a form that an authorised reviewer can interpret.",
        ],
      },
      {
        heading: "Keep authority visible",
        paragraphs: [
          "Access control determines who can see source material, operate the workflow, approve an exception, and review its history. Human review should be attached to an explicit decision rather than presented as a general safety label.",
          "When evidence, permissions, and approvals use the same case boundary, traceability becomes part of normal operation instead of a separate reporting exercise.",
        ],
      },
    ],
    relatedSlug: "why-regulated-ai-projects-stall-before-production",
  },
  {
    slug: "when-on-premise-ai-is-the-right-constraint",
    title: "When on-premise AI is the right constraint",
    category: "Infrastructure",
    publishedAt: "2026-07-30",
    publishedLabel: "30 July 2026",
    summary:
      "A practical explanation of private infrastructure for institutions with strict data and security boundaries, including the decisions that make it an appropriate constraint.",
    keyStatement:
      "Private infrastructure is useful when it answers a defined operating constraint, not when it merely makes the architecture appear more serious.",
    sections: [
      {
        heading: "Start from the boundary",
        paragraphs: [
          "On-premise deployment may be appropriate when an institution must keep sensitive data, model execution, access controls, and operational logs within an environment it directly governs.",
          "The decision should begin with data classification, permitted flows, integration needs, availability, and the teams responsible for operating the system.",
        ],
      },
      {
        heading: "Account for the operating model",
        paragraphs: [
          "Private infrastructure also transfers responsibilities. Capacity, patching, model replacement, observability, and incident handling need named owners and realistic service expectations.",
          "A useful architecture can combine private and managed components where the boundary allows. The constraint should make the system clearer and more controllable, not simply more complex.",
        ],
      },
    ],
    relatedSlug: "designing-ai-workflows-that-can-be-audited",
  },
  {
    slug: "ai-in-healthcare-without-crossing-into-diagnostics",
    title: "AI in healthcare without crossing into diagnostics",
    category: "Healthcare",
    publishedAt: "2026-07-30",
    publishedLabel: "30 July 2026",
    summary:
      "A clear description of NNCO’s focus on administrative and operational workflows in healthcare, including the deliberate boundary around MDR and clinical diagnostics.",
    keyStatement:
      "A deliberate boundary around clinical diagnosis creates room to improve operational work without obscuring where medical authority must remain.",
    sections: [
      {
        heading: "Choose the workflow before the model",
        paragraphs: [
          "Healthcare organisations contain substantial administrative work around scheduling, documentation routing, capacity, reporting, internal knowledge, and coordination.",
          "These workflows can be examined without asking a system to diagnose a patient or replace clinical judgment. The boundary should be stated at the beginning and reflected in the data, interfaces, and approvals.",
        ],
      },
      {
        heading: "Keep the MDR boundary explicit",
        paragraphs: [
          "NNCO’s initial focus is administrative and operational. Clinical diagnostics and patient-specific medical decisions remain outside that scope.",
          "This is not a claim that operational work is free of risk. Sensitive information, role-based access, traceability, and human oversight still need to be designed into the workflow.",
        ],
      },
    ],
    relatedSlug: "when-on-premise-ai-is-the-right-constraint",
  },
  {
    slug: "introducing-nnco",
    title: "Introducing NNCO",
    category: "Company",
    publishedAt: "2026-07-30",
    publishedLabel: "30 July 2026",
    summary:
      "A concise company announcement explaining the implementation gap NNCO intends to fill for regulated institutions across the Czech and Slovak markets.",
    keyStatement:
      "NNCO is being built around the implementation gap between an AI idea and a workflow an institution can actually operate.",
    sections: [
      {
        heading: "An implementation-focused company",
        paragraphs: [
          "NNCO is an AI implementation firm for regulated institutions in the Czech and Slovak markets. Its focus is the work between a promising concept and a controlled production workflow.",
          "That work includes discovery, process definition, integration, infrastructure, access, evidence, and the operating responsibilities that continue after launch.",
        ],
      },
      {
        heading: "Start with the institution",
        paragraphs: [
          "The intended starting point is a real institutional problem rather than a generic model demonstration. The workflow and its constraints shape the system that follows.",
          "NNCO will develop reusable agents, connectors, controls, and delivery patterns while keeping each engagement grounded in the institution’s data boundary and operating context.",
        ],
      },
    ],
    relatedSlug: "why-regulated-ai-projects-stall-before-production",
  },
];

export function getNewsArticle(slug: string): NewsArticle | undefined {
  return newsArticles.find((article) => article.slug === slug);
}
