import assert from "node:assert/strict";
import { test } from "node:test";

import activityPauses from "../fixtures/activity-pauses.json" with { type: "json" };
import activityRequestTurned from "../fixtures/activity-request-turned.json" with { type: "json" };
import activityRequestWalks from "../fixtures/activity-request-walks.json" with { type: "json" };
import activityRequest from "../fixtures/activity-request.json" with { type: "json" };
import activityTurned from "../fixtures/activity-turned.json" with { type: "json" };
import activityWalks from "../fixtures/activity-walks.json" with { type: "json" };
import activity from "../fixtures/activity.json" with { type: "json" };
import apiErrorCodes from "../fixtures/api-error-codes.json" with { type: "json" };
import apiError from "../fixtures/api-error.json" with { type: "json" };
import contract from "../fixtures/contract.json" with { type: "json" };
import directions from "../fixtures/directions.json" with { type: "json" };
import editReasons from "../fixtures/edit-reasons.json" with { type: "json" };
import favoriteCycling from "../fixtures/favorite-cycling.json" with { type: "json" };
import favoriteRequestCycling from "../fixtures/favorite-request-cycling.json" with { type: "json" };
import favoriteRequestTurned from "../fixtures/favorite-request-turned.json" with { type: "json" };
import favoriteRequestWalks from "../fixtures/favorite-request-walks.json" with { type: "json" };
import favoriteRequest from "../fixtures/favorite-request.json" with { type: "json" };
import favoriteTurned from "../fixtures/favorite-turned.json" with { type: "json" };
import favoriteWalks from "../fixtures/favorite-walks.json" with { type: "json" };
import favorite from "../fixtures/favorite.json" with { type: "json" };
import favoritesCycling from "../fixtures/favorites-cycling.json" with { type: "json" };
import favorites from "../fixtures/favorites.json" with { type: "json" };
import gpxRequest from "../fixtures/gpx-request.json" with { type: "json" };
import imageError from "../fixtures/image-error.json" with { type: "json" };
import imageLimits from "../fixtures/image-limits.json" with { type: "json" };
import imageEditRequest from "../fixtures/image-outline-edit-request.json" with { type: "json" };
import imageEdited from "../fixtures/image-outline-edited.json" with { type: "json" };
import imageOutlineRequest from "../fixtures/image-outline-request.json" with { type: "json" };
import imageOutline from "../fixtures/image-outline.json" with { type: "json" };
import imageReasons from "../fixtures/image-reasons.json" with { type: "json" };
import imageRouteRequest from "../fixtures/image-route-request.json" with { type: "json" };
import editError from "../fixtures/outline-edit-error.json" with { type: "json" };
import jobDone from "../fixtures/route-job-done.json" with { type: "json" };
import jobFailed from "../fixtures/route-job-failed.json" with { type: "json" };
import jobRunning from "../fixtures/route-job-running.json" with { type: "json" };
import jobStatuses from "../fixtures/route-job-statuses.json" with { type: "json" };
import alternativeLimits from "../fixtures/route-alternatives.json" with { type: "json" };
import cyclingRequest from "../fixtures/route-request-cycling.json" with { type: "json" };
import paddlingNearRequest from "../fixtures/route-request-paddling-near.json" with { type: "json" };
import paddlingRequest from "../fixtures/route-request-paddling.json" with { type: "json" };
import penUpShapeRequest from "../fixtures/route-request-pen-up-shape.json" with { type: "json" };
import penUpRequest from "../fixtures/route-request-pen-up.json" with { type: "json" };
import wordRequest from "../fixtures/route-request-word.json" with { type: "json" };
import request from "../fixtures/route-request.json" with { type: "json" };
import betterResult from "../fixtures/route-result-better-distance.json" with { type: "json" };
import cyclingResult from "../fixtures/route-result-cycling.json" with { type: "json" };
import imageResult from "../fixtures/route-result-image.json" with { type: "json" };
import paddlingResult from "../fixtures/route-result-paddling.json" with { type: "json" };
import penUpResult from "../fixtures/route-result-pen-up.json" with { type: "json" };
import tiltedResult from "../fixtures/route-result-tilted.json" with { type: "json" };
import wordResult from "../fixtures/route-result-word.json" with { type: "json" };
import result from "../fixtures/route-result.json" with { type: "json" };
import shapeReadingLimits from "../fixtures/shape-reading-limits.json" with { type: "json" };
import shapeReadingNone from "../fixtures/shape-reading-none.json" with { type: "json" };
import shapeReadingRequest from "../fixtures/shape-reading-request.json" with { type: "json" };
import shapeReading from "../fixtures/shape-reading.json" with { type: "json" };
import trackScoreRequest from "../fixtures/track-score-request.json" with { type: "json" };
import trackWalksRequest from "../fixtures/track-score-request-walks.json" with { type: "json" };
import {
  ACTIVITIES,
  API_ERROR_CODES,
  DISTANCE_LIMITS_M,
  EDIT_REASONS,
  GROUP_M,
  IMAGE_REASONS,
  JOB_STATUSES,
  LETTER_DISTANCE_M,
  LETTER_STYLES,
  LETTERS,
  MAX_ALTERNATIVES,
  MAX_DETAIL_POINTS,
  MAX_DISTANCE_M,
  MAX_DRAWN_POINTS,
  MAX_IMAGE_BYTES,
  MAX_OUTLINE_POINTS,
  MAX_SHAPE_TEXT_LENGTH,
  MAX_WORD_LETTERS,
  MIN_DISTANCE_M,
  PEN_UP_SHAPES,
  SHAPES,
  TURNS,
  type ApiError,
  type Direction,
  type GpxRequest,
  type ImageOutline,
  type ImageOutlineEditRequest,
  type ImageOutlineRequest,
  type ImageRouteRequest,
  type RouteJob,
  type RouteRequest,
  type RouteResult,
  type ShapeReading,
  type ShapeReadingRequest,
  type Stretch,
  type TrackScoreRequest,
  type Walk,
} from "../src/index.ts";

