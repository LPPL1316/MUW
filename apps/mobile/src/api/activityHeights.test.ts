import activities from "@shaperoute/shared-types/fixtures/activities.json";
import request from "@shaperoute/shared-types/fixtures/activity-request.json";
import type { LatLon } from "@shaperoute/shared-types";

import { answers, apiError } from "../account/testing";
import { recordedRun } from "../activities/recordedRun";
import type { SavedRun } from "../navigation/trackStore";
import { type ActivityRequest, saveActivity, withoutHeights } from "./activities";

// The heights of a run's fixes (TASK-305): sent when the phone gave them,
// for the API to count the climb; an API older than TASK-305 refuses them,
// and the run goes again without.

const URL = "http://api";
const TOKEN = "the-token";
const ID = "7c2e91a4b05d3f68";
const HEIGHTS = [200, 230, 225, 260, 240];
const plain = request as ActivityRequest;
const high: ActivityRequest = {
  ...plain,
  track: plain.track.map((fix, i) => ({ ...fix, altitude_m: HEIGHTS[i] })),
};

/** The run of the API's example as the phone keeps it, with `heights`. */
function run(heights: (number | null | undefined)[]): SavedRun {
  return {
    version: 1,
    route: request.points as LatLon[],
    similarity: request.similarity,
    track: {
      fixes: request.track.map((fix, i) => ({
        point: fix.point as LatLon,
        timeMs: fix.time_ms,
        accuracyM: fix.accuracy_m,
        altitudeM: heights[i],
      })),
      distanceM: 4007,
      pauses: [{ fromMs: 1790000300000, toMs: 1790000360000, auto: true }],
    },
    status: "arrived",
  };
}

const STAR = { shape: "star", word: null, style: null, title: null };

test("a fix with a height sends it; one without sends what it sent before", () => {
  const sent = recordedRun(run([200, null, undefined, Number.NaN, 240]), STAR);
  expect(sent?.request.track.map((fix) => fix.altitude_m)).toEqual([
    200,
    undefined,
    undefined,
    undefined,
    240,
  ]);
  expect(Object.keys(sent?.request.track[1] ?? {})).toEqual([
    "point",
    "time_ms",
    "accuracy_m",
  ]);
  // Without any height, the request of the API's example, field for field.
  expect(recordedRun(run([]), STAR)?.request).toEqual(request);
});

test("an older app's request has no heights; one without is the same", () => {
  expect(withoutHeights(high)).toEqual(plain);
  expect(withoutHeights(plain)).toBe(plain);
});

test("a run with heights an older API refuses goes again without them", async () => {
  const [saved] = activities.activities;
  const fetchFn: jest.Mock = answers(
    {
      status: 422,
      body: apiError("invalid_request", "Extra inputs are not permitted"),
    },
    { status: 201, body: saved },
  );
  const outcome = await saveActivity(URL, TOKEN, ID, high, { fetchFn, key: null });
  expect(outcome).toEqual({ kind: "ok", value: saved });
  expect(JSON.parse(String(fetchFn.mock.calls[0][1]?.body))).toEqual(high);
  expect(JSON.parse(String(fetchFn.mock.calls[1][1]?.body))).toEqual(plain);
});

test("an API that takes the heights is asked once", async () => {
  const [saved] = activities.activities;
  const fetchFn: jest.Mock = answers({ status: 201, body: saved });
  await saveActivity(URL, TOKEN, ID, high, { fetchFn, key: null });
  expect(fetchFn).toHaveBeenCalledTimes(1);
});
