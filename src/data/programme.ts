import type { FaqPageKey } from "./faq";
import { cardGlyphSets } from "./glyphs.ts";
import type { ModularGlyphDefinition } from "@/lib/modular-glyph";

export interface ContentItem {
  title: string;
  text: string;
  href?: string;
}

export interface ContentLink {
  href: string;
  label: string;
}

export interface ContentGroup {
  title: string;
  items: readonly string[];
}

export interface HighlightedLeadSegment {
  text: string;
  highlight?: boolean;
}

export interface CardPresentation {
  columns?: 1 | 2 | 3;
  surface?: "solid" | "bordered";
  glyphs?: readonly ModularGlyphDefinition[];
  className?: string;
}

export interface ContentSection {
  title: string;
  paragraphs?: readonly string[];
  items?: readonly ContentItem[];
  links?: readonly ContentLink[];
  groups?: readonly ContentGroup[];
  lead?: readonly HighlightedLeadSegment[];
  contentWidth?: "50" | "75" | "100";
  cards?: CardPresentation;
  groupLayout?: "stacked-numbered";
  render?: "ways-of-working" | "highlighted-lead";
}

export interface MarketingPageData {
  path: string;
  metaTitle: string;
  metaDescription: string;
  title: string;
  introduction: string;
  primaryAction?: ContentLink;
  secondaryAction?: ContentLink;
  tone?: "paper" | "dark";
  sections: readonly ContentSection[];
  closing: string;
  faqKey: FaqPageKey;
  service?: {
    name: string;
    serviceType: string;
    description: string;
  };
}

export const homePhases = [
  {
    title: "1/ AI Audit",
    text: "We go through your operations and return a map of opportunities and a plan for what to build first.",
    href: "/ai-first-enterprise/ai-audit",
  },
  {
    title: "2/ Pilot in Production",
    text: "The first use case runs on real data, inside your systems, with real users.",
  },
  {
    title: "3/ Scale",
    text: "Further use cases across the operation, on the infrastructure the pilot already proved.",
  },
  {
    title: "4/ Operation",
    text: "We keep it running: quality monitoring, model replacement, and changes when the regulation changes.",
    href: "/ai-first-enterprise/operation",
  },
] as const;

export const programmePhases = [
  {
    title: "1/ AI Audit",
    text: "We go through your operations and return a ranked map: which workflows AI can take over, what each one is worth, and where your data and your regulator allow it. Two to four weeks.",
    href: "/ai-first-enterprise/ai-audit",
  },
  {
    title: "2/ First use case in production",
    text: "One workflow, taken all the way. Real data, real users, inside your systems, with evidence behind every step. This is where an organisation finds out what deploying AI actually costs it.",
  },
  {
    title: "3/ Scale",
    text: "Further use cases across the operation, reusing the infrastructure and the controls the first one proved. This is the phase where the cost per use case drops.",
  },
  {
    title: "4/ Operation",
    text: "Monitoring, quality checks, model replacement and changes when the process or the regulation changes.",
    href: "/ai-first-enterprise/operation",
  },
] as const;

