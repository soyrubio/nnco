import type { MarketingPageData } from "./programme";

export const industries = {
  banking: {
    path: "/banking",
    metaTitle: "AI for banks: KYC, monitoring, reporting | NNCO",
    metaDescription:
      "AI systems for onboarding and KYC, periodic review, transaction monitoring triage, credit files and regulatory reporting. Built to run inside supervisory constraints and to be evidenced.",
    title: "Banking",
    introduction:
      "Onboarding, periodic review, alert triage, credit files and regulatory reporting carry most of the manual volume in a bank. AI can take the preparation work in all of them, provided every step can be reconstructed afterwards.",
    sections: [
      {
        title: "AI in banking",
        paragraphs: [
          "In banking, AI is used to read and structure documents, prepare cases for a human decision, triage alerts by likely materiality, draft regulatory and customer correspondence, and answer staff questions from internal policy. It is not used to make credit, sanctions or account-closure decisions on its own, because those decisions have to be attributable to a person.",
        ],
      },
      {
        title: "Preparation workload",
        paragraphs: [
          "An analyst spends most of a case gathering: pulling documents from three systems, checking a name against a register, retyping data that already exists somewhere, and writing a summary of what they found. The decision itself takes minutes. Preparation is where the queue builds, and preparation is what AI takes.",
        ],
      },
      {
        title: "AI-supported case preparation",
        items: [
          {
            title: "Onboarding and KYC",
            text: "The system reads incorporation documents, ownership structures and identity records, extracts the entities and relationships, checks them against your registers and screening tools, and assembles the file with every source attached. The analyst reviews and decides.",
          },
          {
            title: "Periodic review",
            text: "For existing clients, the system re-runs the checks, compares the current picture against the file on record and flags what changed. Reviews where nothing material moved arrive already prepared; the analyst spends their time on the ones that did.",
          },
          {
            title: "Transaction monitoring triage",
            text: "Alerts arrive with the context already gathered: customer profile, transaction history, prior alerts and the pattern that triggered this one, summarised with sources. The investigator still makes the escalation decision, and the system records what it presented and what was done with it.",
          },
          {
            title: "Credit file preparation",
            text: "Financial statements, contracts and correspondence are read and turned into the structured inputs your credit process expects, with each figure linked to the page it came from. The credit decision stays entirely with the committee.",
          },
          {
            title: "Regulatory reporting checks",
            text: "The system checks submissions against the rules and against prior periods, and explains each exception in the language of the reporting requirement rather than as a failed validation code.",
          },
          {
            title: "Internal policy and product knowledge",
            text: "Staff ask a question in the way they would ask a colleague and get an answer from your current policy, with the clause and version attached. This removes the most common source of inconsistent answers to customers.",
          },
        ],
      },
      {
        title: "Design constraints",
        items: [
          {
            title: "EU AI Act",
            text: "Each use case is classified, and the classification determines what documentation, human oversight and record-keeping the design has to carry.",
          },
          {
            title: "AML and sanctions obligations",
            text: "Screening and monitoring decisions stay attributable to a person, and the system records what was presented at the moment of decision.",
          },
          {
            title: "DORA",
            text: "Model hosting, third-party dependencies and incident handling are treated as ICT risk and documented as such from the design stage.",
          },
          {
            title: "GDPR",
            text: "Purpose, lawful basis, minimisation and retention are settled per use case before data moves anywhere.",
          },
          {
            title: "Supervisory expectations",
            text: "Systems are built so that a supervisor's question about a specific case can be answered with the record, not with a description of the process.",
          },
        ],
      },
      {
        title: "Decision authority",
        paragraphs: [
          "We build systems that prepare, check and explain. Credit approvals, sanctions determinations, escalations and account decisions stay with the people who are accountable for them, and the record shows what they saw when they decided.",
        ],
      },
      {
        title: "Private deployment",
        paragraphs: [
          "Customer data, transaction data and case files usually fall into classifications that rule out third-party processing. Where that is the case, models and retrieval run inside your infrastructure. Where it is not, a hosted model with the right controls is faster to stand up and we say so.",
        ],
        links: [
          { href: "/ai-first-enterprise/private-ai", label: "Private AI" },
        ],
      },
      {
        title: "Start with an audit",
        paragraphs: [
          "Two to four weeks, across onboarding, monitoring, credit and reporting operations. The output is a ranked list of what to build, what each one is worth, and where the rules allow it.",
        ],
        links: [
          { href: "/ai-first-enterprise/ai-audit", label: "AI audit" },
          {
            href: "/blog/what-goes-into-an-audit-trail-for-an-ai-workflow",
            label: "What an AI audit trail records",
          },
        ],
      },
    ],
    closing:
      "Bring one workflow where the queue is longest. We will go through what AI could take out of it, what would stay with your analysts, and what your risk team would need to see.",
    faqKey: "banking",
    service: {
      name: "AI systems for banking",
      serviceType: "AI implementation",
      description:
        "AI systems for onboarding and KYC, periodic review, transaction monitoring triage, credit files and regulatory reporting.",
    },
  },
  insurance: {
    path: "/insurance",
    metaTitle: "AI for insurers: claims and underwriting | NNCO",
    metaDescription:
      "AI systems for claims intake and review, underwriting support, fraud investigation and policy correspondence. The file arrives prepared; the decision stays with your people.",
    title: "Insurance",
    introduction:
      "Claims, underwriting and complaints run on documents that arrive in whatever form the customer sent them. AI reads them, extracts what the process needs and assembles the case, so the adjuster or underwriter starts from a complete file instead of an inbox.",
    sections: [
      {
        title: "AI in insurance",
        paragraphs: [
          "In insurance, AI is used to read claim and submission documents, extract structured data, check it against policy terms and prior records, assemble a case file and draft correspondence. Coverage decisions, settlement amounts, declines and underwriting acceptance stay with the people accountable for them.",
        ],
      },
      {
        title: "Claims workload",
        paragraphs: [
          "Photographs, invoices, medical reports, police records and free-text descriptions arrive in every format there is. Someone reads them, retypes the relevant parts into the claims system, checks the policy, and writes a summary. That is the bulk of the handling time, and none of it is judgement.",
        ],
      },
      {
        title: "AI-supported claims",
        items: [
          {
            title: "Claims intake and triage",
            text: "Everything that arrives with a claim is read, classified and turned into structured data in your claims system. Straightforward claims arrive complete; complex ones arrive flagged with what is missing. The adjuster decides which is which and what happens next.",
          },
          {
            title: "Claim document review",
            text: "Invoices, reports and estimates are checked against policy terms, coverage limits and the claim history, with each finding linked to the page it came from. The adjuster sees the exceptions rather than the whole stack.",
          },
          {
            title: "Underwriting support",
            text: "Submissions are read and turned into the inputs your underwriting process expects: exposures, prior losses, inconsistencies against what was declared before. The underwriter prices and accepts.",
          },
          {
            title: "Fraud investigation support",
            text: "Cases are assembled with the pattern that raised them, the related history and the supporting documents already gathered and cross-referenced. The investigator directs the investigation, and the system records what it surfaced and when.",
          },
          {
            title: "Policy and complaint correspondence",
            text: "Responses are drafted from the case record and your approved wording, with the relevant policy clauses attached. A person reviews and sends, and the record shows what was changed before it went out.",
          },
          {
            title: "Broker and partner submissions",
            text: "Submissions arriving in a hundred different formats are normalised into one structure, with the gaps identified before they reach a queue.",
          },
        ],
      },
      {
        title: "Design constraints",
        items: [
          {
            title: "EU AI Act",
            text: "Each use case is classified, and the classification drives the documentation, oversight and record-keeping the design carries. Use cases touching pricing or access to insurance get the closest look.",
          },
          {
            title: "Solvency II and supervisory expectations",
            text: "Governance, model documentation and outsourcing arrangements are handled as part of the design, not as a later filing exercise.",
          },
          {
            title: "GDPR and special categories",
            text: "Health and biometric data in claims sets the processing boundary. Purpose, minimisation and retention are settled per use case before data moves.",
          },
          {
            title: "Insurance Distribution Directive",
            text: "Customer-facing outputs stay within approved wording and remain attributable to a person.",
          },
        ],
      },
      {
        title: "Coverage and pricing authority",
        paragraphs: [
          "The system prepares the file, checks it against the policy and explains what it found. Coverage decisions, settlement amounts, declines and underwriting acceptance are made by the adjuster or underwriter, and the record shows what was in front of them.",
        ],
      },
      {
        title: "Health data boundary",
        paragraphs: [
          "Claim files routinely contain health data and other special categories, which usually rules out third-party processing. Where that applies, models and retrieval run inside your infrastructure. Where a workflow touches no such data, a hosted model is faster to deploy.",
        ],
        links: [
          { href: "/ai-first-enterprise/private-ai", label: "Private AI" },
        ],
      },
      {
        title: "Start with an audit",
        paragraphs: [
          "Two to four weeks, across claims, underwriting and customer correspondence. The output is a ranked list of what to build, what each one is worth, and where the rules allow it.",
        ],
        links: [
          { href: "/ai-first-enterprise/ai-audit", label: "AI audit" },
          {
            href: "/blog/what-goes-into-an-audit-trail-for-an-ai-workflow",
            label: "What an AI audit trail records",
          },
        ],
      },
    ],
    closing:
      "Bring the claim type with the longest handling time. We will go through what AI could take out of it, what would stay with your adjusters, and what your compliance team would need to see.",
    faqKey: "insurance",
    service: {
      name: "AI systems for insurance",
      serviceType: "AI implementation",
      description:
        "AI systems for claims intake and review, underwriting support, fraud investigation and policy correspondence.",
    },
  },
  healthcare: {
    path: "/healthcare",
    metaTitle: "AI for healthcare operations and admin | NNCO",
    metaDescription:
      "AI for administrative and operational healthcare workflows: intake and scheduling admin, documentation routing, billing preparation, capacity reporting and internal knowledge. Clinical decisions stay with clinicians.",
    title: "Healthcare",
    introduction:
      "Hospitals and providers run on paperwork that has nothing to do with clinical judgement: intake, scheduling, documentation routing, billing preparation, reporting and procurement. That is where we work, and there is more of it than most executives expect.",
    sections: [
      {
        title: "AI in healthcare operations",
        paragraphs: [
          "In healthcare, AI can take over administrative and operational work: reading and routing documents, preparing billing and coding inputs, structuring intake information, assembling reports and answering staff questions from internal procedures. Clinical diagnosis and treatment decisions are made by clinicians, and systems that make them are regulated medical devices.",
        ],
      },
      {
        title: "Administrative scope",
        paragraphs: [
          "We build systems for administrative and operational workflows. Clinical decisions stay with clinicians, and we do not build software that makes them. Where AI genuinely belongs in care, the right answer is a certified medical device from a vendor who carries that certification and the liability with it, and we integrate it for you.",
        ],
      },
      {
        title: "Administrative workload",
        paragraphs: [
          "Documentation, referrals, insurer correspondence, coding, scheduling changes and internal queries take a measurable share of a clinician's day and almost all of an administrator's. None of it requires medical judgement, and most of it is reading one document and writing another.",
        ],
      },
      {
        title: "AI-supported administration",
        items: [
          {
            title: "Intake and referral administration",
            text: "Incoming referrals, forms and correspondence are read, classified and routed to the right department with the required information already extracted and the gaps flagged. A person confirms the routing.",
          },
          {
            title: "Documentation routing and completion",
            text: "Documents arriving from other providers, insurers and patients are matched to the right record, filed and checked for missing items. Staff see what is incomplete instead of discovering it later.",
          },
          {
            title: "Billing and coding preparation",
            text: "The system prepares the coding and billing inputs from the documentation, with each item linked to the source note. A coder reviews and submits, and the record shows what was changed.",
          },
          {
            title: "Insurer correspondence",
            text: "Requests, authorisations and queries are drafted from the record and your approved wording, with the supporting documents attached. A person reviews and sends.",
          },
          {
            title: "Capacity and operational reporting",
            text: "Reports that are assembled by hand each week are built from the source systems automatically, with every figure traceable to the record it came from.",
          },
          {
            title: "Internal procedure knowledge",
            text: "Staff ask a question in plain language and get an answer from your current internal procedures, with the document and version attached. This replaces the search that ends in asking a colleague.",
          },
        ],
      },
      {
        title: "Design constraints",
        items: [
          {
            title: "Medical Device Regulation",
            text: "Systems that support a clinical decision fall under MDR. We stay outside that scope by design, and where a workflow needs it, we integrate a certified third-party device whose vendor carries the certification and the liability.",
          },
          {
            title: "EU AI Act",
            text: "Each use case is classified and the classification determines the documentation, oversight and record-keeping the design carries.",
          },
          {
            title: "GDPR and health data",
            text: "Health data is a special category. Purpose, lawful basis, minimisation, access and retention are settled per use case before data moves anywhere.",
          },
          {
            title: "Professional confidentiality",
            text: "Access follows the same rules as the underlying record system. A user sees in the AI exactly what they may see in the source system.",
          },
        ],
      },
      {
        title: "Clinical boundary",
        paragraphs: [
          "Nothing we build diagnoses, triages by clinical severity, or recommends treatment. Administrative outputs are reviewed by the person accountable for them before they leave the organisation.",
        ],
      },
      {
        title: "Health data boundary",
        paragraphs: [
          "Patient data almost always rules out third-party processing, so models and retrieval run inside your infrastructure with access inherited from your record systems. Workflows that touch no patient data, such as procurement or internal procedures, can use hosted models.",
        ],
        links: [
          { href: "/ai-first-enterprise/private-ai", label: "Private AI" },
        ],
      },
      {
        title: "Start with an audit",
        paragraphs: [
          "Two to four weeks, across intake, documentation, billing and internal operations. The output is a ranked list of what to build, what each one is worth, and where the rules allow it.",
        ],
        links: [
          { href: "/ai-first-enterprise/ai-audit", label: "AI audit" },
          {
            href: "/blog/what-goes-into-an-audit-trail-for-an-ai-workflow",
            label: "What an AI audit trail records",
          },
        ],
      },
    ],
    closing:
      "Bring the administrative process that consumes the most staff time. We will go through what AI could take out of it, where the boundary with clinical work sits, and what your data protection officer would need to see.",
    faqKey: "healthcare",
    service: {
      name: "AI for healthcare administration",
      serviceType: "AI implementation",
      description:
        "AI systems for intake, documentation routing, billing preparation, capacity reporting and internal healthcare operations.",
    },
  },
  capitalMarkets: {
    path: "/capital-markets",
    metaTitle: "AI for asset managers and funds | NNCO",
    metaDescription:
      "AI for fund and investor reporting, due diligence document review, DDQ and RFP responses, compliance monitoring and portfolio data extraction. Every figure traceable to its source.",
    title: "Capital markets and asset management",
    introduction:
      "Fund reporting, investor requests, due diligence and compliance monitoring run on documents that are read by hand and numbers that are copied between systems. AI can do the reading and the assembly, with a link from every output back to the record it came from.",
    sections: [
      {
        title: "AI in asset management",
        paragraphs: [
          "In asset management, AI is used to read fund documents, contracts and portfolio company reporting, extract structured data, assemble investor and regulatory reporting, draft responses to due diligence questionnaires, and monitor for compliance exceptions. Investment decisions and valuations stay with the people accountable for them.",
        ],
      },
      {
        title: "Reporting workload",
        paragraphs: [
          "Quarterly reporting, investor requests and DDQs consume weeks of senior time, and most of that time is spent locating a number, checking it against another source and pasting it into a template that has been filled in ten times before. The analysis is the short part.",
        ],
      },
      {
        title: "AI-supported reporting",
        items: [
          {
            title: "Fund and investor reporting",
            text: "Figures and commentary are assembled from your source systems and portfolio reporting into your templates, with every number linked back to the record it came from. The reviewer checks the exceptions and the narrative.",
          },
          {
            title: "Due diligence document review",
            text: "Data room documents are read and turned into a structured picture: contracts, obligations, dates, counterparties, inconsistencies against what was represented. The deal team directs the review and reaches the conclusions.",
          },
          {
            title: "DDQ and RFP responses",
            text: "Draft answers are assembled from your approved response library and current fund data, with the source of each answer attached. A person reviews and approves before anything goes to an investor.",
          },
          {
            title: "Portfolio company reporting",
            text: "Reporting packs arriving in every format from every company are normalised into one structure, with missing items flagged before the reporting deadline rather than after it.",
          },
          {
            title: "Compliance monitoring",
            text: "Mandates, restrictions and regulatory limits are checked continuously against the portfolio, with each exception explained in the language of the mandate rather than as a rule identifier.",
          },
          {
            title: "Internal knowledge",
            text: "Fund terms, side letters, policies and prior correspondence become searchable in the way people actually ask, with the clause and version attached.",
          },
        ],
      },
      {
        title: "Design constraints",
        items: [
          {
            title: "AIFMD and MiFID II",
            text: "Reporting, record-keeping and outsourcing arrangements are handled in the design, and outputs stay attributable to the person who approved them.",
          },
          {
            title: "SFDR",
            text: "Sustainability reporting has to be traceable to source data, which is exactly the property these systems are built to have.",
          },
          {
            title: "EU AI Act",
            text: "Each use case is classified and the classification determines the documentation and oversight the design carries.",
          },
          {
            title: "Confidentiality and MNPI",
            text: "Access follows your existing information barriers. Deal and portfolio data is segregated at the retrieval layer, not just at the interface.",
          },
        ],
      },
      {
        title: "Investment authority",
        paragraphs: [
          "Valuations, investment decisions and anything that goes to an investor are approved by the person accountable for them. The system does the assembly and shows its sources, which is also what makes the review fast.",
        ],
      },
      {
        title: "Deal data boundary",
        paragraphs: [
          "Material non-public information and investor data normally rule out third-party processing. Where that applies, models and retrieval run inside your own environment with your information barriers enforced at the retrieval layer.",
        ],
        links: [
          { href: "/ai-first-enterprise/private-ai", label: "Private AI" },
        ],
      },
      {
        title: "Start with an audit",
        paragraphs: [
          "Two to four weeks, across reporting, due diligence and compliance operations. The output is a ranked list of what to build, what each one is worth, and where the rules allow it.",
        ],
        links: [
          { href: "/ai-first-enterprise/ai-audit", label: "AI audit" },
          {
            href: "/blog/what-goes-into-an-audit-trail-for-an-ai-workflow",
            label: "What an AI audit trail records",
          },
        ],
      },
    ],
    closing:
      "Bring the reporting cycle that eats the most senior time. We will go through what AI could assemble, what would still need a reviewer, and how the sourcing would be evidenced.",
    faqKey: "capitalMarkets",
    service: {
      name: "AI systems for asset management",
      serviceType: "AI implementation",
      description:
        "AI systems for fund reporting, due diligence document review, DDQ responses and compliance monitoring.",
    },
  },
} as const satisfies Record<string, MarketingPageData>;
