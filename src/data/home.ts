import { homeBuildGlyphs } from "./glyphs.ts";

export const homeBuildItems = [
  {
    title: "Agents that run whole workflows",
    description:
      "An agent takes a process end to end: onboarding checks, document review, preparing a case for a human decision. It works inside your systems, not next to them.",
    glyph: homeBuildGlyphs[0],
  },
  {
    title: "Documents and case files",
    description:
      "It reads contracts, statements and case files, pulls out the data and drafts the output. This is the work whole departments sit on today.",
    glyph: homeBuildGlyphs[1],
  },
  {
    title: "Data that sits unused",
    description:
      "Data your teams never had time to use becomes an answer in seconds, with a link back to the record it came from.",
    glyph: homeBuildGlyphs[2],
  },
] as const;
