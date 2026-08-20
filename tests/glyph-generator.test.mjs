import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertGlyphPattern,
  buildGlyphPath,
  countGlyphComponents,
  createGlyphSvg,
  createRandomConnectedGlyph,
  createRandomGlyphPattern,
  createRandomSymmetricComposition,
  hasGlyphSymmetry,
  isConnectedGlyph,
} from "../src/lib/glyph-generator.ts";
import { glyphLibrary } from "../src/data/glyph-references.ts";

const routeSource = await readFile(
  new URL("../src/pages/glyphs.astro", import.meta.url),
  "utf8",
);

test("glyph patterns accept grids from 2x2 through 8x8", () => {
  assert.doesNotThrow(() => assertGlyphPattern({ gridSize: 2, cells: [[1, 1]] }));
  assert.doesNotThrow(() => assertGlyphPattern({ gridSize: 8, cells: [[7, 7]] }));
  assert.throws(
    () => assertGlyphPattern({ gridSize: 1, cells: [] }),
    /integer from 2 to 8/,
  );
  assert.throws(
    () => assertGlyphPattern({ gridSize: 9, cells: [] }),
    /integer from 2 to 8/,
  );
  assert.throws(
    () => assertGlyphPattern({ gridSize: 4, cells: [[4, 0]] }),
    /outside the 4x4 grid/,
  );
  assert.throws(
    () => assertGlyphPattern({ gridSize: 4, cells: [[1, 1], [1, 1]] }),
    /duplicate cell 1:1/,
  );
});

test("touching cells merge into one sharp outer boundary", () => {
  const path = buildGlyphPath({
    gridSize: 2,
    cells: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
  });

  assert.equal(path, "M 0 0 L 200 0 L 200 200 L 0 200 Z");
  assert.doesNotMatch(path, /\bA\b/);
  assert.equal(path.match(/\bM\b/g)?.length, 1);
});

test("concave corners receive the logo's half-cell circular fillet", () => {
  const path = buildGlyphPath({
    gridSize: 2,
    cells: [
      [0, 0],
      [0, 1],
      [1, 1],
    ],
  });

  assert.match(path, /L 100 50 A 50 50 0 0 0 150 100/);
  assert.equal(path.match(/\bA\b/g)?.length, 1);
  assert.equal(path.match(/\bM\b/g)?.length, 1);
});

test("enclosed gaps become rounded holes in one even-odd path", () => {
  const cells = [];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      if (column !== 1 || row !== 1) cells.push([column, row]);
    }
  }

  const path = buildGlyphPath({ gridSize: 3, cells });
  const svg = createGlyphSvg({ gridSize: 3, cells });
  assert.equal(path.match(/\bM\b/g)?.length, 2);
  assert.equal(path.match(/\bA\b/g)?.length, 4);
  assert.match(svg, /viewBox="0 0 300 300"/);
  assert.match(svg, /fill-rule="evenodd" clip-rule="evenodd"/);
});

test("manual edits may produce multiple independent SVG subpaths", () => {
  const path = buildGlyphPath({
    gridSize: 3,
    cells: [
      [0, 0],
      [2, 0],
    ],
  });
  assert.equal(path.match(/\bM\b/g)?.length, 2);
  assert.equal(path.match(/\bZ\b/g)?.length, 2);
});

test("random patterns have the requested size and remain edge-connected", () => {
  let seed = 0x12345678;
  const random = () => {
    seed = (1664525 * seed + 1013904223) % 0x100000000;
    return seed / 0x100000000;
  };

  for (const [gridSize, cellCount] of [
    [2, 4],
    [4, 7],
    [8, 42],
    [8, 64],
  ]) {
    const cells = createRandomConnectedGlyph(gridSize, cellCount, random);
    assert.equal(cells.length, cellCount);
    assert.equal(new Set(cells.map(([column, row]) => `${column}:${row}`)).size, cellCount);
    assert.ok(isConnectedGlyph(cells));
    assert.doesNotThrow(() => assertGlyphPattern({ gridSize, cells }));
  }
});

