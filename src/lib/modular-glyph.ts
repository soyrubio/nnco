export type ModularGlyphCell = readonly [column: number, row: number];

export type ModularGlyphSymmetry =
  | "horizontal"
  | "vertical"
  | "rotational"
  | "diagonal";

export interface ModularGlyphDefinition {
  cells: readonly ModularGlyphCell[];
  symmetry: ModularGlyphSymmetry;
}
