export type GlyphCell = readonly [column: number, row: number];

export interface GlyphPattern {
  gridSize: number;
  cells: readonly GlyphCell[];
}

export type GlyphSymmetry =
  | "horizontal"
  | "vertical"
  | "rotational"
  | "diagonal";

export type GlyphGenerationMode = "balanced" | "free" | GlyphSymmetry;

export interface GeneratedGlyphPattern {
  cells: GlyphCell[];
  symmetry: GlyphSymmetry | "none";
}

interface Point {
  x: number;
  y: number;
}

interface Edge {
  start: Point;
  end: Point;
}

interface RoundedVertex {
  start: Point;
  end: Point;
  radius: number;
}

const MIN_GRID_SIZE = 2;
const MAX_GRID_SIZE = 8;

const pointKey = ({ x, y }: Point) => `${x}:${y}`;
const cellKey = ([column, row]: GlyphCell) => `${column}:${row}`;
const parseCellKey = (key: string): GlyphCell => {
  const [column, row] = key.split(":").map(Number);
  return [column, row];
};
const samePoint = (left: Point, right: Point) =>
  left.x === right.x && left.y === right.y;

const directionIndex = ({ start, end }: Edge) => {
  const horizontal = end.x - start.x;
  const vertical = end.y - start.y;
  if (horizontal > 0) return 0;
  if (vertical > 0) return 1;
  if (horizontal < 0) return 2;
  return 3;
};

const crossProduct = (first: Point, second: Point) =>
  first.x * second.y - first.y * second.x;

const vectorBetween = (start: Point, end: Point): Point => ({
  x: end.x - start.x,
  y: end.y - start.y,
});

const vectorLength = ({ x, y }: Point) => Math.hypot(x, y);

const normaliseVector = (vector: Point): Point => {
  const length = vectorLength(vector);
  return { x: vector.x / length, y: vector.y / length };
};

const formatNumber = (value: number) => {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return String(rounded);
};

const formatPoint = ({ x, y }: Point) =>
  `${formatNumber(x)} ${formatNumber(y)}`;

export function assertGlyphPattern(pattern: GlyphPattern): void {
  const { gridSize, cells } = pattern;
  if (
    !Number.isInteger(gridSize) ||
    gridSize < MIN_GRID_SIZE ||
    gridSize > MAX_GRID_SIZE
  ) {
    throw new Error("Glyph grid size must be an integer from 2 to 8.");
  }

  const seenCells = new Set<string>();
  for (const [column, row] of cells) {
    if (
      !Number.isInteger(column) ||
      !Number.isInteger(row) ||
      column < 0 ||
      row < 0 ||
      column >= gridSize ||
      row >= gridSize
    ) {
      throw new Error(
        `Glyph cell ${column}:${row} falls outside the ${gridSize}x${gridSize} grid.`,
      );
    }

    const key = `${column}:${row}`;
    if (seenCells.has(key)) {
      throw new Error(`Glyph pattern contains the duplicate cell ${key}.`);
    }
    seenCells.add(key);
  }
}

export function sortGlyphCells(cells: Iterable<GlyphCell>): GlyphCell[] {
  return [...cells].sort(
    ([leftColumn, leftRow], [rightColumn, rightRow]) =>
      leftRow - rightRow || leftColumn - rightColumn,
  );
}

export function isConnectedGlyph(cells: readonly GlyphCell[]): boolean {
  return countGlyphComponents(cells) === 1;
}

export function countGlyphComponents(cells: readonly GlyphCell[]): number {
  if (cells.length === 0) return 0;

  const remaining = new Set(cells.map(cellKey));
  let componentCount = 0;

  while (remaining.size > 0) {
    componentCount += 1;
    const firstKey = remaining.values().next().value as string;
    const queue = [parseCellKey(firstKey)];
    remaining.delete(firstKey);

    for (let index = 0; index < queue.length; index += 1) {
      const [column, row] = queue[index];
      const neighbours: GlyphCell[] = [
        [column + 1, row],
        [column - 1, row],
        [column, row + 1],
        [column, row - 1],
      ];

      for (const neighbour of neighbours) {
        const key = cellKey(neighbour);
        if (!remaining.has(key)) continue;
        remaining.delete(key);
        queue.push(neighbour);
      }
    }
  }

  return componentCount;
}

