import { outlineSegments } from "./outlineSegments";

const SQUARE: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [0, 0],
];

test("a closed outline gives one segment a side, inside the padding", () => {
  const segments = outlineSegments(SQUARE, 100, 10);
  expect(segments).toHaveLength(4);
  for (const s of segments) {
    expect(s.length).toBeCloseTo(80);
  }
  // The first side runs along the top, left to right.
  expect(segments[0]).toMatchObject({ top: 10, angle: 0 });
  expect(segments[0].left).toBeCloseTo(10);
  // Then down the right.
  expect(segments[1].angle).toBeCloseTo(90);
});

test("a tall shape is centred, proportions kept", () => {
  const tall: [number, number][] = [
    [0.4, 0],
    [0.6, 0],
    [0.6, 1],
    [0.4, 1],
    [0.4, 0],
  ];
  const segments = outlineSegments(tall, 100, 0);
  // 0.2 wide against 1 tall: 20 points wide, from 40 to 60.
  expect(segments[0].length).toBeCloseTo(20);
  expect(segments[0].left).toBeCloseTo(40);
  expect(segments[1].length).toBeCloseTo(100);
});

test("points too close to draw are skipped, not lost", () => {
  const segments = outlineSegments([...SQUARE.slice(0, 2), [1, 0.001], [1, 1]], 100, 0);
  expect(segments).toHaveLength(2);
  expect(segments[1].length).toBeCloseTo(100);
});

test("one point is nothing to draw", () => {
  expect(outlineSegments([[0.5, 0.5]], 100, 0)).toEqual([]);
});
