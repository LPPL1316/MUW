import type { Direction, LatLon, Turn } from "@shaperoute/shared-types";

import levico from "./fixtures/levico-dead-end-u-turn.json";
import trento from "./fixtures/trento-fiere-crossings.json";
import { MERGE_M, simplifyDirections } from "./simplifyDirections";

/** Metres east and north of a point in Trento, as a position. */
const ORIGIN: LatLon = [46.0535, 11.1238];
const METRE = 1 / 111_195;
function at(eastM: number, northM: number): LatLon {
  return [
    ORIGIN[0] + northM * METRE,
    ORIGIN[1] + (eastM * METRE) / Math.cos((ORIGIN[0] * Math.PI) / 180),
  ];
}

/** A direction as the engine gives it, at `where` (metres east, north). */
function direction(
  turn: Turn,
  angleDeg: number,
  distanceM: number,
  where: [number, number],
  street: string | null = null,
  roadType: string | null = "footway",
): Direction {
  return {
    node: Math.round(distanceM * 10),
    point: at(...where),
    distance_m: distanceM,
    turn,
    angle_deg: angleDeg,
    street,
    road_type: roadType,
    branches: 3,
    joined: false,
  };
}

const DEPART = direction("depart", 0, 0, [0, 0], "Via Roma", "residential");

/** The engine's directions read with the one before, by its own rule. */
function joinedAsEngine(directions: Direction[]): Direction[] {
  return directions.map((d, i) =>
    i === 0 ? d : { ...d, joined: d.distance_m - directions[i - 1].distance_m < 15 },
  );
}

const said = (directions: Direction[]) =>
  directions.map((d) => [d.distance_m, d.turn, d.street]);

describe("a junction crossed on foot (TASK-302)", () => {
  // North along Via Roma, onto the zebra crossing to the right, the
  // pavement to the left, then left along Via Verdi: one turn left.
  const points = [at(0, 0), at(0, 200), at(10, 200), at(10, 210), at(-90, 210)];
  const directions = joinedAsEngine([
    DEPART,
    direction("right", 90, 200, [0, 200]),
    direction("left", -90, 210, [10, 200]),
    direction("left", -90, 220, [10, 210], "Via Verdi", "residential"),
  ]);

  test("is said as one turn, the way it turns as a whole, onto the road it ends on", () => {
    const simplified = simplifyDirections(points, directions);
    expect(said(simplified)).toEqual([
      [0, "depart", "Via Roma"],
      [200, "left", "Via Verdi"],
    ]);
    const [, turn] = simplified;
    // Where it starts: the voice counts the metres to it.
    expect(turn.point).toEqual(directions[1].point);
    expect(turn.angle_deg).toBeCloseTo(-90, 0);
    expect(turn.road_type).toBe("residential");
    expect(turn.joined).toBe(false);
  });

  test("leaves the engine's directions as they are", () => {
    const before = JSON.parse(JSON.stringify(directions));
    simplifyDirections(points, directions);
    expect(directions).toEqual(before);
  });

  test("closer together than the distance given only", () => {
    expect(simplifyDirections(points, directions, { mergeM: 5 })).toEqual(directions);
    expect(MERGE_M).toBe(25);
  });
});

describe("a manoeuvre that does not turn", () => {
  // Across the street and on along the other pavement, 12 m to the right.
  const points = [at(0, 0), at(0, 200), at(12, 200), at(12, 500)];

  test("is not said along the same road", () => {
    const directions = joinedAsEngine([
      DEPART,
      direction("right", 90, 200, [0, 200]),
      direction("left", -90, 212, [12, 200], "Via Roma", "residential"),
    ]);
    expect(said(simplifyDirections(points, directions))).toEqual([
      [0, "depart", "Via Roma"],
    ]);
  });

  test("nor onto a path without a name", () => {
    const directions = joinedAsEngine([
      DEPART,
      direction("right", 90, 200, [0, 200]),
      direction("left", -90, 212, [12, 200]),
    ]);
    expect(said(simplifyDirections(points, directions))).toEqual([
      [0, "depart", "Via Roma"],
    ]);
  });

  test("is «straight on» onto a road of another name", () => {
    const directions = joinedAsEngine([
      DEPART,
      direction("right", 90, 200, [0, 200]),
      direction("left", -90, 212, [12, 200], "Via Verdi", "residential"),
    ]);
    expect(said(simplifyDirections(points, directions))).toEqual([
      [0, "depart", "Via Roma"],
      [200, "straight", "Via Verdi"],
    ]);
  });
});

