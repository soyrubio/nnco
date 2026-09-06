interface NavigationLink {
  href: string;
  label: string;
  description?: string;
}

interface NavigationMenu {
  label: string;
  links: readonly NavigationLink[];
}

type NavigationItem = NavigationLink | NavigationMenu;

export const programmeLinks = [
  {
    href: "/ai-first-enterprise",
    label: "AI-First Enterprise",
    description: "The programme, from audit to operation.",
  },
  {
    href: "/ai-first-enterprise/ai-audit",
    label: "AI Audit",
    description: "Find where AI is worth building first.",
  },
  {
    href: "/ai-first-enterprise/private-ai",
    label: "Private AI",
    description: "Your models, inside your boundary.",
  },
  {
    href: "/ai-first-enterprise/operation",
    label: "Operation",
    description: "Someone has to own it after launch.",
  },
] as const;

export const sectors = [
  {
    name: "Banking",
    shortName: "Banking",
    href: "/banking",
    description:
      "Onboarding and KYC, transaction monitoring, credit files, regulatory reporting.",
  },
  {
    name: "Insurance",
    shortName: "Insurance",
    href: "/insurance",
    description:
      "Claims intake and review, underwriting support, fraud investigation, policy correspondence.",
  },
  {
    name: "Healthcare",
    shortName: "Healthcare",
    href: "/healthcare",
    description:
      "Administrative and operational workflows. Clinical decisions stay with clinicians.",
  },
  {
    name: "Capital Markets & Asset Management",
    shortName: "Capital Markets",
    href: "/capital-markets",
    description:
      "Fund reporting, due diligence document review, investor reporting, compliance monitoring.",
  },
] as const;

export const siteNavigation: readonly NavigationItem[] = [
  {
    label: "AI-First Enterprise",
    links: programmeLinks,
  },
  {
    label: "Industries",
    links: sectors.map(({ href, shortName, description }) => ({
      href,
      label: shortName,
      description,
    })),
  },
  { href: "/company", label: "Company" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
] as const;

export const footerGroups = [
  {
    label: "Company",
    links: [
      { href: "/company", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/privacy", label: "Privacy" },
      { href: "/security", label: "Security" },
    ],
  },
  { label: "Programme", links: programmeLinks },
  {
    label: "Industries",
    links: sectors.map(({ href, shortName }) => ({
      href,
      label: shortName,
    })),
  },
  {
    label: "Contact",
    links: [
      { href: "/contact", label: "Book a call" },
      { href: "/discovery", label: "Start the diagnostic" },
      { href: "mailto:general@nnco.ai", label: "general@nnco.ai" },
    ],
  },
] as const;

export const waysOfWorking = [
  {
    title: "The audit comes before the proposal",
    description:
      "We do not scope a build from a first meeting. The audit looks at how the work runs today, who touches it, where the exceptions go, and what the constraints actually are. Then we propose.",
  },
  {
    title: "Constraints shape the architecture",
    description:
      "Data classification, residency, access rights, retention, supervisory expectations and audit requirements are inputs to the design. Retrofitting them after the build has started is what kills pilots.",
  },
  {
    title: "We stay after launch",
    description:
      "Monitoring, drift, model replacement, and changes when the regulation or the process changes. A system with no owner degrades quietly until people stop trusting it.",
  },
  {
    title: "We say when something is not worth building",
    description:
      "Some workflows are not worth automating, and some are not allowed to be. Hearing that in week two of an audit is cheaper than hearing it in month six of a build.",
  },
] as const;

export const team = [
  {
    name: "Marek Kříž",
    role: "Co-Founder & CEO",
    bio: "Founder, CEO or CGO at Investown and Zaloto, and at the software house Devx. Most of that decade was spent inside licensed financial businesses, which is where the questions a supervisor actually asks stop being theoretical.",
    image: "/assets/team/marek-kriz-reframed.png",
  },
  {
    name: "Dominik Veselý",
    role: "Co-Founder & COO",
    bio: "COO at the software house Ackee, which was sold to Expandia. Ran delivery for a company whose clients were banks, insurers and public institutions, where the deployment is the product.",
    image: "/assets/team/dominik-vesely-reframed.png",
  },
  {
    name: "Josef Gattermayer",
    role: "Co-Founder, AI & R&D consultant",
    bio: "CTO at Ackee, then founder of Ackee Blockchain, a security audit firm. Audit work is the discipline of proving that a system does what it claims, which is the same discipline an AI system needs before a regulator looks at it.",
    image: "/assets/team/josef-gattermayer-reframed.png",
  },
  {
    name: "Josef Bazal",
    role: "Co-Founder, Product & Delivery consultant",
    bio: "Turns complex business and operational problems into clear direction. Connects client needs, user workflows and delivery so that AI systems solve real problems and work in everyday practice.",
    image: "/assets/team/josef-bazal-reframed.png",
  },
  {
    name: "Lukáš Rajnoha",
    role: "Co-Founder, Technical consultant",
    bio: "Previously a security engineer at Ackee Blockchain, securing high-value DeFi protocols and building a top-performing AI security analysis system for automated code security analysis. Now helps build AI systems end to end, from architecture and infrastructure to production.",
    image: "/assets/team/lukas-rajnoha-reframed.png",
  },
] as const;
