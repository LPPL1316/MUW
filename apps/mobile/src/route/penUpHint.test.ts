import type {
  ImageRouteRequest,
  RouteRequest,
  RouteResult,
} from "@shaperoute/shared-types";
import word from "@shaperoute/shared-types/fixtures/route-result-word.json";

import type { AnyRouteRequest } from "../api/routes";
import { penUpHint, withPenUp } from "./penUpHint";
import type { RouteProblem, RouteState } from "./useRouteRequest";

const oneLine: RouteRequest = {
  start: [46.0671, 11.1214],
  word: "SMILE",
  style: "round",
  distance_m: 15000,
  activity: "running",
};

/** The engine's route for the word: as the contract's example, with
 * `similarity` and `distance_m` said. */
function route(similarity: number, distance_m = 15000): RouteResult {
  return { ...(word as unknown as RouteResult), word: "SMILE", similarity, distance_m };
}

function done(request: AnyRouteRequest, result: RouteResult): RouteState {
  return { status: "done", request, result };
}

function failed(request: AnyRouteRequest, problem: RouteProblem): RouteState {
  return { status: "failed", request, problem };
}

const notDrawable: RouteProblem = {
  kind: "api_error",
  code: "shape_not_drawable",
  message: "word does not fit the road network here",
  suggested_distance_m: null,
};

test("a word in one line that came out good is left as it is", () => {
  expect(penUpHint(done(oneLine, route(0.9)))).toBe(false);
  expect(penUpHint(done(oneLine, route(0.97, 16400)))).toBe(false);
  expect(penUpHint(done(oneLine, route(0.95, 13600)))).toBe(false);
});

test("a word in one line below the similarity of a good route is offered the pen up", () => {
  expect(penUpHint(done(oneLine, route(0.89)))).toBe(true);
  expect(penUpHint(done(oneLine, route(0.67)))).toBe(true);
});

test("a word in one line more than 10 % off the distance is offered the pen up", () => {
  expect(penUpHint(done(oneLine, route(0.95, 16600)))).toBe(true);
  expect(penUpHint(done(oneLine, route(0.95, 13400)))).toBe(true);
});

test("the engine's choice is judged, not the alternative on screen", () => {
  const good = route(0.93);
  const poor = route(0.82);
  // The user looks at a poor alternative: the word came out all the same.
  expect(penUpHint(done(oneLine, poor), good)).toBe(false);
  // The user looks at a good alternative of a poor choice: still offered.
  expect(penUpHint(done(oneLine, good), poor)).toBe(true);
});

test("a short word in one line is offered the pen up too", () => {
  const ciao: RouteRequest = { ...oneLine, word: "CIAO", distance_m: 12000 };
  expect(penUpHint(done(ciao, route(0.85, 12000)))).toBe(true);
  expect(penUpHint(done(ciao, route(0.95, 12000)))).toBe(false);
});

test("a word that does not fit the roads in one line is offered the pen up", () => {
  expect(penUpHint(failed(oneLine, notDrawable))).toBe(true);
  expect(
    penUpHint(failed(oneLine, { ...notDrawable, suggested_distance_m: 18000 })),
  ).toBe(true);
});

test("other failures say nothing of the pen", () => {
  expect(penUpHint(failed(oneLine, { kind: "timeout" }))).toBe(false);
  expect(
    penUpHint(
      failed(oneLine, { kind: "unreachable", url: "http://192.168.1.23:8000" }),
    ),
  ).toBe(false);
  expect(
    penUpHint(
      failed(oneLine, {
        kind: "api_error",
        code: "engine_error",
        message: "the route could not be drawn",
      }),
    ),
  ).toBe(false);
});

test("a word already asked with the pen up is not offered it again", () => {
  const lifted: RouteRequest = { ...oneLine, pen_up: true };
  expect(penUpHint(done(lifted, route(0.7)))).toBe(false);
  expect(penUpHint(failed(lifted, notDrawable))).toBe(false);
  // Off is one line, as a request without the field.
  expect(penUpHint(done({ ...oneLine, pen_up: false }, route(0.7)))).toBe(true);
});

test("a single letter, a shape, a picture or the water are never offered it", () => {
  const letter: RouteRequest = { ...oneLine, word: "O", distance_m: 3000 };
  expect(penUpHint(done(letter, route(0.7, 3000)))).toBe(false);
  const heart: RouteRequest = {
    start: [46.0671, 11.1214],
    shape: "heart",
    distance_m: 15000,
    activity: "running",
  };
  expect(penUpHint(done(heart, { ...route(0.7), shape: "heart", word: null }))).toBe(
    false,
  );
  expect(penUpHint(failed(heart, notDrawable))).toBe(false);
  const picture: ImageRouteRequest = {
    start: [46.0671, 11.1214],
    outline: [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    distance_m: 15000,
    activity: "running",
  };
  expect(penUpHint(done(picture, { ...route(0.7), word: null }))).toBe(false);
  const paddle: RouteRequest = { ...oneLine, activity: "paddling" };
  expect(penUpHint(done(paddle, route(0.7)))).toBe(false);
});

test("by bike a word in one line is offered the pen up as on foot", () => {
  const ride: RouteRequest = { ...oneLine, activity: "cycling", distance_m: 20000 };
  expect(penUpHint(done(ride, route(0.8, 20000)))).toBe(true);
});

test("nothing is offered while waiting or before a request", () => {
  expect(penUpHint({ status: "idle" })).toBe(false);
  expect(
    penUpHint({ status: "waiting", request: oneLine, startedAt: 0, phase: "sending" }),
  ).toBe(false);
});

test("«Lift the pen» asks the same word with the pen up", () => {
  expect(withPenUp(oneLine)).toEqual({
    start: [46.0671, 11.1214],
    word: "SMILE",
    style: "round",
    pen_up: true,
    distance_m: 15000,
    activity: "running",
  });
  expect(withPenUp({ ...oneLine, pen_up: false })).toEqual({
    ...oneLine,
    pen_up: true,
  });
  const heart: RouteRequest = {
    start: [46.0671, 11.1214],
    shape: "heart",
    distance_m: 15000,
    activity: "running",
  };
  expect(withPenUp(heart)).toBe(heart);
});
