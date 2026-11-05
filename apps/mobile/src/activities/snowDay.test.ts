import type { LatLon } from "@shaperoute/shared-types";

import { addFix, emptyTrack, type Track } from "../navigation/trackRecorder";
import { snowDay } from "./snowDay";

const START: LatLon = [46.4, 11.8];
const METRE = 1 / 111_195;

type Step = [northM: number, seconds: number, altitudeM?: number | null];

/** A track through `steps`: metres north, seconds, and the height if any. */
function trackOf(steps: Step[]): Track {
  return steps.reduce(
    (track, [northM, seconds, altitudeM]) =>
      addFix(track, {
        point: [START[0] + northM * METRE, START[1]],
        timeMs: seconds * 1000,
        accuracyM: 5,
        altitudeM,
      }),
    emptyTrack(),
  );
}

/** From where the last step is, `seconds` long, a fix every `every`
 * seconds, going `northM` and `upM` in all, evenly. */
function stretch(
  from: Step,
  seconds: number,
  every: number,
  northM: number,
  upM: number,
): Step[] {
  const [north, at, height] = from;
  const steps: Step[] = [];
  for (let s = every; s <= seconds; s += every) {
    const share = s / seconds;
    steps.push([north + northM * share, at + s, (height ?? 0) + upM * share]);
  }
  return steps;
}

function then(steps: Step[], ...more: ((last: Step) => Step[])[]): Step[] {
  return more.reduce((all, next) => [...all, ...next(all[all.length - 1])], steps);
}

/** Two descents of 300 m at 10 m/s with a chairlift between them, 300 m up
 * in five minutes at a steady 4 m/s. */
function twoDescents(): Step[] {
  return then(
    [[0, 0, 2000]],
    (last) => stretch(last, 120, 5, 1200, -300),
    (last) => stretch(last, 300, 10, -1200, 300),
    (last) => stretch(last, 120, 5, 1200, -300),
  );
}

describe("a day on the snow", () => {
  it("counts the descents and the lift between them", () => {
    const day = snowDay(trackOf(twoDescents()));
    expect(day.descents).toBe(2);
    expect(day.lifts).toHaveLength(1);
  });

  it("takes only the descents' kilometres and metres down", () => {
    const day = snowDay(trackOf(twoDescents()));
    expect(day.skiedM).toBeGreaterThan(2350);
    expect(day.skiedM).toBeLessThan(2450);
    expect(day.verticalM).toBeGreaterThan(580);
    expect(day.verticalM).toBeLessThanOrEqual(600);
  });

  it("gives the speeds of the descents, never of the lift", () => {
    const day = snowDay(trackOf(twoDescents()));
    expect(day.topMps).toBeCloseTo(10, 0);
    expect(day.averageMps).toBeCloseTo(10, 0);
  });

  it("does not take a slow climb on foot for a lift", () => {
    // Down 300 m, up 90 m in ten minutes on skins, down 90 m.
    const day = snowDay(
      trackOf(
        then(
          [[0, 0, 2000]],
          (last) => stretch(last, 120, 5, 1200, -300),
          (last) => stretch(last, 600, 10, 300, 90),
          (last) => stretch(last, 40, 5, 400, -90),
        ),
      ),
    );
    expect(day.lifts).toEqual([]);
    expect(day.descents).toBe(1);
    expect(day.verticalM).toBeGreaterThan(370);
  });

  it("does not take a climb that stops and starts for a lift", () => {
    // Up 300 m in five minutes, but a step fast and a step slow.
    const climb: Step[] = [];
    let north = 1200;
    for (let s = 10; s <= 300; s += 10) {
      north -= s % 20 === 0 ? 80 : 15;
      climb.push([north, 120 + s, 1700 + s]);
    }
    const day = snowDay(
      trackOf(
        then(
          [[0, 0, 2000]],
          (last) => stretch(last, 120, 5, 1200, -300),
          () => climb,
          (last) => stretch(last, 120, 5, 1200, -300),
        ),
      ),
    );
    expect(day.lifts).toEqual([]);
  });

  it("leaves a climb shorter than a minute to the skier", () => {
    const day = snowDay(
      trackOf(
        then(
          [[0, 0, 2000]],
          (last) => stretch(last, 120, 5, 1200, -300),
          (last) => stretch(last, 50, 5, -200, 50),
          (last) => stretch(last, 120, 5, 1200, -300),
        ),
      ),
    );
    expect(day.lifts).toEqual([]);
    expect(day.descents).toBe(1);
  });

  it("does not count a stretch that drops too little as a descent", () => {
    // From the car park to the lift, then a lift and one descent.
    const day = snowDay(
      trackOf(
        then(
          [[0, 0, 1500]],
          (last) => stretch(last, 120, 5, 300, -5),
          (last) => stretch(last, 300, 10, -1200, 300),
          (last) => stretch(last, 120, 5, 1200, -300),
        ),
      ),
    );
    expect(day.descents).toBe(1);
    expect(day.skiedM).toBeLessThan(1250);
  });

  it("does not make a jump of the GPS the top speed", () => {
    const steps = twoDescents();
    const [north, at, height] = steps[10];
    steps[10] = [north + 3000, at, height];
    const day = snowDay(trackOf(steps));
    expect(day.topMps).not.toBeNull();
    expect(day.topMps as number).toBeLessThan(200 / 3.6);
  });

  it("without heights, the whole day is skied and the rest is not known", () => {
    const steps = twoDescents().map(([north, at]): Step => [north, at, null]);
    const track = trackOf(steps);
    const day = snowDay(track);
    expect(day.descents).toBeNull();
    expect(day.verticalM).toBeNull();
    expect(day.lifts).toBeNull();
    expect(day.skiedM).toBeCloseTo(track.distanceM, 0);
  });

  it("an empty day has no numbers", () => {
    expect(snowDay(emptyTrack())).toEqual({
      descents: null,
      skiedM: 0,
      verticalM: null,
      topMps: null,
      averageMps: null,
      lifts: null,
    });
  });
});
