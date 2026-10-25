import type { Direction, LatLon } from "@shaperoute/shared-types";

import { moveOnFootJoined } from "./joinOnFoot";
import {
  ARRIVE_M,
  type Cue,
  JOIN_M,
  type Navigation,
  onFix,
  type Reading,
  startNavigation,
  upcoming,
  waitingToJoin,
} from "./navigator";
import { type BikeWords, type OnFoot, startOnFoot } from "./onFootVoice";
import { cumulative } from "./progress";
import { resumeFollowing } from "./resume";
import { startPen } from "./penUp";
import {
  AT_START_M,
  CLOSED_M,
  isClosed,
  joinRoute,
  loopOf,
  startsAnywhere,
} from "./startAnywhere";

// A square block, 500 m a side, run anticlockwise from its south-west corner:
// east along Via Sud, north along Via Est, west along Via Nord, south along
// Via Ovest, back to the corner. A point every 50 m: index i is 50·i metres
// along. Once round is 2 km.
const ORIGIN: LatLon = [46.0, 11.0];
const M_PER_DEG_LAT = (6_371_000 * Math.PI) / 180;
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos((ORIGIN[0] * Math.PI) / 180);
function at(x: number, y: number): LatLon {
  return [ORIGIN[0] + y / M_PER_DEG_LAT, ORIGIN[1] + x / M_PER_DEG_LON];
}
/** The point `m` metres along the square, round and round. */
function onSquare(m: number): LatLon {
  const s = ((m % 2000) + 2000) % 2000;
  if (s <= 500) return at(s, 0);
  if (s <= 1000) return at(500, s - 500);
  if (s <= 1500) return at(1500 - s, 500);
  return at(0, 2000 - s);
}
const SQUARE: LatLon[] = Array.from({ length: 41 }, (_, i) => onSquare(i * 50));
SQUARE[40] = SQUARE[0];

function direction(
  turn: Direction["turn"],
  distance_m: number,
  street: string | null,
  branches = 3,
): Direction {
  return {
    node: distance_m,
    point: onSquare(distance_m),
    distance_m,
    turn,
    angle_deg: turn === "left" ? -90 : 0,
    street,
    road_type: "residential",
    branches,
    joined: false,
  };
}

const DIRECTIONS: Direction[] = [
  direction("depart", 0, "Via Sud"),
  direction("left", 500, "Via Est"),
  direction("left", 1000, "Via Nord"),
  direction("left", 1500, "Via Ovest"),
];

const EN_WORDS = {
  headNord: { say: "Head out on Via Nord", vibrate: false },
  headSud: { say: "Head out on Via Sud", vibrate: false },
  back: { say: "Back on the route.", vibrate: false },
  off: { say: "You are off the route. Head back to it.", vibrate: true },
  arrived: { say: "You have arrived.", vibrate: true },
};
/** A left turn said within ANNOUNCE_M: at the first fix there, 6 m apart. */
function leftOnto(street: string): Cue {
  return {
    say: expect.stringMatching(
      new RegExp(`^In [45]0 metres, turn left onto ${street}$`),
    ),
    vibrate: true,
  };
}

function closed(directions = DIRECTIONS): Navigation {
  return startNavigation(SQUARE, directions, "en", undefined, true).navigation;
}

/** Fixes every STEP_M along the square, from `fromM` for `metres`
 * (backwards when negative). 6 m, so that JOIN_M is not reached on the
 * dot: the fifth fix is 24 m on. */
const STEP_M = 6;
function run(fromM: number, metres: number): LatLon[] {
  const steps = Math.floor(Math.abs(metres) / STEP_M);
  const sign = metres < 0 ? -1 : 1;
  return Array.from({ length: steps + 1 }, (_, i) =>
    onSquare(fromM + sign * i * STEP_M),
  );
}

type Ran = { navigation: Navigation; cues: Cue[]; joinedAfter: number | null };

