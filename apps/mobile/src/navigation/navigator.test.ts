import type { Direction, LatLon } from "@shaperoute/shared-types";

import {
  ANNOUNCE_M,
  ARRIVE_FIXES,
  BACK_FIXES,
  chainFrom,
  type Cue,
  GAP_MS,
  type Navigation,
  OFF_SECONDS,
  onFix,
  type Reading,
  remainingM,
  startNavigation,
  upcoming,
} from "./navigator";
import { cumulative, locate, OFF_ROUTE_M } from "./progress";
import { RIDE_ANNOUNCE_M } from "./ride";

// A route due east along a parallel, then back west on the same street:
// 1 km out, 1 km back. 0.001° of longitude here is about 77 m.
const LAT = 46.0;
const M_PER_DEG_LON = 77_214;
function east(m: number): LatLon {
  return [LAT, 11.0 + m / M_PER_DEG_LON];
}
function north(m: number, from: LatLon): LatLon {
  return [from[0] + m / 111_195, from[1]];
}
const OUT: LatLon[] = [0, 250, 500, 750, 1000].map(east);
const POINTS: LatLon[] = [...OUT, ...OUT.slice(0, -1).reverse()];

function direction(
  turn: Direction["turn"],
  distance_m: number,
  street: string | null,
  joined = false,
): Direction {
  return {
    node: distance_m,
    point: east(distance_m <= 1000 ? distance_m : 2000 - distance_m),
    distance_m,
    turn,
    angle_deg: 0,
    street,
    road_type: "residential",
    branches: 3,
    joined,
  };
}

const DIRECTIONS: Direction[] = [
  direction("depart", 0, "Via Roma"),
  direction("left", 400, "Via Verdi"),
  direction("right", 408, "Via Bianchi", true),
  direction("u-turn", 1000, "Via Roma"),
];

test("the route is measured in metres along it", () => {
  const along = cumulative(OUT);
  expect(along[along.length - 1]).toBeCloseTo(1000, -1);
});

test("a fix is placed near where the runner was, not on the way back", () => {
  const along = cumulative(POINTS);
  // At 300 m out, the street is also the way back at 1700 m.
  const out = locate(POINTS, along, east(300), 280);
  expect(out.alongM).toBeCloseTo(300, -1);
  expect(out.offM).toBeLessThan(1);
  const back = locate(POINTS, along, east(300), 1650);
  expect(back.alongM).toBeCloseTo(1700, -1);
});

test("the start says where to head out, without vibrating", () => {
  const { cues } = startNavigation(POINTS, DIRECTIONS);
  expect(cues).toEqual([{ say: "Head out on Via Roma", vibrate: false }]);
});

test("a turn is said once, within ANNOUNCE_M, with the ones joined to it", () => {
  let { navigation } = startNavigation(POINTS, DIRECTIONS);
  const far = onFix(navigation, east(300));
  expect(far.cues).toEqual([]);
  navigation = far.navigation;
  const near = onFix(navigation, east(400 - ANNOUNCE_M + 10));
  expect(near.cues).toEqual([
    {
      say: "In 40 metres, turn left onto Via Verdi, then turn right onto Via Bianchi",
      vibrate: true,
    },
  ]);
  const again = onFix(near.navigation, east(380));
  expect(again.cues).toEqual([]);
  // Past both, the next one is the U-turn, not the joined right.
  const past = onFix(again.navigation, east(430));
  expect(upcoming(past.navigation)?.direction.turn).toBe("u-turn");
});

test("on a bike a turn is said RIDE_ANNOUNCE_M ahead (TASK-216); a run as before", () => {
  const ride = startNavigation(POINTS, DIRECTIONS, "en", RIDE_ANNOUNCE_M).navigation;
  // 110 m before the turn: too far for a bike too.
  expect(onFix(ride, east(290)).cues).toEqual([]);
  const near = onFix(onFix(ride, east(290)).navigation, east(300));
  expect(near.cues).toEqual([
    {
      say: "In 100 metres, turn left onto Via Verdi, then turn right onto Via Bianchi",
      vibrate: true,
    },
  ]);
  expect(onFix(near.navigation, east(360)).cues).toEqual([]);
  // A run at the same fixes waits for ANNOUNCE_M, as before.
  const run = startNavigation(POINTS, DIRECTIONS).navigation;
  expect(onFix(run, east(300)).cues).toEqual([]);
  expect(onFix(run, east(350)).cues).toEqual([
    {
      say: "In 50 metres, turn left onto Via Verdi, then turn right onto Via Bianchi",
      vibrate: true,
    },
  ]);
  // A navigation made without the distance, as before TASK-216.
  const { announceM: _announceM, ...before } = run;
  expect(onFix(before, east(300)).cues).toEqual([]);
  expect(onFix(before, east(350)).cues).toHaveLength(1);
});

