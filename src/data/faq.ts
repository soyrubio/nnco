export interface FaqItem {
  question: string;
  answer: string;
}

export const faqByPage = {
  home: [
    {
      question: "What does NNCO do?",
      answer:
        "NNCO is an AI consulting and development company. We design, integrate and operate AI systems for large institutions, starting with an AI audit and ending with a system running in production and supported after launch.",
    },
    {
      question: "How does an engagement start?",
      answer:
        "Every engagement starts with an AI audit. We go through your operations and return a map of where AI is worth building, in what order, and what each use case is worth. The first use case goes into a pilot on real data.",
    },
    {
      question: "Which industries does NNCO work in?",
      answer:
        "Banking, insurance, healthcare and capital markets. These are sectors where AI has to work inside strict data and supervisory constraints, which is the part most implementations get wrong.",
    },
    {
      question: "Can the AI run inside our own infrastructure?",
      answer:
        "Yes. Models, retrieval, access control and monitoring can be deployed on-premise or in a private environment you govern, so that data never leaves your network. We do this when data residency or regulation requires it.",
    },
    {
      question: "Do you publish client names or case studies?",
      answer:
        "No. Client names, logos and case studies are not published by default. A named reference exists only when a client decides to speak about the work themselves.",
    },
    {
      question: "Where is NNCO based?",
      answer:
        "NNCO is based in Prague and works with institutions across the European Union. Engagements run in Czech, Slovak and English.",
    },
  ],
  programme: [
    {
      question: "What does an AI programme in a large company involve?",
      answer:
        "Four phases: an audit that ranks which workflows AI can take over, a first use case taken into production on real data, further use cases reusing the same infrastructure, and ongoing operation after launch. The audit decides the sequence; the first use case decides whether the organisation can actually run these systems.",
    },
    {
      question: "How long does it take?",
      answer:
        "The audit takes two to four weeks. A first use case typically runs as a pilot within a quarter of the audit closing, depending on system access and data readiness.",
    },
    {
      question: "Do you build custom AI or integrate existing tools?",
      answer:
        "Both. Where a certified or established product already covers the workflow, we integrate it and configure it around your constraints. Where nothing fits, we build it. The audit says which of the two applies to each use case.",
    },
    {
      question: "Which models do you use?",
      answer:
        "Whichever fits the constraint. Hosted frontier models where the data allows it, open models running inside your own infrastructure where it does not. Models are replaceable components, and we design systems so that swapping one does not mean rebuilding the workflow.",
    },
    {
      question: "Our sector is not on your list. Does this apply to us?",
      answer:
        "Probably, if the work is high volume, document heavy and has to be attributable. The sector pages exist because those four sectors have rules specific enough to name, not because the programme is limited to them.",
    },
  ],
  aiAudit: [
    {
      question: "What is an AI audit?",
      answer:
        "An AI audit is a structured review of an organisation's operations that identifies which workflows AI can take over, ranks them by value and feasibility, and records the data, security and regulatory constraints each one must satisfy. The output is a ranked build plan and a scoped first pilot.",
    },
    {
      question: "How long does an AI audit take?",
      answer:
        "Two to four weeks, depending on the size of the operation and how many systems are in scope. The result is presented in a working session, not sent as a deck.",
    },
    {
      question: "How is this different from an AI readiness assessment?",
      answer:
        "A readiness assessment usually produces a maturity score and a set of recommendations. This audit produces a ranked list of workflows, the constraints on each one, and a first use case scoped tightly enough to start building.",
    },
    {
      question: "Do you need access to our production data?",
      answer:
        "No. The audit works from interviews, process observation, system documentation and samples. Access to live data comes later, at the pilot, under whatever controls your security team requires.",
    },
    {
      question: "Does the audit cover the EU AI Act?",
      answer:
        "It classifies each candidate use case under the EU AI Act and records what that classification requires in terms of documentation, human oversight and evidence. It is not a legal opinion, and it is written to be usable by your legal and compliance teams rather than to replace them.",
    },
    {
      question: "What happens if the audit finds nothing worth building?",
      answer:
        "We say so. It is a rarer outcome than it sounds, but a plan with three ranked use cases and a reason to stop at three is more useful than a plan with fifteen.",
    },
  ],
  privateAi: [
    {
      question: "Can AI run entirely on our own infrastructure?",
      answer:
        "Yes. Open-weight models, the retrieval layer, access control, logging and monitoring can all run inside your data centre or a dedicated tenancy, with no external call in the path of a decision. The main trade-offs are hardware cost and who operates the platform.",
    },
    {
      question: "Which models can be deployed on-premise?",
      answer:
        "Open-weight models, sized to the workflow and the hardware available. Frontier hosted models cannot be deployed on-premise, so where a workflow genuinely needs one, either the data has to allow a hosted call or the workflow has to be redesigned.",
    },
    {
      question: "Does on-premise deployment make us compliant?",
      answer:
        "No. It resolves questions about where data is processed and who can reach it. Obligations around documentation, human oversight, evidence and monitoring apply regardless of where the model runs.",
    },
    {
      question: "What hardware does this need?",
      answer:
        "It depends on the model size, the number of concurrent users and the response time the workflow needs. The AI audit produces a sizing estimate before anything is procured, and in many cases the first pilot runs on far less than institutions expect.",
    },
    {
      question: "Can we start hosted and move on-premise later?",
      answer:
        "Yes, if the workflow is designed for it from the start: the model behind an interface, the retrieval layer independent of the provider, and evidence stored in your systems rather than the vendor's. Retrofitting that after launch is where it becomes expensive.",
    },
  ],
  operation: [
    {
      question: "What happens after an AI system goes live?",
      answer:
        "It needs monitoring for quality and drift, an owner for exceptions and failures, periodic model replacement, and adjustment when the process or the regulation changes. Without that, output quality degrades and users quietly stop relying on it.",
    },
    {
      question: "Can our own team operate it?",
      answer:
        "Yes. We hand over runbooks, acceptance criteria, monitoring and training. The important part is that the ownership is decided before launch rather than after.",
    },
    {
      question: "How often do models need replacing?",
      answer:
        "More often than most procurement cycles expect. Because we keep the model behind an interface, a replacement is a change to one component tested against existing acceptance criteria, rather than a rebuild of the workflow.",
    },
  ],
  banking: [
    {
      question: "How is AI used in KYC and onboarding?",
      answer:
        "AI reads incorporation documents, ownership structures and identity records, extracts the entities and relationships, runs them against registers and screening tools, and assembles a complete case file with sources attached. The analyst reviews the file and makes the decision, and the system records what it presented.",
    },
    {
      question: "Can AI make credit or sanctions decisions?",
      answer:
        "It should not, and we do not build it that way. Those decisions have to be attributable to an accountable person. AI prepares the case, checks it and explains the exceptions, which is where the time goes anyway.",
    },
    {
      question: "Does this satisfy our auditors and supervisor?",
      answer:
        "No system satisfies an auditor by itself, and nobody can promise you a supervisory outcome. What we build is designed so that a question about a specific case can be answered from the record: the inputs, the sources retrieved, the output, the person who acted and the version of every component involved.",
    },
    {
      question: "Can customer data leave the bank?",
      answer:
        "Usually not, and we design for that. Models and retrieval run inside your infrastructure where classification or residency requires it, with no external call in the path of a decision.",
    },
    {
      question: "How does the EU AI Act affect these use cases?",
      answer:
        "It depends on the use case. Systems that prepare a case for a human decision carry different obligations from systems that decide. The AI audit classifies each candidate use case and records what the classification requires, so the compliance work is scoped before the build starts rather than discovered after it.",
    },
  ],
  insurance: [
    {
      question: "How is AI used in claims processing?",
      answer:
        "AI reads everything that arrives with a claim - invoices, reports, photographs, free text - extracts the structured data, checks it against policy terms and claim history, and assembles a complete case file with sources attached. The adjuster reviews the prepared file and decides coverage and settlement.",
    },
    {
      question: "Can AI decide whether to pay a claim?",
      answer:
        "It should not, and we do not build it that way. The system prepares the file and explains the exceptions it found. Coverage, settlement and declines stay with the adjuster, and the record shows what was presented at the time of the decision.",
    },
    {
      question: "What about health data in claim files?",
      answer:
        "Health data is a special category under GDPR and normally sets the processing boundary for the whole workflow. In practice this means models and retrieval run inside your own infrastructure, with access inherited from your claims system and retention following your policy.",
    },
    {
      question: "Can AI help with fraud detection?",
      answer:
        "It can assemble the case: the pattern that raised the alert, the related history and the supporting documents, cross-referenced and summarised with sources. The investigation and the conclusion stay with the investigator, which is also what keeps the output usable in a later dispute.",
    },
    {
      question: "How long before something is running?",
      answer:
        "A first use case typically runs as a pilot on real claims within a quarter of the audit closing, depending on system access and data readiness. Claims intake is usually the fastest to reach production because the input is already digital.",
    },
  ],
  healthcare: [
    {
      question: "Does NNCO build clinical AI?",
      answer:
        "No. We build AI for administrative and operational healthcare workflows. Clinical diagnosis and treatment decisions stay with clinicians, and software that makes them is a regulated medical device under MDR. Where a workflow genuinely needs one, we integrate a certified third-party device rather than building our own.",
    },
    {
      question: "What administrative workflows can AI take over in a hospital?",
      answer:
        "Intake and referral routing, documentation matching and completion checks, billing and coding preparation, insurer correspondence, operational reporting and internal procedure knowledge. These consume a large share of administrative time and require no medical judgement.",
    },
    {
      question: "Can patient data be used safely?",
      answer:
        "Health data is a special category under GDPR, so in practice models and retrieval run inside your own infrastructure, with access inherited from your record systems and retention following your policy. The processing boundary is settled per use case before anything is built.",
    },
    {
      question: "Why avoid clinical use cases entirely?",
      answer:
        "Because a system that supports a clinical decision is a medical device, and the certification, conformity assessment and liability that come with it belong to a manufacturer, not to an implementation partner. Being clear about that boundary is what lets us move quickly on everything else.",
    },
    {
      question: "Do you work with public hospitals?",
      answer:
        "Yes, and the constraints are usually procurement rather than technology. The audit covers what a public procurement route would require before anything is committed.",
    },
  ],
  capitalMarkets: [
    {
      question: "How is AI used in fund reporting?",
      answer:
        "AI assembles figures and commentary from source systems and portfolio company reporting into your templates, with every number linked back to the record it came from. A reviewer checks the exceptions and the narrative rather than rebuilding the pack by hand.",
    },
    {
      question: "Can AI review a data room?",
      answer:
        "It can read the documents and turn them into a structured picture: obligations, dates, counterparties and inconsistencies against what was represented, each linked to the page it came from. The deal team directs the review and draws the conclusions.",
    },
    {
      question: "Does AI make investment decisions?",
      answer:
        "No. We build systems that assemble, check and evidence. Valuations and investment decisions stay with the people accountable for them.",
    },
    {
      question: "How do you handle information barriers?",
      answer:
        "Access is enforced at the retrieval layer, not at the interface, so a user's AI can only reach documents they are permitted to see in the source system. Deal data is segregated on the same basis as the rest of your estate.",
    },
  ],
  company: [
    {
      question: "What kind of company is NNCO?",
      answer:
        "NNCO is an AI consulting and development company. It designs, integrates and operates AI systems for large institutions, covering the whole arc from an initial AI audit to running the system in production.",
    },
    {
      question: "Who founded NNCO?",
      answer:
        "NNCO was founded by a team that previously built and ran software businesses and a regulated fintech: Marek Kříž, Dominik Veselý and Josef Gattermayer, with Josef Bazal and Lukáš Rajnoha as founding members.",
    },
    {
      question: "How big is NNCO?",
      answer:
        "Small and deliberately so. Engagements are run by the people listed on this page rather than staffed out to a bench.",
    },
    {
      question: "Why does NNCO not show client references?",
      answer:
        "Because our clients are institutions where supplier relationships and internal projects are not discussed publicly. Client names, logos and case studies are not published by default, and a named reference exists only when a client decides to speak about the work themselves.",
    },
  ],
  contact: [
    {
      question: "What happens on the first call?",
      answer:
        "Thirty minutes, no slides. You describe the workflow and where it stalls, we tell you what AI could take out of it, what would stay with your people, and whether an AI audit is the right next step. If it is not something we should build, we say so.",
    },
    {
      question: "Do we need to sign an NDA first?",
      answer:
        "Not for the first call. We can sign a mutual NDA before it if what you are working on is sensitive, and we always sign one before an audit begins.",
    },
    {
      question: "How quickly do you reply?",
      answer: "Within one business day.",
    },
  ],
} as const satisfies Record<string, readonly FaqItem[]>;

export type FaqPageKey = keyof typeof faqByPage;
