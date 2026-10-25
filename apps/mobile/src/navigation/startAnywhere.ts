import {
  type Direction,
  GROUP_M,
  type LatLon,
  type Walk,
} from "@shaperoute/shared-types";

import { metresBetween } from "../map/coordinates";
import { cumulative } from "./progress";

/**
 * A closed shape starts wherever the runner reaches it (TASK-273, ADR-0241,
 * the user's choice «Automatico, dove la tocchi»): the run begins at the
 * point of the shape where the runner first reaches it, goes all the way
 * round and ends back there, with the turns said from there. Words and open
 * shapes start at their start, as before.
 *
 * Here is the geometry: which routes, and the route turned to start at a
 * point of it, with its directions. When the runner has reached it is the
 * navigator's (navigator.ts).
 */

/** A route whose end is this close to its start is closed: as close as the
 * navigator needs to say it has arrived (ARRIVE_M). The API sends a closed
 * route with its last point its first. */
export const CLOSED_M = 25;
/** A run that joins a route this close to its start, either side, joins it
 * at its start: the route is followed as it is. */
export const AT_START_M = 25;

// The engine's own (directions.py), for the turn at the route's start, of
// which the engine says nothing: it is the last node of the route. The
// heading of a road is taken HEADING_PROBE_M along it; up to TURN_MIN_DEG
// either side is straight on, from SHARP_MIN_DEG sharp, from U_TURN_MIN_DEG
// a U-turn; a node is a junction from MIN_BRANCHES roads.
const HEADING_PROBE_M = 20;
const TURN_MIN_DEG = 30;
const SHARP_MIN_DEG = 135;
const U_TURN_MIN_DEG = 165;
const MIN_BRANCHES = 3;

/** Whether the route ends where it starts. */
export function isClosed(points: readonly LatLon[]): boolean {
  const first = points[0];
  const last = points[points.length - 1];
  return (
    points.length >= 3 &&
    first !== undefined &&
    last !== undefined &&
    metresBetween(first, last) <= CLOSED_M
  );
}

/**
 * Whether a run along `points` starts wherever it reaches them: a closed
 * route that is not a word, whose letters are read from the first, nor in
 * pieces with the pen up between them (`walks`, already checked: walksOf).
 */
export function startsAnywhere(
  points: readonly LatLon[],
  { word, walks }: { word?: string | null; walks?: readonly Walk[] },
): boolean {
  return isClosed(points) && !word && (walks?.length ?? 0) === 0;
}

/**
 * A closed route twice round, so that a fix is followed across the route's
 * start as anywhere else on it. `lengthM` is once round, with the step from
 * the last point to the first when they are not the same.
 */
export type Loop = { points: LatLon[]; along: number[]; lengthM: number };

/** The loop of a closed route whose metres along it are `along`. */
export function loopOf(points: LatLon[], along: number[]): Loop {
  const gapM = metresBetween(points[points.length - 1], points[0]);
  const twice = [...points, ...(gapM > 0 ? points : points.slice(1))];
  return {
    points: twice,
    along: cumulative(twice),
    lengthM: (along[along.length - 1] ?? 0) + gapM,
  };
}

/** A route followed from where a run joined it. */
export type JoinedRoute = {
  points: LatLon[];
  along: number[];
  directions: Direction[];
  /** Where it was joined, in metres along the route as drawn: 0 at its
   * start, where the route is the one drawn. */
  joinedAtM: number;
};

/**
 * The closed route from `joinM` metres along it round to there again, with
 * its directions at their distances from there: the route as it is when
 * that is its start (AT_START_M).
 */
export function joinRoute(
  points: LatLon[],
  along: number[],
  directions: Direction[],
  loop: Loop,
  joinM: number,
): JoinedRoute {
  const { lengthM } = loop;
  if (joinM <= AT_START_M || lengthM - joinM <= AT_START_M) {
    return { points, along, directions, joinedAtM: 0 };
  }
  const turned = cut(loop.points, loop.along, joinM, joinM + lengthM);
  return {
    points: turned,
    along: cumulative(turned),
    directions: joinDirections(points, along, directions, turned[0], joinM, lengthM),
    joinedAtM: joinM,
  };
}

