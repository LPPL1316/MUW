import assert from "node:assert/strict";
import { test } from "node:test";

import found from "../fixtures/way-back.json" with { type: "json" };
import request from "../fixtures/way-back-request.json" with { type: "json" };
import {
  ACTIVITIES,
  type Direction,
  type LatLon,
  TURNS,
  type WayBack,
  type WayBackRequest,
} from "../src/index.ts";

// The same JSON is checked by the API's test_way_back_api.py (TASK-314).
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const pair = ([lat, lon]: number[]): LatLon => [lat ?? NaN, lon ?? NaN];

const asked: WayBackRequest = {
  activity: ACTIVITIES.find((activity) => activity === request.activity) ?? "running",
  here: pair(request.here),
  ahead: request.ahead.map(pair),
};
const answer: WayBack = {
  ...found,
  points: found.points.map(pair),
  rejoin: pair(found.rejoin),
  directions: found.directions.map((d): Direction => ({
    ...d,
    point: pair(d.point),
    turn: TURNS.find((turn) => turn === d.turn) ?? "straight",
  })),
};

const requestFields: Same<keyof typeof request, keyof WayBackRequest> = true;
const answerFields: Same<keyof typeof found, keyof WayBack> = true;
const directionFields: Same<keyof (typeof found.directions)[number], keyof Direction> =
  true;

test("the fixtures have every field of the types, and no other", () => {
  assert.ok(requestFields && answerFields && directionFields);
  assert.equal(asked.activity, request.activity);
});

test("the way starts where the runner is and ends where it rejoins", () => {
  assert.deepEqual(answer.points[0], asked.here);
  assert.deepEqual(answer.points.at(-1), answer.rejoin);
  assert.ok(answer.distance_m > 0);
  assert.ok(answer.rejoin_m >= 0);
});

test("the directions start on the first street and go along the way", () => {
  const [start, ...rest] = answer.directions;
  assert.equal(start?.turn, "depart");
  assert.equal(start?.distance_m, 0);
  let before = 0;
  for (const direction of rest) {
    assert.ok(TURNS.includes(direction.turn));
    assert.ok(direction.distance_m >= before);
    assert.ok(direction.distance_m <= answer.distance_m);
    before = direction.distance_m;
  }
  assert.deepEqual(answer.directions.at(-1)?.point, answer.rejoin);
});