/** The navigation through `fixes`, a second apart, with all that was said. */
function follow(navigation: Navigation, fixes: LatLon[], fromMs = 0): Ran {
  const cues: Cue[] = [];
  let joinedAfter: number | null = null;
  fixes.forEach((fix, i) => {
    const reading: Reading = { accuracyM: 5, timeMs: fromMs + i * 1000 };
    const step = onFix(navigation, fix, reading, "en");
    if (waitingToJoin(navigation) && !waitingToJoin(step.navigation)) {
      joinedAfter = i + 1;
    }
    navigation = step.navigation;
    cues.push(...step.cues);
  });
  return { navigation, cues, joinedAfter };
}

describe("which routes start anywhere", () => {
  test("a closed route, not a word, not in pieces", () => {
    expect(isClosed(SQUARE)).toBe(true);
    expect(startsAnywhere(SQUARE, {})).toBe(true);
    expect(startsAnywhere(SQUARE, { word: null, walks: [] })).toBe(true);
    // A word keeps its start, closed or not; so does a shape in pieces.
    expect(startsAnywhere(SQUARE, { word: "O" })).toBe(false);
    expect(startsAnywhere(SQUARE, { walks: [[10, 12]] })).toBe(false);
  });

  test("an open route keeps its start; an end within CLOSED_M is closed", () => {
    const open = SQUARE.slice(0, 31);
    expect(isClosed(open)).toBe(false);
    expect(startsAnywhere(open, {})).toBe(false);
    const near = [...SQUARE.slice(0, 40), at(0, CLOSED_M - 5)];
    expect(isClosed(near)).toBe(true);
    expect(isClosed([...SQUARE.slice(0, 40), at(0, CLOSED_M + 5)])).toBe(false);
  });
});

describe("the route from where it is joined", () => {
  const along = cumulative(SQUARE);
  const loop = loopOf(SQUARE, along);

  test("the same square from there, with the turn at the old start", () => {
    const joined = joinRoute(SQUARE, along, DIRECTIONS, loop, 1200);
    expect(joined.joinedAtM).toBe(1200);
    expect(joined.along.at(-1)).toBeCloseTo(2000, 0);
    expect(joined.points[0][1]).toBeCloseTo(onSquare(1200)[1], 6);
    expect(joined.points.at(-1)?.[1]).toBeCloseTo(onSquare(1200)[1], 6);
    expect(
      joined.directions.map(({ turn, distance_m, street }) => [
        turn,
        Math.round(distance_m),
        street,
      ]),
    ).toEqual([
      ["depart", 0, "Via Nord"],
      ["left", 300, "Via Ovest"],
      // Of which the engine says nothing: the route's last node.
      ["left", 800, "Via Sud"],
      ["left", 1300, "Via Est"],
      ["left", 1800, "Via Nord"],
    ]);
    expect(joined.directions[2].angle_deg).toBeCloseTo(-90, 0);
  });

  test("joined within AT_START_M of the start, either side, the route is as drawn", () => {
    for (const joinM of [AT_START_M - 1, 2000 - AT_START_M + 1]) {
      const joined = joinRoute(SQUARE, along, DIRECTIONS, loop, joinM);
      expect(joined.joinedAtM).toBe(0);
      expect(joined.points).toBe(SQUARE);
      expect(joined.directions).toBe(DIRECTIONS);
    }
  });

  test("no turn at the old start where it is no junction, or straight on the same road", () => {
    const notJunction = [direction("depart", 0, "Via Sud", 2), ...DIRECTIONS.slice(1)];
    expect(
      joinRoute(SQUARE, along, notJunction, loop, 1200).directions.map((d) => d.street),
    ).toEqual(["Via Nord", "Via Ovest", "Via Est", "Via Nord"]);
    // The same square from the middle of Via Sud: straight on through it.
    const mid = Array.from({ length: 41 }, (_, i) => onSquare(250 + i * 50));
    mid[40] = mid[0];
    const midAlong = cumulative(mid);
    const midDirections = [
      direction("depart", 0, "Via Sud"),
      direction("left", 250, "Via Est"),
      direction("left", 750, "Via Nord"),
      direction("left", 1250, "Via Ovest"),
      direction("left", 1750, "Via Sud"),
    ];
    const straight = joinRoute(
      mid,
      midAlong,
      midDirections,
      loopOf(mid, midAlong),
      1000,
    );
    expect(
      straight.directions.map(({ turn, distance_m, street }) => [
        turn,
        Math.round(distance_m),
        street,
      ]),
    ).toEqual([
      ["depart", 0, "Via Nord"],
      ["left", 250, "Via Ovest"],
      ["left", 750, "Via Sud"],
      ["left", 1250, "Via Est"],
      ["left", 1750, "Via Nord"],
    ]);
  });

  test("a U-turn at the old start is said: out along a street and back", () => {
    const line = Array.from({ length: 41 }, (_, i) => at(0, i * 50 - 1000));
    const round = [...line, ...line.slice(0, -1).reverse()];
    const roundAlong = cumulative(round);
    const joined = joinRoute(
      round,
      roundAlong,
      [direction("depart", 0, "Viale"), direction("u-turn", 2000, "Viale")],
      loopOf(round, roundAlong),
      1000,
    );
    expect(joined.directions.map((d) => [d.turn, Math.round(d.distance_m)])).toEqual([
      ["depart", 0],
      ["u-turn", 1000],
      ["u-turn", 3000],
    ]);
  });
});

