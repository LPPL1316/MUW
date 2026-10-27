import type { LatLon } from "@shaperoute/shared-types";

import { metresBetween } from "../map/coordinates";
import { AHEAD_M, nearest } from "./progress";

/**
 * Where a runner off the route gets back on it (TASK-303, ADR-0263): the
 * point of the route nearest to them in a straight line, ahead of where
 * they left it. No streets are looked at: the map shows a dotted line to
 * it, the banner and the voice how far it is and which way.
 *
 * A shape crosses itself and passes the same street again later (a star, a
 * heart, an eight): the nearest point of all the route ahead may be on a
 * part kilometres on, and a runner going round a closed street would be
 * sent there, past a large piece of the drawing. So the point, and the
 * place where the run takes the runner back, are looked for only so far
 * along the route from where they left it: AHEAD_M, as near the route, and
 * REJOIN_PER_M more for each metre run since. A detour round a block skips
 * less of the route than it runs; a later part of the shape is too far on.
 */
export const REJOIN_PER_M = 2;

export type Rejoin = {
  /** The fix it is seen from: where the runner is. */
  from: LatLon;
  /** The point of the route to get back to. */
  to: LatLon;
  /** Metres along the route to it. */
  alongM: number;
  /** Metres to it in a straight line. */
  distanceM: number;
  /** Which way, in degrees clockwise from north. */
  bearingDeg: number;
};

/** How far along the route from where the runner left it they are looked
 * for, after `offRunM` metres run off it. */
export function rejoinAheadM(offRunM: number): number {
  return AHEAD_M + REJOIN_PER_M * offRunM;
}

/**
 * The point of the route between `fromM` and `toM` metres along it nearest
 * to `fix`, with how far and which way. Null when the route has no
 * stretch there.
 */
export function rejoinOf(
  points: LatLon[],
  along: number[],
  fix: LatLon,
  fromM: number,
  toM: number,
): Rejoin | null {
  const near = nearest(points, along, fix, fromM, toM);
  if (!Number.isFinite(near.offM)) {
    return null;
  }
  // `nearest` takes the whole of the segments at either end: no further.
  const alongM = Math.min(Math.max(near.alongM, fromM), toM);
  const to = pointAt(points, along, alongM);
  return {
    from: fix,
    to,
    alongM,
    distanceM: metresBetween(fix, to),
    bearingDeg: bearingOn(fix, to),
  };
}

/** The point `alongM` metres along the route. */
function pointAt(points: LatLon[], along: number[], alongM: number): LatLon {
  for (let i = 1; i < points.length; i += 1) {
    if (along[i] >= alongM) {
      const length = along[i] - along[i - 1];
      const t = length > 0 ? (alongM - along[i - 1]) / length : 0;
      const [lat0, lon0] = points[i - 1];
      const [lat1, lon1] = points[i];
      return [lat0 + t * (lat1 - lat0), lon0 + t * (lon1 - lon0)];
    }
  }
  return points[points.length - 1];
}

/** Degrees clockwise from north of the way from `from` to `to`, on the
 * plane tangent at `from`: the way is short. */
function bearingOn([lat0, lon0]: LatLon, [lat, lon]: LatLon): number {
  const east = (lon - lon0) * Math.cos((lat0 * Math.PI) / 180);
  const north = lat - lat0;
  return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
}
