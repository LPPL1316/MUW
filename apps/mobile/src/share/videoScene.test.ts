import type { LatLon } from "@shaperoute/shared-types";

import { fitLines } from "../activities/fitLines";
import { color } from "../theme/tokens";
import { POST_RESULTS, type PostRun, resultValue } from "./postRun";
import type { Sticker } from "./stickers";
import {
  lengthOf,
  pointAlong,
  pointsOf,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_SECONDS,
  VIDEO_WIDTH,
  type VideoOp,
  videoScene,
} from "./videoScene";

/** A straight line north, a point every 50 m. */
function north(metres: number): LatLon[] {
  return Array.from({ length: metres / 50 + 1 }, (_, i): LatLon => [
    46.07 + (i * 50) / 111_195,
    11.12,
  ]);
}

const RUN: PostRun = {
  key: "run-1",
  title: "Heart in Trento",
  track: north(5200),
  distanceM: 5200,
  durationMs: (28 * 60 + 10) * 1000,
};

const STICKERS: Sticker[] = [
  { id: 1, emoji: "🔥", x: 0.2, y: 0.3 },
  { id: 2, emoji: "🏆", x: 0.8, y: 0.6 },
];

type Line = Extract<VideoOp, { k: "line" }>;
type Words = Extract<VideoOp, { k: "text" }>;

function runLine(frame: VideoOp[]): Line | undefined {
  return frame.find((op): op is Line => op.k === "line" && op.path === 1);
}

function words(frame: VideoOp[]): string[] {
  return frame.filter((op): op is Words => op.k === "text").map((op) => op.text);
}

const scene = videoScene(RUN, POST_RESULTS, STICKERS);
const last = scene.frames[scene.frames.length - 1];

