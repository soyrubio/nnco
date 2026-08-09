export interface PostLink {
  paragraph: number;
  text: string;
  href: string;
}

export interface PostSection {
  heading: string;
  paragraphs: string[];
  links?: PostLink[];
}

export interface Post {
  slug: string;
  title: string;
  category: "Systems" | "Field notes" | "Regulation" | "Principles";
  author: string;
  readingMinutes: number;
  publishedAt: string;
  updatedAt: string;
  publishedLabel: string;
  summary: string;
  keyStatement: string;
  introduction: string[];
  sections: PostSection[];
  relatedSlug?: string;
}

export const posts: Post[] = [
  {
    slug: "what-goes-into-an-audit-trail-for-an-ai-workflow",
    title: "What goes into an audit trail for an AI workflow",
    category: "Systems",
    author: "Marek Kříž",
    readingMinutes: 7,
    publishedAt: "2026-08-06",
    updatedAt: "2026-08-09",
    publishedLabel: "6 August 2026",
    summary:
      "An audit trail for an AI workflow must reconstruct a decision as it stood when it was made, using only the evidence retained with the case.",
    keyStatement:
      "An audit trail has to let someone reconstruct the decision as it stood at the moment it was made, using only the record.",
    introduction: [
      "The question always arrives in the same form: show me why the system did that, for this case, on this date. Sometimes it comes from an internal auditor, sometimes from a supervisor, occasionally from a customer's lawyer. It is never a general question about the model. It is always about one case, months after the fact.",
      "Most teams answer it by pulling up a conversation log. The prompt is there, the response is there, and the timestamp is there. It is not enough, and the reason it is not enough is worth being precise about. A conversation log tells you what was said. An audit trail has to let someone reconstruct the decision as it stood at the moment it was made, using only the record.",
      "Those are different requirements, and the second one is the one you get asked about.",
    ],
    sections: [
      {
        heading: "Reconstructing a decision",
        paragraphs: [
          "Take a straightforward case. An onboarding file comes in, the system reads the incorporation documents, checks the ownership structure against a register, assembles the file and puts it in front of an analyst. The analyst approves it. Eleven months later, someone wants to know why.",
          "To answer that from the record, you need seven things.",
          "The inputs as they arrived, not as they exist now. The document may have been superseded, the register entry may have been updated, the customer record may have been edited twice since. What matters is what the system was looking at.",
          "The sources it retrieved, with versions. If the system applied a policy, you need to know which version of that policy it read, not which version is current. This is where most retrieval systems are weakest, because they index documents without treating the version as part of the identity of the document.",
          "The model and its configuration. Which model, which version, what temperature, what system instruction, what tools it was allowed to call. Model providers deprecate and silently update. If your record says only that a decision came from a model, you have recorded almost nothing.",
          "The output, in full, including the parts nobody looked at.",
          "The human action. Who saw it, what they saw, what they did, and how long it took. If the analyst edited the summary before approving, both versions belong in the record. The gap between what the system proposed and what the person approved is often the most interesting line in the whole trail.",
          "The exception path, when there was one. What failed, what was retried, what a person did about it. Systems get reviewed on their bad days.",
          "The component versions of everything above, so that if the same case is replayed later, you can tell whether a difference in the outcome is a difference in the case or a difference in the system.",
        ],
      },
      {
        heading: "Everything is not the same as enough",
        paragraphs: [
          "The first instinct after reading a list like that is to log everything. We have had that instinct and acted on it, and it was the wrong call in both directions.",
          "Logging every event produces a volume nobody can search, which means that when the question comes, the answer takes three days of engineering time instead of five minutes of an analyst's. It also creates a second copy of sensitive data with its own classification, its own retention obligation and its own access problem. An audit trail that a supervisor cannot be shown because it contains more than the case file did is a liability wearing the costume of a control.",
          "The useful frame is narrower. Decide which steps are consequential, meaning a person could reasonably be asked to defend them, and record those completely. Record everything else at the level you would need to debug, with a shorter retention. The line moves per use case, and it is a design decision made before the logging is configured.",
        ],
      },
      {
        heading: "Where the trail lives",
        paragraphs: [
          "The second mistake is more expensive and less visible. The trail gets stored wherever the AI platform stores it, which is usually the vendor's system.",
          "That works until you change vendors, or the vendor changes its retention policy, or you need to hand the record to someone who is not going to be given a login. Evidence about your cases belongs in your systems, under your retention rules, reachable by your case identifier. The AI platform is a component. Components get replaced, and the record of what happened to a customer eleven months ago should not be replaced with them.",
          "Practically this means the workflow writes its trail to your storage as it goes, keyed to the case, rather than the platform accumulating it and exposing an export.",
        ],
        links: [
          {
            paragraph: 2,
            text: "writes its trail to your storage",
            href: "/ai-first-enterprise/private-ai",
          },
        ],
      },
      {
        heading: "Process documentation is not case evidence",
        paragraphs: [
          "The third mistake is the one that survives longest, because it looks like the work is done.",
          "An organisation writes a thorough description of how the AI workflow operates, gets it approved, and files it. Then the question comes about one case, and the description cannot answer it, because a description of how something normally works is not evidence about a specific instance.",
          "Both are needed. The description explains the design and the controls. The trail answers the question about case 4471. When an audit goes badly, it is usually because the organisation had the first one and assumed it covered the second.",
        ],
      },
      {
        heading: "What this costs if you leave it",
        paragraphs: [
          "Building this into the design costs a modest amount, mostly in deciding what counts as consequential and in wiring storage that is not the vendor's. Adding it after a system is live costs considerably more, because the interesting parts are the ones that were never captured. You cannot reconstruct the version of a policy the system read six months ago if you never recorded that it read a version at all.",
          "The uncomfortable part is that nothing about this shows up in a pilot. A pilot is judged on whether the output is good, and the output is good. The trail matters at the point where the system stops being an experiment and starts being something a person has to defend, and by then the design decisions have already been made.",
          "That is the argument for settling it in week one, when it is a conversation, rather than in month eight, when it is a rebuild.",
        ],
        links: [
          {
            paragraph: 2,
            text: "settling it in week one",
            href: "/ai-first-enterprise/ai-audit",
          },
        ],
      },
    ],
    relatedSlug: "where-human-review-belongs-in-an-ai-workflow",
  },
  {
    slug: "where-human-review-belongs-in-an-ai-workflow",
    title: "Where human review belongs in an AI workflow",
    category: "Principles",
    author: "Dominik Veselý",
    readingMinutes: 6,
    publishedAt: "2026-07-24",
    updatedAt: "2026-07-24",
    publishedLabel: "24 July 2026",
    summary:
      "Human review works only when the reviewer can inspect the evidence, understand the system's reasoning and change the outcome before it matters.",
    keyStatement:
      "A human in the loop is a control only when that person has enough context, authority and time to disagree with the system.",
    introduction: [
      "Human review is the standard answer to almost every concern about an AI workflow. If the model is uncertain, a person will check it. If the case is sensitive, a person will approve it. If something goes wrong, a person remains accountable.",
      "That answer sounds responsible, but it leaves out the design of the review itself. A person who sees only the model's conclusion, has no access to the underlying evidence and is expected to clear a queue at machine speed is not providing meaningful oversight. They are confirming the system by default.",
      "The useful question is not whether a human appears somewhere in the process. It is where review happens, what the reviewer can see and whether their decision can still change the outcome.",
    ],
    sections: [
      {
        heading: "Review before the consequence",
        paragraphs: [
          "The strongest review point sits immediately before an action that is difficult to reverse. That might be sending a customer communication, escalating a case, changing a risk classification or moving a file into a formal decision path.",
          "Review placed several steps earlier is often bypassed by later automation. Review placed after the action becomes quality assurance rather than a control. Both can be useful, but they solve different problems and should not be described as the same safeguard.",
          "For each workflow, mark the consequential actions first. Then decide which can proceed automatically, which need review under defined conditions and which should always remain with a person.",
        ],
      },
      {
        heading: "The reviewer needs the decision context",
        paragraphs: [
          "A useful review screen contains the source material, the relevant policy, the system's proposed action and the reason the case reached a person. It should distinguish retrieved facts from model-generated interpretation.",
          "Showing a polished summary without its sources makes the work faster, but it also makes disagreement harder. The reviewer has to be able to move from the proposal back to the evidence without opening another system and reconstructing the case from scratch.",
          "The interface should also preserve edits and overrides. Those differences reveal where the system is weak, where policy is ambiguous and where automation should be narrowed.",
        ],
      },
      {
        heading: "Authority matters more than presence",
        paragraphs: [
          "A reviewer needs explicit authority to stop, change or redirect the workflow. If every override creates a delay that the team is penalised for, the practical instruction is to accept the recommendation.",
          "Track how often reviewers change outcomes, which reasons they give and whether certain case types produce repeated corrections. A review step with no disagreement may indicate excellent automation. It may also indicate a control that exists only on paper.",
          "Human oversight becomes credible when the organisation can show what the reviewer saw, what they decided and what changed because they were there.",
        ],
      },
    ],
    relatedSlug: "private-ai-starts-with-the-data-boundary",
  },
  {
    slug: "private-ai-starts-with-the-data-boundary",
    title: "Private AI starts with the data boundary",
    category: "Systems",
    author: "Josef Gattermayer",
    readingMinutes: 8,
    publishedAt: "2026-07-10",
    updatedAt: "2026-07-10",
    publishedLabel: "10 July 2026",
    summary:
      "Private AI is an architecture decision about where data travels, where models execute and who can operate the system, not a label attached to a model.",
    keyStatement:
      "Choose the data boundary before choosing the model, because the boundary determines which models and operating patterns are actually available.",
    introduction: [
      "Private AI is often discussed as a model choice. Run an open model, place it on dedicated infrastructure and the privacy problem is considered solved. That can be part of the answer, but it starts too late in the architecture.",
      "The boundary has to cover the complete path of the case: source systems, document processing, retrieval, model execution, logs, monitoring and the people who operate each component. Data can remain private during inference and still leave through telemetry, support tooling or an exported trace.",
      "The first design decision is therefore not which model to deploy. It is which data may cross which boundary, for what purpose and under whose control.",
    ],
    sections: [
      {
        heading: "Draw the boundary around the workflow",
        paragraphs: [
          "Start with the data classes the workflow touches and the systems that currently hold them. Mark where each document, field and derived output is allowed to travel. Include temporary stores, queues, vector indexes and logs, because these are common places for a clean architecture diagram to become an untidy production system.",
          "The answer may differ by step. A hosted model may be acceptable for public policy text while customer documents remain inside controlled infrastructure. Treating the whole workflow as either public or private usually produces unnecessary cost or an unacceptable exposure.",
          "A per-step boundary makes hybrid designs possible without hiding the transfer points. Each transfer can then have an explicit purpose, retention rule and owner.",
        ],
      },
      {
        heading: "Model hosting is only one component",
        paragraphs: [
          "A privately hosted model still depends on surrounding services. Documents are parsed, text is embedded, context is retrieved, prompts are assembled and outputs are inspected. Any one of those services can become the point where protected data crosses the intended boundary.",
          "The system also needs identity, access control and case-level isolation. A model endpoint that is private at the network level but accepts broad internal access does not meet the needs of a workflow where teams, regions or legal entities must remain separated.",
          "Architecture review should follow a representative case through every component, including failures and retries. The exception path often uses different tooling from the normal path and deserves the same scrutiny.",
        ],
      },
      {
        heading: "Operations determine whether privacy lasts",
        paragraphs: [
          "The boundary has to survive model updates, incident response, debugging and vendor support. If an engineer must copy production content into an external tool to understand a failure, the operating model has already broken the design.",
          "Keep the evidence needed for debugging inside the same control environment. Define who can inspect it, how access is approved and how long it remains available. Test model replacement without moving the underlying case record.",
          "Private AI is durable when privacy is expressed through the system's normal operating procedures, not through an instruction that everyone must remember during an incident.",
        ],
      },
    ],
    relatedSlug: "what-goes-into-an-audit-trail-for-an-ai-workflow",
  },
];

export function getPost(slug: string): Post | undefined {
  return posts.find((post) => post.slug === slug);
}