const OFF_CUE: Cue = { say: "You are off the route. Head back to it.", vibrate: true };
/** Said after it, once (TASK-303): where the route is. */
const WHERE_CUE: Cue = {
  say: expect.stringMatching(/^The route is \d+ metres away, to the [a-z-]+\.$/),
  vibrate: false,
};
const BACK_CUE: Cue = { say: "Back on the route.", vibrate: false };
/** A fix every 2 s, as the phone gives them at a running pace (6 m apart). */
const FIX_S = 2;

/** Runs fix after fix from `navigation`; returns every cue and when it came. */
function run(
  navigation: Navigation,
  fixes: { at: LatLon; reading?: Reading }[],
): { navigation: Navigation; cues: { index: number; cue: Cue }[] } {
  const cues: { index: number; cue: Cue }[] = [];
  fixes.forEach(({ at, reading }, index) => {
    const result = onFix(navigation, at, reading ?? { timeMs: index * FIX_S * 1000 });
    navigation = result.navigation;
    cues.push(...result.cues.map((cue) => ({ index, cue })));
  });
  return { navigation, cues };
}

// GPS error across the street, in metres: it strays in runs of a few
// seconds, as it does between buildings, up to 23 m beyond the far pavement.
const NOISE_M = [
  0, 6, -4, 12, 19, 20, 23, 9, -2, -8, 5, 14, 21, 19, 3, -6, 11, 16, 22, 7,
];

test("the far pavement with a stray GPS is never off the route", () => {
  const { navigation } = startNavigation(POINTS, DIRECTIONS);
  // Along the far pavement, 22 m from the route, for 120 fixes (4 minutes).
  const fixes = Array.from({ length: 120 }, (_, i) => ({
    at: north(22 + NOISE_M[i % NOISE_M.length], east(20 + 6 * i)),
  }));
  expect(fixes.some(({ at }) => at[0] - LAT > OFF_ROUTE_M / 111_195)).toBe(true);
  const result = run(navigation, fixes);
  expect(result.cues.map(({ cue }) => cue)).not.toContainEqual(OFF_CUE);
  expect(result.navigation.offRoute).toBe(false);
  expect(result.navigation.alongM).toBeGreaterThan(600);
});

test("one fix 60 m away is not off the route", () => {
  const { navigation } = startNavigation(POINTS, DIRECTIONS);
  const result = run(navigation, [
    { at: east(100) },
    { at: north(60, east(106)) },
    { at: east(112) },
    { at: east(118) },
  ]);
  expect(result.cues).toEqual([]);
  expect(result.navigation.offRoute).toBe(false);
});

test("a wrong parallel street is off the route within seconds", () => {
  const { navigation } = startNavigation(POINTS, DIRECTIONS);
  // On the route to 100 m, then along a street 55 m north of it.
  const fixes = Array.from({ length: 20 }, (_, i) => {
    const m = 40 + 6 * i;
    return { at: m <= 100 ? east(m) : north(55 + (NOISE_M[i] - 8) / 2, east(m)) };
  });
  const firstOff = fixes.findIndex(({ at }) => at[0] > LAT);
  const result = run(navigation, fixes);
  const said = result.cues.filter(({ cue }) => cue.say === OFF_CUE.say);
  expect(said).toHaveLength(1);
  const seconds = (said[0].index - firstOff) * FIX_S;
  expect(seconds).toBeGreaterThanOrEqual(OFF_SECONDS);
  expect(seconds).toBeLessThanOrEqual(OFF_SECONDS + 2 * FIX_S);
  expect(said[0].cue).toEqual(OFF_CUE);
});