test("turns further apart than MERGE_M are each said, as the engine gives them", () => {
  const points = [at(0, 0), at(0, 200), at(60, 200), at(60, 400)];
  const directions = joinedAsEngine([
    DEPART,
    direction("right", 90, 200, [0, 200]),
    direction("left", -90, 260, [60, 200], "Via Verdi"),
  ]);
  expect(simplifyDirections(points, directions)).toEqual(directions);
});

test("a U-turn and the departure are never part of a manoeuvre", () => {
  const points = [
    at(0, 0),
    at(0, 200),
    at(8, 200),
    at(0, 200),
    at(0, 215),
    at(-50, 215),
  ];
  const directions = joinedAsEngine([
    DEPART,
    direction("right", 10, 8, [0, 8]),
    direction("right", 90, 200, [0, 200]),
    direction("u-turn", 180, 208, [8, 200]),
    direction("left", -90, 231, [0, 215], "Via Verdi"),
  ]);
  const simplified = simplifyDirections(points, directions);
  expect(said(simplified)).toEqual([
    [0, "depart", "Via Roma"],
    [8, "right", null],
    [200, "right", null],
    [208, "u-turn", null],
    [231, "left", "Via Verdi"],
  ]);
  // Still read with the one before, as the engine said.
  expect(simplified.map((d) => d.joined)).toEqual([false, true, false, true, false]);
});

test("a path winding for long is not one turn: MERGE_SPAN_M at most", () => {
  // North 200 m, then a turn of 45° to the right every 20 m, seven times.
  const points: LatLon[] = [at(0, 0)];
  const directions: Direction[] = [DEPART];
  let [x, y] = [0, 200];
  points.push(at(x, y));
  for (let k = 0; k < 7; k += 1) {
    directions.push(direction("right", 45, 200 + 20 * k, [x, y]));
    const heading = (45 * (k + 1) * Math.PI) / 180;
    x += 20 * Math.sin(heading);
    y += 20 * Math.cos(heading);
    points.push(at(x, y));
  }
  points.push(at(x + 100, y));
  const simplified = simplifyDirections(points, joinedAsEngine(directions));
  expect(simplified.map((d) => d.distance_m)).toEqual([0, 200, 260, 320]);
  expect(simplified.slice(1).every((d) => d.turn.endsWith("right"))).toBe(true);
});

test("two turns to the right of 100° each turn back, not sharp left", () => {
  const rad = Math.PI / 180;
  const corner: [number, number] = [
    15 * Math.sin(100 * rad),
    200 + 15 * Math.cos(100 * rad),
  ];
  const end: [number, number] = [
    corner[0] + 100 * Math.sin(200 * rad),
    corner[1] + 100 * Math.cos(200 * rad),
  ];
  const points = [at(0, 0), at(0, 200), at(...corner), at(...end)];
  const directions = joinedAsEngine([
    DEPART,
    direction("right", 100, 200, [0, 200]),
    direction("right", 100, 215, corner),
  ]);
  const [, turn] = simplifyDirections(points, directions);
  expect(turn.turn).toBe("u-turn");
  // The angle stays within (-180, 180], as the engine's.
  expect(turn.angle_deg).toBeCloseTo(-160, 0);
});

test("a route with fewer than two directions is left as it is", () => {
  const points = [at(0, 0), at(0, 100)];
  const one = [DEPART];
  expect(simplifyDirections(points, one)).toBe(one);
});