function chooseNextEdge(current: Edge, candidates: number[], edges: Edge[]) {
  const currentDirection = directionIndex(current);
  const turnPriority = new Map([
    [1, 0],
    [0, 1],
    [3, 2],
    [2, 3],
  ]);

  return candidates.sort((leftIndex, rightIndex) => {
    const leftTurn =
      (directionIndex(edges[leftIndex]) - currentDirection + 4) % 4;
    const rightTurn =
      (directionIndex(edges[rightIndex]) - currentDirection + 4) % 4;
    return (
      (turnPriority.get(leftTurn) ?? 4) -
      (turnPriority.get(rightTurn) ?? 4)
    );
  })[0];
}

function traceBoundaryLoops(cells: readonly GlyphCell[], cellSize: number) {
  const selectedCells = new Set(cells.map(cellKey));
  const edges: Edge[] = [];

  const addEdge = (start: Point, end: Point) => {
    edges.push({
      start: { x: start.x * cellSize, y: start.y * cellSize },
      end: { x: end.x * cellSize, y: end.y * cellSize },
    });
  };

  for (const [column, row] of cells) {
    if (!selectedCells.has(`${column}:${row - 1}`)) {
      addEdge({ x: column, y: row }, { x: column + 1, y: row });
    }
    if (!selectedCells.has(`${column + 1}:${row}`)) {
      addEdge(
        { x: column + 1, y: row },
        { x: column + 1, y: row + 1 },
      );
    }
    if (!selectedCells.has(`${column}:${row + 1}`)) {
      addEdge(
        { x: column + 1, y: row + 1 },
        { x: column, y: row + 1 },
      );
    }
    if (!selectedCells.has(`${column - 1}:${row}`)) {
      addEdge({ x: column, y: row + 1 }, { x: column, y: row });
    }
  }

  const outgoingEdges = new Map<string, number[]>();
  edges.forEach((edge, index) => {
    const key = pointKey(edge.start);
    const outgoing = outgoingEdges.get(key) ?? [];
    outgoing.push(index);
    outgoingEdges.set(key, outgoing);
  });

  const unusedEdges = new Set(edges.map((_, index) => index));
  const loops: Point[][] = [];

  while (unusedEdges.size > 0) {
    const firstEdgeIndex = unusedEdges.values().next().value as number;
    const firstPoint = edges[firstEdgeIndex].start;
    const vertices = [firstPoint];
    let currentEdgeIndex = firstEdgeIndex;
    let guard = 0;

    while (guard <= edges.length) {
      guard += 1;
      const currentEdge = edges[currentEdgeIndex];
      unusedEdges.delete(currentEdgeIndex);
      vertices.push(currentEdge.end);

      if (samePoint(currentEdge.end, firstPoint)) break;

      const candidates = (outgoingEdges.get(pointKey(currentEdge.end)) ?? []).filter(
        (edgeIndex) => unusedEdges.has(edgeIndex),
      );
      if (candidates.length === 0) {
        throw new Error("Glyph boundary could not be closed.");
      }
      currentEdgeIndex = chooseNextEdge(currentEdge, candidates, edges);
    }

    if (!samePoint(vertices.at(-1) as Point, firstPoint)) {
      throw new Error("Glyph boundary tracing exceeded its safe limit.");
    }

    const openLoop = vertices.slice(0, -1);
    const simplifiedLoop = openLoop.filter((vertex, index) => {
      const previous = openLoop[(index - 1 + openLoop.length) % openLoop.length];
      const next = openLoop[(index + 1) % openLoop.length];
      return crossProduct(
        vectorBetween(previous, vertex),
        vectorBetween(vertex, next),
      ) !== 0;
    });

    if (simplifiedLoop.length >= 4) loops.push(simplifiedLoop);
  }

  return loops;
}

