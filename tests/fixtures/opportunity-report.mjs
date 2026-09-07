export function opportunityReportFixture(companyName = "Example Insurance") {
  return {
    providedContext: `${companyName} describes document review across email and files. Staff review cases daily and require approval for material decisions.`,
    sectorOpportunities: "In insurance, AI could help compare case documents with stated requirements. It could highlight an absent explanation or bring related passages together for review.",
    areasIntro: "These possibilities concern the document review described in the supplied answers.",
    areas: [
      { name: "Finding missing information", explanation: "AI could compare the documents in a case with its stated requirements. It could identify a missing explanation and show what the requirement asks for." },
      { name: "Comparing case descriptions", explanation: "AI could compare descriptions across supplied documents and highlight different dates or accounts. A reviewer could then examine those differences before reaching a decision." },
    ],
    detail: {
      areaName: "Finding missing information",
      paragraphs: [
        "In a hypothetical case, a requirement asks for the event date and the supplied statement gives only the reporting date. These details are assumptions.",
        "AI could identify the unanswered date question and quote the relevant requirement. This would show the reviewer exactly which information needs clarification.",
        "A differently worded date elsewhere in the case could change this result. The reviewer would need to check the original documents before confirming a gap.",
      ],
    },
  };
}