describe("a real walk in Trento, from Trento Fiere (OSM, the engine's directions)", () => {
  const points = trento.points as LatLon[];
  const directions = trento.directions as Direction[];
  const simplified = simplifyDirections(points, directions);

  test("the crossing onto Viale Rovereto is one turn right, not four", () => {
    // The engine: right, then left, left, right in 25 m.
    expect(
      said(directions.filter((d) => d.distance_m >= 909 && d.distance_m <= 935)),
    ).toEqual([
      [909.4, "right", null],
      [921.9, "left", null],
      [930.8, "left", null],
      [934.5, "right", "Viale Rovereto"],
    ]);
    expect(
      said(simplified.filter((d) => d.distance_m >= 909 && d.distance_m <= 935)),
    ).toEqual([[909.4, "right", "Viale Rovereto"]]);
  });

  test("a pavement changed on the way is not said", () => {
    expect(directions.some((d) => d.distance_m === 1187.4)).toBe(true);
    expect(simplified.some((d) => d.distance_m === 1187.4)).toBe(false);
  });

  test("30 directions become 13, none of them closer than MERGE_M but the first", () => {
    expect(directions).toHaveLength(30);
    expect(simplified.map((d) => [d.distance_m, d.turn])).toEqual([
      [0, "depart"],
      [11.2, "left"],
      [123.2, "left"],
      [292.3, "right"],
      [428.4, "left"],
      [549.5, "right"],
      [756.9, "right"],
      [789.3, "left"],
      [909.4, "right"],
      [1059, "left"],
      [1401.2, "right"],
      [1682.8, "right"],
      [1782.2, "right"],
    ]);
    // Only the turn just after the start is read with the departure.
    expect(simplified.filter((d) => d.joined).map((d) => d.distance_m)).toEqual([11.2]);
  });
});

describe("a real walk in Levico into a dead end (TASK-271's graph)", () => {
  // `levico_walk_1km.graphml` of the engine's tests: left onto Viale Lido,
  // left into a footway that ends 3.8 m on, back, and left again, all in
  // 25 m.
  const points = levico.points as LatLon[];
  const directions = levico.directions as Direction[];
  const simplified = simplifyDirections(points, directions);
  const near = (list: Direction[]) =>
    list.filter((d) => d.distance_m >= 400 && d.distance_m <= 430);

  test("the U-turn, and the turns too close to it, are said as today", () => {
    expect(near(directions).map((d) => d.turn)).toEqual([
      "left",
      "left",
      "u-turn",
      "left",
    ]);
    expect(near(simplified)).toEqual(near(directions));
  });

  test("the U-turn is never part of a manoeuvre, nor a turn of another kind", () => {
    const uTurns = (list: Direction[]) => list.filter((d) => d.turn === "u-turn");
    expect(uTurns(directions)).toHaveLength(1);
    expect(uTurns(simplified)).toEqual(uTurns(directions));
  });
});

test("the arrival is never part of a manoeuvre, nor the turns too close to it", () => {
  // The junction of «a junction crossed on foot», 24 m from the end: its
  // last turn is within ARRIVE_M of it, though the way on is long enough to
  // read the turn.
  const points = [at(0, 0), at(0, 270), at(10, 270), at(10, 280), at(-14, 280)];
  const directions = joinedAsEngine([
    DEPART,
    direction("right", 90, 270, [0, 270]),
    direction("left", -90, 280, [10, 270]),
    direction("left", -90, 290, [10, 280], "Via Verdi"),
  ]);
  expect(simplifyDirections(points, directions)).toEqual(directions);
});

describe.each([
  ["Trento", trento],
  ["Levico", levico],
])("all along the real walk in %s", (_, walk) => {
  const points = walk.points as LatLon[];
  const directions = walk.directions as Direction[];

  test("every direction further than MERGE_M from the ones beside it is as today", () => {
    const apart = directions.filter((d, i) => {
      const before = directions[i - 1];
      const after = directions[i + 1];
      return (
        (before === undefined || d.distance_m - before.distance_m > MERGE_M) &&
        (after === undefined || after.distance_m - d.distance_m > MERGE_M)
      );
    });
    expect(apart.length).toBeGreaterThanOrEqual(4);
    const simplified = simplifyDirections(points, directions);
    for (const direction of apart) {
      expect(simplified).toContainEqual(direction);
    }
  });

  test("with nothing closer than mergeM, nothing changes", () => {
    expect(simplifyDirections(points, directions, { mergeM: 0 })).toEqual(directions);
  });
});
