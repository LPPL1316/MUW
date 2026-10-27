import type { LatLon } from "@shaperoute/shared-types";

import { metresBetween } from "../map/coordinates";
import { AHEAD_M, cumulative } from "./progress";
import { REJOIN_PER_M, rejoinAheadM, rejoinOf } from "./rejoin";

// A street due east: 0.001° of longitude here is about 77 m.
const LAT = 46.0;
const M_PER_DEG_LON = 77_243;
function east(m: number): LatLon {
  return [LAT, 11.0 + m / M_PER_DEG_LON];
}
function north(m: number, from: LatLon): LatLon {
  return [from[0] + m / 111_195, from[1]];
}
const POINTS: LatLon[] = [0, 250, 500, 750, 1000].map(east);
const ALONG = cumulative(POINTS);

test("the way back is the nearest point of the route ahead, in a straight line", () => {
  const fix = north(100, east(420));
  const rejoin = rejoinOf(POINTS, ALONG, fix, 300, 1000)!;
  expect(rejoin.from).toEqual(fix);
  expect(rejoin.alongM).toBeCloseTo(420, 0);
  expect(metresBetween(rejoin.to, east(420))).toBeLessThan(1);
  expect(rejoin.distanceM).toBeCloseTo(100, 0);
  // Due south.
  expect(rejoin.bearingDeg).toBeCloseTo(180, 0);
});

test("never behind where the runner left the route, nor further than looked", () => {
  // Beside 200 m, having left at 300 m: the way back is where they left.
  const behind = rejoinOf(POINTS, ALONG, north(50, east(200)), 300, 1000)!;
  expect(behind.alongM).toBeCloseTo(300, 0);
  expect(behind.bearingDeg).toBeGreaterThan(90);
  expect(behind.bearingDeg).toBeLessThan(180);
  // Beside 900 m, looked for up to 600 m: no further, though the segment
  // from 500 to 750 m goes on beyond.
  const beyond = rejoinOf(POINTS, ALONG, north(50, east(900)), 300, 600)!;
  expect(beyond.alongM).toBeCloseTo(600, 0);
  expect(beyond.distanceM).toBeGreaterThan(300);
  // West, and a little south.
  expect(beyond.bearingDeg).toBeGreaterThan(260);
  expect(beyond.bearingDeg).toBeLessThan(270);
});

test("anywhere on the route, for a closed one not joined yet", () => {
  const rejoin = rejoinOf(POINTS, ALONG, north(-30, east(80)), -Infinity, Infinity)!;
  expect(rejoin.alongM).toBeCloseTo(80, 0);
  expect(rejoin.bearingDeg).toBeCloseTo(0, 0);
});

test("a route with no stretch there has no way back", () => {
  expect(rejoinOf([east(0)], [0], east(10), 0, 300)).toBeNull();
  expect(rejoinOf(POINTS, ALONG, east(10), 2000, 3000)).toBeNull();
});

test("the further the runner has run off the route, the further on it is looked for", () => {
  expect(rejoinAheadM(0)).toBe(AHEAD_M);
  expect(rejoinAheadM(400)).toBe(AHEAD_M + REJOIN_PER_M * 400);
});