describe("a run along a closed route", () => {
  test("nothing is said at «Start»: where it heads out is not known yet", () => {
    const started = startNavigation(SQUARE, DIRECTIONS, "en", undefined, true);
    expect(started.cues).toEqual([]);
    expect(waitingToJoin(started.navigation)).toBe(true);
    // Any other route says it at once, as before.
    const open = startNavigation(SQUARE, DIRECTIONS, "en");
    expect(open.cues).toEqual([EN_WORDS.headSud]);
    expect(waitingToJoin(open.navigation)).toBe(false);
  });

  test("joined half-way: the turns from there, the old start's too, and the end back there", () => {
    const ran = follow(closed(), run(1200, 2000));
    expect(ran.navigation.joinedAtM).toBeCloseTo(1200, 0);
    // JOIN_M along the shape.
    expect(ran.joinedAfter).toBe(Math.ceil(JOIN_M / STEP_M) + 1);
    expect(ran.cues).toEqual([
      EN_WORDS.headNord,
      leftOnto("Via Ovest"),
      leftOnto("Via Sud"),
      leftOnto("Via Est"),
      leftOnto("Via Nord"),
      EN_WORDS.arrived,
    ]);
    expect(ran.navigation.arrived).toBe(true);
  });

  test("it arrives back where it joined, not at the route's start", () => {
    const toStart = follow(closed(), run(1200, 800 + 40));
    // At the route's start, and past it: running on.
    expect(toStart.navigation.arrived).toBe(false);
    expect(upcoming(toStart.navigation)?.direction.street).toBe("Via Est");
    const almostFixes = run(1200, 2000 - ARRIVE_M - 10);
    const almost = follow(closed(), almostFixes);
    expect(almost.navigation.arrived).toBe(false);
    const back = follow(
      almost.navigation,
      run(1200 - ARRIVE_M - 5, 15),
      almostFixes.length * 1000,
    );
    expect(back.navigation.arrived).toBe(true);
    expect(back.cues).toEqual([EN_WORDS.arrived]);
  });

  test("from the route's own start: the route as drawn, «Head out» once on it", () => {
    const ran = follow(closed(), run(0, 2000));
    expect(ran.navigation.joinedAtM).toBe(0);
    expect(ran.navigation.points).toBe(SQUARE);
    expect(ran.cues).toEqual([
      EN_WORDS.headSud,
      leftOnto("Via Est"),
      leftOnto("Via Nord"),
      leftOnto("Via Ovest"),
      EN_WORDS.arrived,
    ]);
  });

  test("from just before the route's start, across it: as from the start", () => {
    const ran = follow(closed(), run(2000 - 15, 300));
    expect(ran.navigation.joinedAtM).toBe(0);
    expect(ran.navigation.alongM).toBeCloseTo(285, -1);
    expect(ran.navigation.arrived).toBe(false);
    expect(ran.cues).toEqual([EN_WORDS.headSud]);
  });

  test("a stray fix near another part of the shape does not choose the start", () => {
    // On Via Nord; one fix on Via Sud, as a GPS stray or one the phone
    // kept from where the route was drawn.
    const fixes = [onSquare(1200), onSquare(300), ...run(1205, 200)];
    const ran = follow(closed(), fixes);
    expect(ran.navigation.joinedAtM).toBeCloseTo(1205, 0);
    expect(ran.cues[0]).toEqual(EN_WORDS.headNord);
    const kept = follow(closed(), [onSquare(0), ...run(1200, 200)]);
    expect(kept.navigation.joinedAtM).toBeCloseTo(1200, 0);
  });

  test("on a street the shape runs twice, the pass the runner goes along", () => {
    // Via Sud with a spur: at 250 m south down Via Spina for 200 m and back
    // up it, then on along Via Sud and round the block.
    const corners: [number, number][] = [
      [0, 0],
      [250, 0],
      [250, -200],
      [250, 0],
      [500, 0],
      [500, 500],
      [0, 500],
      [0, 0],
    ];
    const spurAt = (m: number): LatLon => {
      let left = m;
      for (let i = 1; i < corners.length; i += 1) {
        const [x0, y0] = corners[i - 1];
        const [x1, y1] = corners[i];
        const length = Math.hypot(x1 - x0, y1 - y0);
        if (left <= length) {
          return at(x0 + ((x1 - x0) * left) / length, y0 + ((y1 - y0) * left) / length);
        }
        left -= length;
      }
      return at(0, 0);
    };
    const spur = Array.from({ length: 49 }, (_, i) => spurAt(i * 50));
    spur[48] = spur[0];
    const turn = (t: Direction["turn"], m: number, street: string): Direction => ({
      ...direction(t, m, street),
      point: spurAt(m),
    });
    const spurDirections = [
      turn("depart", 0, "Via Sud"),
      turn("right", 250, "Via Spina"),
      turn("u-turn", 450, "Via Spina"),
      turn("right", 650, "Via Sud"),
      turn("left", 900, "Via Est"),
      turn("left", 1400, "Via Nord"),
      turn("left", 1900, "Via Ovest"),
    ];
    const fixes = (fromM: number, metres: number) =>
      Array.from({ length: Math.floor(Math.abs(metres) / STEP_M) + 1 }, (_, i) =>
        spurAt(fromM + Math.sign(metres) * i * STEP_M),
      );
    const spurRun = () =>
      startNavigation(spur, spurDirections, "en", undefined, true).navigation;
    // Half-way up Via Spina, going north: the way back up, at 550 m.
    const up = follow(spurRun(), fixes(550, 150));
    expect(up.navigation.joinedAtM).toBeCloseTo(550, 0);
    expect(up.cues).toEqual([
      { say: "Head out on Via Spina", vibrate: false },
      {
        say: expect.stringMatching(/^In [45]0 metres, turn right onto Via Sud$/),
        vibrate: true,
      },
    ]);
    // The same place going south: the way down, at 350 m, to the U-turn.
    const down = follow(spurRun(), fixes(350, 60));
    expect(down.navigation.joinedAtM).toBeCloseTo(350, 0);
    expect(upcoming(down.navigation)?.direction.turn).toBe("u-turn");
    expect(down.cues).not.toContainEqual(EN_WORDS.off);
  });

  test("crossing the shape on the way to another part of it does not join it", () => {
    // Across Via Sud at 250 m, from 35 m outside the block to 35 m inside.
    const across = Array.from({ length: 15 }, (_, i) => at(250, i * 5 - 35));
    const ran = follow(closed(), across);
    expect(waitingToJoin(ran.navigation)).toBe(true);
    expect(ran.cues).toEqual([]);
  });

  test("on the way to the shape it is off the route, then back on it where reached", () => {
    // 100 m outside Via Nord, then onto it at 1200 m.
    const outside = Array.from({ length: 12 }, () => at(300, 600));
    const ran = follow(closed(), [...outside, ...run(1200, 100)]);
    expect(ran.cues).toEqual([EN_WORDS.off, EN_WORDS.back, EN_WORDS.headNord]);
    expect(ran.navigation.joinedAtM).toBeCloseTo(1200, 0);
    expect(ran.navigation.offRoute).toBe(false);
  });

  test("a poor fix neither counts nor ends the fixes on the shape", () => {
    let navigation = closed();
    const fixes = run(1200, 30);
    navigation = onFix(navigation, fixes[0], { accuracyM: 5 }).navigation;
    navigation = onFix(navigation, fixes[1], { accuracyM: 5 }).navigation;
    const poor = onFix(navigation, onSquare(300), { accuracyM: 80 });
    expect(poor.navigation.joining).toEqual(navigation.joining);
    navigation = poor.navigation;
    for (const fix of fixes.slice(2)) {
      navigation = onFix(navigation, fix, { accuracyM: 5 }).navigation;
    }
    expect(navigation.joinedAtM).toBeCloseTo(1200, 0);
  });

  test("going the other way it joins, then is off the route: the way is the route's", () => {
    const ran = follow(closed(), run(1200, -120));
    expect(ran.navigation.joinedAtM).toBeCloseTo(1200, 0);
    expect(ran.cues).toEqual([EN_WORDS.headNord, EN_WORDS.off]);
  });

  test("open routes and words start at their start, as before", () => {
    const open = SQUARE.slice(0, 31);
    const navigation = startNavigation(open, DIRECTIONS.slice(0, 3), "en").navigation;
    // Half-way along, away from the start: off the route, as ever.
    const ran = follow(navigation, run(1200, 60));
    expect(ran.cues).toEqual([EN_WORDS.off]);
    expect(ran.navigation.joinedAtM).toBeUndefined();
  });
});

