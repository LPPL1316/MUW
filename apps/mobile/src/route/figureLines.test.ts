import type { LatLon, OutlinePoint } from "@shaperoute/shared-types";
import imageRequest from "@shaperoute/shared-types/fixtures/image-route-request.json";

import { lookOf } from "../mapdraw/figure";
import {
  drawingLines,
  requestLines,
  shapeLines,
  splitExcursions,
  trackLines,
} from "./figureLines";

/**
 * The lines a figure opens in the board (TASK-320): of a shape of the
 * catalogue, of a route asked for, of a route run; in the board's square,
 * from the top left, y down.
 */

const TRENTO: LatLon = [46.0671, 11.1214];

test("a shape of the catalogue gives the engine's lines, the first the outline, on the board", () => {
  const { outline, details } = shapeLines("heart");
  const look = lookOf({ kind: "shape", shape: "heart" });
  expect(outline).toHaveLength(look.lines[0].length);
  expect(details).toHaveLength(look.lines.length - 1);
  // [-1, 1] with y up becomes [0, 1] with y down: the engine's top is the top.
  const [x, y] = look.lines[0][0];
  expect(outline[0]).toEqual([(x + 1) / 2, (1 - y) / 2]);
  const top = Math.min(...outline.map(([, py]) => py));
  const engineTop = Math.max(...look.lines[0].map(([, py]) => py));
  expect(top).toBeCloseTo((1 - engineTop) / 2);
});

test("the excursions inside the engine's line become details: a ray out and back, an eye around", () => {
  // A square with a ray out of its top side and an eye inside, as the
  // engine runs them: out from a point of the outline and back to it.
  const line: OutlinePoint[] = [
    [0, 0],
    [1, 0],
    [1, 0.5],
    [1.5, 0.5], // the ray's tip
    [1, 0.5],
    [1, 1],
    [0.5, 1],
    [0.5, 0.8], // the link to the eye
    [0.4, 0.7],
    [0.6, 0.7],
    [0.5, 0.8], // the eye, closed where the link ends
    [0.5, 1],
    [0, 1],
    [0, 0],
  ];
  expect(splitExcursions(line)).toEqual({
    outline: [
      [0, 0],
      [1, 0],
      [1, 0.5],
      [1, 1],
      [0.5, 1],
      [0, 1],
      [0, 0],
    ],
    details: [
      [
        [1, 0.5],
        [1.5, 0.5],
      ],
      [
        [0.5, 1],
        [0.5, 0.8],
        [0.4, 0.7],
        [0.6, 0.7],
        [0.5, 0.8],
      ],
    ],
  });
  // The cat: its body, and two eyes as details, each starting on the body.
  const cat = shapeLines("cat");
  expect(cat.details).toHaveLength(2);
  expect(cat.outline.length).toBeLessThan(
    lookOf({ kind: "shape", shape: "cat" }).lines[0].length,
  );
  for (const eye of cat.details) {
    expect(cat.outline).toContainEqual(eye[0]);
    expect(eye[eye.length - 1]).toEqual(eye[1]);
  }
  // The sun: eight rays, the way out alone, each from the body's edge.
  const sun = shapeLines("sun");
  expect(sun.details).toHaveLength(8);
  for (const ray of sun.details) {
    expect(ray.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ray.map(String)).size).toBe(ray.length);
    expect(sun.outline).toContainEqual(ray[0]);
  }
});

test("a route asked for: a shape by its lines, a picture by its outline and details, a word nothing", () => {
  const start = TRENTO;
  expect(
    requestLines({ start, shape: "star", distance_m: 5000, activity: "running" }),
  ).toEqual(shapeLines("star"));
  const picture = requestLines({
    ...imageRequest,
    start: imageRequest.start as LatLon,
    outline: imageRequest.outline as OutlinePoint[],
    strokes: [
      [
        [0, -0.8],
        [0, 0],
      ],
    ],
    activity: "running",
  });
  expect(picture?.outline).toEqual(
    (imageRequest.outline as OutlinePoint[]).map(([x, y]) => [
      (x + 1) / 2,
      (1 - y) / 2,
    ]),
  );
  expect(picture?.details).toEqual([
    [
      [0.5, 0.9],
      [0.5, 0.5],
    ],
  ]);
  expect(
    requestLines({
      start,
      word: "CIAO",
      style: "round",
      distance_m: 12000,
      activity: "running",
    }),
  ).toBeNull();
  // A shape the app does not know (an API newer than the app).
  expect(
    requestLines({
      start,
      shape: "dragon" as never,
      distance_m: 5000,
      activity: "running",
    }),
  ).toBeNull();
});

test("the points of a route run give one closed outline, as a favorite keeps it", () => {
  const points: LatLon[] = Array.from({ length: 50 }, (_, i) => {
    const a = (2 * Math.PI * i) / 50;
    return [TRENTO[0] + 0.004 * Math.sin(a), TRENTO[1] + 0.006 * Math.cos(a)];
  });
  const { outline, details } = trackLines(points);
  expect(details).toEqual([]);
  expect(outline[outline.length - 1]).toEqual(outline[0]);
  expect(outline.length).toBeLessThanOrEqual(101);
  for (const [x, y] of outline) {
    expect(x).toBeGreaterThanOrEqual(-1e-9);
    expect(x).toBeLessThanOrEqual(1 + 1e-9);
    expect(y).toBeGreaterThanOrEqual(-1e-9);
    expect(y).toBeLessThanOrEqual(1 + 1e-9);
  }
});

test("a member's drawing: a shape by its lines, a picture or a drawing by the track run", () => {
  const ring: LatLon[] = Array.from({ length: 50 }, (_, i) => {
    const a = (2 * Math.PI * i) / 50;
    return [TRENTO[0] + 0.004 * Math.sin(a), TRENTO[1] + 0.006 * Math.cos(a)];
  });
  const run = { shape: null, word: null, route_title: null, track: ring };
  expect(drawingLines({ ...run, shape: "star" })).toEqual(shapeLines("star"));
  // A drawing, a picture or a photo: its planned route says only a title.
  expect(drawingLines({ ...run, route_title: "Drawing" })).toEqual(trackLines(ring));
  expect(drawingLines({ ...run, route_title: "Image", source: "muw" })).toEqual(
    trackLines(ring),
  );
});

test.each([
  ["a word", { word: "ciao", style: "round" as const }],
  ["a shape the app does not know", { shape: "dragon" }],
  ["a run without a planned route", {}],
  [
    "a run imported from another app",
    { route_title: "Morning run", source: "file" as const },
  ],
  ["a post of photos alone", { route_title: "Image", track: [] }],
  ["a track too short to follow", { route_title: "Image", track: [TRENTO] }],
])("a member's drawing opens nothing in the board: %s", (_what, fields) => {
  const run = { shape: null, word: null, route_title: null, track: [TRENTO, TRENTO] };
  expect(drawingLines({ ...run, ...fields })).toBeNull();
});
