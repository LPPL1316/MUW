import { type Direction, GROUP_M, type LatLon } from "@shaperoute/shared-types";

import { cumulative, nearest } from "./progress";

/**
 * The directions as a runner sees the junctions (TASK-302): the engine
 * gives one at every junction of the graph (ADR-0045), and in a town a
 * crossing on foot is two to four of them, the pavements and the zebra
 * crossings mapped as roads of their own, 5 to 25 m apart. Said one by
 * one that is «turn right in 10 m, then left, then left» for what is, on
 * the spot, one turn to the right. Here the directions that close together
 * become one manoeuvre, said once, with the turn it makes as a whole: the
 * heading of the route before it against the heading after it. One that
 * makes no turn on the same road is not said at all: a pavement changed, a
 * street crossed. The engine's directions stay as they are, in the route
 * and in the run file; only what is said and shown changes, in the voice's
 * words (no new ones).
 */

/** A direction this close to the one before, in metres along the route, is
 * part of the same manoeuvre. */
export const MERGE_M = 25;
/** A manoeuvre spans at most this much, from its first direction to its
 * last: a path that winds for a long way is not one turn. */
export const MERGE_SPAN_M = 50;

// The engine's own (directions.py): the heading of a road is taken
// HEADING_PROBE_M along it; up to TURN_MIN_DEG either side is straight on,
// from SHARP_MIN_DEG sharp, from U_TURN_MIN_DEG a U-turn.
const HEADING_PROBE_M = 20;
const TURN_MIN_DEG = 30;
const SHARP_MIN_DEG = 135;
const U_TURN_MIN_DEG = 165;
/** A heading read over less of the line than this is no heading: the
 * turn of the manoeuvre is then the sum of its directions' turns. */
const MIN_PROBE_M = 5;
/** A direction is looked for on the line this far either side of where the
 * engine says it is: the engine measures the roads, the app the points. */
const FIND_M = 50;

export type MergeOptions = {
  /** MERGE_M unless given. */
  mergeM?: number;
  /** MERGE_SPAN_M unless given. */
  spanM?: number;
};

/**
 * `directions` along `points` with each manoeuvre made of directions
 * `mergeM` or less apart said as one: where it starts, the turn it makes as
 * a whole, onto the road it ends on. A manoeuvre that makes no turn is left
 * out, unless it ends on a road of another name, which is then said
 * («straight on onto …»). The departure and a U-turn are never part of a
 * manoeuvre: they are said as the engine gives them. Directions closer than
 * GROUP_M after the end of the one before are read with it, as the engine
 * reads them (`joined`).
 */
export function simplifyDirections(
  points: LatLon[],
  directions: Direction[],
  { mergeM = MERGE_M, spanM = MERGE_SPAN_M }: MergeOptions = {},
): Direction[] {
  if (directions.length < 2 || points.length < 2) {
    return directions;
  }
  const along = cumulative(points);
  // Where each direction is on the line, in the app's metres.
  const at = directions.map(
    (direction) =>
      nearest(
        points,
        along,
        direction.point,
        direction.distance_m - FIND_M,
        direction.distance_m + FIND_M,
      ).alongM,
  );
  const said: Said[] = [];
  let group: number[] = [];

  function flush(): void {
    if (group.length > 0) {
      const made = manoeuvre(points, along, at, directions, group, said.at(-1) ?? null);
      if (made !== null) {
        said.push(made);
      }
    }
    group = [];
  }

  directions.forEach((direction, i) => {
    if (direction.turn === "depart" || direction.turn === "u-turn") {
      flush();
      said.push({ direction, endM: direction.distance_m });
      return;
    }
    const first = group[0];
    const last = group.at(-1);
    if (
      first !== undefined &&
      last !== undefined &&
      direction.distance_m - directions[last].distance_m <= mergeM &&
      direction.distance_m - directions[first].distance_m <= spanM
    ) {
      group.push(i);
      return;
    }
    flush();
    group = [i];
  });
  flush();

  return said.map(({ direction }, i) => {
    const before = said[i - 1];
    return before === undefined
      ? direction
      : { ...direction, joined: direction.distance_m - before.endM < GROUP_M };
  });
}

/** A direction to say, and where its manoeuvre ends, in the engine's
 * metres: the next one is read with it from there. */
type Said = { direction: Direction; endM: number };

/**
 * The manoeuvre of the directions at `group` (indices, in order), or null
 * when it says nothing: one direction alone is the engine's, as it is.
 * `before` is the direction said before it, whose road the runner is on.
 */
