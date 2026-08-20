import { glyphLibrary } from "./glyph-references.ts";
import {
  hasGlyphSymmetry,
  sortGlyphCells,
  type GlyphCell,
  type GlyphSymmetry,
} from "../lib/glyph-generator.ts";
import type { ModularGlyphDefinition } from "../lib/modular-glyph.ts";

type GlyphTransform = (
  cell: GlyphCell,
  lastIndex: number,
) => GlyphCell;

const transforms: readonly GlyphTransform[] = [
  ([column, row]) => [column, row],
  ([column, row], lastIndex) => [lastIndex - row, column],
  ([column, row], lastIndex) => [lastIndex - column, lastIndex - row],
  ([column, row], lastIndex) => [row, lastIndex - column],
  ([column, row], lastIndex) => [lastIndex - column, row],
  ([column, row], lastIndex) => [column, lastIndex - row],
  ([column, row]) => [row, column],
  ([column, row], lastIndex) => [lastIndex - row, lastIndex - column],
];

const libraryById = new Map(glyphLibrary.map((glyph) => [glyph.id, glyph]));
const allocatedSignatures = new Set<string>();
const supportedSymmetries: readonly GlyphSymmetry[] = [
  "horizontal",
  "vertical",
  "rotational",
  "diagonal",
];

const glyphSignature = (gridSize: number, cells: readonly GlyphCell[]) =>
  `${gridSize}:${cells.map(([column, row]) => `${column}:${row}`).join("|")}`;

const allocateLibraryGlyph = (
  ...preferredIds: readonly string[]
): ModularGlyphDefinition => {
  const candidateIds = [
    ...new Set([...preferredIds, ...glyphLibrary.map((glyph) => glyph.id)]),
  ];

  for (const id of candidateIds) {
    const source = libraryById.get(id);
    if (!source) throw new Error(`Unknown library glyph ${id}.`);

    for (const transform of transforms) {
      const cells = sortGlyphCells(
        source.cells.map((cell) => transform(cell, source.gridSize - 1)),
      );
      const signature = glyphSignature(source.gridSize, cells);
      if (allocatedSignatures.has(signature)) continue;

      allocatedSignatures.add(signature);
      const symmetry =
        supportedSymmetries.find((candidate) =>
          hasGlyphSymmetry(
            { gridSize: source.gridSize, cells },
            candidate,
          ),
        ) ?? "none";
      return {
        libraryId: source.id,
        gridSize: source.gridSize,
        cells,
        symmetry,
      };
    }
  }

  throw new Error("The glyph library does not contain enough unique variants.");
};

export const homeBuildGlyphs = [
  allocateLibraryGlyph("cross-bridge", "relay"),
  allocateLibraryGlyph("parallel-rails"),
  allocateLibraryGlyph("dormant-data"),
] as const;

export const cardGlyphSets = {
  commonStartingPoints: [
    allocateLibraryGlyph("chain-of-custody", "handoff"), // Inbound documents
    allocateLibraryGlyph("constellation", "parallel-rails"), // Internal knowledge
    allocateLibraryGlyph("convergence", "staged-route"), // Reporting
    allocateLibraryGlyph("twin-pipeline", "cross-bridge"), // Back-office processing
    allocateLibraryGlyph("rotational-exchange", "relay"), // Correspondence
  ],
  rankedBuildPlan: [
    allocateLibraryGlyph("aperture", "convergence"), // Opportunity map
    allocateLibraryGlyph("convergence", "exchange"), // Ranking
    allocateLibraryGlyph("guardrails", "open-boundary"), // Constraint register
    allocateLibraryGlyph("cross-bridge", "parallel-rails"), // Architecture direction
    allocateLibraryGlyph("stepped-change", "staged-route"), // Pilot scope
  ],
  ongoingOperation: [
    allocateLibraryGlyph("rotational-exchange", "exchange"), // Quality and drift
    allocateLibraryGlyph("interlock", "distributed-frame"), // Exceptions and failures
    allocateLibraryGlyph("staged-route", "stepped-change"), // Model replacement
    allocateLibraryGlyph("chain-of-custody", "convergence"), // Evidence
    allocateLibraryGlyph("guardrails", "paired-modules"), // Process and regulation changes
  ],
  bankingWorkloads: [
    allocateLibraryGlyph("open-boundary", "protected-core"), // Onboarding and KYC
    allocateLibraryGlyph("relay", "rotational-exchange"), // Periodic review
    allocateLibraryGlyph("convergence", "exchange"), // Transaction-monitoring triage
    allocateLibraryGlyph("chain-of-custody", "staged-route"), // Credit-file preparation
    allocateLibraryGlyph("guardrails", "core-perimeter"), // Regulatory-reporting checks
    allocateLibraryGlyph("parallel-rails", "constellation"), // Policy and product knowledge
  ],
  insuranceWorkloads: [
    allocateLibraryGlyph("handoff", "relay"), // Claims intake and triage
    allocateLibraryGlyph("chain-of-custody", "convergence"), // Claim-document review
    allocateLibraryGlyph("aperture", "protected-core"), // Underwriting support
    allocateLibraryGlyph("core-perimeter", "protected-core"), // Fraud-investigation support
    allocateLibraryGlyph("relay", "rotational-exchange"), // Policy correspondence
    allocateLibraryGlyph("distributed-frame", "paired-modules"), // Broker submissions
  ],
  healthcareWorkloads: [
    allocateLibraryGlyph("handoff", "relay"), // Intake and referral administration
    allocateLibraryGlyph("relay", "staged-route"), // Documentation routing
    allocateLibraryGlyph("twin-pipeline", "parallel-rails"), // Billing and coding
    allocateLibraryGlyph("rotational-exchange", "exchange"), // Insurer correspondence
    allocateLibraryGlyph("parallel-rails", "distributed-frame"), // Capacity reporting
    allocateLibraryGlyph("constellation", "distributed-frame"), // Procedure knowledge
  ],
  capitalMarketsWorkloads: [
    allocateLibraryGlyph("staged-route", "parallel-rails"), // Fund and investor reporting
    allocateLibraryGlyph("protected-core", "core-perimeter"), // Due-diligence review
    allocateLibraryGlyph("distributed-frame", "relay"), // DDQ and RFP responses
    allocateLibraryGlyph("parallel-rails", "twin-pipeline"), // Portfolio-company reporting
    allocateLibraryGlyph("guardrails", "chain-of-custody"), // Compliance monitoring
    allocateLibraryGlyph("constellation", "exchange"), // Internal knowledge
  ],
  companyWaysOfWorking: [
    allocateLibraryGlyph("chain-of-custody", "convergence"), // Audit before proposal
    allocateLibraryGlyph("guardrails", "open-boundary"), // Constraints shape architecture
    allocateLibraryGlyph("cross-bridge", "stepped-change"), // Stay after launch
    allocateLibraryGlyph("aperture", "protected-core"), // Say when not to build
  ],
} as const satisfies Record<string, readonly ModularGlyphDefinition[]>;
