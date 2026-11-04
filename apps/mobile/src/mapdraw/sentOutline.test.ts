/**
 * The outline «Draw route» sends (TASK-382): checked as the engine checks
 * it (route_engine/shapes/outline.py, `_first_crossing`), and where the
 * rounding of `framed` makes two sides meet, the corners between them are
 * left out. The case of the report: «Edit the drawing» on an example on a
 * lake, paddled from the shore, then «Draw route».
 * services/api/tests/test_paddle_edit_outline.py says what the API answers
 * to each of the two bodies.
 */
import type { LatLon, OutlinePoint } from "@shaperoute/shared-types";
import sent from "@shaperoute/shared-types/fixtures/image-route-request-paddle-edit.json";
import touching from "@shaperoute/shared-types/fixtures/image-route-request-paddle-edit-touching.json";
import track from "@shaperoute/shared-types/fixtures/track-paddled-with-leg.json";

import { distanceLimitsM } from "../route/distance";
import { routeTrack } from "../route/figureLines";
import { canvasRequest } from "./canvasRequest";
import { drawingOf } from "./edit";
import { withinLimits } from "./figure";
import { cornersOf, firstMeeting, sentOutline } from "./sentOutline";

const SQUARE: OutlinePoint[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
];

/** A square with a spike out of its right side and back along itself, as
 * the rounding leaves a strip a hair wide. */
const SPIKED: OutlinePoint[] = [
  [-1, -1],
  [0.5, -1],
  [0.5, 0],
  [1, 0],
  [0.5, 0],
  [0.5, 1],
  [-1, 1],
  [-1, -1],
];

/** The square without the spike. */
const UNSPIKED: OutlinePoint[] = [
  [-1, -1],
  [0.5, -1],
  [0.5, 0],
  [0.5, 1],
  [-1, 1],
  [-1, -1],
];

test("an outline the engine takes goes as it is", () => {
  expect(sentOutline(SQUARE, [])).toBe(SQUARE);
});

test("the corners are read as the engine reads them: a repeat and the closing point left out", () => {
  expect(
    cornersOf([
      [0, 0],
      [1, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ]),
  ).toEqual([
    [0, 0],
    [1, 0],
    [1, 1],
  ]);
});

test("sides meet as the engine says: crossing, touching, going back along the one before", () => {
  expect(firstMeeting(cornersOf(SQUARE))).toBeNull();
  // A bow tie: sides 0 and 2 cross.
  expect(
    firstMeeting([
      [0, 0],
      [1, 1],
      [1, 0],
      [0, 1],
    ]),
  ).toEqual([0, 2]);
  // A corner on side 0: touching is meeting.
  expect(
    firstMeeting([
      [0, 0],
      [2, 0],
      [2, 2],
      [1, 0],
      [0, 2],
    ]),
  ).toEqual([0, 2]);
  // Side 1 goes back along side 0.
  expect(
    firstMeeting([
      [0, 0],
      [2, 0],
      [1, 0],
      [1, 1],
    ]),
  ).toEqual([0, 1]);
});

test("a spike is left out: the corners between the two sides that meet", () => {
  expect(firstMeeting(cornersOf(SPIKED))).not.toBeNull();
  const kept = sentOutline(SPIKED, []);
  expect(kept).toEqual(UNSPIKED);
  expect(firstMeeting(cornersOf(kept))).toBeNull();
});

test("it starts on the corner nearest its first one, where the route starts", () => {
  // The same square, starting on the tip of the spike.
  const fromTip: OutlinePoint[] = [
    ...SPIKED.slice(3, -1),
    ...SPIKED.slice(0, 3),
    [1, 0],
  ];
  expect(sentOutline(fromTip, [])).toEqual([
    [0.5, 0],
    [0.5, 1],
    [-1, 1],
    [-1, -1],
    [0.5, -1],
    [0.5, 0],
  ]);
});

test("a detail that would no longer start on it: the outline goes as it is", () => {
  const detail: OutlinePoint[] = [
    [1, 0],
    [1, 0.5],
  ];
  expect(sentOutline(SPIKED, [detail])).toBe(SPIKED);
  // Starting on what is kept, it stays.
  const kept: OutlinePoint[] = [
    [0.5, 1],
    [0.8, 1],
  ];
  expect(sentOutline(SPIKED, [kept])).toEqual(UNSPIKED);
});

test("an outline that is all spike goes as it is: the API says why", () => {
  const flat: OutlinePoint[] = [
    [0, 0],
    [1, 0],
    [0.5, 0],
    [0, 0],
  ];
  expect(sentOutline(flat, [])).toBe(flat);
});

test("«Edit the drawing» on a lake's example paddled from the shore, then «Draw route»: an outline the engine takes", () => {
  // The route of the example: a horse of 1.5 km on the lake of the
  // engine's tests, with 300 m from the shore and back, as on the water.
  const edited = routeTrack(track as LatLon[]);
  const drawing = edited === null ? null : drawingOf(edited.lines);
  if (edited === null || drawing === null) {
    throw new Error("no drawing to edit");
  }
  // «Draw on the map» keeps it within the distances of «Paddle».
  const placed = withinLimits(
    { figure: drawing, centre: edited.centre, unitM: edited.unitM },
    distanceLimitsM("paddling", "km"),
  );
  const request = canvasRequest(placed, false, "paddling", "km");
  expect(request).toEqual(sent);
  expect(firstMeeting(cornersOf(sent.outline as OutlinePoint[]))).toBeNull();
  // Before, the outline went as rounded, sides 1 and 38 met and the API
  // answered 422: «outline: the outline crosses itself: the sides starting
  // at points 1 and 38 meet».
  const before = touching.outline as OutlinePoint[];
  expect(firstMeeting(cornersOf(before))).toEqual([1, 38]);
  expect(sentOutline(before, [])).toEqual(sent.outline);
  expect({ ...touching, outline: sent.outline }).toEqual(sent);
});