describe("videoScene", () => {
  it("is a vertical video of about 12 seconds on the yellow of MuW", () => {
    expect([scene.width, scene.height, scene.fps]).toEqual([1080, 1920, 30]);
    expect(VIDEO_WIDTH / VIDEO_HEIGHT).toBeCloseTo(9 / 16);
    expect(scene.frames).toHaveLength(VIDEO_SECONDS * VIDEO_FPS);
    expect(scene.paper).toBe(color.accent);
    expect(scene.ink).toBe(color.onAccent);
  });

  it("starts empty, the logo and the title coming in", () => {
    const first = scene.frames[0];
    expect(first.every((op) => op.alpha === 0)).toBe(true);
    expect(runLine(first)).toBeUndefined();
    const second = scene.frames[VIDEO_FPS];
    expect(words(second)).toEqual(expect.arrayContaining(["MuW", "Heart in Trento"]));
    expect(second.filter((op) => op.k === "text").every((op) => op.alpha === 1)).toBe(
      true,
    );
  });

  it("draws the run's line from its start to its end, then keeps it whole", () => {
    const whole = lengthOf(scene.paths[1]);
    const drawn = scene.frames.map((frame) => runLine(frame)?.upTo ?? 0);
    expect(whole).toBeGreaterThan(500);
    for (let i = 1; i < drawn.length; i += 1) {
      expect(drawn[i]).toBeGreaterThanOrEqual(drawn[i - 1]);
    }
    expect(drawn[Math.round(5 * VIDEO_FPS)]).toBeGreaterThan(0);
    expect(drawn[Math.round(5 * VIDEO_FPS)]).toBeLessThan(whole);
    expect(drawn[drawn.length - 1]).toBeCloseTo(whole, 0);
  });

  it("shows the pen's tip only while the line draws", () => {
    const tips = (frame: VideoOp[]) =>
      frame.filter((op) => op.k === "dot" && op.fill === color.accent && op.alpha > 0);
    expect(tips(scene.frames[5 * VIDEO_FPS])).toHaveLength(1);
    expect(tips(last)).toHaveLength(0);
  });

  it("counts distance and time up, and ends on the run's numbers", () => {
    const middle = words(scene.frames[5 * VIDEO_FPS]);
    expect(middle).not.toContain(resultValue(RUN, "distance"));
    expect(middle).not.toContain(resultValue(RUN, "time"));
    expect(middle).toContain(resultValue(RUN, "pace"));
    expect(words(last)).toEqual(
      expect.arrayContaining([
        "Distance",
        "Time",
        "Pace",
        resultValue(RUN, "distance"),
        resultValue(RUN, "time"),
        resultValue(RUN, "pace"),
      ]),
    );
  });

  it("shows only the results on", () => {
    const only = videoScene(RUN, ["distance"], []);
    const end = words(only.frames[only.frames.length - 1]);
    expect(end).toContain(resultValue(RUN, "distance"));
    expect(end).not.toContain("Time");
    expect(end).not.toContain("Pace");
  });

  it("brings the emoji in at the end, where the runner put them", () => {
    const emoji = (frame: VideoOp[]) => frame.filter((op) => op.k === "emoji");
    expect(emoji(scene.frames[8 * VIDEO_FPS])).toHaveLength(0);
    expect(emoji(last)).toEqual([
      expect.objectContaining({ text: "🔥", x: 216, y: 576, scale: 1, alpha: 1 }),
      expect.objectContaining({ text: "🏆", x: 864, y: 1152, scale: 1, alpha: 1 }),
    ]);
  });

  it("leaves out the ends of the track: a short run has numbers only", () => {
    const short = videoScene(
      { ...RUN, track: north(350), distanceM: 350 },
      POST_RESULTS,
      [],
    );
    expect(short.paths[1]).toEqual([]);
    expect(short.frames.every((frame) => runLine(frame) === undefined)).toBe(true);
    expect(words(short.frames[short.frames.length - 1])).toContain(
      resultValue({ ...RUN, distanceM: 350 }, "distance"),
    );
  });

  it("keeps the drawing inside its box, between the title and the numbers", () => {
    const path = scene.paths[1];
    for (let i = 0; i < path.length; i += 2) {
      expect(path[i]).toBeGreaterThanOrEqual(1080 * 0.08);
      expect(path[i]).toBeLessThanOrEqual(1080 * 0.92);
      expect(path[i + 1]).toBeGreaterThanOrEqual(1920 * 0.2);
      expect(path[i + 1]).toBeLessThanOrEqual(1920 * 0.7);
    }
  });

  it("draws a run along a turned route turned back, as the post", () => {
    const turned = videoScene({ ...RUN, rotationDeg: 90 }, POST_RESULTS, []);
    const xs = turned.paths[1].filter((_, i) => i % 2 === 0);
    const ys = turned.paths[1].filter((_, i) => i % 2 === 1);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(
      Math.max(...ys) - Math.min(...ys),
    );
  });

  it("has no title words when the run has no title", () => {
    const untitled = videoScene({ ...RUN, title: null }, POST_RESULTS, []);
    expect(words(untitled.frames[untitled.frames.length - 1])).not.toContain(
      "Heart in Trento",
    );
  });
});

describe("pointsOf", () => {
  it("gives back the points fitLines laid its segments on", () => {
    const [segments] = fitLines(
      [
        [
          [46, 11],
          [46.001, 11],
          [46.001, 11.001],
        ],
      ],
      300,
      300,
      0,
    );
    const points = pointsOf(segments);
    expect(points).toHaveLength(3);
    // North first (up the box), then east (to the right).
    expect(points[1][1]).toBeLessThan(points[0][1]);
    expect(points[1][0]).toBeCloseTo(points[0][0], 6);
    expect(points[2][0]).toBeGreaterThan(points[1][0]);
    expect(points[2][1]).toBeCloseTo(points[1][1], 6);
  });

  it("is empty with no segments", () => {
    expect(pointsOf([])).toEqual([]);
  });
});

describe("lengthOf and pointAlong", () => {
  const path = [0, 0, 30, 0, 30, 40];

  it("measures a path", () => {
    expect(lengthOf(path)).toBe(70);
  });

  it("finds a point along it, its end past its length", () => {
    expect(pointAlong(path, 15)).toEqual([15, 0]);
    expect(pointAlong(path, 50)).toEqual([30, 20]);
    expect(pointAlong(path, 999)).toEqual([30, 40]);
  });
});
