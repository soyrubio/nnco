export type DiscoveryScreen =
  | "intro"
  | "entry"
  | "enriching"
  | "context"
  | "sector"
  | "questions"
  | "competitor"
  | "contact"
  | "analyzing"
  | "report";

export function discoveryProgress(
  screen: DiscoveryScreen,
  questionIndex: number,
  stepCount: number,
): number {
  switch (screen) {
    case "competitor":
    case "contact":
    case "analyzing":
    case "report":
      return 100;
    case "questions":
      return Math.round(((questionIndex + 1) / stepCount) * 100);
    default:
      return 0;
  }
}
