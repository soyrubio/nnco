export const siteNavigation = [
  { href: "/what-we-do", label: "What We Do" },
  { href: "/company", label: "Company" },
  { href: "/news", label: "News" },
  { href: "/contact", label: "Contact" },
] as const;

export const sectors = [
  {
    name: "Banking",
    anchor: "banking",
    description:
      "Risk, compliance, KYC, internal knowledge, and secure AI infrastructure.",
  },
  {
    name: "Insurance",
    anchor: "insurance",
    description:
      "Claims, underwriting, document review, and fraud investigation.",
  },
  {
    name: "Healthcare",
    anchor: "healthcare",
    description:
      "Administrative workflows where privacy, traceability, and human oversight are mandatory.",
  },
] as const;

export const engagements = [
  {
    title: "AI Transformation",
    description:
      "Institution-wide capability building across governance, implementation, and adoption.",
  },
  {
    title: "Workflow Projects",
    description:
      "Risk, compliance, claims, KYC, underwriting, and internal-knowledge systems.",
  },
  {
    title: "On-Premise Infrastructure",
    description:
      "Private AI clusters with institutional control over data, deployment, and access.",
  },
  {
    title: "Operation",
    description:
      "Monitoring, model replacement, governance, and continued improvement after launch.",
  },
] as const;

export const workflowAreas = [
  "Risk and compliance copilots",
  "KYC and AML investigation support",
  "Claims intake and review",
  "Underwriting assistance",
  "Regulatory document analysis",
  "Internal knowledge systems",
  "Customer-service quality review",
] as const;

export const waysOfWorking = [
  {
    title: "Start from the institution",
    description:
      "The first meeting is a design-partner session. We study the workflow before proposing the system.",
  },
  {
    title: "Compliance from day one",
    description:
      "Regulatory and supervisory constraints shape the architecture, scope, and evidence model from the beginning.",
  },
  {
    title: "Deploy into reality",
    description:
      "We integrate with existing systems, permissions, data boundaries, and operating teams.",
  },
  {
    title: "Stay after launch",
    description:
      "We monitor, improve, and replace components as requirements and models change.",
  },
] as const;

export const team = [
  { name: "Marek Kříž", role: "CEO" },
  { name: "Josef Gattermayer", role: "Cofounder and advisor to CTO" },
  { name: "Dominik Veselý", role: "Founding advisor and interim COO" },
  { name: "Josef Bazal", role: "Founding product manager" },
  { name: "Lukáš Rajnoha", role: "Founding engineer" },
] as const;