export const programmePage: MarketingPageData = {
  path: "/ai-first-enterprise",
  metaTitle: "AI-First Enterprise: the programme | NNCo.",
  metaDescription:
    "The cross-industry programme that takes a large organisation from an AI audit to systems running in production: what gets built, in what order, on what infrastructure, and who runs it after launch.",
  title: "AI-First Enterprise",
  introduction:
    "A large organisation does not become AI-first by buying a tool. It happens when a sequence of workflows moves into systems that run every day, on infrastructure that survives an audit, with someone accountable for each one. This is that sequence.",
  primaryAction: { href: "/contact", label: "Book a 30-minute call" },
  secondaryAction: {
    href: "/ai-first-enterprise/ai-audit",
    label: "Start with the audit",
  },
  sections: [
    {
      title: "Programme scope",
      paragraphs: [
        "The AI-First Enterprise programme takes an organisation from an initial audit of its operations to a portfolio of AI systems running in production. It covers what to build and in what order, the infrastructure those systems run on, the evidence and oversight around them, and who operates them after launch.",
      ],
    },
    {
      title: "Who it is for",
      paragraphs: [
        "The pattern is the same whether you run a bank, a logistics operator or a manufacturer: high volumes of documents, processes that cross several systems, decisions that have to be attributable, and teams doing work that fills their day without using their judgement. Where a sector has rules specific enough to name, it has its own page.",
      ],
    },
    {
      title: "Four phases",
      items: programmePhases,
      contentWidth: "50",
      cards: {
        columns: 1,
        className: "home-operation-sequence",
      },
    },
    {
      title: "Core AI capabilities",
      items: [
        {
          title: "Agents that run whole workflows",
          text: "The agent reads the case, pulls what it needs from your systems, applies your rules and prepares the outcome. A person approves, corrects or rejects it. The agent records what it did and why at every step.",
        },
        {
          title: "Document and case processing",
          text: "Contracts, statements, records, claim files, regulatory correspondence. The system extracts the structured data, checks it against your rules and drafts the output a person would otherwise type.",
        },
        {
          title: "Answers from data you already have",
          text: "Policies, procedures, historical cases, product terms and contracts become searchable in the way people actually ask. Every answer links back to the source document and version.",
        },
      ],
      cards: {
        columns: 2,
        surface: "bordered",
      },
    },
    {
      title: "Common starting points",
      items: [
        {
          title: "Inbound documents",
          text: "Everything arriving by email, portal or post gets read, classified, routed and turned into structured data. Usually the fastest measurable win, because the input is already digital.",
        },
        {
          title: "Internal knowledge",
          text: "Staff stop searching an intranet and start asking a question. Answers come from your current documents, with the version attached.",
        },
        {
          title: "Reporting",
          text: "Reports assembled by hand each week or quarter get built from the source systems, with every figure traceable to the record it came from.",
        },
        {
          title: "Back-office processing",
          text: "Reconciliation, checks and data entry between systems that were never integrated. Work that exists only because two systems do not talk to each other.",
        },
        {
          title: "Customer and partner correspondence",
          text: "Responses drafted from the case record and your approved wording. A person reviews and sends.",
        },
      ],
      cards: {
        columns: 1,
        glyphs: cardGlyphSets.commonStartingPoints,
      },
    },
    {
      title: "Decision boundaries",
      paragraphs: [
        "Before anything is built, we write down which decisions the system makes, which it prepares, and which stay entirely with a person. That boundary goes into the design, the interface and the evidence trail. It is the first thing a risk team asks about and the first thing we settle.",
      ],
    },
    {
      title: "Deployment environment",
      paragraphs: [
        "Some of this runs on hosted models with the right controls. Some of it cannot, because of data classification, residency or a supervisory expectation. The audit says which is which per use case, and where private deployment is required we build it.",
      ],
      links: [
        { href: "/ai-first-enterprise/private-ai", label: "Private AI" },
      ],
    },
    {
      title: "How we work",
      render: "ways-of-working",
    },
    {
      title: "Sector detail",
      paragraphs: [
        "Where the workflows and the rules are specific enough to name, they have their own page.",
      ],
      links: [
        { href: "/banking", label: "Banking" },
        { href: "/insurance", label: "Insurance" },
        { href: "/healthcare", label: "Healthcare" },
        {
          href: "/capital-markets",
          label: "Capital Markets & Asset Management",
        },
      ],
    },
  ],
  closing:
    "No slides. Bring the part of the operation that consumes the most time and we will tell you whether the audit is the right first step, and what the sequence after it would look like.",
  faqKey: "programme",
};