// Checked by `tsc`: the fixtures have exactly the fields of the types, so a
// field added or renamed on one side only fails the typecheck.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
// The fixtures written before TASK-197 are what an older app sends and an
// older API answers: without the pen up and the walks, both optional; nor
// the stretches with the bike on foot, optional too (TASK-206); nor the
// distance where the shape comes out better (TASK-234); nor where a shape
// on the water is wanted and where it is (TASK-238); nor how far the
// shape is turned (TASK-232); nor where the drawing goes and was placed
// (TASK-347: `placement`, `fit`, `placed_outline`).
// Member by member: a shape's request and a word's stay apart.
type OlderRequest = RouteRequest extends infer R
  ? R extends RouteRequest
    ? Omit<R, "pen_up" | "near" | "placement" | "fit">
    : never
  : never;
type OlderResult = Omit<
  RouteResult,
  | "walks"
  | "on_foot"
  | "better_distance_m"
  | "centre"
  | "rotation_deg"
  | "placed_outline"
>;
const requestFields: Same<keyof typeof request, keyof OlderRequest> = true;
const resultFields: Same<keyof typeof result, keyof OlderResult> = true;
const wordFields: Same<keyof typeof wordRequest, keyof OlderRequest> &
  Same<keyof typeof wordResult, keyof OlderResult> = true;
// A bike route (TASK-190): the same fields, another activity.
const cyclingFields: Same<keyof typeof cyclingRequest, keyof OlderRequest> = true;
// A paddling route (TASK-191): the same fields again.
const paddlingFields: Same<keyof typeof paddlingRequest, keyof OlderRequest> = true;
type PenUpRequest = Omit<RouteRequest, "near" | "placement" | "fit">;
const penUpFields: Same<keyof typeof penUpRequest, keyof PenUpRequest> &
  Same<keyof typeof penUpShapeRequest, keyof PenUpRequest> &
  Same<
    keyof typeof penUpResult,
    keyof Omit<
      RouteResult,
      "on_foot" | "better_distance_m" | "centre" | "rotation_deg" | "placed_outline"
    >
  > = true;
// A shape moved on the water (TASK-238): every field of the request, and of
// the result that says where the shape is, before TASK-232.
const movedFields: Same<
  keyof typeof paddlingNearRequest,
  keyof Omit<RouteRequest, "placement" | "fit">
> &
  Same<
    keyof typeof paddlingResult,
    keyof Omit<RouteResult, "rotation_deg" | "placed_outline">
  > = true;
