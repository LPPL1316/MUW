/**
 * What a swim writes (TASK-323 D, the user's choice): a swimmer's pace, the
 * time of 100 m, on the share card, in «My activities» and in the Feed, with
 * the sport first. The paddle's is in paddle.test.ts.
 */
import type { LatLon } from "@shaperoute/shared-types";
import whole from "@shaperoute/shared-types/fixtures/activity.json";

import { runFacts } from "../activities/activityText";
import type { ActivityDetail } from "../api/activities";
import { postFacts } from "../feed/FeedPost";
import { SAMPLE_FEED } from "../feed/sampleFeed";
import { postOfActivity, postOfTrack, resultValue } from "../share/postRun";
import { STANDING_S_PER_KM } from "./runStats";
import {
  isSwim,
  per100S,
  SWIM_PACE_UNIT,
  SWIM_STANDING_S_PER_KM,
  swimPaceLabel,
} from "./swim";
import { addFix, emptyTrack, type Track } from "./trackRecorder";

jest.mock("expo-file-system");
jest.mock("react-native-webview");

const START: LatLon = [44.0, 12.65];
const METRE = 1 / 111_194;

/** `metres` north at 2:00 every 100 m, a fix every 10 m. */
function swum(metres: number): Track {
  let track = emptyTrack();
  for (let m = 0; m <= metres; m += 10) {
    track = addFix(track, {
      point: [START[0] + m * METRE, START[1]],
      timeMs: m * 1200,
      accuracyM: 6,
    });
  }
  return track;
}

test("only a swim is swum", () => {
  expect(isSwim("swimming")).toBe(true);
  expect(isSwim("paddling")).toBe(false);
  expect(isSwim("running")).toBe(false);
  expect(isSwim(undefined)).toBe(false);
});

test("a swimmer's pace is the time of 100 m, in every language", () => {
  expect(SWIM_PACE_UNIT).toBe("/100 m");
  expect(per100S(1200)).toBe(120);
  expect(swimPaceLabel(1000, 20 * 60_000)).toBe("2:00 /100 m");
  expect(swimPaceLabel(600, 810_000)).toBe("2:15 /100 m");
  expect(swimPaceLabel(40, 60_000)).toBeNull();
  // A swimmer stands only below 1 km/h: an easy swim is slower than a walk.
  expect(SWIM_STANDING_S_PER_KM).toBe(3600);
  expect(STANDING_S_PER_KM).toBe(1200);
});

test("the post of a swim just ended writes the pace of 100 m", () => {
  const track = swum(1000);
  expect(resultValue(postOfTrack(track, "swimming"), "pace")).toBe("2:00 /100 m");
  expect(resultValue(postOfTrack(track, "running"), "pace")).toBe("20:00 /km");
});

test("a swim of «My activities» has the pace of 100 m, its post too", () => {
  // 1.20 km in 28:48: 2:24 every 100 m.
  const swim = { distance_m: 1200, duration_s: 1728, activity: "swimming" as const };
  expect(runFacts(swim)).toBe("1.20 km · 28:48 · 2:24 /100 m");
  const detail: ActivityDetail = {
    ...(whole as ActivityDetail),
    distance_m: 1200,
    duration_s: 1728,
    activity: "swimming",
  };
  expect(resultValue(postOfActivity(detail), "pace")).toBe("2:24 /100 m");
});

test("in the Feed a swim says its sport first, and its pace of 100 m", () => {
  const [post] = SAMPLE_FEED;
  expect(
    postFacts({
      ...post!,
      shape: "heart",
      route_m: 1000,
      minutes: 20,
      activity: "swimming",
    }),
  ).toBe("Open water swim · Heart · 1.0 km · 20 min · 2:00 /100 m");
});