function roundConcaveVertex(
  previous: Point,
  vertex: Point,
  next: Point,
  maximumRadius: number,
): RoundedVertex {
  const incomingVector = vectorBetween(previous, vertex);
  const outgoingVector = vectorBetween(vertex, next);
  const turn = crossProduct(incomingVector, outgoingVector);

  if (turn >= 0 || maximumRadius <= 0) {
    return { start: vertex, end: vertex, radius: 0 };
  }

  const radius = Math.min(
    maximumRadius,
    vectorLength(incomingVector) / 2,
    vectorLength(outgoingVector) / 2,
  );
  const incoming = normaliseVector(incomingVector);
  const outgoing = normaliseVector(outgoingVector);

  return {
    start: {
      x: vertex.x - incoming.x * radius,
      y: vertex.y - incoming.y * radius,
    },
    end: {
      x: vertex.x + outgoing.x * radius,
      y: vertex.y + outgoing.y * radius,
    },
    radius,
  };
}

export function buildGlyphPath(
  pattern: GlyphPattern,
  cellSize = 100,
  cornerRadius = cellSize / 2,
): string {
  assertGlyphPattern(pattern);
  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    throw new Error("Glyph cell size must be a positive number.");
  }
  if (!Number.isFinite(cornerRadius) || cornerRadius < 0) {
    throw new Error("Glyph corner radius cannot be negative.");
  }
  if (pattern.cells.length === 0) return "";

  return traceBoundaryLoops(pattern.cells, cellSize)
    .map((loop) => {
      const roundedVertices = loop.map((vertex, index) =>
        roundConcaveVertex(
          loop[(index - 1 + loop.length) % loop.length],
          vertex,
          loop[(index + 1) % loop.length],
          cornerRadius,
        ),
      );
      const commands = [`M ${formatPoint(roundedVertices[0].start)}`];
      let currentPoint = roundedVertices[0].start;

      roundedVertices.forEach(({ start, end, radius }, index) => {
        if (index > 0 && !samePoint(currentPoint, start)) {
          commands.push(`L ${formatPoint(start)}`);
          currentPoint = start;
        }
        if (radius > 0) {
          commands.push(
            `A ${formatNumber(radius)} ${formatNumber(radius)} 0 0 0 ${formatPoint(end)}`,
          );
          currentPoint = end;
        }
      });
      commands.push("Z");
      return commands.join(" ");
    })
    .join(" ");
}

export function createGlyphSvg(pattern: GlyphPattern): string {
  const path = buildGlyphPath(pattern);
  const viewBoxSize = pattern.gridSize * 100;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}">`,
    `  <path d="${path}" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"/>`,
    `</svg>`,
  ].join("\n");
}

export function createRandomConnectedGlyph(
  gridSize: number,
  cellCount: number,
  random: () => number = Math.random,
): GlyphCell[] {
  assertGlyphPattern({ gridSize, cells: [] });
  if (
    !Number.isInteger(cellCount) ||
    cellCount < 1 ||
    cellCount > gridSize * gridSize
  ) {
    throw new Error(
      `Glyph cell count must be an integer from 1 to ${gridSize * gridSize}.`,
    );
  }

  const centre = Math.floor((gridSize - 1) / 2);
  const selectedCells = new Set([`${centre}:${centre}`]);
  const frontier = new Set<string>();

  const addFrontierNeighbours = (column: number, row: number) => {
    const neighbours: GlyphCell[] = [
      [column + 1, row],
      [column - 1, row],
      [column, row + 1],
      [column, row - 1],
    ];
    for (const [nextColumn, nextRow] of neighbours) {
      if (
        nextColumn < 0 ||
        nextRow < 0 ||
        nextColumn >= gridSize ||
        nextRow >= gridSize
      ) {
        continue;
      }
      const key = `${nextColumn}:${nextRow}`;
      if (!selectedCells.has(key)) frontier.add(key);
    }
  };

  addFrontierNeighbours(centre, centre);
  while (selectedCells.size < cellCount) {
    const candidates = [...frontier];
    const randomValue = Math.max(0, Math.min(0.999999999, random()));
    const key = candidates[Math.floor(randomValue * candidates.length)];
    frontier.delete(key);
    selectedCells.add(key);
    const [column, row] = key.split(":").map(Number);
    addFrontierNeighbours(column, row);
  }

  return sortGlyphCells(
    [...selectedCells].map(parseCellKey),
  );
}