// A bike route walked in part (TASK-206): every field before TASK-234, its
// alternative too.
type BikeResult = Omit<
  RouteResult,
  "better_distance_m" | "centre" | "rotation_deg" | "placed_outline"
>;
const cyclingResultFields: Same<keyof typeof cyclingResult, keyof BikeResult> &
  Same<keyof (typeof cyclingResult.alternatives)[number], keyof BikeResult> = true;
// A route with a better distance (TASK-234): every field before TASK-232,
// its alternative too.
type BetterResult = Omit<RouteResult, "rotation_deg" | "placed_outline">;
const betterFields: Same<keyof typeof betterResult, keyof BetterResult> &
  Same<keyof (typeof betterResult.alternatives)[number], keyof BetterResult> = true;
// A tilted route (TASK-232): every field before TASK-347, its alternative too.
type TiltedResult = Omit<RouteResult, "placed_outline">;
const tiltedFields: Same<keyof typeof tiltedResult, keyof TiltedResult> &
  Same<keyof (typeof tiltedResult.alternatives)[number], keyof TiltedResult> = true;
const trackFields: Same<
  keyof typeof trackScoreRequest,
  keyof Omit<TrackScoreRequest, "walks">
> &
  Same<keyof typeof trackWalksRequest, keyof TrackScoreRequest> = true;
const directionFields: Same<keyof (typeof result.directions)[number], keyof Direction> =
  true;
const errorFields: Same<keyof typeof apiError, keyof ApiError> = true;
const errorDetailFields: Same<keyof typeof apiError.error, keyof ApiError["error"]> =
  true;

const jobFields: Same<keyof typeof jobRunning, keyof RouteJob> &
  Same<keyof typeof jobDone, keyof RouteJob> &
  Same<keyof typeof jobFailed, keyof RouteJob> = true;
const jobResultFields: Same<keyof typeof jobDone.result, keyof OlderResult> = true;
const jobErrorFields: Same<keyof typeof jobFailed.error, keyof ApiError["error"]> =
  true;

const gpxFields: Same<keyof typeof gpxRequest, keyof GpxRequest> &
  Same<keyof typeof gpxRequest.request, keyof OlderRequest> &
  Same<keyof typeof gpxRequest.result, keyof OlderResult> = true;

const shapeReadingFields: Same<
  keyof typeof shapeReadingRequest,
  keyof ShapeReadingRequest
> &
  Same<keyof typeof shapeReading, keyof ShapeReading> &
  Same<keyof typeof shapeReadingNone, keyof ShapeReading> = true;

// The traced outline and its request without the details of TASK-079.
const imageFields: Same<keyof typeof imageOutlineRequest, keyof ImageOutlineRequest> &
  Same<
    keyof typeof imageOutline,
    keyof Omit<ImageOutline, "strokes" | "image_strokes">
  > &
  Same<
    keyof typeof imageRouteRequest,
    keyof Omit<ImageRouteRequest, "strokes" | "pen_up" | "placement" | "fit">
  > &
  Same<keyof typeof imageResult, keyof OlderResult> &
  Same<keyof typeof imageError.error, keyof ApiError["error"]> = true;

const editFields: Same<keyof typeof imageEditRequest, keyof ImageOutlineEditRequest> &
  Same<keyof typeof imageEdited, keyof ImageOutline> &
  Same<keyof typeof editError.error, keyof ApiError["error"]> = true;

// Checked by `tsc` too: the fixtures are values of the types.
const typedImage: [ImageOutline, ImageRouteRequest, ApiError] = [
  imageOutline as ImageOutline,
  imageRouteRequest as ImageRouteRequest,
  imageError as ApiError,
];
// The request has no strokes yet: through unknown, like typedImage.
const typedEdit: [ImageOutlineEditRequest, ImageOutline, ApiError] = [
  imageEditRequest as unknown as ImageOutlineEditRequest,
  imageEdited as ImageOutline,
  editError as ApiError,
];
// JSON arrays are not tuples to tsc: through unknown too (TASK-197).
const typedPenUp: [RouteRequest, RouteResult, TrackScoreRequest] = [
  penUpRequest as unknown as RouteRequest,
  penUpResult as unknown as RouteResult,
  trackWalksRequest as unknown as TrackScoreRequest,
];
const typedCycling = cyclingResult as unknown as RouteResult;
const typedBetter = betterResult as unknown as RouteResult;
const typedTilted = tiltedResult as unknown as RouteResult;

