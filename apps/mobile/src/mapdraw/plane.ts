import type { LatLon } from "@shaperoute/shared-types";

/**
 * A point on the plane tangent at an origin, in metres: x to the east, y to
 * the north (TASK-281). The geometry of a figure on the map is done here,
 * never in degrees (CLAUDE.md), with the engine's own projection
 * (`route_engine/geo.py`, ROUTE_ENGINE.md §3).
 */
export type Xy = [x: number, y: number];

const EARTH_RADIUS_M = 6_371_000;
const RAD = Math.PI / 180;

/** `point` on the plane tangent at `origin`. */
export function toPlane(origin: LatLon, point: LatLon): Xy {
  return [
    (point[1] - origin[1]) * RAD * EARTH_RADIUS_M * Math.cos(origin[0] * RAD),
    (point[0] - origin[0]) * RAD * EARTH_RADIUS_M,
  ];
}

/** The point of the map at `xy` on the plane tangent at `origin`. */
export function fromPlane(origin: LatLon, [x, y]: Xy): LatLon {
  return [
    origin[0] + y / EARTH_RADIUS_M / RAD,
    origin[1] + x / (EARTH_RADIUS_M * Math.cos(origin[0] * RAD)) / RAD,
  ];
}
