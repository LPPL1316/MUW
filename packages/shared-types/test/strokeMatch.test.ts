import assert from "node:assert/strict";
import { test } from "node:test";

import anchoredImage from "../fixtures/image-route-request-anchored.json" with { type: "json" };
import anchoredRequest from "../fixtures/route-request-anchored.json" with { type: "json" };
import anchoredResult from "../fixtures/route-result-anchored.json" with { type: "json" };
import strokeMatch from "../fixtures/stroke-match.json" with { type: "json" };
import strokeRequest from "../fixtures/stroke-match-request.json" with { type: "json" };
import {
  type ImageRouteRequest,
  type LatLon,
  MAX_STROKE_M,
  MAX_STROKE_POINTS,
  PLACEMENTS,
  type Placement,
  type RouteRequest,
  type RouteResult,
  type StrokeMatchRequest,
  type StrokeMatchResult,
} from "../src/index.ts";

// The same JSON is validated by the engine's test_contract_anchored.py and
// the API's test_contract.py (TASK-347, ADR-0300).
const placement = (value: string): Placement => {
  assert.ok((PLACEMENTS as readonly string[]).includes(value));
  return value as Placement;
};
const request: RouteRequest = {
  ...anchoredRequest,
  start: anchoredRequest.start as LatLon,
  shape: "heart",
  word: null,
  activity: "running",
  style: "round",
  pen_up: false,
  near: null,
  placement: placement(anchoredRequest.placement),
};
const image: ImageRouteRequest = {
  ...anchoredImage,
  start: anchoredImage.start as LatLon,
  outline: anchoredImage.outline as [number, number][],
  strokes: [],
  activity: "running",
  pen_up: false,
  placement: placement(anchoredImage.placement),
};
const result: RouteResult = {
  ...anchoredResult,
  points: anchoredResult.points as LatLon[],
  shape: null,
  directions: [],
  alternatives: [],
  walks: [],
  on_foot: [],
  centre: null,
  placed_outline: anchoredResult.placed_outline as LatLon[][],
};
const stroke: StrokeMatchRequest = {
  ...strokeRequest,
  activity: "running",
  line: strokeRequest.line as LatLon[],
  from: strokeRequest.from as LatLon,
};
const match: StrokeMatchResult = {
  ...strokeMatch,
  points: strokeMatch.points as LatLon[],
};

test("a drawing is anchored where it was drawn, with its magnet", () => {
  assert.deepEqual(PLACEMENTS, ["free", "anchored"]);
  assert.equal(request.placement, "anchored");
  assert.ok(request.fit !== undefined && request.fit >= 0 && request.fit <= 1);
  assert.equal(image.placement, "anchored");
  // An app of before TASK-347 sends neither field.
  const { placement: _p, fit: _f, ...older } = request;
  const before: RouteRequest = older;
  assert.equal(before.placement, undefined);
});

test("the result says where the drawing was placed, as a ghost", () => {
  assert.ok(result.placed_outline && result.placed_outline.length === 1);
  const [line] = result.placed_outline;
  assert.deepEqual(line[0], line[line.length - 1]); // closed
  assert.deepEqual(line[0], result.points[0]);
  assert.ok(result.warnings.some((w) => w.includes("not rescaled")));
});

test("a stroke goes with its magnet and where the one before ended", () => {
  assert.deepEqual(Object.keys(stroke).sort(), ["activity", "fit", "from", "line"]);
  assert.ok(stroke.line.length >= 2 && stroke.line.length <= MAX_STROKE_POINTS);
  assert.equal(MAX_STROKE_M, 10_000);
  assert.deepEqual(Object.keys(match).sort(), ["away_m", "off_roads", "points"]);
  assert.equal(match.away_m.length, stroke.line.length);
  assert.equal(match.off_roads, false);
});