function symmetryOrbit(
  [column, row]: GlyphCell,
  gridSize: number,
  symmetry: GlyphSymmetry,
): GlyphCell[] {
  const lastIndex = gridSize - 1;
  const transformed: GlyphCell = (() => {
    switch (symmetry) {
      case "horizontal":
        return [column, lastIndex - row];
      case "vertical":
        return [lastIndex - column, row];
      case "rotational":
        return [lastIndex - column, lastIndex - row];
      case "diagonal":
        return [row, column];
    }
  })();

  const orbit: GlyphCell[] = [[column, row], transformed];
  return sortGlyphCells(
    new Map(orbit.map((cell) => [cellKey(cell), cell])).values(),
  );
}

export function hasGlyphSymmetry(
  pattern: GlyphPattern,
  symmetry: GlyphSymmetry,
): boolean {
  assertGlyphPattern(pattern);
  const selectedCells = new Set(pattern.cells.map(cellKey));
  return pattern.cells.every((cell) =>
    symmetryOrbit(cell, pattern.gridSize, symmetry).every((mirroredCell) =>
      selectedCells.has(cellKey(mirroredCell)),
    ),
  );
}

function symmetricSeed(
  gridSize: number,
  symmetry: GlyphSymmetry,
  random: () => number,
): GlyphCell[] {
  const lowerCentre = Math.floor((gridSize - 1) / 2);
  const upperCentre = Math.ceil((gridSize - 1) / 2);
  const chosenCentre = random() < 0.5 ? lowerCentre : upperCentre;
  const hasSingleCentre = lowerCentre === upperCentre;

  switch (symmetry) {
    case "horizontal":
      return hasSingleCentre
        ? [[chosenCentre, lowerCentre]]
        : [
            [chosenCentre, lowerCentre],
            [chosenCentre, upperCentre],
          ];
    case "vertical":
      return hasSingleCentre
        ? [[lowerCentre, chosenCentre]]
        : [
            [lowerCentre, chosenCentre],
            [upperCentre, chosenCentre],
          ];
    case "rotational":
      return hasSingleCentre
        ? [[lowerCentre, lowerCentre]]
        : [
            [lowerCentre, lowerCentre],
            [upperCentre, lowerCentre],
            [lowerCentre, upperCentre],
            [upperCentre, upperCentre],
          ];
    case "diagonal":
      return [[chosenCentre, chosenCentre]];
  }
}

export function createRandomSymmetricGlyph(
  gridSize: number,
  cellCount: number,
  symmetry: GlyphSymmetry,
  random: () => number = Math.random,
): GlyphCell[] {
  assertGlyphPattern({ gridSize, cells: [] });
  if (
    !Number.isInteger(cellCount) ||
    cellCount < 1 ||
    cellCount > gridSize * gridSize
  ) {
    throw new Error(
      `Glyph cell count must be an integer from 1 to ${gridSize * gridSize}.`,
    );
  }

  const selectedCells = new Set(
    symmetricSeed(gridSize, symmetry, random).map(cellKey),
  );
  const targetCount = Math.max(cellCount, selectedCells.size);

  while (selectedCells.size < targetCount) {
    const candidateOrbits = new Map<string, GlyphCell[]>();
    for (let row = 0; row < gridSize; row += 1) {
      for (let column = 0; column < gridSize; column += 1) {
        const key = `${column}:${row}`;
        if (selectedCells.has(key)) continue;
        const orbit = symmetryOrbit([column, row], gridSize, symmetry).filter(
          (cell) => !selectedCells.has(cellKey(cell)),
        );
        const signature = orbit.map(cellKey).join("|");
        candidateOrbits.set(signature, orbit);
      }
    }

    const candidates = [...candidateOrbits.values()]
      .filter((orbit) => selectedCells.size + orbit.length <= targetCount)
      .map((orbit) => {
        const candidateCells = sortGlyphCells([
          ...[...selectedCells].map(parseCellKey),
          ...orbit,
        ]);
        const touchingEdges = orbit.reduce((total, [column, row]) => {
          const neighbours = [
            `${column + 1}:${row}`,
            `${column - 1}:${row}`,
            `${column}:${row + 1}`,
            `${column}:${row - 1}`,
          ];
          return (
            total + neighbours.filter((key) => selectedCells.has(key)).length
          );
        }, 0);
        return {
          orbit,
          candidateCells,
          touchingEdges,
          connected: isConnectedGlyph(candidateCells),
          tieBreaker: random(),
        };
      })
      .filter((candidate) => candidate.connected);

    if (candidates.length === 0) break;
    candidates.sort(
      (left, right) =>
        right.touchingEdges - left.touchingEdges ||
        left.tieBreaker - right.tieBreaker,
    );
    const shortlist = candidates.slice(0, Math.min(4, candidates.length));
    const randomValue = Math.max(0, Math.min(0.999999999, random()));
    const chosen = shortlist[Math.floor(randomValue * shortlist.length)];
    chosen.orbit.forEach((cell) => selectedCells.add(cellKey(cell)));
  }

  const cells = sortGlyphCells([...selectedCells].map(parseCellKey));
  if (!isConnectedGlyph(cells) || !hasGlyphSymmetry({ gridSize, cells }, symmetry)) {
    throw new Error("Symmetric glyph generation produced an invalid pattern.");
  }
  return cells;
}