const isShape = (value: string): boolean =>
  (SHAPES as readonly string[]).includes(value);

test("the fixtures have the fields of the types", () => {
  assert.ok(requestFields && resultFields && errorFields && errorDetailFields);
  assert.ok(jobFields && jobResultFields && jobErrorFields && gpxFields);
  assert.ok(shapeReadingFields && directionFields && wordFields);
  assert.ok(penUpFields && trackFields && cyclingFields && paddlingFields);
  assert.ok(cyclingResultFields && betterFields && movedFields && tiltedFields);
});

/** Whether `walks` are stretches of a route of `count` points, in order. */
const walksFit = (walks: Walk[], count: number): boolean => {
  let end = 0;
  for (const [from, to] of walks) {
    if (!(0 <= from && from <= to && to < count) || from < end) return false;
    end = to;
  }
  return true;
};

test("a word with the pen up walks once fewer than its letters", () => {
  const [request, result, track] = typedPenUp;
  assert.equal(request.pen_up, true);
  assert.equal(result.word, request.word?.toUpperCase());
  const walks = result.walks ?? [];
  assert.equal(walks.length, (result.word ?? "").length - 1);
  assert.ok(walksFit(walks, result.points.length));
  // Open: from the first letter to the last.
  assert.notDeepEqual(result.points.at(0), result.points.at(-1));
  assert.ok(walksFit(track.walks ?? [], track.points.length));
  assert.ok((track.walks ?? []).length > 0);
});

test("a shape in pieces may be asked with the pen up, the others not", () => {
  // TASK-223: tsc refuses the pen up with a shape that has no pieces.
  const asked: RouteRequest = penUpShapeRequest as RouteRequest;
  assert.equal(asked.pen_up, true);
  assert.ok((PEN_UP_SHAPES as readonly string[]).includes(asked.shape ?? ""));
  const heart = {
    start: [46.0671, 11.1214],
    shape: "heart",
    distance_m: 5000,
    activity: "running",
    pen_up: true,
  } as const;
  // @ts-expect-error the heart has no pieces
  const refused: RouteRequest = heart;
  assert.ok(refused);
});

test("a bike route says where the bike is walked, its alternatives too", () => {
  // TASK-206: stretches of the points like the walks, but not walks.
  const alternatives = typedCycling.alternatives ?? [];
  assert.ok(alternatives.length > 0);
  for (const route of [typedCycling, ...alternatives]) {
    const stretches: Stretch[] = route.on_foot ?? [];
    assert.ok(stretches.length > 0);
    assert.ok(walksFit(stretches, route.points.length));
    assert.deepEqual(route.walks, []);
    assert.deepEqual(route.points.at(0), route.points.at(-1));
    assert.ok(route.warnings.some((w) => w.endsWith("with the bike on foot")));
  }
});

test("a route may say where its shape comes out better, not its alternatives", () => {
  // TASK-234: whole km, another distance than the route's; null otherwise.
  const better = typedBetter.better_distance_m ?? 0;
  assert.ok(better > 0 && better % 1000 === 0);
  assert.ok(Math.abs(better - typedBetter.distance_m) > 1000);
  for (const other of typedBetter.alternatives ?? []) {
    assert.equal(other.better_distance_m, null);
  }
  for (const fixture of [result, wordResult, imageResult, penUpResult, cyclingResult]) {
    assert.ok(!("better_distance_m" in fixture));
  }
});

test("a route says how far its shape is turned, each alternative its own", () => {
  // TASK-232: counterclockwise within (-180, 180]; at most 45° for a shape
  // with a top and a bottom (ADR-0195).
  const routes = [typedTilted, ...(typedTilted.alternatives ?? [])];
  assert.ok(routes.length > 1);
  const turns = routes.map((route) => route.rotation_deg ?? 0);
  for (const turn of turns) assert.ok(-45 <= turn && turn <= 45);
  assert.notEqual(turns[0], 0);
  assert.notDeepEqual(turns[0], turns[1]);
  for (const fixture of [result, wordResult, imageResult, penUpResult, betterResult]) {
    assert.ok(!("rotation_deg" in fixture));
  }
});

