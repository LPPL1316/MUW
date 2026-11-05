import type { LatLon } from "@shaperoute/shared-types";

import type { FreeRun } from "../navigation/freeRun";
import { addFix, emptyTrack, type Track } from "../navigation/trackRecorder";
import { snowLiftsOf, splitAtLifts } from "./snowLifts";

const START: LatLon = [46.4, 11.8];
const METRE = 1 / 111_195;

/** Down 300 m in two minutes, `liftS` seconds up 300 m (none: no lift),
 * down again. */
function day(liftS: number | null): FreeRun {
  let track: Track = emptyTrack();
  let north = 0;
  let height = 2000;
  let at = 0;
  const go = (seconds: number, every: number, northM: number, upM: number) => {
    for (let s = every; s <= seconds; s += every) {
      track = addFix(track, {
        point: [START[0] + (north + (northM * s) / seconds) * METRE, START[1]],
        timeMs: (at + s) * 1000,
        accuracyM: 5,
        altitudeM: height + (upM * s) / seconds,
      });
    }
    north += northM;
    height += upM;
    at += seconds;
  };
  track = addFix(track, { point: START, timeMs: 0, accuracyM: 5, altitudeM: height });
  go(120, 5, 1200, -300);
  if (liftS !== null) {
    go(liftS, 10, -1200, 300);
  }
  go(120, 5, 1200, -300);
  return { version: 1, route: [], track, status: "stopped" };
}

describe("the lifts of a day on the map", () => {
  it("a day of skiing has its lifts", () => {
    const lifts = snowLiftsOf(day(300), "ski");
    expect(lifts).toHaveLength(1);
  });

  it("any other sport, cross-country skiing too, has none", () => {
    expect(snowLiftsOf(day(300), "xc_ski")).toBeNull();
    expect(snowLiftsOf(day(300), "run")).toBeNull();
    expect(snowLiftsOf(day(300), "bike")).toBeNull();
  });

  it("a day of skiing without a lift draws as a run", () => {
    expect(snowLiftsOf(day(null), "ski")).toBeNull();
  });

  it("cuts the line at the lifts, the pieces touching", () => {
    const points: LatLon[] = Array.from({ length: 10 }, (_, i) => [46 + i / 1000, 11]);
    const { skied, lifts } = splitAtLifts(points, [{ from: 3, to: 6 }]);
    expect(skied).toEqual([points.slice(0, 4), points.slice(6)]);
    expect(lifts).toEqual([points.slice(3, 7)]);
  });

  it("a day that starts on a lift and ends on one has no piece of a single point", () => {
    const points: LatLon[] = Array.from({ length: 10 }, (_, i) => [46 + i / 1000, 11]);
    const { skied, lifts } = splitAtLifts(points, [
      { from: 0, to: 3 },
      { from: 6, to: 9 },
    ]);
    expect(skied).toEqual([points.slice(3, 7)]);
    expect(lifts).toEqual([points.slice(0, 4), points.slice(6)]);
  });

  it("the lifts of a real day match its line", () => {
    const run = day(300);
    const points = run.track.fixes.map((fix) => fix.point);
    const { skied, lifts } = splitAtLifts(points, snowLiftsOf(run, "ski")!);
    expect(skied).toHaveLength(2);
    expect(lifts).toHaveLength(1);
    // The lift goes back south, where the descents go north.
    const lift = lifts[0];
    expect(lift[lift.length - 1][0]).toBeLessThan(lift[0][0]);
  });
});
