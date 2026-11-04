import type { LatLon, OutlinePoint } from "@shaperoute/shared-types";
import imageRequest from "@shaperoute/shared-types/fixtures/image-route-request.json";

import { metresBetween } from "../map/coordinates";
import { isOpenLine } from "../mapdraw/drawing";
import { drawingOf } from "../mapdraw/edit";
import { onMap } from "../mapdraw/figure";
import { drawingTrack, requestLines, routeTrack, trackInPlace } from "./figureLines";

/**
 * The lines «Edit the drawing» puts on the map (TASK-320, TASK-331): of a
 * route asked for, of a route run; in the engine's frame, [-1, 1] with y
 * up. A shape of the catalogue — an emoji — has none (ADR-0288). The
 * track of a member's drawing goes where it was run, as big (TASK-346), and
 * since TASK-369 (ADR-0313) so does the line of every drawing and route.
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

test("the points of a route run give one closed outline, as a favorite keeps it, where they were run", () => {
  const { lines, centre, unitM } = trackInPlace(RING);
  const { outline, details } = lines;
  expect(details).toEqual([]);
  expect(outline[outline.length - 1]).toEqual(outline[0]);
  expect(outline.length).toBeLessThanOrEqual(101);
  for (const [x, y] of outline) {
    expect(Math.abs(x)).toBeLessThanOrEqual(1 + 1e-3);
    expect(Math.abs(y)).toBeLessThanOrEqual(1 + 1e-3);
  }
  // Its middle is the middle of the loop, one unit its half width in metres.
  expect(metresBetween(centre, TRENTO)).toBeLessThan(1);
  expect(unitM).toBeCloseTo(metresBetween(TRENTO, [TRENTO[0], TRENTO[1] + 0.006]), -1);
  // On the map, each point is back on the track.
  outline.forEach((point, i) => {
    const run = RING[i % RING.length];
    expect(
      metresBetween(
        onMap({ figure: { kind: "shape", shape: "heart" }, centre, unitM }, point),
        run,
      ),
    ).toBeLessThan(1);
  });
});

test("a long track keeps at most the corners an outline may have, its start first", () => {
  const long: LatLon[] = Array.from({ length: 400 }, (_, i) => {
    const a = (2 * Math.PI * i) / 400;
    return [TRENTO[0] + 0.01 * Math.sin(a), TRENTO[1] + 0.01 * Math.cos(a)];
  });
  const { lines, centre, unitM } = trackInPlace(long);
  expect(lines.outline.length).toBeLessThanOrEqual(101);
  const first = onMap(
    { figure: { kind: "shape", shape: "heart" }, centre, unitM },
    lines.outline[0],
  );
  expect(metresBetween(first, long[0])).toBeLessThan(1);
});

/** A line of 60 points going east from Trento, 1.2 km: it ends away from
 * its start, as a run from A to B or a word does. */
const LINE: LatLon[] = Array.from({ length: 60 }, (_, i) => [
  TRENTO[0] + 0.0005 * Math.sin(i / 6),
  TRENTO[1] + (0.015 * i) / 59,
]);

test("a track that ends away from its start stays open: a ring at its start and the line hung on it", () => {
  const { lines, centre, unitM } = trackInPlace(LINE);
  // The outline is the small ring on the first point, the line a detail.
  expect(isOpenLine(lines.outline, lines.details)).toBe(true);
  expect(lines.details).toHaveLength(1);
  const at = (point: OutlinePoint) =>
    onMap({ figure: { kind: "shape", shape: "heart" }, centre, unitM }, point);
  expect(metresBetween(at(lines.outline[0]), LINE[0])).toBeLessThan(1);
  const detail = lines.details[0];
  expect(metresBetween(at(detail[0]), LINE[0])).toBeLessThan(1);
  expect(
    metresBetween(at(detail[detail.length - 1]), LINE[LINE.length - 1]),
  ).toBeLessThan(1);
  // Every point of the detail lies on the track.
  for (const point of detail) {
    expect(Math.min(...LINE.map((p) => metresBetween(p, at(point))))).toBeLessThan(15);
  }
  // A drawing of the map takes it as a line drawn there would be.
  expect(drawingOf(lines)).not.toBeNull();
});

test("a track that ends near its start is still one closed outline", () => {
  expect(isOpenLine(trackInPlace(RING).lines.outline, [])).toBe(false);
  expect(trackInPlace(RING).lines.details).toEqual([]);
});

const RUN = { track: RING };

test.each([
  ["a picture or a drawing", { shape: null, word: null, route_title: "Drawing" }],
  ["a photo", { route_title: "Image", source: "muw" as const }],
  ["a shape of the catalogue, an emoji", { shape: "star", route_title: "Star" }],
  ["a shape the app does not know", { shape: "dragon" }],
  ["a word", { word: "ciao", style: "round" as const }],
  ["a run without a planned route", { route_title: null }],
  [
    "a run imported from another app",
    { route_title: "Morning run", source: "file" as const },
  ],
  ["a run on foot", { activity: "running" as const }],
  ["a ride", { activity: "cycling" as const }],
  ["a drawing paddled, on the water (part B)", { activity: "paddling" as const }],
])("a member's drawing gives its track where it was run: %s", (_what, fields) => {
  expect(drawingTrack({ ...RUN, ...fields })).toEqual(trackInPlace(RING));
});

test.each([
  ["a post of photos alone", { track: [] }],
  ["a track too short to follow", { track: [TRENTO] }],
])("a member's drawing puts nothing on the map: %s", (_what, fields) => {
  expect(drawingTrack({ ...RUN, ...fields })).toBeNull();
});

test("a route of «Explore» gives its line where it is; one too short nothing", () => {
  expect(routeTrack(RING)).toEqual(trackInPlace(RING));
  expect(routeTrack(LINE)).toEqual(trackInPlace(LINE));
  expect(routeTrack([TRENTO])).toBeNull();
  expect(routeTrack([])).toBeNull();
});
