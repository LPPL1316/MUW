/**
 * A run off the route and back on it further on (TASK-303, ADR-0263): the
 * user's run at Trento Fiere, where a passage was closed and the block was
 * run round. Before, the run stayed «off the route» for good.
 */
import type { Activity, Direction, LatLon } from "@shaperoute/shared-types";

import {
  ANNOUNCE_M,
  type Cue,
  JOIN_M,
  type Navigation,
  onFix,
  type Reading,
  startNavigation,
} from "./navigator";
import { cumulative, nearest } from "./progress";
import { REJOIN_PER_M } from "./rejoin";
import { announceMOf, RIDE_ANNOUNCE_M } from "./ride";
import { addFix, durationMs, emptyTrack } from "./trackRecorder";

// Metres east (x) and north (y) of a corner of Trento, on a plane.
const LAT = 46.0;
const LON = 11.0;
const M_PER_DEG_LAT = 111_195;
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos((LAT * Math.PI) / 180);
function at(x: number, y: number): LatLon {
  return [LAT + y / M_PER_DEG_LAT, LON + x / M_PER_DEG_LON];
}
function xy([lat, lon]: LatLon): [number, number] {
  return [(lon - LON) * M_PER_DEG_LON, (lat - LAT) * M_PER_DEG_LAT];
}

type Corner = [x: number, y: number];

/** The points along the corners, `stepM` apart. */
function through(corners: Corner[], stepM: number): LatLon[] {
  const points: LatLon[] = [at(...corners[0])];
  for (let i = 1; i < corners.length; i += 1) {
    const [x0, y0] = corners[i - 1];
    const [x1, y1] = corners[i];
    const steps = Math.round(Math.hypot(x1 - x0, y1 - y0) / stepM);
    for (let s = 1; s <= steps; s += 1) {
      points.push(at(x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps));
    }
  }
  return points;
}

/** The runner's fixes along the corners: 6 m apart, every `everyS` s. */
function runner(corners: Corner[], everyS = 2): { at: LatLon; reading: Reading }[] {
  return through(corners, 6).map((point, i) => ({
    at: point,
    reading: { accuracyM: 8, timeMs: i * everyS * 1000 },
  }));
}

/** Every fix's navigation and cues, in order. */
function follow(navigation: Navigation, fixes: { at: LatLon; reading: Reading }[]) {
  const steps: { fix: LatLon; navigation: Navigation; cues: Cue[] }[] = [];
  for (const { at: fix, reading } of fixes) {
    const result = onFix(navigation, fix, reading, "en");
    navigation = result.navigation;
    steps.push({ fix, navigation, cues: result.cues });
  }
  return {
    navigation,
    steps,
    said: steps.flatMap(({ cues }) => cues.map(({ say }) => say)),
  };
}

function direction(
  turn: Direction["turn"],
  distance_m: number,
  street: string,
): Direction {
  return {
    node: distance_m,
    point: at(distance_m, 0),
    distance_m,
    turn,
    angle_deg: 0,
    street,
    road_type: "residential",
    branches: 3,
    joined: false,
  };
}

// A street due east for 1.2 km. The navigator places the turns by their
// distance along the route: the two in the closed stretch, at 450 and 600 m,
// are skipped; the one at 900 m is said.
const STREET = through(
  [
    [0, 0],
    [1200, 0],
  ],
  25,
);
const TURNS: Direction[] = [
  direction("depart", 0, "Via Roma"),
  direction("right", 450, "Via Garibaldi"),
  direction("left", 600, "Via Mazzini"),
  direction("right", 900, "Via Manci"),
];

// Out at 300 m, 100 m north, 400 m east, back south and on along the route.
const ROUND_THE_BLOCK: Corner[] = [
  [0, 0],
  [300, 0],
  [300, 100],
  [700, 100],
  [700, 0],
  [1000, 0],
];

const OFF = "You are off the route. Head back to it.";
const BACK = "Back on the route.";

function start(points: LatLon[] = STREET, activity?: Activity): Navigation {
  return startNavigation(points, TURNS, "en", announceMOf(activity)).navigation;
}