describe("with the bike on foot and after a stop", () => {
  const WORDS: BikeWords = {
    walkTheBike: (inM, metres) =>
      `walk ${inM === null ? "now" : Math.round(inM)} for ${Math.round(metres)}`,
    backOnTheBike: "ride",
  };

  test("the stretches from where the run joined, one over that point in two", () => {
    const along = cumulative(SQUARE);
    // 1150-1250 m, over the joining point; 1600-1700 m on Via Ovest.
    let onFoot: OnFoot = startOnFoot(along, [
      [23, 25],
      [32, 34],
    ]);
    let navigation = closed();
    const said: string[] = [];
    for (const fix of run(1200, 2000)) {
      const before = navigation;
      navigation = onFix(navigation, fix, { accuracyM: 5 }).navigation;
      const step = moveOnFootJoined(before, navigation, onFoot, WORDS, 5);
      onFoot = step.onFoot;
      said.push(...step.cues.map((cue) => cue.say));
    }
    expect(said).toEqual([
      // Joined at 1200 m, said at the join 24 m on: 26 m left.
      "walk now for 26",
      "ride",
      "walk 100 for 100",
      "ride",
      // 1950-2000 m from the join: to the end, so no «back on the bike».
      "walk 96 for 50",
    ]);
  });

  test("nothing is said of a stretch before the run joins the route", () => {
    const along = cumulative(SQUARE);
    const onFoot = startOnFoot(along, [[0, 2]]);
    const navigation = closed();
    const after = onFix(navigation, at(300, 600), { accuracyM: 5 }).navigation;
    expect(moveOnFootJoined(navigation, after, onFoot, WORDS).cues).toEqual([]);
  });

  test("a run that goes on joins where it joined before", () => {
    const fixes = run(1200, 300).map((point, i) => ({
      point,
      timeMs: i * 1000,
      accuracyM: 5,
    }));
    const along = cumulative(SQUARE);
    const live = follow(
      closed(),
      fixes.map((fix) => fix.point),
    );
    const resumed = resumeFollowing(
      {
        navigation: closed(),
        pen: startPen(along, [], null),
        onFoot: startOnFoot(along, []),
      },
      fixes,
    );
    expect(resumed.navigation.joinedAtM).toBe(live.navigation.joinedAtM);
    expect(resumed.navigation.alongM).toBeCloseTo(live.navigation.alongM, 6);
    expect(resumed.navigation.next).toBe(live.navigation.next);
  });
});
