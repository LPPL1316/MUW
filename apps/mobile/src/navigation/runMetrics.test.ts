import type { LatLon } from "@shaperoute/shared-types";

import { changeLabel, CLIMB_STEP_M, climbM, kmTimesMs, splits } from "./runMetrics";
import {
  addFix,
  emptyTrack,
  pauseTrack,
  resumeTrack,
  type Track,
} from "./trackRecorder";

const START: LatLon = [46.067, 11.1215];
const METRE = 1 / 111_195;

/** A track through `steps`: metres north, seconds, and the height if any. */
function trackOf(
  steps: [northM: number, seconds: number, altitudeM?: number][],
): Track {
  return steps.reduce(
    (track, [northM, seconds, altitudeM]) =>
      addFix(track, {
        point: [START[0] + northM * METRE, START[1]],
        timeMs: seconds * 1000,
        accuracyM: 5,
        altitudeM,
      }),
    emptyTrack(),
  );
}

/** The first kilometre at 6:00, the second at 5:00, the third at 5:30. */
function threeKm(): Track {
  const steps: [number, number][] = [];
  for (let m = 0; m <= 1000; m += 50) {
    steps.push([m, m * 0.36]);
  }
  for (let m = 1050; m <= 2000; m += 50) {
    steps.push([m, 360 + (m - 1000) * 0.3]);
  }
  for (let m = 2050; m <= 3200; m += 50) {
    steps.push([m, 660 + (m - 2000) * 0.33]);
  }
  return trackOf(steps);
}

test("each whole kilometre has its time, and the change from the one before", () => {
  expect(splits(emptyTrack())).toEqual([]);
  const rows = splits(threeKm());
  expect(rows.map((row) => row.km)).toEqual([1, 2, 3]);
  expect(rows[0].seconds).toBeCloseTo(360, 0);
  expect(rows[0].change).toBeNull();
  expect(rows[1].seconds).toBeCloseTo(300, 0);
  expect(rows[1].change).toBeCloseTo(-60, 0);
  expect(rows[2].seconds).toBeCloseTo(330, 0);
  expect(rows[2].change).toBeCloseTo(30, 0);
});

test("a kilometre that ends between two fixes ends in proportion", () => {
  // 0, 900 m at 270 s, 1100 m at 330 s: the kilometre ends at 300 s.
  const times = kmTimesMs(
    trackOf([
      [0, 0],
      [900, 270],
      [1100, 330],
    ]),
  );
  expect(times).toHaveLength(1);
  expect(times[0]).toBeCloseTo(300_000, -2);
});

test("a pause is in no kilometre", () => {
  // 600 m in 3:00, ten minutes paused, 600 m more in 3:00.
  let track = trackOf([
    [0, 0],
    [300, 90],
    [600, 180],
  ]);
  track = resumeTrack(pauseTrack(track, 180_000), 780_000);
  for (const [northM, seconds] of [
    // Back where the run was paused, then on.
    [600, 780],
    [610, 781],
    [910, 871],
    [1210, 961],
  ]) {
    track = addFix(track, {
      point: [START[0] + northM * METRE, START[1]],
      timeMs: seconds * 1000,
      accuracyM: 5,
    });
  }
  const rows = splits(track);
  expect(rows).toHaveLength(1);
  // 600 m before the pause and 400 m after it: about five minutes.
  expect(rows[0].seconds).toBeGreaterThan(295);
  expect(rows[0].seconds).toBeLessThan(305);
});

test("a change reads with its sign, to the second", () => {
  expect(changeLabel(12)).toBe("+0:12");
  expect(changeLabel(-5)).toBe("-0:05");
  expect(changeLabel(-75.4)).toBe("-1:15");
  expect(changeLabel(0.3)).toBe("0:00");
});

test("the climb is the sum of the rises, and small wanderings do not count", () => {
  expect(climbM(emptyTrack())).toBeNull();
  // No height from the phone.
  expect(
    climbM(
      trackOf([
        [0, 0],
        [50, 15],
      ]),
    ),
  ).toBeNull();
  const hill = trackOf([
    [0, 0, 200],
    [50, 15, 201],
    [100, 30, 199.5],
    [150, 45, 206],
    [200, 60, 212],
    [250, 75, 205],
    [300, 90, 206.5],
    [350, 105, 210],
  ]);
  // 200 → 206 → 212, down to 205, up to 210: 6 + 6 + 5.
  expect(climbM(hill)).toBeCloseTo(17, 5);
  expect(CLIMB_STEP_M).toBe(3);
  // Flat: a height, and nothing climbed.
  expect(
    climbM(
      trackOf([
        [0, 0, 200],
        [50, 15, 200],
      ]),
    ),
  ).toBe(0);
});