test("a block run round: off once, the way back shown, back on further on", () => {
  const ran = follow(start(), runner(ROUND_THE_BLOCK));
  const offAt = ran.steps.findIndex(
    ({ cues }) => cues.length > 0 && cues[0].say === OFF,
  );
  expect(offAt).toBeGreaterThan(0);
  // Leaving the route northwards, it is right behind, to the south.
  expect(ran.steps[offAt].cues).toEqual([
    { say: OFF, vibrate: true },
    {
      say: expect.stringMatching(/^The route is \d0 metres away, to the south\.$/),
      vibrate: false,
    },
  ]);
  // While off, the way back is the route right beside the runner, ahead of
  // where they left it, and it goes with them.
  const onTheBlock = ran.steps.filter(({ fix }) => {
    const [x, y] = xy(fix);
    return Math.abs(y - 100) < 1 && x > 400 && x < 650;
  });
  expect(onTheBlock.length).toBeGreaterThan(30);
  for (const { fix, navigation } of onTheBlock) {
    const rejoin = navigation.rejoin!;
    const [x] = xy(fix);
    expect(navigation.offRoute).toBe(true);
    expect(rejoin.from).toEqual(fix);
    expect(Math.abs(xy(rejoin.to)[0] - x)).toBeLessThan(2);
    expect(Math.abs(xy(rejoin.to)[1])).toBeLessThan(1);
    expect(rejoin.alongM).toBeCloseTo(x, -1);
    expect(rejoin.distanceM).toBeCloseTo(100, 0);
    expect(rejoin.bearingDeg).toBeCloseTo(180, 0);
  }
  // Back on it at about 700 m, once JOIN_M along it.
  const backAt = ran.steps.findIndex(({ cues }) =>
    cues.some(({ say }) => say === BACK),
  );
  const back = ran.steps[backAt].navigation;
  expect(back.offRoute).toBe(false);
  expect(back.alongM).toBeGreaterThanOrEqual(700 + JOIN_M - 6);
  expect(back.alongM).toBeLessThanOrEqual(700 + JOIN_M + 12);
  expect(back.rejoin).toBeNull();
  // The turns in the stretch left out are never said; the next one is,
  // ANNOUNCE_M ahead of it.
  expect(ran.said).toEqual([
    OFF,
    expect.stringMatching(/^The route is /),
    BACK,
    // At the first fix within ANNOUNCE_M, 6 m apart.
    expect.stringMatching(/^In [45]0 metres, turn right onto Via Manci$/),
  ]);
  expectSaidAhead(ran.steps, ANNOUNCE_M);
  expect(ran.navigation.alongM).toBeCloseTo(1000, -1);
});

/** The turn at 900 m is said at the first fix within `aheadM` of it. */
function expectSaidAhead(
  steps: { navigation: Navigation; cues: Cue[] }[],
  aheadM: number,
) {
  const turnAt = steps.findIndex(({ cues }) =>
    cues.some(({ say }) => say.includes("Via Manci")),
  );
  const saidAtM = steps[turnAt].navigation.alongM;
  expect(saidAtM).toBeGreaterThanOrEqual(900 - aheadM);
  expect(saidAtM).toBeLessThan(900 - aheadM + 7);
}

test("the way back is said once, and never over a turn", () => {
  const ran = follow(start(), runner(ROUND_THE_BLOCK));
  const spoken = ran.steps
    .map(({ cues }, index) => ({ index, says: cues.map(({ say }) => say) }))
    .filter(({ says }) => says.length > 0);
  // One fix says both words as the runner leaves; nothing until they are
  // back; each turn has a fix of its own, after.
  expect(spoken.map(({ says }) => says.length)).toEqual([2, 1, 1]);
  expect(spoken[0].says[1]).toMatch(/^The route is /);
  expect(spoken[1].says).toEqual([BACK]);
  expect(spoken[1].index).toBeLessThan(spoken[2].index);
  expect(ran.said.filter((say) => say.startsWith("The route is "))).toHaveLength(1);
});

test("straying near the route while off says nothing more", () => {
  // Off the route, then on a parallel pavement, the GPS coming within
  // OFF_ROUTE_M of the route one fix at a time for a minute: never two in a
  // row there.
  const strays = [52, 35, 58, 61, 34, 49, 55, 33, 60, 47];
  const fixes = [
    ...runner([
      [0, 0],
      [300, 0],
      [300, 100],
    ]),
  ];
  const lastMs = fixes[fixes.length - 1].reading.timeMs ?? 0;
  for (let i = 1; i <= 30; i += 1) {
    fixes.push({
      at: at(300 + 6 * i, strays[i % strays.length]),
      reading: { accuracyM: 8, timeMs: lastMs + i * 2000 },
    });
  }
  const ran = follow(start(), fixes);
  expect(ran.said.filter((say) => say === OFF)).toHaveLength(1);
  expect(ran.said.filter((say) => say.startsWith("The route is "))).toHaveLength(1);
  expect(ran.said).not.toContain(BACK);
  expect(ran.navigation.offRoute).toBe(true);
  // The way back went on moving with the runner all the same.
  expect(xy(ran.navigation.rejoin!.to)[0]).toBeCloseTo(480, -1);
});