test("a result without walks, from an older API, is still a result", () => {
  // tsc: an older API's result is a RouteResult, and so is its request.
  const older: OlderResult extends RouteResult ? true : false = true;
  const asked: OlderRequest extends RouteRequest ? true : false = true;
  assert.ok(older && asked);
  for (const fixture of [result, wordResult, imageResult, jobDone.result]) {
    assert.ok(!("walks" in fixture));
    assert.ok(!("on_foot" in fixture));
  }
  assert.ok(!("on_foot" in penUpResult));
  assert.ok(!("pen_up" in request) && !("pen_up" in wordRequest));
  assert.ok(!("walks" in trackScoreRequest));
});

test("saved runs and favorites keep the walks of a word with the pen up", () => {
  // TASK-199: the same walks as the route's, in the request and the detail;
  // the bodies are typed in the app (src/api/activities.ts, favorites.ts).
  const walked = [
    activityRequestWalks,
    activityWalks,
    favoriteRequestWalks,
    favoriteWalks,
  ];
  for (const fixture of walked) {
    assert.ok(fixture.word !== null);
    assert.ok(fixture.walks.length > 0);
    assert.ok(walksFit(fixture.walks as Walk[], fixture.points.length));
  }
  assert.deepEqual(activityRequestWalks.walks, trackWalksRequest.walks);
  assert.deepEqual(activityRequestWalks.points, trackWalksRequest.points);
  // A pause of the pen is the runner's: not one the app took standing still.
  const [pen] = activityRequestWalks.pauses;
  assert.equal(pen.pen, true);
  assert.equal(pen.auto, false);
  // Written before TASK-199: an older app's requests, an older API's answers.
  for (const fixture of [activityRequest, activity, favoriteRequest, favorite]) {
    assert.ok(!("walks" in fixture));
  }
  assert.ok(activityRequest.pauses.every((pause) => !("pen" in pause)));
});

test("a favorite keeps its activity, and a saved run opens with its pauses", () => {
  // TASK-200: the bodies are typed in the app (src/api/favorites.ts,
  // activities.ts). A bike route kept, listed and opened says `cycling`.
  const offered = ACTIVITIES as readonly string[];
  assert.equal(favoriteRequestCycling.activity, "cycling");
  assert.equal(favoriteCycling.activity, favoriteRequestCycling.activity);
  assert.deepEqual(favoriteCycling.points, favoriteRequestCycling.points);
  const [lowest, highest] = DISTANCE_LIMITS_M.cycling;
  const asked = favoriteRequestCycling.distance_m;
  assert.ok(lowest <= asked && asked <= highest);
  const [bike, kept] = favoritesCycling.favorites;
  assert.equal(bike.id, favoriteCycling.id);
  assert.equal(bike.activity, "cycling");
  assert.ok(favoritesCycling.favorites.every((one) => offered.includes(one.activity)));
  // The star kept before is a run: the same favorite, now with its activity.
  assert.deepEqual(
    { ...kept, activity: undefined },
    {
      ...favorites.favorites[0],
      activity: undefined,
    },
  );
  assert.equal(kept.activity, "running");
  // Written before: an older app's requests, an older API's answers.
  for (const fixture of [
    favoriteRequest,
    favoriteRequestWalks,
    favorite,
    favoriteWalks,
  ]) {
    assert.ok(!("activity" in fixture));
  }
  assert.ok(favorites.favorites.every((one) => !("activity" in one)));
  // A run's pauses: on the clock of its track, `pen` only when true.
  assert.deepEqual({ ...activityPauses, pauses: [] }, { ...activityWalks, pauses: [] });
  assert.ok(activityPauses.pauses.length > 0);
  for (const pause of activityPauses.pauses) {
    assert.ok(0 <= pause.from_s && pause.from_s <= pause.to_s);
    assert.ok(!("pen" in pause) || pause.pen === true);
  }
  const [pen] = activityPauses.pauses;
  const [sent] = activityRequestWalks.pauses;
  const began = activityRequestWalks.track[0].time_ms;
  assert.equal(pen.from_s, (sent.from_ms - began) / 1000);
  assert.equal(pen.to_s, (sent.to_ms - began) / 1000);
  assert.equal(pen.pen, true);
  for (const fixture of [activity, activityWalks]) {
    assert.ok(!("pauses" in fixture));
  }
});