test("off the route is said once, and the way back after BACK_FIXES", () => {
  const { navigation } = startNavigation(POINTS, DIRECTIONS);
  const off = run(
    navigation,
    Array.from({ length: 10 }, (_, i) => ({
      at: north(OFF_ROUTE_M + 20, east(100 + 6 * i)),
    })),
  );
  expect(off.navigation.offRoute).toBe(true);
  expect(off.cues.map(({ cue }) => cue)).toEqual([OFF_CUE, WHERE_CUE]);
  const first = onFix(off.navigation, east(160), { accuracyM: 8, timeMs: 30_000 });
  expect(BACK_FIXES).toBe(2);
  expect(first.cues).toEqual([]);
  expect(first.navigation.offRoute).toBe(true);
  const back = onFix(first.navigation, east(166), { accuracyM: 8, timeMs: 32_000 });
  expect(back.navigation.offRoute).toBe(false);
  expect(back.cues[0]).toEqual(BACK_CUE);
  expect(back.navigation.alongM).toBeCloseTo(166, -1);
});

test("a fix with an 80 m error says nothing about being off", () => {
  const { navigation } = startNavigation(POINTS, DIRECTIONS);
  // A minute of poor fixes 80 m away: the phone has lost the sky.
  const poor = run(
    navigation,
    Array.from({ length: 30 }, (_, i) => ({
      at: north(80, east(100)),
      reading: { accuracyM: 80, timeMs: i * FIX_S * 1000 },
    })),
  );
  expect(poor.cues).toEqual([]);
  expect(poor.navigation.offRoute).toBe(false);
  // Nor does it bring a runner off the route back on it.
  const off = run(
    navigation,
    Array.from({ length: 10 }, (_, i) => ({ at: north(60, east(100 + 6 * i)) })),
  );
  const still = run(off.navigation, [
    { at: east(160), reading: { accuracyM: 80, timeMs: 30_000 } },
    { at: east(166), reading: { accuracyM: 80, timeMs: 32_000 } },
  ]);
  expect(still.cues).toEqual([]);
  expect(still.navigation.offRoute).toBe(true);
});

test("without times from the phone, OFF_FIXES fixes in a row are enough", () => {
  let { navigation } = startNavigation(POINTS, DIRECTIONS);
  const cues: Cue[] = [];
  for (const m of [100, 106, 112]) {
    const result = onFix(navigation, north(60, east(m)));
    navigation = result.navigation;
    cues.push(...result.cues);
  }
  expect(cues).toEqual([OFF_CUE, WHERE_CUE]);
});

test("the end of the route is said, and nothing after", () => {
  let navigation = startNavigation(POINTS, DIRECTIONS).navigation;
  // Along the way, fix by fix, as the phone gives them.
  for (let m = 50; m <= 1990; m += 40) {
    navigation = onFix(navigation, m <= 1000 ? east(m) : east(2000 - m)).navigation;
  }
  // One fix at the end is not enough (TASK-253): ARRIVE_FIXES in a row are.
  const first = onFix(navigation, east(5));
  expect(ARRIVE_FIXES).toBe(2);
  expect(first.navigation.arrived).toBe(false);
  expect(first.cues).toEqual([]);
  const end = onFix(first.navigation, east(5));
  expect(end.navigation.arrived).toBe(true);
  expect(end.cues).toContainEqual({ say: "You have arrived.", vibrate: true });
  expect(onFix(end.navigation, east(5)).cues).toEqual([]);
  expect(remainingM(end.navigation)).toBeLessThan(30);
});

test("a poor fix at the end, or one away from it, does not count towards arriving", () => {
  let navigation = startNavigation(POINTS, DIRECTIONS).navigation;
  for (let m = 50; m <= 1990; m += 40) {
    navigation = onFix(navigation, m <= 1000 ? east(m) : east(2000 - m)).navigation;
  }
  const poor = onFix(navigation, east(5), { accuracyM: 60 });
  expect(poor.navigation.arrived).toBe(false);
  const there = onFix(poor.navigation, east(5));
  expect(there.navigation.arrived).toBe(false);
  // Away again (the runner overshot): the count starts over.
  const away = onFix(there.navigation, east(40));
  expect(away.navigation.arrived).toBe(false);
  const back = onFix(away.navigation, east(8));
  expect(back.navigation.arrived).toBe(false);
  expect(onFix(back.navigation, east(6)).navigation.arrived).toBe(true);
});

