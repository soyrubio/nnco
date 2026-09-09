export const discoveryIntro = {
  brand: "NNCo.",
  title: "Opportunity Discovery",
  introduction:
    "Opportunity Discovery is a short review of your team's everyday work. It uses your answers and, if provided, public information from your company website.",
  outcome:
    "Answer a few questions to receive a report explaining what we understood, where AI might help, and what we still need to know.",
  action: "Start Discovery",
};

export const discoveryCopy = {
  website: {
    title: "What is your firm's website?",
    help: "Use your company website to prefill relevant answers. You can review and change them as you continue.",
    action: "Find company",
    placeholder: "Provide your company URL",
    skip: "Skip website",
  },
  research: {
    title: "Company information found",
    message: (name: string) => `We've prefilled some answers using public information about ${name}. Review them in the following questions and update anything that isn't correct.`,
  },
  sector: { title: "Which sector best represents your firm?" },
  questions: {
    workflow: { title: "Which processes would you like to improve?", help: "Choose up to two related processes, or describe your own." },
    friction: { title: "Where does the work slow down?", help: "Choose up to two recurring problems, or describe what happens." },
    scale: { title: "How often does this work take place?", help: "An estimate is enough." },
    systems: { title: "Which tools does your team use for this work?", help: "Select all that apply, or describe your tools below." },
    controls: { title: "Which requirements must any change meet?", help: "Select all that apply, or describe your requirements below." },
  },
  additionalContext: {
    divider: "Or add your own answer",
    placeholder: "Provide your own answer",
  },
  prefill: "Suggested from your website. Review or change the selected answers.",
  sources: "Research sources",
  buildingReport: "Building the diagnostic.",
  contact: {
    title: "What is your work email?",
    placeholder: "Provide your work email",
    help: "We will send your report to this address.",
    privacy: "By continuing, you request an AI opportunity report and an email from NNCo. to discuss the findings and how we could help.",
  },
};

export const discoveryReportCopy = {
  savePdf: "Save PDF",
  preparingPdf: "Preparing PDF",
  contact: "Contact NNCo.",
  pdfError: "The report assets could not load. Please try again.",
  title: "Opportunity Discovery",
  summary: "About this report",
  purpose: "Opportunity Discovery is a first look at where artificial intelligence (AI) might help with everyday work. This report starts with the information provided and what we understand from it. It then describes possible improvements and explores one example in more detail.",
  context: "Provided context",
  sectorOpportunities: "Sector opportunities",
  detail: "Detail",
  sources: "Public sources",
  closerLook: "One area in more detail",
  opportunities: "Potential areas for improvement",
  suitability: "What we still need to know",
  noOpportunity: "There is not enough information to identify a useful role for AI yet. The questions below explain what is missing.",
  publicContext: "Public context",
  assessment: "For a formal assessment of these areas, contact NNCo. at",
  assessmentEmail: "general@nnco.ai",
  disclaimer: "Prepared by NNCo. automated Opportunity Discovery process. Not a formal assessment.",
};
