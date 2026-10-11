import type { LatLon } from "@shaperoute/shared-types";

import { metresBetween } from "../map/coordinates";

/**
 * Where the runner is along the route (TASK-049, ADR-0052), from a GPS fix.
 *
 * A shape crosses itself and passes the same street twice, so the nearest
 * point of the whole route may be kilometres ahead or behind. The fix is
 * placed only near where the runner last was: from BACK_M behind to AHEAD_M
 * ahead, which a runner does not cover between two fixes. On a street run
 * out and back the fix is as near to both ways: going back along the route
 * costs as much as being off it, so the way ahead wins. Going ahead costs
 * too, a little (FORWARD_COST): where the route comes back within AHEAD_M
 * (a spur, a crossing) the nearer pass wins over the later one, which a
 * fix off by a few metres would otherwise pick (TASK-253). Among the
 * places on the route (within OFF_ROUTE_M) the cheapest wins; off it, the
 * nearest.
 */
export const BACK_M = 50;
export const AHEAD_M = 300;
/** What a metre ahead along the route costs, against a metre off it: a
 * fix that strays 8 m still beats the pass of the same street 40 m on. */
export const FORWARD_COST = 0.25;
/** Farther than this from the route, a fix is off it (a GPS fix in a town
 * is often 10-20 m off, the far pavement 15-25 m; a parallel street is 50 m
 * or more). One fix is not enough to say so: see OFF_FIXES (ADR-0070). */
export const OFF_ROUTE_M = 40;

export type Located = {
  /** Metres along the route to the point nearest to the fix. */
  alongM: number;
  /** Metres from the fix to the route. */
  offM: number;
};

/** Metres along the route at each of its points. */
export function cumulative(points: LatLon[]): number[] {
  const along = [0];
  for (let i = 1; i < points.length; i += 1) {
    along.push(along[i - 1] + metresBetween(points[i - 1], points[i]));
  }
  return along;
}

/**
 * The fix placed on the route, near `fromM` (where the runner last was):
 * up to `aheadM` ahead, AHEAD_M unless the navigator looks further, after a
 * gap in the fixes (TASK-270).
 * Works in metres on the plane tangent at the fix: segments are short.
 */
export function locate(
  points: LatLon[],
  along: number[],
  fix: LatLon,
  fromM: number,
  aheadM: number = AHEAD_M,
): Located {
  // The cheapest place on the route, and the nearest off it.
  let onRoute: Located | null = null;
  let onRouteCost = Infinity;
  let nearest: Located = { alongM: fromM, offM: Infinity };
  for (let i = 1; i < points.length; i += 1) {
    if (along[i] < fromM - BACK_M) {
      continue;
    }
    if (along[i - 1] > fromM + aheadM) {
      break;
    }
    const [ax, ay] = toPlane(fix, points[i - 1]);
    const [bx, by] = toPlane(fix, points[i]);
    const dx = bx - ax;
    const dy = by - ay;
    const length2 = dx * dx + dy * dy;
    // The fix is the origin: the nearest point of the segment to (0, 0).
    const t = length2 > 0 ? clamp(-(ax * dx + ay * dy) / length2, 0, 1) : 0;
    const offM = Math.hypot(ax + t * dx, ay + t * dy);
    const alongM = along[i - 1] + t * (along[i] - along[i - 1]);
    if (offM < nearest.offM) {
      nearest = { alongM, offM };
    }
    if (offM > OFF_ROUTE_M) {
      continue;
    }
    const cost =
      offM + Math.max(0, fromM - alongM) + FORWARD_COST * Math.max(0, alongM - fromM);
    if (cost < onRouteCost) {
      onRoute = { alongM, offM };
      onRouteCost = cost;
    }
  }
  return onRoute ?? nearest;
}

/**
 * The point of the route nearest to the fix, between `fromM` and `toM`
 * metres along it, either way from where the runner was, or anywhere on it:
 * for a run that may join a closed route wherever it reaches it (TASK-273),
 * before it has a way to go along it. Works as `locate` does.
 */
export function nearest(
  points: LatLon[],
  along: number[],
  fix: LatLon,
  fromM: number = -Infinity,
  toM: number = Infinity,
): Located {
  let best: Located = { alongM: 0, offM: Infinity };
  for (let i = 1; i < points.length; i += 1) {
    if (along[i] < fromM) {
      continue;
    }
    if (along[i - 1] > toM) {
      break;
    }
    const here = onSegment(points, along, fix, i);
    if (here.offM < best.offM) {
      best = here;
    }
  }
  return best;
}

/**
 * Each pass of the route within OFF_ROUTE_M of the fix, at its point
 * nearest to it, in their order along the route: a shape passes the same
 * street twice (ADR-0039), and which pass a runner joining it is on shows
 * only from the way they go (TASK-273).
 */
export function passesNear(points: LatLon[], along: number[], fix: LatLon): Located[] {
  const passes: Located[] = [];
  let within = false;
  for (let i = 1; i < points.length; i += 1) {
    const here = onSegment(points, along, fix, i);
    if (here.offM > OFF_ROUTE_M) {
      within = false;
      continue;
    }
    const last = passes[passes.length - 1];
    if (!within || last === undefined) {
      passes.push(here);
      within = true;
    } else if (here.offM < last.offM) {
      passes[passes.length - 1] = here;
    }
  }
  return passes;
}

/** The point of the route's segment ending at point `i` nearest to the fix. */
function onSegment(points: LatLon[], along: number[], fix: LatLon, i: number): Located {
  const [ax, ay] = toPlane(fix, points[i - 1]);
  const [bx, by] = toPlane(fix, points[i]);
  const dx = bx - ax;
  const dy = by - ay;
  const length2 = dx * dx + dy * dy;
  const t = length2 > 0 ? clamp(-(ax * dx + ay * dy) / length2, 0, 1) : 0;
  return {
    alongM: along[i - 1] + t * (along[i] - along[i - 1]),
    offM: Math.hypot(ax + t * dx, ay + t * dy),
  };
}

const EARTH_RADIUS_M = 6_371_000;

function toPlane([lat0, lon0]: LatLon, [lat, lon]: LatLon): [number, number] {
  const rad = Math.PI / 180;
  return [
    (lon - lon0) * rad * EARTH_RADIUS_M * Math.cos(lat0 * rad),
    (lat - lat0) * rad * EARTH_RADIUS_M,
  ];
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
