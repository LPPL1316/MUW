import type { LatLon, OutlinePoint } from "@shaperoute/shared-types";
import imageRequest from "@shaperoute/shared-types/fixtures/image-route-request.json";

import { drawingLines, requestLines, trackLines } from "./figureLines";

/**
 * The lines «Edit the drawing» puts on the map (TASK-320, TASK-331): of a
 * route asked for, of a route run; in the engine's frame, [-1, 1] with y
 * up. A shape of the catalogue — an emoji — has none (ADR-0288).
 */

const TRENTO: LatLon = [46.0671, 11.1214];

/** A loop of 50 points around Trento, as a run of a picture leaves it. */
const RING: LatLon[] = Array.from({ length: 50 }, (_, i) => {
  const a = (2 * Math.PI * i) / 50;
  return [TRENTO[0] + 0.004 * Math.sin(a), TRENTO[1] + 0.006 * Math.cos(a)];
});

test("a route asked for: a picture by its outline and details as sent; a shape or a word nothing", () => {
  const start = TRENTO;
  const strokes: OutlinePoint[][] = [
    [
      [0, -0.8],
      [0, 0],
    ],
  ];
  const picture = requestLines({
    ...imageRequest,
    start: imageRequest.start as LatLon,
    outline: imageRequest.outline as OutlinePoint[],
    strokes,
    activity: "running",
  });
  expect(picture?.outline).toEqual(imageRequest.outline);
  expect(picture?.details).toBe(strokes);
  // Without strokes, no details.
  expect(
    requestLines({
      ...imageRequest,
      start: imageRequest.start as LatLon,
      outline: imageRequest.outline as OutlinePoint[],
      activity: "running",
    })?.details,
  ).toEqual([]);
  // An emoji is not changed.
  expect(
    requestLines({ start, shape: "star", distance_m: 5000, activity: "running" }),
  ).toBeNull();
  expect(
    requestLines({
      start,
      word: "CIAO",
      style: "round",
      distance_m: 12000,
      activity: "running",
    }),
  ).toBeNull();
});

test("the points of a route run give one closed outline, as a favorite keeps it", () => {
  const { outline, details } = trackLines(RING);
  expect(details).toEqual([]);
  expect(outline[outline.length - 1]).toEqual(outline[0]);
  expect(outline.length).toBeLessThanOrEqual(101);
  for (const [x, y] of outline) {
    expect(Math.abs(x)).toBeLessThanOrEqual(1 + 1e-9);
    expect(Math.abs(y)).toBeLessThanOrEqual(1 + 1e-9);
  }
});

test("a member's drawing: a picture or a drawing by the track run", () => {
  const run = { shape: null, word: null, route_title: null, track: RING };
  // A drawing, a picture or a photo: its planned route says only a title.
  expect(drawingLines({ ...run, route_title: "Drawing" })).toEqual(trackLines(RING));
  expect(drawingLines({ ...run, route_title: "Image", source: "muw" })).toEqual(
    trackLines(RING),
  );
});

test.each([
  ["a shape of the catalogue", { shape: "star", route_title: "Star" }],
  ["a shape the app does not know", { shape: "dragon" }],
  ["a word", { word: "ciao", style: "round" as const }],
  ["a run without a planned route", {}],
  [
    "a run imported from another app",
    { route_title: "Morning run", source: "file" as const },
  ],
  ["a post of photos alone", { route_title: "Image", track: [] }],
  ["a track too short to follow", { route_title: "Image", track: [TRENTO] }],
])("a member's drawing puts nothing on the map: %s", (_what, fields) => {
  const run = { shape: null, word: null, route_title: null, track: RING };
  expect(drawingLines({ ...run, ...fields })).toBeNull();
});