export function createRandomSymmetricComposition(
  gridSize: number,
  cellCount: number,
  symmetry: GlyphSymmetry,
  random: () => number = Math.random,
): GlyphCell[] {
  assertGlyphPattern({ gridSize, cells: [] });
  if (
    !Number.isInteger(cellCount) ||
    cellCount < 1 ||
    cellCount > gridSize * gridSize
  ) {
    throw new Error(
      `Glyph cell count must be an integer from 1 to ${gridSize * gridSize}.`,
    );
  }

  const availableOrbits = new Map<string, GlyphCell[]>();
  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize; column += 1) {
      const orbit = symmetryOrbit([column, row], gridSize, symmetry);
      availableOrbits.set(orbit.map(cellKey).join("|"), orbit);
    }
  }

  const allOrbits = [...availableOrbits.values()];
  const seedOrbits = allOrbits.filter(
    (orbit) => orbit.length <= cellCount,
  );
  const availableSeeds =
    seedOrbits.length > 0
      ? seedOrbits
      : allOrbits.filter(
          (orbit) =>
            orbit.length === Math.min(...allOrbits.map((item) => item.length)),
        );
  const preferredSeedSize = Math.max(
    ...availableSeeds.map((orbit) => orbit.length),
  );
  const preferredSeeds = availableSeeds.filter(
    (orbit) => orbit.length === preferredSeedSize,
  );
  const seedValue = Math.max(0, Math.min(0.999999999, random()));
  const selectedCells = new Set(
    preferredSeeds[Math.floor(seedValue * preferredSeeds.length)].map(cellKey),
  );

  while (selectedCells.size < cellCount) {
    const candidates = [...availableOrbits.values()]
      .map((orbit) =>
        orbit.filter((cell) => !selectedCells.has(cellKey(cell))),
      )
      .filter(
        (orbit) =>
          orbit.length > 0 && selectedCells.size + orbit.length <= cellCount,
      )
      .map((orbit) => {
        const candidateCells = sortGlyphCells([
          ...[...selectedCells].map(parseCellKey),
          ...orbit,
        ]);
        const touchingEdges = orbit.reduce((total, [column, row]) => {
          const neighbours = [
            `${column + 1}:${row}`,
            `${column - 1}:${row}`,
            `${column}:${row + 1}`,
            `${column}:${row - 1}`,
          ];
          return (
            total + neighbours.filter((key) => selectedCells.has(key)).length
          );
        }, 0);
        const componentCount = countGlyphComponents(candidateCells);
        return {
          orbit,
          score:
            touchingEdges * 0.8 +
            Math.min(componentCount, 8) * 0.15 +
            random(),
        };
      })
      .sort((left, right) => right.score - left.score);

    if (candidates.length === 0) break;
    const shortlist = candidates.slice(0, Math.min(4, candidates.length));
    const randomValue = Math.max(0, Math.min(0.999999999, random()));
    const chosen = shortlist[Math.floor(randomValue * shortlist.length)];
    chosen.orbit.forEach((cell) => selectedCells.add(cellKey(cell)));
  }

  const cells = sortGlyphCells([...selectedCells].map(parseCellKey));
  if (!hasGlyphSymmetry({ gridSize, cells }, symmetry)) {
    throw new Error("Modular glyph generation produced an invalid pattern.");
  }
  return cells;
}