test("a saved run and a favorite keep how far their shape is turned", () => {
  // TASK-232 part C: the turn of the route, as RouteResult.rotation_deg, in
  // the request and in the answer, within half a turn; the bodies are typed
  // in the app (src/api/activities.ts, favorites.ts). The fixtures written
  // before say nothing: an older app's requests, an older API's answers.
  for (const fixture of [
    activityRequestTurned,
    activityTurned,
    favoriteRequestTurned,
    favoriteTurned,
  ]) {
    assert.ok(-180 <= fixture.rotation_deg && fixture.rotation_deg <= 180);
    assert.notEqual(fixture.rotation_deg, 0);
  }
  assert.deepEqual(
    { ...activityRequestTurned, rotation_deg: undefined },
    { ...activityRequest, rotation_deg: undefined },
  );
  assert.equal(activityTurned.rotation_deg, activityRequestTurned.rotation_deg);
  assert.deepEqual(activityTurned.points, activityRequestTurned.points);
  assert.deepEqual(
    { ...favoriteRequestTurned, rotation_deg: undefined },
    { ...favoriteRequest, rotation_deg: undefined },
  );
  assert.equal(favoriteTurned.rotation_deg, favoriteRequestTurned.rotation_deg);
  assert.deepEqual(favoriteTurned.points, favoriteRequestTurned.points);
  for (const fixture of [
    activityRequest,
    activity,
    activityWalks,
    activityPauses,
    favoriteRequest,
    favorite,
    favoriteWalks,
    favoriteCycling,
  ]) {
    assert.ok(!("rotation_deg" in fixture));
  }
  assert.ok(favorites.favorites.every((one) => !("rotation_deg" in one)));
});

test("a shape reading names a shape of the catalogue, or none", () => {
  assert.equal(shapeReading.text, shapeReadingRequest.text);
  assert.ok(isShape(shapeReading.shape));
  assert.equal(shapeReadingNone.shape, null);
  assert.equal(MAX_SHAPE_TEXT_LENGTH, shapeReadingLimits.max_text_length);
  assert.ok(shapeReadingRequest.text.length <= MAX_SHAPE_TEXT_LENGTH);
});

test("the GPX request carries the request and result fixtures", () => {
  assert.deepEqual(gpxRequest.request, request);
  assert.deepEqual(gpxRequest.result, result);
});

test("route jobs carry a result only when done, an error only when failed", () => {
  assert.deepEqual([...JOB_STATUSES], jobStatuses);
  for (const job of [jobRunning, jobDone, jobFailed]) {
    assert.ok((JOB_STATUSES as readonly string[]).includes(job.status));
  }
  assert.equal(jobRunning.result, null);
  assert.equal(jobRunning.error, null);
  assert.equal(jobDone.status, "done");
  assert.deepEqual(jobDone.result, result);
  assert.equal(jobFailed.status, "failed");
  assert.deepEqual(jobFailed.error, apiError.error);
});

test("the error fixture uses a known code, and the codes match the API", () => {
  assert.ok((API_ERROR_CODES as readonly string[]).includes(apiError.error.code));
  assert.deepEqual([...API_ERROR_CODES], apiErrorCodes);
});

test("shapes, activities and distance limits match the route engine", () => {
  assert.deepEqual([...SHAPES], contract.shapes);
  assert.deepEqual([...PEN_UP_SHAPES], contract.pen_up_shapes);
  assert.deepEqual([...ACTIVITIES], contract.activities);
  assert.equal(MIN_DISTANCE_M, contract.min_distance_m);
  assert.equal(MAX_DISTANCE_M, contract.max_distance_m);
  assert.deepEqual(DISTANCE_LIMITS_M, contract.distance_limits_m);
  assert.deepEqual(Object.keys(DISTANCE_LIMITS_M), [...ACTIVITIES]);
  assert.deepEqual([...LETTERS], contract.letters);
  assert.equal(MAX_WORD_LETTERS, contract.max_word_letters);
  assert.equal(LETTER_DISTANCE_M, contract.letter_distance_m);
  assert.deepEqual([...LETTER_STYLES], contract.styles);
});

