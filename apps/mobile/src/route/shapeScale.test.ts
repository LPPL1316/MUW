import { lookOf } from "../mapdraw/figure";
import { scaleBar, shapeScale } from "./shapeScale";

test("a circle of 2π km is 2 km across", () => {
  const { widthM, heightM, boxM } = shapeScale("circle", 2000 * Math.PI);
  expect(widthM).toBeCloseTo(2000, -1);
  expect(heightM).toBeCloseTo(2000, -1);
  expect(boxM).toBeCloseTo(2000, -1);
});

test("twice the distance, twice the size", () => {
  const small = shapeScale("heart", 5000);
  const large = shapeScale("heart", 10000);
  expect(large.widthM / small.widthM).toBeCloseTo(2);
  expect(large.lines).toEqual(small.lines);
});

test("the lines fit the box, centred, with north up", () => {
  for (const shape of ["star", "horse", "christmas_tree"] as const) {
    const { lines } = shapeScale(shape, 7000);
    const points = lines.flat();
    expect(Math.min(...points.flat())).toBeGreaterThanOrEqual(-1e-9);
    expect(Math.max(...points.flat())).toBeLessThanOrEqual(1 + 1e-9);
    expect(lines.length).toBe(lookOf({ kind: "shape", shape }).lines.length);
  }
  // The tree's top (its highest y on the plane) is at the top of the box.
  const tree = lookOf({ kind: "shape", shape: "christmas_tree" }).lines.flat();
  const top = tree.reduce((a, b) => (b[1] > a[1] ? b : a));
  const shown = shapeScale("christmas_tree", 7000).lines.flat();
  expect(shown[tree.indexOf(top)][1]).toBeCloseTo(0);
});

test("the scale bar: a round length, under 40 % of the box", () => {
  expect(scaleBar(2000)).toEqual({ metres: 500, share: 0.25 });
  expect(scaleBar(6000).metres).toBe(2000);
  expect(scaleBar(100).metres).toBe(50);
});
