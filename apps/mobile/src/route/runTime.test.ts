import type { Activity as SavedRun } from "../api/activities";
import {
  averagePace,
  durationText,
  runTimeText,
  USUAL_PACE_S_PER_KM,
  USUAL_WALK_S_PER_KM,
} from "./runTime";

function run(distance_m: number, duration_s: number, activity?: SavedRun["activity"]) {
  return { distance_m, duration_s, activity } as SavedRun;
}

test("no runs: the usual pace, said as such", () => {
  expect(averagePace([])).toMatchObject({ sPerKm: USUAL_PACE_S_PER_KM, own: false });
  expect(runTimeText(7000, averagePace([]), "km")).toBe(
    "≈ 42 min at 6:00/km (a usual pace)",
  );
});

test("the runner's pace: all the metres over all the seconds", () => {
  // 5 km in 26:40 and 10 km in 53:20: 5:20 a km.
  const pace = averagePace([run(5000, 1600), run(10000, 3200)]);
  expect(pace).toMatchObject({ sPerKm: 320, own: true });
  expect(runTimeText(7800, pace, "km")).toBe("≈ 42 min at 5:20/km");
});

test("rides, paddles, short runs and odd paces do not count", () => {
  const pace = averagePace([
    run(20000, 2400, "cycling"),
    run(3000, 1500, "paddling"),
    run(500, 150),
    run(5000, 600), // 2:00 a km: a ride saved as a run
    run(5000, 6000), // 20:00 a km: left recording
    run(5000, 1500),
  ]);
  expect(pace).toMatchObject({ sPerKm: 300, own: true });
});

test("a walk has its own pace, 12:00 a km before there is any (TASK-371)", () => {
  expect(averagePace([]).walking).toEqual({ sPerKm: USUAL_WALK_S_PER_KM, own: false });
  expect(USUAL_WALK_S_PER_KM).toBe(720);
  expect(runTimeText(5000, { sPerKm: USUAL_WALK_S_PER_KM, own: false }, "km")).toBe(
    "≈ 1 h 00 min at 12:00/km (a usual pace)",
  );
  // 5 km in 55:00 and 3 km in 33:00: 11:00 a km; runs do not count, nor a
  // walk left recording (30:00 a km) or one that was a run (5:00 a km).
  const pace = averagePace([
    run(5000, 3300, "walking"),
    run(3000, 1980, "walking"),
    run(5000, 1500),
    run(2000, 3600, "walking"),
    run(2000, 600, "walking"),
  ]);
  expect(pace.walking).toEqual({ sPerKm: 660, own: true });
  expect(pace).toMatchObject({ sPerKm: 300, own: true });
});

test("only the last ten runs", () => {
  const runs = [...Array(10).fill(run(5000, 1500)), run(5000, 3000)];
  expect(averagePace(runs).sPerKm).toBe(300);
});

test("an hour and more, and miles", () => {
  expect(durationText(65 * 60)).toBe("1 h 05 min");
  expect(durationText(10)).toBe("1 min");
  const pace = { sPerKm: 300, own: true };
  // 5:00 a km is 8:03 a mile.
  expect(runTimeText(16093, pace, "mi")).toBe("≈ 1 h 20 min at 8:03/mi");
});

test("no distance, no line", () => {
  expect(runTimeText(null, averagePace([]), "km")).toBeNull();
});