test("a request has a shape or a word, and a word the letters it may use", () => {
  assert.equal(request.word, null);
  assert.equal(wordRequest.shape, null);
  const letters = wordRequest.word.toUpperCase();
  assert.ok(letters.length <= MAX_WORD_LETTERS);
  assert.ok([...letters].every((c) => (LETTERS as readonly string[]).includes(c)));
  assert.ok(wordRequest.distance_m >= letters.length * LETTER_DISTANCE_M);
});

test("a cycling request is a request with the bike's distances", () => {
  // TASK-190: the activity is the only difference, and the limits its own.
  assert.ok((ACTIVITIES as readonly string[]).includes(cyclingRequest.activity));
  assert.equal(cyclingRequest.activity, "cycling");
  const [lowest, highest] = DISTANCE_LIMITS_M.cycling;
  assert.ok(
    lowest <= cyclingRequest.distance_m && cyclingRequest.distance_m <= highest,
  );
  assert.ok(isShape(cyclingRequest.shape));
  assert.deepEqual(DISTANCE_LIMITS_M.running, [MIN_DISTANCE_M, MAX_DISTANCE_M]);
});

test("a paddling request is a request with a shape and the water's distances", () => {
  // TASK-191: the activity is the only difference; on the water a shape of
  // the catalogue, never a word or an image (ADR-0161).
  assert.ok((ACTIVITIES as readonly string[]).includes(paddlingRequest.activity));
  assert.equal(paddlingRequest.activity, "paddling");
  assert.deepEqual(DISTANCE_LIMITS_M.paddling, [1_000, 5_000]);
  const [lowest, highest] = DISTANCE_LIMITS_M.paddling;
  assert.ok(
    lowest <= paddlingRequest.distance_m && paddlingRequest.distance_m <= highest,
  );
  assert.ok(isShape(paddlingRequest.shape));
  assert.equal(paddlingRequest.word, null);
});

test("a shape on the water says where it is, and may be asked elsewhere", () => {
  // TASK-238: the result's centre, moved, is the next request's `near`.
  const asked = paddlingNearRequest as unknown as RouteRequest;
  const drawn = paddlingResult as unknown as RouteResult;
  assert.equal(asked.activity, "paddling");
  assert.ok(asked.near && drawn.centre);
  assert.notDeepEqual(asked.near, drawn.centre);
  const lats = drawn.points.map(([lat]) => lat);
  const lons = drawn.points.map(([, lon]) => lon);
  const [lat, lon] = drawn.centre;
  assert.ok(Math.min(...lats) < lat && lat < Math.max(...lats));
  assert.ok(Math.min(...lons) < lon && lon < Math.max(...lons));
  // On the roads there is none; before TASK-238 the field is missing.
  assert.equal(betterResult.centre, null);
  for (const fixture of [result, wordResult, imageResult, penUpResult, cyclingResult]) {
    assert.ok(!("centre" in fixture));
  }
  for (const fixture of [request, wordRequest, cyclingRequest, paddlingRequest]) {
    assert.ok(!("near" in fixture));
  }
});

test("a result names its shape or its word", () => {
  assert.equal(result.word, null);
  assert.equal(wordResult.shape, null);
  assert.equal(wordResult.word, wordRequest.word.toUpperCase());
  assert.deepEqual(wordResult.points.at(0), wordResult.points.at(-1));
});

test("the request fixture is a valid request", () => {
  assert.equal(request.start.length, 2);
  assert.ok(isShape(request.shape));
  assert.ok((ACTIVITIES as readonly string[]).includes(request.activity));
  assert.ok(Number.isInteger(request.distance_m));
  assert.ok(
    MIN_DISTANCE_M <= request.distance_m && request.distance_m <= MAX_DISTANCE_M,
  );
});

test("the result fixture is a closed route of [lat, lon] points", () => {
  assert.ok(result.points.every((point) => point.length === 2));
  assert.deepEqual(result.points.at(0), result.points.at(-1));
  assert.ok(isShape(result.shape));
  assert.ok(0 <= result.similarity && result.similarity <= 1);
});