test("crossing the route further on, and on beyond it, is not getting back on it", () => {
  const across = follow(
    start(),
    runner([
      [0, 0],
      [300, 0],
      [300, 100],
      [700, 100],
      [700, -100],
      [1000, -100],
    ]),
  );
  // Some fixes were within OFF_ROUTE_M of the route as it was crossed.
  const crossing = across.steps.filter(({ fix }) => Math.abs(xy(fix)[1]) < 30);
  expect(crossing.length).toBeGreaterThan(8);
  expect(across.said).not.toContain(BACK);
  expect(across.said.filter((say) => say === OFF)).toHaveLength(1);
  expect(across.navigation.offRoute).toBe(true);
  expect(across.navigation.alongM).toBeCloseTo(300, -1);
  // The way back is still the route beside the runner, now to the north.
  const rejoin = across.navigation.rejoin!;
  expect(xy(rejoin.to)[0]).toBeCloseTo(1000, -1);
  expect(rejoin.bearingDeg).toBeCloseTo(0, 0);
});

test("the track counts every metre of the detour, and every second", () => {
  const fixes = runner(ROUND_THE_BLOCK);
  let track = emptyTrack();
  for (const { at: point, reading } of fixes) {
    track = addFix(track, { point, timeMs: reading.timeMs ?? 0, accuracyM: 8 });
  }
  // 300 + 100 + 400 + 100 + 300 m, run in 2 s steps.
  expect(track.distanceM).toBeGreaterThan(1200 * 0.99);
  expect(track.distanceM).toBeLessThan(1200 * 1.01);
  expect(durationMs(track)).toBe((fixes.length - 1) * 2000);
});

// A shape that comes back along the street of the detour later, the same
// way (a spiral, as a star or an eight does): out east along y = 0, round
// and back west along y = 200, then east again along y = 100.
const SPIRAL = through(
  [
    [0, 0],
    [1000, 0],
    [1000, 200],
    [0, 200],
    [0, 100],
    [1000, 100],
  ],
  25,
);

test("a later part of a shape that crosses itself does not take the runner on", () => {
  // Along y = 100 the runner is on the spiral's last side, the route's way:
  // the nearest of all the route ahead is there, some 2.3 km further on.
  const along = cumulative(SPIRAL);
  const onLastSide = nearest(SPIRAL, along, at(500, 100), 300);
  expect(onLastSide.offM).toBeLessThan(1);
  expect(onLastSide.alongM).toBeGreaterThan(2500);

  const ran = follow(start(SPIRAL), runner(ROUND_THE_BLOCK));
  const onTheBlock = ran.steps.filter(({ fix }) => Math.abs(xy(fix)[1] - 100) < 1);
  expect(onTheBlock.length).toBeGreaterThan(60);
  for (const { navigation } of onTheBlock) {
    // Still off the route, shown the stretch just left, on y = 0.
    expect(navigation.offRoute).toBe(true);
    expect(navigation.rejoin!.alongM).toBeLessThan(1000);
    expect(Math.abs(xy(navigation.rejoin!.to)[1])).toBeLessThan(1);
  }
  // Back on the route at about 700 m, not 2.3 km on.
  const backAt = ran.steps.findIndex(({ cues }) =>
    cues.some(({ say }) => say === BACK),
  );
  expect(ran.steps[backAt].navigation.alongM).toBeCloseTo(700 + JOIN_M, -1);
  expect(ran.navigation.alongM).toBeCloseTo(1000, -1);
});

test("the route is looked for further on the more the runner has run off it", () => {
  // 300 m on as near the route, then REJOIN_PER_M for each metre run: a
  // block of 600 m round skips at most 1.5 km of the route.
  expect(REJOIN_PER_M).toBe(2);
  const ran = follow(start(SPIRAL), runner(ROUND_THE_BLOCK));
  const last = ran.steps.filter(({ navigation }) => navigation.offRoute).pop()!;
  expect(last.navigation.offRunM).toBeGreaterThan(500);
  expect(last.navigation.offRunM).toBeLessThan(600);
});

test.each<[Activity, number]>([
  ["cycling", RIDE_ANNOUNCE_M],
  ["paddling", ANNOUNCE_M],
])("%s: the same way back, the turns said as far ahead as ever", (activity, aheadM) => {
  // A fix a second on a bike, as on the water now and then.
  const ran = follow(start(STREET, activity), runner(ROUND_THE_BLOCK, 1));
  const backAt = ran.steps.findIndex(({ cues }) =>
    cues.some(({ say }) => say === BACK),
  );
  expect(ran.steps[backAt].navigation.alongM).toBeCloseTo(700 + JOIN_M, -1);
  expect(ran.said[0]).toBe(OFF);
  expect(ran.said[1]).toMatch(/^The route is \d0 metres away, to the south\.$/);
  expectSaidAhead(ran.steps, aheadM);
  expect(ran.said).not.toContainEqual(expect.stringContaining("Via Garibaldi"));
  expect(ran.said).not.toContainEqual(expect.stringContaining("Via Mazzini"));
});