test("automatic symmetry modes generate genuinely symmetric patterns", () => {
  let seed = 0x87654321;
  const random = () => {
    seed = (1664525 * seed + 1013904223) % 0x100000000;
    return seed / 0x100000000;
  };

  for (const symmetry of [
    "horizontal",
    "vertical",
    "rotational",
    "diagonal",
  ]) {
    for (const gridSize of [3, 4, 7, 8]) {
      const generated = createRandomGlyphPattern(
        gridSize,
        Math.round(gridSize * gridSize * 0.44),
        symmetry,
        random,
      );
      assert.equal(generated.symmetry, symmetry);
      assert.ok(
        hasGlyphSymmetry(
          { gridSize, cells: generated.cells },
          symmetry,
        ),
      );
    }
  }

  const balanced = createRandomGlyphPattern(6, 16, "balanced", random);
  assert.ok(balanced.cells.length >= 15 && balanced.cells.length <= 17);
});

test("symmetric composition generation allows deliberate separated modules", () => {
  let seed = 42;
  const random = () => {
    seed = (1664525 * seed + 1013904223) % 0x100000000;
    return seed / 0x100000000;
  };
  const cells = createRandomSymmetricComposition(
    5,
    13,
    "rotational",
    random,
  );
  assert.ok(hasGlyphSymmetry({ gridSize: 5, cells }, "rotational"));
  assert.ok(countGlyphComponents(cells) > 1);
  assert.doesNotThrow(() => buildGlyphPath({ gridSize: 5, cells }));
});

test("symmetry generation handles requests smaller than the minimum orbit", () => {
  const generated = createRandomGlyphPattern(2, 1, "rotational", () => 0.25);
  assert.equal(generated.symmetry, "rotational");
  assert.ok(generated.cells.length >= 1);
  assert.ok(
    hasGlyphSymmetry(
      { gridSize: 2, cells: generated.cells },
      "rotational",
    ),
  );
});

test("curated references preserve the supplied connected and sparse 5x5 grammar", () => {
  assert.equal(glyphLibrary.length, 21);
  const signatures = new Set();
  const componentCounts = [];
  for (const pattern of glyphLibrary) {
    assert.equal(pattern.gridSize, 5);
    assert.ok(pattern.id.length > 0);
    assert.ok(pattern.name.length > 0);
    assert.match(pattern.comment, /^Use for /);
    assert.doesNotThrow(() => assertGlyphPattern(pattern));
    assert.doesNotThrow(() => buildGlyphPath(pattern));
    const signature = pattern.cells
      .map(([column, row]) => `${column}:${row}`)
      .sort()
      .join("|");
    signatures.add(signature);
    componentCounts.push(countGlyphComponents(pattern.cells));
  }
  assert.equal(signatures.size, glyphLibrary.length);
  assert.ok(componentCounts.some((count) => count === 1));
  assert.ok(componentCounts.some((count) => count > 3));
  for (const pattern of glyphLibrary.slice(14, 20)) {
    assert.notEqual(pattern.symmetry, "none");
    assert.ok(hasGlyphSymmetry(pattern, pattern.symmetry));
  }
});

test("the internal glyph route exposes editor, preview and export controls", () => {
  assert.match(routeSource, /canonicalPath="\/glyphs"/);
  assert.match(routeSource, /noindex/);
  for (let size = 2; size <= 8; size += 1) {
    assert.match(routeSource, new RegExp(`<option value="${size}"`));
  }
  assert.match(routeSource, /<option value="5" selected>/);
  assert.match(routeSource, /role="grid"/);
  assert.match(routeSource, /data-randomise/);
  assert.match(routeSource, /data-pattern-mode/);
  assert.match(routeSource, /value="rotational"/);
  assert.match(routeSource, /value="diagonal"/);
  assert.match(routeSource, /data-copy-data/);
  assert.match(routeSource, /data-copy-svg/);
  assert.match(routeSource, /data-download-svg/);
  assert.match(routeSource, /data-pattern-batch/);
  assert.match(routeSource, /data-generate-batch/);
  assert.match(routeSource, /data-clear-shortlist/);
  assert.match(routeSource, /data-clear-batch/);
  assert.match(routeSource, /data-copy-shortlist/);
  assert.match(routeSource, /generateBatch\(\);/);
  assert.match(routeSource, /comment: comment\.trim\(\)/);
  assert.match(routeSource, /glyphLibrary/);
  assert.doesNotMatch(routeSource, /holds two parts together/);
  assert.doesNotMatch(routeSource, /must share an edge/);
});