test("a direction in the last metres does not stop the arrival (TASK-253)", () => {
  // A right turn 6 m before the end: never passed by PASS_M.
  const directions = [...DIRECTIONS, direction("right", 1994, "Via Roma")];
  let navigation = startNavigation(POINTS, directions).navigation;
  for (let m = 50; m <= 1990; m += 40) {
    navigation = onFix(navigation, m <= 1000 ? east(m) : east(2000 - m)).navigation;
  }
  navigation = onFix(navigation, east(5)).navigation;
  const end = onFix(navigation, east(5));
  expect(end.navigation.arrived).toBe(true);
  expect(end.cues).toContainEqual({ say: "You have arrived.", vibrate: true });
});

test("a route that passes near its own end arrives only at the end (TASK-253)", () => {
  // Out east 1 km and back along the same street: at 300 m out the fix is
  // 300 m from the end, and the end is within AHEAD_M of 1700 m. From
  // 1650 m, a fix at 60 m out (1940 m back) is placed on the way back,
  // not on the end 60 m further.
  const along = cumulative(POINTS);
  const back = locate(POINTS, along, east(60), 1650);
  expect(back.alongM).toBeCloseTo(1940, -1);
  // And the navigation does not arrive there.
  let navigation = startNavigation(POINTS, DIRECTIONS).navigation;
  for (let m = 50; m <= 1930; m += 40) {
    navigation = onFix(navigation, m <= 1000 ? east(m) : east(2000 - m)).navigation;
  }
  const near = onFix(onFix(navigation, east(60)).navigation, east(54));
  expect(near.navigation.arrived).toBe(false);
  expect(near.navigation.alongM).toBeCloseTo(1946, -1);
});

test("a chain is the direction and the joined ones after it", () => {
  expect(chainFrom(DIRECTIONS, 1).map((d) => d.turn)).toEqual(["left", "right"]);
  expect(chainFrom(DIRECTIONS, 3).map((d) => d.turn)).toEqual(["u-turn"]);
});

/** Fixes on the way out every 6 m and FIX_S, from `fromM` to `toM`, the
 * first at `startMs`, with a good accuracy. */
function outward(
  fromM: number,
  toM: number,
  startMs: number,
): { at: LatLon; reading: Reading }[] {
  const fixes: { at: LatLon; reading: Reading }[] = [];
  for (let m = fromM, i = 0; m <= toM; m += 6, i += 1) {
    fixes.push({
      at: east(m),
      reading: { accuracyM: 8, timeMs: startMs + i * FIX_S * 1000 },
    });
  }
  return fixes;
}

/** Fix by fix from `navigation`, with the readings given. */
function follow(
  navigation: Navigation,
  fixes: { at: LatLon; reading: Reading }[],
): { navigation: Navigation; cues: Cue[] } {
  const cues: Cue[] = [];
  for (const { at, reading } of fixes) {
    const result = onFix(navigation, at, reading);
    navigation = result.navigation;
    cues.push(...result.cues);
  }
  return { navigation, cues };
}

test("after a gap the runner is found further ahead than locate looks (TASK-270)", () => {
  const start = startNavigation(POINTS, DIRECTIONS).navigation;
  const before = follow(start, outward(20, 296, 0));
  expect(before.navigation.alongM).toBeCloseTo(296, -1);
  const lastMs = before.navigation.lastFixMs ?? 0;
  // Three minutes with the app behind another: the runner went on to 800 m
  // out, past the turns at 400 m, and 800 m out is the way back at 1200 m too.
  const after = follow(before.navigation, outward(800, 812, lastMs + 3 * 60_000));
  expect(GAP_MS).toBe(20_000);
  expect(after.navigation.alongM).toBeCloseTo(812, -1);
  expect(after.navigation.offRoute).toBe(false);
  expect(after.navigation.lost).toBe(false);
  // Nothing said for the turns behind, nor about being off the route.
  expect(after.cues).toEqual([]);
  // The way goes on from there: the U-turn at 1000 m is said ahead of it.
  const on = follow(after.navigation, outward(818, 956, lastMs + 3 * 60_000 + 6000));
  expect(on.cues).toHaveLength(1);
  expect(on.cues[0].say).toContain("U-turn");
});

