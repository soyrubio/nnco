import type {
  ModularGlyphCell,
  ModularGlyphDefinition,
  ModularGlyphSymmetry,
} from "@/lib/modular-glyph";

const defineGlyph = (
  symmetry: ModularGlyphSymmetry,
  pattern: string,
): ModularGlyphDefinition => {
  const rows = pattern.split("/");
  if (rows.length !== 4 || rows.some((row) => !/^[.#]{4}$/.test(row))) {
    throw new Error("Card glyph patterns must define a 4x4 grid.");
  }

  const cells: ModularGlyphCell[] = [];
  rows.forEach((row, rowIndex) => {
    [...row].forEach((cell, columnIndex) => {
      if (cell === "#") cells.push([columnIndex, rowIndex]);
    });
  });

  if (cells.length < 5 || cells.length > 9) {
    throw new Error("Card glyphs must contain between 5 and 9 cells.");
  }

  const cellKeys = new Set(cells.map(([column, row]) => `${column}:${row}`));
  const mirroredCell = ([column, row]: ModularGlyphCell): ModularGlyphCell => {
    switch (symmetry) {
      case "horizontal":
        return [column, 3 - row];
      case "vertical":
        return [3 - column, row];
      case "rotational":
        return [3 - column, 3 - row];
      case "diagonal":
        return [row, column];
    }
  };

  for (const cell of cells) {
    const [mirrorColumn, mirrorRow] = mirroredCell(cell);
    if (!cellKeys.has(`${mirrorColumn}:${mirrorRow}`)) {
      throw new Error(`Card glyphs must follow ${symmetry} symmetry.`);
    }
  }

  return { symmetry, cells };
};

export const cardGlyphSets = {
  commonStartingPoints: [
    defineGlyph("diagonal", ".##./##../#.../...."), // Inbound documents
    defineGlyph("diagonal", "##../###./.#../...."), // Internal knowledge
    defineGlyph("diagonal", "..#./.##./##../...."), // Reporting
    defineGlyph("vertical", "####/.##./.##./...."), // Back-office processing
    defineGlyph("vertical", "#..#/####/.##./...."), // Correspondence
  ],
  rankedBuildPlan: [
    defineGlyph("diagonal", "###./#.#./###./...."), // Opportunity map
    defineGlyph("diagonal", ".##./###./###./...."), // Ranking
    defineGlyph("vertical", "#..#/####/#..#/...."), // Constraint register
    defineGlyph("diagonal", "####/#.../#.../#..."), // Architecture direction
    defineGlyph("diagonal", "####/#.#./##../#..."), // Pilot scope
  ],
  ongoingOperation: [
    defineGlyph("diagonal", ".###/###./##../#..."), // Quality and drift
    defineGlyph("diagonal", "..##/.##./###./#..."), // Exceptions and failures
    defineGlyph("diagonal", "..../.###/.#../.#.."), // Model replacement
    defineGlyph("diagonal", "###./#.##/##../.#.."), // Evidence
    defineGlyph("diagonal", ".##./####/##../.#.."), // Process and regulation changes
  ],
  bankingWorkloads: [
    defineGlyph("diagonal", ".#../####/.##./.#.."), // Onboarding and KYC
    defineGlyph("diagonal", "..#./..##/###./.#.."), // Periodic review
    defineGlyph("rotational", "..#./###./.###/.#.."), // Transaction-monitoring triage
    defineGlyph("diagonal", "####/#..#/#.../##.."), // Credit-file preparation
    defineGlyph("diagonal", ".#.#/####/.#../##.."), // Regulatory-reporting checks
    defineGlyph("rotational", "..##/.##./.##./##.."), // Policy and product knowledge
  ],
  insuranceWorkloads: [
    defineGlyph("diagonal", "..##/..##/###./##.."), // Claims intake and triage
    defineGlyph("rotational", ".#../.###/###./..#."), // Claim-document review
    defineGlyph("rotational", ".#../###./.###/..#."), // Underwriting support
    defineGlyph("diagonal", "..#./..#./####/..#."), // Fraud-investigation support
    defineGlyph("diagonal", "..#./.##./####/..#."), // Policy correspondence
    defineGlyph("vertical", "..../####/.##./.##."), // Broker submissions
  ],
  healthcareWorkloads: [
    defineGlyph("diagonal", "..#./.###/##.#/.##."), // Intake and referral administration
    defineGlyph("diagonal", "..../..##/.###/.##."), // Documentation routing
    defineGlyph("vertical", "..../.##./####/.##."), // Billing and coding
    defineGlyph("horizontal", "###./#.../#.../###."), // Insurer correspondence
    defineGlyph("diagonal", "...#/.###/.#.#/###."), // Capacity reporting
    defineGlyph("diagonal", "...#/..##/.###/###."), // Procedure knowledge
  ],
  capitalMarketsWorkloads: [
    defineGlyph("horizontal", "...#/.###/.###/...#"), // Fund and investor reporting
    defineGlyph("vertical", "..../#..#/####/#..#"), // Due-diligence review
    defineGlyph("diagonal", "..../..#./.###/..##"), // DDQ and RFP responses
    defineGlyph("diagonal", "..#./..#./####/..##"), // Portfolio-company reporting
    defineGlyph("horizontal", ".###/.#../.#../.###"), // Compliance monitoring
    defineGlyph("horizontal", ".###/...#/...#/.###"), // Internal knowledge
  ],
  companyWaysOfWorking: [
    defineGlyph("diagonal", "..#./..##/##.#/.###"), // Audit before proposal
    defineGlyph("diagonal", "..../.###/.###/.###"), // Constraints shape architecture
    defineGlyph("diagonal", "...#/...#/...#/####"), // Stay after launch
    defineGlyph("diagonal", "...#/..##/.#.#/####"), // Say when not to build
  ],
} as const satisfies Record<string, readonly ModularGlyphDefinition[]>;