function countConcaveCorners(cells: readonly GlyphCell[], gridSize: number) {
  const selectedCells = new Set(cells.map(cellKey));
  let concaveCorners = 0;
  for (let row = 0; row <= gridSize; row += 1) {
    for (let column = 0; column <= gridSize; column += 1) {
      const surroundingCells = [
        `${column - 1}:${row - 1}`,
        `${column}:${row - 1}`,
        `${column - 1}:${row}`,
        `${column}:${row}`,
      ];
      if (
        surroundingCells.filter((key) => selectedCells.has(key)).length === 3
      ) {
        concaveCorners += 1;
      }
    }
  }
  return concaveCorners;
}

function glyphAestheticScore(
  cells: readonly GlyphCell[],
  gridSize: number,
  requestedCount: number,
  symmetry: GlyphSymmetry | "none",
) {
  const columns = cells.map(([column]) => column);
  const rows = cells.map(([, row]) => row);
  const minimumColumn = Math.min(...columns);
  const maximumColumn = Math.max(...columns);
  const minimumRow = Math.min(...rows);
  const maximumRow = Math.max(...rows);
  const width = maximumColumn - minimumColumn + 1;
  const height = maximumRow - minimumRow + 1;
  const boundingArea = width * height;
  const density = cells.length / boundingArea;
  const patternCentreX = (minimumColumn + maximumColumn + 1) / 2;
  const patternCentreY = (minimumRow + maximumRow + 1) / 2;
  const gridCentre = gridSize / 2;
  const centreOffset =
    Math.abs(patternCentreX - gridCentre) + Math.abs(patternCentreY - gridCentre);
  const selectedCells = new Set(cells.map(cellKey));
  const danglingCells = cells.filter(([column, row]) => {
    const neighbours = [
      `${column + 1}:${row}`,
      `${column - 1}:${row}`,
      `${column}:${row + 1}`,
      `${column}:${row - 1}`,
    ];
    return neighbours.filter((key) => selectedCells.has(key)).length === 1;
  }).length;
  const concaveCorners = countConcaveCorners(cells, gridSize);
  const componentCount = countGlyphComponents(cells);

  return (
    20 -
    Math.abs(cells.length - requestedCount) * 4 -
    Math.abs(width - height) * 1.4 -
    centreOffset * 1.8 -
    Math.abs(density - 0.62) * 4 -
    danglingCells * 0.45 +
    Math.min(concaveCorners, 8) * 0.55 +
    Math.min(Math.max(componentCount - 1, 0), 7) * 0.15 +
    (symmetry === "none" ? 0 : 1.25) -
    (width === 1 || height === 1 ? 8 : 0)
  );
}

export function createRandomGlyphPattern(
  gridSize: number,
  cellCount: number,
  mode: GlyphGenerationMode = "balanced",
  random: () => number = Math.random,
): GeneratedGlyphPattern {
  assertGlyphPattern({ gridSize, cells: [] });
  const modes: (GlyphSymmetry | "free")[] =
    mode === "balanced"
      ? ["horizontal", "vertical", "rotational", "diagonal", "free"]
      : [mode];
  const candidates = new Map<
    string,
    GeneratedGlyphPattern & { score: number }
  >();

  for (const candidateMode of modes) {
    const attempts = mode === "balanced" ? 3 : 8;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const cells =
        candidateMode === "free"
          ? createRandomConnectedGlyph(gridSize, cellCount, random)
          : attempt % 2 === 0
            ? createRandomSymmetricComposition(
                gridSize,
                cellCount,
                candidateMode,
                random,
              )
            : createRandomSymmetricGlyph(
                gridSize,
                cellCount,
                candidateMode,
                random,
              );
      const symmetry = candidateMode === "free" ? "none" : candidateMode;
      const signature = cells.map(cellKey).join("|");
      const score =
        glyphAestheticScore(cells, gridSize, cellCount, symmetry) +
        random() * 0.9;
      const existing = candidates.get(signature);
      if (!existing || score > existing.score) {
        candidates.set(signature, { cells, symmetry, score });
      }
    }
  }

  const rankedCandidates = [...candidates.values()].sort(
    (left, right) => right.score - left.score,
  );
  const shortlist = rankedCandidates.slice(0, Math.min(3, rankedCandidates.length));
  const randomValue = Math.max(0, Math.min(0.999999999, random()));
  const chosen = shortlist[Math.floor(randomValue * shortlist.length)];
  return { cells: chosen.cells, symmetry: chosen.symmetry };
}