export const programmeSubpages = {
  "ai-audit": {
    path: "/ai-first-enterprise/ai-audit",
    metaTitle: "AI audit for large institutions | NNCo.",
    metaDescription:
      "An AI audit maps where AI is worth building in your operation, in what order, and where your data and your regulator allow it. Two to four weeks, ending in a pilot.",
    title: "AI audit",
    introduction:
      "An AI audit goes through your operations and returns a map: which workflows AI can take over, in what order, what each one is worth, and where your data and your regulator allow deployment. It ends with the first use case going into a pilot.",
    primaryAction: { href: "/contact", label: "Book a 30-minute call" },
    secondaryAction: { href: "/discovery", label: "Start the diagnostic" },
    sections: [
      {
        title: "Audit scope",
        paragraphs: [
          "An AI audit is a structured review of an organisation's operations that identifies which workflows can be handled by AI, ranks them by value and feasibility, and records the data, security and regulatory constraints each one has to satisfy. Its output is a ranked build plan and a first use case scoped tightly enough to start.",
        ],
      },
      {
        title: "Use case selection",
        paragraphs: [
          "The usual pattern is a visible use case chosen in a workshop, built as a demo, and then stopped by something nobody looked at first: where the data actually lives, who is allowed to see it, or what has to be evidenced. The audit does that looking before the money is committed.",
        ],
      },
      {
        title: "What we examine",
        items: [
          {
            title: "The work as it runs today",
            text: "We follow real cases through the operation: who touches them, where they wait, which steps are copied by hand, and where the exceptions go. Process documentation describes the intended path. We map the actual one.",
          },
          {
            title: "Systems and data",
            text: "Where the data sits, what condition it is in, which systems can be integrated and which cannot, and what a system would need read or write access to. This is where most estimates go wrong.",
          },
          {
            title: "Constraints",
            text: "Data classification and residency, access rights, retention, supervisory expectations, the EU AI Act classification of each use case, and what has to be evidenced. We record where deployment is allowed, where it is allowed with conditions, and where it is not.",
          },
          {
            title: "People and ownership",
            text: "Which decisions must stay with a person, who would operate the system, and who would be accountable for it. Use cases with no named owner do not make the plan.",
          },
        ],
        cards: {
          columns: 2,
          surface: "bordered",
        },
      },
      {
        title: "Ranked build plan",
        items: [
          {
            title: "Opportunity map",
            text: "Every candidate workflow, with the volume it carries, the time it consumes today and what AI would change about it.",
          },
          {
            title: "Ranking",
            text: "Use cases ordered by value against effort and risk, so the sequence is defensible to a board and to a risk committee.",
          },
          {
            title: "Constraint register",
            text: "Per use case: data classification, where it may run, what has to be logged, EU AI Act classification, and the open questions for your risk and legal teams.",
          },
          {
            title: "Architecture direction",
            text: "What the first use cases would run on, whether that has to be private infrastructure, and what it would take to reuse it for the next ones.",
          },
          {
            title: "Pilot scope",
            text: "One use case defined tightly enough to start: boundary, data, users, success criteria, and what stays with a person.",
          },
        ],
        contentWidth: "50",
        cards: {
          columns: 1,
          glyphs: cardGlyphSets.rankedBuildPlan,
        },
      },
      {
        title: "Audit process",
        paragraphs: [
          "Two to four weeks, depending on the size of the operation and how many systems are in scope.",
        ],
        items: [
          {
            title: "1/ NDA and access",
            text: "Signed before you describe anything internal. We agree who we talk to and what we can see.",
          },
          {
            title: "2/ Interviews and observation",
            text: "Sessions with the people who do the work and the people accountable for it. Operations, risk, IT, and the business owner.",
          },
          {
            title: "3/ Systems and data review",
            text: "What exists, what it holds, what it can expose, and in what condition.",
          },
          {
            title: "4/ Ranking and constraints",
            text: "Candidates scored against value, effort, risk and what the rules allow.",
          },
          {
            title: "5/ Working session",
            text: "We present the map and argue it with your team. The sequence usually changes in this room.",
          },
          {
            title: "6/ Pilot scope",
            text: "The first use case is scoped and starts.",
          },
        ],
        contentWidth: "50",
        cards: {
          columns: 1,
          className: "home-operation-sequence",
        },
      },
      {
        title: "Four essential roles",
        paragraphs: [
          "The business owner of the workflow, someone from operations who does the work daily, someone from risk or compliance, and someone from IT or data. Missing the risk seat is the single most common reason an audit produces a plan that later gets blocked.",
        ],
      },
      {
        title: "Online diagnostic",
        paragraphs: [
          "The diagnostic maps one workflow, locates where it loses time and returns an evidence-linked preview of the same analysis. It takes about 15 minutes and does not require a call.",
        ],
        links: [
          { href: "/discovery", label: "Start the diagnostic" },
          { href: "/ai-first-enterprise", label: "AI-First Enterprise" },
          {
            href: "/blog/what-goes-into-an-audit-trail-for-an-ai-workflow",
            label: "What goes into an audit trail",
          },
        ],
      },
    ],
    closing:
      "Before the audit there is a call. We go through what your operation looks like, whether an audit is the right first step, and what it would cover.",
    faqKey: "aiAudit",
    service: {
      name: "AI audit",
      serviceType: "AI consulting",
      description:
        "A structured review of an organisation's operations that identifies which workflows AI can take over, ranks them by value and feasibility, and records the data, security and regulatory constraints each one has to satisfy.",
    },
  },
  "private-ai": {
    path: "/ai-first-enterprise/private-ai",
    metaTitle: "On-premise and private AI deployment | NNCo.",
    metaDescription:
      "Models, retrieval, access control and monitoring deployed inside the boundary you govern. On-premise or in your own tenancy, so sensitive data never leaves your network.",
    title: "Private AI",
    introduction:
      "Models, retrieval, access control, logging and monitoring deployed in an environment you govern. Sensitive data does not leave your network, and there is no call to an external service in the path of a decision.",
    tone: "dark",
    sections: [
      {
        title: "Private AI scope",
        render: "highlighted-lead",
        lead: [
          { text: "Private AI deployment means running " },
          { text: "the model", highlight: true },
          { text: ", " },
          { text: "retrieval layer", highlight: true },
          { text: " and " },
          { text: "surrounding controls", highlight: true },
          { text: " inside " },
          { text: "governed infrastructure", highlight: true },
          {
            text: ", whether that is the organisation's own data centre or a dedicated cloud tenancy. The data used for inference, prompts and logs ",
          },
          { text: "stay inside", highlight: true },
          { text: " that boundary, under its " },
          { text: "access and retention", highlight: true },
          { text: " rules." },
        ],
      },
      {
        title: "Deployment criteria",
        paragraphs: [
          "Private infrastructure adds cost and responsibility. It is the right answer when data classification, residency, contractual limits or a supervisory expectation puts a hosted model out of scope. When none of those apply, a hosted model with the right controls is faster and cheaper, and we say so.",
        ],
        groups: [
          {
            title: "1/ Reasons that justify it",
            items: [
              "Data that cannot leave the jurisdiction or the network under law, policy or client contract.",
              "Data classified in a way that rules out third-party processing.",
              "A supervisory or audit expectation that inference and logs remain under direct control.",
              "Latency or availability requirements tied to a system that itself runs internally.",
            ],
          },
          {
            title: "2/ Reasons that do not",
            items: [
              "A general preference for owning things.",
              "An assumption that private infrastructure is automatically more secure. It is more controlled, which is only an advantage if someone operates it.",
            ],
          },
        ],
        groupLayout: "stacked-numbered",
      },
      {
        title: "Inside the boundary",
        items: [
          {
            title: "Models",
            text: "Open-weight models sized to the workflow and the hardware, running on your infrastructure. Replaceable: as better models arrive, we swap them without rebuilding the workflow around them.",
          },
          {
            title: "Retrieval",
            text: "Your documents, indexed inside the boundary, with permissions inherited from your source systems. A user sees in the AI exactly what they are allowed to see in the underlying system, and nothing else.",
          },
          {
            title: "Access control and identity",
            text: "Integrated with your identity provider. Role-based access to workflows, data and administrative functions, with the same joiner-mover-leaver process as the rest of your estate.",
          },
          {
            title: "Evidence",
            text: "Every consequential step is recorded: the inputs, the retrieved sources, the model output, the human action and the version of every component involved. Retention follows your policy.",
          },
          {
            title: "Monitoring",
            text: "Quality, drift, failure and cost, with alerting into the tooling your operations team already uses.",
          },
        ],
        cards: {
          columns: 2,
          surface: "bordered",
        },
      },
      {
        title: "Operational ownership",
        paragraphs: [
          "Private infrastructure moves capacity planning, patching, model replacement, observability and incident handling to whoever owns it. We either run it under a support agreement, or we hand it over with the runbooks and the training your team needs to run it themselves. What does not work is leaving it undecided.",
        ],
      },
      {
        title: "Boundary scope",
        paragraphs: [
          "In most institutions only part of the data is genuinely restricted. A common design keeps restricted workflows entirely inside the boundary and lets the rest use hosted models, with a policy layer that decides which path a request takes. This is cheaper than running everything privately and easier to defend than running everything externally.",
        ],
        links: [
          { href: "/ai-first-enterprise", label: "AI-First Enterprise" },
          {
            href: "/blog/what-goes-into-an-audit-trail-for-an-ai-workflow",
            label: "What goes into an audit trail",
          },
        ],
      },
    ],
    closing:
      "Bring the data classification and the constraint you are working against. We will tell you whether private deployment is the right answer for it, and what running it would actually involve.",
    faqKey: "privateAi",
    service: {
      name: "Private AI deployment",
      serviceType: "AI infrastructure",
      description:
        "Models, retrieval, access control, logging and monitoring deployed inside infrastructure the organisation governs.",
    },
  },
  operation: {
    path: "/ai-first-enterprise/operation",
    metaTitle: "Running AI systems after launch | NNCo.",
    metaDescription:
      "What happens to an AI system after it goes live: monitoring, quality checks, model replacement and changes when the process or the regulation changes.",
    title: "AI operations",
    introduction:
      "An AI system in production is not finished software. Models change, data drifts, processes get reorganised and regulation moves. We either run it for you or hand it over with everything your team needs to run it themselves.",
    sections: [
      {
        title: "Operational scope",
        paragraphs: [
          "Operating an AI system in production means monitoring output quality and drift, handling exceptions and failures, replacing models as better ones become available, keeping the evidence trail intact, and adjusting the system when the underlying process or the applicable regulation changes.",
        ],
      },
      {
        title: "Ownership risk",
        paragraphs: [
          "The failure is rarely dramatic. Quality slips, a source system changes a field, exceptions start piling into a queue nobody reads, and within a year people have gone back to doing it by hand while the system still appears in the architecture diagram.",
        ],
      },
      {
        title: "Ongoing operation",
        items: [
          {
            title: "Quality and drift",
            text: "Output quality is sampled and reviewed against the same criteria the system was accepted on. When it moves, you hear it from us rather than from the team that stopped trusting it.",
          },
          {
            title: "Exceptions and failures",
            text: "Failed cases, retries and edge cases go somewhere with an owner and a response, not into a log.",
          },
          {
            title: "Model replacement",
            text: "Better and cheaper models arrive constantly. Because the model sits behind an interface, swapping it is a change to one component, tested against the same acceptance criteria.",
          },
          {
            title: "Evidence",
            text: "The record stays complete and readable through every change, including changes to the components that produced it.",
          },
          {
            title: "Process and regulation changes",
            text: "When your process changes or the rules do, the system and its documentation change with them.",
          },
        ],
        contentWidth: "50",
        cards: {
          columns: 1,
          glyphs: cardGlyphSets.ongoingOperation,
        },
      },
      {
        title: "Internal ownership",
        paragraphs: [
          "Where you would rather own the operation internally, we hand over the runbooks, the acceptance criteria, the monitoring and the training. What we do not do is leave the question open, because that is how a system ends up with no owner at all.",
        ],
        links: [
          { href: "/ai-first-enterprise", label: "AI-First Enterprise" },
          {
            href: "/blog/what-goes-into-an-audit-trail-for-an-ai-workflow",
            label: "What goes into an audit trail",
          },
        ],
      },
    ],
    closing:
      "If you already have an AI system in production and nobody clearly owns it, that is a conversation worth having on its own.",
    faqKey: "operation",
  },
} as const satisfies Record<string, MarketingPageData>;
