import catalog from "@shaperoute/shared-types/fixtures/game-catalog.json";

import {
  lengthOf,
  piecesOf,
  placeOutline,
  type Point,
  polylineSegments,
  splitPolyline,
} from "./pieceSegments";
// What the API's `game_rules.pieces_of` gives for the same outlines, written
// by the API's own function (services/api, 2026-10-25): the phone must cut
// the same, to the last decimal (docs/GIOCO.md §6.2).
import fromApi from "./piecesOfApi.json";

const SQUARE: Point[] = [
  [0.0, 0.0],
  [1.0, 0.0],
  [1.0, 1.0],
  [0.0, 1.0],
  [0.0, 0.0],
];

// The cases of the API's test_game_pieces.py, with its numbers.
test("a square in four is its sides", () => {
  expect(piecesOf(SQUARE, 4)).toEqual([
    [
      [0, 0],
      [1, 0],
    ],
    [
      [1, 0],
      [1, 1],
    ],
    [
      [1, 1],
      [0, 1],
    ],
    [
      [0, 1],
      [0, 0],
    ],
  ]);
});

test("a cut inside a side is interpolated", () => {
  const pieces = piecesOf(SQUARE, 8);
  expect(pieces[0]).toEqual([
    [0, 0],
    [0.5, 0],
  ]);
  expect(pieces[1]).toEqual([
    [0.5, 0],
    [1, 0],
  ]);
  expect(pieces[5]).toEqual([
    [0.5, 1],
    [0, 1],
  ]);
});

test("a piece keeps the corners it runs through", () => {
  expect(piecesOf(SQUARE, 2)).toEqual([
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    [
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ]);
});

test("one piece is the whole outline", () => {
  expect(piecesOf(SQUARE, 1)).toEqual([SQUARE]);
});

test("a cut on a corner lists the corner once in each piece", () => {
  const pieces = piecesOf(SQUARE, 6);
  expect(pieces[1]).toEqual([
    [0.6667, 0],
    [1, 0],
    [1, 0.3333],
  ]);
  expect(pieces[2]).toEqual([
    [1, 0.3333],
    [1, 1],
  ]);
  expect(pieces[3]).toEqual([
    [1, 1],
    [0.3333, 1],
  ]);
});

test("nothing is cut into empty pieces, and fewer than one piece is refused", () => {
  expect(piecesOf([], 3)).toEqual([[], [], []]);
  expect(() => piecesOf(SQUARE, 0)).toThrow();
});

const SHAPES = catalog.shapes as unknown as { id: string; outline: Point[] }[];

test("the phone cuts every shape of the catalog exactly as the API does", () => {
  const byId = fromApi as unknown as Record<
    string,
    Record<string, [number, number][][]>
  >;
  for (const shape of SHAPES) {
    const expected = byId[shape.id];
    expect(expected).toBeDefined();
    for (const [n, pieces] of Object.entries(expected)) {
      expect(piecesOf(shape.outline, Number(n))).toEqual(pieces);
    }
  }
  for (const [n, pieces] of Object.entries(byId.square)) {
    expect(piecesOf(SQUARE, Number(n))).toEqual(pieces);
  }
});

test("the pieces of a shape join end to end and close it", () => {
  for (const shape of SHAPES) {
    for (const n of [2, 3, 7, 12]) {
      const pieces = piecesOf(shape.outline, n);
      expect(pieces).toHaveLength(n);
      const whole = lengthOf(shape.outline);
      for (let i = 0; i < n; i += 1) {
        expect(pieces[i].length).toBeGreaterThanOrEqual(2);
        expect(Math.abs(lengthOf(pieces[i]) - whole / n)).toBeLessThan(1e-3);
        if (i > 0) {
          expect(pieces[i][0]).toEqual(pieces[i - 1][pieces[i - 1].length - 1]);
        }
      }
      expect(pieces[n - 1][pieces[n - 1].length - 1]).toEqual(pieces[0][0]);
    }
  }
});

test("one placement fits all the pieces together, centred in the square", () => {
  const place = placeOutline(SQUARE, 100, 10);
  expect(place([0, 0])).toEqual([10, 10]);
  expect(place([1, 1])).toEqual([90, 90]);
  // A wide shape is centred in height.
  const wide = placeOutline(
    [
      [0, 0],
      [1, 0.5],
    ],
    100,
    0,
  );
  expect(wide([0, 0])).toEqual([0, 25]);
  expect(wide([1, 0.5])).toEqual([100, 75]);
  expect(placeOutline([], 100, 10)([0.3, 0.3])).toEqual([50, 50]);
});

test("a line is split at a share of its length, the two parts meeting at the cut", () => {
  const line: Point[] = [
    [0, 0],
    [10, 0],
    [10, 10],
  ];
  const [done, left] = splitPolyline(line, 0.75);
  expect(done).toEqual([
    [0, 0],
    [10, 0],
    [10, 5],
  ]);
  expect(left).toEqual([
    [10, 5],
    [10, 10],
  ]);
  expect(splitPolyline(line, 0)).toEqual([[], line]);
  expect(splitPolyline(line, 1)).toEqual([line, []]);
  expect(splitPolyline(line, 2)).toEqual([line, []]);
  expect(splitPolyline([[3, 3]], 0.5)).toEqual([[], [[3, 3]]]);
});

test("a placed line becomes turned strokes, the too short ones left out", () => {
  const segments = polylineSegments([
    [0, 0],
    [10, 0],
    [10, 0.2],
    [10, 10],
  ]);
  expect(segments).toHaveLength(2);
  expect(segments[0]).toEqual({ left: 0, top: 0, length: 10, angle: 0 });
  expect(segments[1].angle).toBeCloseTo(90);
  expect(segments[1].length).toBeCloseTo(9.8);
});