test("directions start with the departure and use the engine's turns", () => {
  assert.deepEqual([...TURNS], directions.turns);
  assert.equal(GROUP_M, directions.group_m);
  const [start, ...rest] = result.directions;
  assert.equal(start.turn, "depart");
  assert.equal(start.distance_m, 0);
  assert.deepEqual(start.point, result.points[0]);
  let before = start.distance_m;
  for (const direction of rest) {
    assert.ok((TURNS as readonly string[]).includes(direction.turn));
    assert.notEqual(direction.turn, "depart");
    assert.ok(direction.distance_m >= before);
    assert.equal(direction.joined, direction.distance_m - before < GROUP_M);
    before = direction.distance_m;
  }
});

test("only a direction without a street of its own runs along one", () => {
  for (const direction of result.directions) {
    if (direction.street !== null) assert.equal(direction.along, null);
  }
  assert.ok(result.directions.some((d) => d.street === null && d.along !== null));
  // An API older than TASK-060 leaves it out: still a Direction (tsc).
  const older: Omit<Direction, "along"> extends Direction ? true : false = true;
  assert.ok(older);
});

test("an image outline, its route request and its refusal", () => {
  assert.ok(imageFields);
  const [outline, request, error] = typedImage;
  assert.deepEqual([...IMAGE_REASONS], imageReasons);
  assert.equal(MAX_IMAGE_BYTES, imageLimits.max_image_bytes);
  assert.equal(MAX_OUTLINE_POINTS, imageLimits.max_outline_points);
  assert.ok(imageOutlineRequest.image.length > 0);
  // The route request sends the outline back unchanged.
  assert.deepEqual(request.outline, outline.points);
  assert.deepEqual(outline.points.at(0), outline.points.at(-1));
  assert.equal(outline.points.length, outline.image_points.length);
  assert.ok(outline.points.flat().every((v) => Math.abs(v) <= 1));
  assert.ok(outline.image_points.flat().every((v) => v >= 0 && v <= 1));
  assert.ok(outline.points.length - 1 <= MAX_OUTLINE_POINTS);
  assert.equal(error.error.code, "image_not_usable");
  assert.ok((IMAGE_REASONS as readonly unknown[]).includes(error.error.reason));
  assert.equal(apiError.error.reason, null);
});

test("an image route has neither shape nor word", () => {
  assert.equal(imageResult.shape, null);
  assert.equal(imageResult.word, null);
  assert.deepEqual(imageResult.points.at(0), imageResult.points.at(-1));
});

test("a line drawn on an outline, the outline it gives, and its refusal", () => {
  assert.ok(editFields);
  const [edit, edited, error] = typedEdit;
  assert.deepEqual([...EDIT_REASONS], editReasons);
  assert.equal(MAX_DETAIL_POINTS, imageLimits.max_detail_points);
  assert.equal(MAX_DRAWN_POINTS, imageLimits.max_drawn_points);
  // The edit sends the outline as shown over the picture.
  assert.deepEqual(edit.image_points, imageOutline.image_points);
  assert.equal(edit.kind, "detail");
  // One detail more, in both frames; the outline itself is unchanged.
  assert.deepEqual(edited.image_points, edit.image_points);
  assert.equal(edited.strokes?.length, 1);
  assert.equal(edited.image_strokes?.length, 1);
  assert.ok(edited.points.flat().every((v) => Math.abs(v) <= 1));
  assert.equal(error.error.code, "outline_edit_rejected");
  assert.ok((EDIT_REASONS as readonly unknown[]).includes(error.error.reason));
  // The traced outline and its request are as an API and an app older than
  // TASK-079 send them: without details, still of the types.
  assert.ok(!("strokes" in imageOutline) && !("strokes" in imageRouteRequest));
});

test("alternatives are whole results from the same start, without their own", () => {
  assert.equal(MAX_ALTERNATIVES, alternativeLimits.max_alternatives);
  const alternatives = result.alternatives;
  assert.ok(alternatives.length > 0 && alternatives.length <= MAX_ALTERNATIVES);
  for (const other of alternatives) {
    const fields: Same<keyof typeof other, keyof OlderResult> = true;
    assert.ok(fields);
    assert.deepEqual(other.points.at(0), result.points.at(0));
    assert.deepEqual(other.points.at(0), other.points.at(-1));
    assert.equal(other.shape, result.shape);
    assert.deepEqual(other.alternatives, []);
  }
  assert.deepEqual(wordResult.alternatives, []);
  assert.deepEqual(imageResult.alternatives, []);
});
