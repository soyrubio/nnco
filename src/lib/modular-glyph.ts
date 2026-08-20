export type ModularGlyphCell = readonly [column: number, row: number];

export type ModularGlyphSymmetry =
  | "horizontal"
  | "vertical"
  | "rotational"
  | "diagonal"
  | "none";

export interface ModularGlyphDefinition {
  libraryId: string;
  gridSize: number;
  cells: readonly ModularGlyphCell[];
  symmetry: ModularGlyphSymmetry;
}