test("without a gap, a fix beyond where locate looks is off the route, as before", () => {
  const start = startNavigation(POINTS, DIRECTIONS).navigation;
  const before = follow(start, outward(20, 296, 0));
  const lastMs = before.navigation.lastFixMs ?? 0;
  const jump = Array.from({ length: 8 }, (_, i) => ({
    at: east(800 + 6 * i),
    reading: { accuracyM: 8, timeMs: lastMs + (i + 1) * FIX_S * 1000 },
  }));
  const after = follow(before.navigation, jump);
  // The route is shown where the runner can be taken back: not where they
  // jumped to, beyond rejoinAheadM (TASK-303).
  expect(after.cues).toEqual([
    OFF_CUE,
    { say: "The route is 230 metres away, to the west.", vibrate: false },
  ]);
  expect(after.navigation.alongM).toBeCloseTo(296, -1);
});

test("after a gap, one fix ahead is not enough, and a poor one counts for nothing", () => {
  const start = startNavigation(POINTS, DIRECTIONS).navigation;
  const before = follow(start, outward(20, 296, 0));
  const backMs = (before.navigation.lastFixMs ?? 0) + 2 * 60_000;
  const poor = onFix(before.navigation, east(800), { accuracyM: 80, timeMs: backMs });
  expect(poor.navigation.lost).toBe(true);
  expect(poor.navigation.alongM).toBeCloseTo(296, -1);
  const first = onFix(poor.navigation, east(806), {
    accuracyM: 8,
    timeMs: backMs + 2000,
  });
  expect(first.navigation.found?.fixes).toBe(1);
  expect(first.navigation.alongM).toBeCloseTo(296, -1);
  const second = onFix(first.navigation, east(812), {
    accuracyM: 8,
    timeMs: backMs + 4000,
  });
  expect(second.navigation.alongM).toBeCloseTo(812, -1);
  expect(second.cues).toEqual([]);
});

test("after a gap the runner is looked for where they stopped first", () => {
  const start = startNavigation(POINTS, DIRECTIONS).navigation;
  const before = follow(start, outward(20, 296, 0));
  // A minute at a light, then on along the route.
  const lastMs = before.navigation.lastFixMs ?? 0;
  const after = follow(before.navigation, outward(302, 314, lastMs + 60_000));
  expect(after.navigation.alongM).toBeCloseTo(314, -1);
  expect(after.navigation.lost).toBe(false);
  expect(after.cues).toEqual([]);
});

test("off the route before a gap, the runner is back on it further ahead", () => {
  const start = startNavigation(POINTS, DIRECTIONS).navigation;
  const before = follow(start, outward(20, 296, 0));
  const lastMs = before.navigation.lastFixMs ?? 0;
  const off = follow(
    before.navigation,
    Array.from({ length: 10 }, (_, i) => ({
      at: north(OFF_ROUTE_M + 20, east(300 + 6 * i)),
      reading: { accuracyM: 8, timeMs: lastMs + (i + 1) * FIX_S * 1000 },
    })),
  );
  expect(off.navigation.offRoute).toBe(true);
  const backMs = (off.navigation.lastFixMs ?? 0) + 2 * 60_000;
  const back = follow(off.navigation, outward(700, 706, backMs));
  expect(back.navigation.offRoute).toBe(false);
  expect(back.navigation.alongM).toBeCloseTo(706, -1);
  expect(back.cues).toEqual([BACK_CUE]);
});

test("a runner never on the route yet is not looked for further on", () => {
  const start = startNavigation(POINTS, DIRECTIONS).navigation;
  // Waiting 300 m from the start, then a walk along the route at 800 m.
  const waiting = onFix(start, north(300, east(0)), { accuracyM: 8, timeMs: 0 });
  const walk = follow(waiting.navigation, outward(800, 836, 60_000));
  expect(walk.navigation.alongM).toBe(0);
  expect(walk.cues).toEqual([OFF_CUE, WHERE_CUE]);
});