/**
 * The directions from `joinM` round: they head out on the road the runner
 * is on there (the one the last direction before it took), the ones after
 * come first, then the turn at the route's start, then the ones before.
 * Read together (`joined`) by the engine's rule, GROUP_M apart.
 */
function joinDirections(
  points: LatLon[],
  along: number[],
  directions: Direction[],
  at: LatLon,
  joinM: number,
  lengthM: number,
): Direction[] {
  const depart = directions[0]?.turn === "depart" ? directions[0] : null;
  const turns = depart === null ? directions : directions.slice(1);
  const onRoad = directions.filter((direction) => direction.distance_m <= joinM).at(-1);
  const head: Direction[] =
    onRoad === undefined
      ? []
      : [
          {
            ...onRoad,
            point: at,
            distance_m: 0,
            turn: "depart",
            angle_deg: 0,
            joined: false,
          },
        ];
  const ahead = turns
    .filter((direction) => direction.distance_m >= joinM)
    .map((direction) => ({ ...direction, distance_m: direction.distance_m - joinM }));
  const behind = turns
    .filter((direction) => direction.distance_m < joinM)
    .map((direction) => ({
      ...direction,
      distance_m: direction.distance_m + lengthM - joinM,
    }));
  const atStart =
    depart === null ? null : startTurn(points, along, depart, turns.at(-1) ?? depart);
  const all = [
    ...head,
    ...ahead,
    ...(atStart === null ? [] : [{ ...atStart, distance_m: lengthM - joinM }]),
    ...behind,
  ];
  return all.map((direction, i) =>
    i === 0
      ? direction
      : {
          ...direction,
          joined: direction.distance_m - all[i - 1].distance_m < GROUP_M,
        },
  );
}

/**
 * The turn at the start of a closed route, from the road it ends on (the
 * one the last direction took, `came`) onto the road it heads out on: as the
 * engine says one at any other node. Only at a junction, and only when the
 * route turns there or changes road; null otherwise. The headings are read
 * from the route's own line, HEADING_PROBE_M either side of its start.
 */
function startTurn(
  points: LatLon[],
  along: number[],
  depart: Direction,
  came: Direction,
): Direction | null {
  const totalM = along[along.length - 1] ?? 0;
  if (depart.branches < MIN_BRANCHES || totalM < 2 * HEADING_PROBE_M) {
    return null;
  }
  const node = points[0];
  const arrival = bearing(node, pointAt(points, along, totalM - HEADING_PROBE_M)) + 180;
  const angle = signed(
    bearing(node, pointAt(points, along, HEADING_PROBE_M)) - arrival,
  );
  const from = namesOf(came.street);
  const onto = namesOf(depart.street);
  const both = [...onto].filter((name) => from.has(name));
  const changed = both.length === 0 && (from.size > 0 || onto.size > 0);
  const turn = turnOf(angle);
  if (turn === "straight" && !changed) {
    return null;
  }
  return {
    ...depart,
    turn,
    angle_deg: angle,
    street: both.length > 0 ? both.sort().join(" / ") : depart.street,
    joined: false,
  };
}

/** The kind of turn for a signed angle, positive to the right (the
 * engine's `turn_of`). */
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

/** The line of `points` from `fromM` to `toM` metres along it. */
function cut(points: LatLon[], along: number[], fromM: number, toM: number): LatLon[] {
  const line: LatLon[] = [pointAt(points, along, fromM)];
  for (let i = 0; i < points.length; i += 1) {
    if (along[i] > fromM && along[i] < toM) {
      line.push(points[i]);
    }
  }
  line.push(pointAt(points, along, toM));
  return line;
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