function manoeuvre(
  points: LatLon[],
  along: number[],
  at: number[],
  directions: Direction[],
  group: number[],
  before: Said | null,
): Said | null {
  const firstIndex = group[0];
  const lastIndex = group[group.length - 1];
  const first = directions[firstIndex];
  const last = directions[lastIndex];
  if (group.length === 1) {
    return { direction: first, endM: first.distance_m };
  }
  const totalM = along[along.length - 1] ?? 0;
  // The headings either side, not across the directions next to it.
  const inFromM = Math.max(
    at[firstIndex] - HEADING_PROBE_M,
    firstIndex > 0 ? at[firstIndex - 1] : 0,
  );
  const outToM = Math.min(
    at[lastIndex] + HEADING_PROBE_M,
    lastIndex + 1 < at.length ? at[lastIndex + 1] : totalM,
  );
  const summed = group.reduce((sum, i) => sum + directions[i].angle_deg, 0);
  let angle = summed;
  if (
    at[firstIndex] - inFromM >= MIN_PROBE_M &&
    outToM - at[lastIndex] >= MIN_PROBE_M
  ) {
    const heading = bearing(
      pointAt(points, along, inFromM),
      pointAt(points, along, at[firstIndex]),
    );
    const leaving = bearing(
      pointAt(points, along, at[lastIndex]),
      pointAt(points, along, outToM),
    );
    // Round the way the directions turn: two rights of 100° are a
    // U-turn, not a sharp left.
    angle = nearestTurn(signed(leaving - heading), summed);
  }
  const turn = turnOf(angle);
  if (turn === "straight" && !renamed(before?.direction.street ?? null, last.street)) {
    return null;
  }
  return {
    direction: {
      ...first,
      turn,
      // In (-180, 180], as the engine's: a U-turn either way is one.
      angle_deg: Math.round(signed(angle) * 10) / 10,
      street: last.street,
      road_type: last.road_type,
      along: last.along,
      joined: false,
    },
    endM: last.distance_m,
  };
}

/** Whether a manoeuvre straight on ends on a road the runner sees is
 * another: one with a name, none of the names of the road it came on. A
 * pavement or a path without a name, straight on, is not said. */
function renamed(came: string | null, going: string | null): boolean {
  const onto = namesOf(going);
  const from = namesOf(came);
  return onto.size > 0 && ![...onto].some((name) => from.has(name));
}

/** `angle`, or a full turn either way from it, whichever is nearest to
 * `summed`. */
function nearestTurn(angle: number, summed: number): number {
  let turned = angle;
  while (turned - summed > 180) {
    turned -= 360;
  }
  while (summed - turned > 180) {
    turned += 360;
  }
  return turned;
}

/** The kind of turn for a signed angle, positive to the right (the
 * engine's `turn_of`); beyond 180° either way it turns back. */
function turnOf(angle: number): Direction["turn"] {
  const size = Math.abs(angle);
  if (size <= TURN_MIN_DEG) {
    return "straight";
  }
  if (size >= U_TURN_MIN_DEG) {
    return "u-turn";
  }
  if (size >= SHARP_MIN_DEG) {
    return angle > 0 ? "sharp-right" : "sharp-left";
  }
  return angle > 0 ? "right" : "left";
}

/** The names of a road as a direction gives them: "A / B" is two. */
function namesOf(street: string | null): Set<string> {
  return new Set(street ? street.split(" / ") : []);
}

/** The point `m` metres along the line: segments are short, so on a
 * straight line between two of its points. */
function pointAt(points: LatLon[], along: number[], m: number): LatLon {
  let i = 1;
  while (i < points.length - 1 && along[i] < m) {
    i += 1;
  }
  const [a, b] = [points[i - 1], points[i]];
  const span = along[i] - along[i - 1];
  const t = span > 0 ? Math.min(1, Math.max(0, (m - along[i - 1]) / span)) : 0;
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

/** Compass bearing from `from` to `to`, in [0, 360), on the plane tangent
 * at `from`. */
function bearing([lat0, lon0]: LatLon, [lat, lon]: LatLon): number {
  const rad = Math.PI / 180;
  const x = (lon - lon0) * Math.cos(lat0 * rad);
  const y = lat - lat0;
  return (Math.atan2(x, y) / rad + 360) % 360;
}

/** An angle in (-180, 180]. */
function signed(angle: number): number {
  const wrapped = ((((angle + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}
