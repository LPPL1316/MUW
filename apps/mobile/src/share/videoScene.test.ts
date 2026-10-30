import type { LatLon } from "@shaperoute/shared-types";

import { fitLines } from "../activities/fitLines";
import { color, SHADES } from "../theme/tokens";
import { POST_RESULTS, type PostRun, resultValue } from "./postRun";
import type { Sticker } from "./stickers";
import { MAP_CREDIT, MAP_WAIT_MS, NIGHT } from "./videoMap";
import {
  lengthOf,
  MAX_POINTS,
  pointAlong,
  pointsOf,
  thinned,
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

const scene = videoScene(RUN, POST_RESULTS, STICKERS, "paper");
const last = scene.frames[scene.frames.length - 1];

describe("videoScene, on paper", () => {
  it("is a vertical video of about 12 seconds on the yellow of MuW, with no map", () => {
    expect([scene.width, scene.height, scene.fps]).toEqual([1080, 1920, 30]);
    expect(VIDEO_WIDTH / VIDEO_HEIGHT).toBeCloseTo(9 / 16);
    expect(scene.frames).toHaveLength(VIDEO_SECONDS * VIDEO_FPS);
    expect(scene.look).toBe("paper");
    expect(scene.colors.paper).toBe(color.accent);
    expect(scene.colors.ink).toBe(color.onAccent);
    expect(scene.map).toBeNull();
    expect(scene.frames.every((frame) => frame.every((op) => op.k !== "map"))).toBe(
      true,
    );
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
      frame.filter((op) => op.k === "dot" && op.fill === "accent" && op.alpha > 0);
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
    const only = videoScene(RUN, ["distance"], [], "paper");
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
      "paper",
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
    const turned = videoScene({ ...RUN, rotationDeg: 90 }, POST_RESULTS, [], "paper");
    const xs = turned.paths[1].filter((_, i) => i % 2 === 0);
    const ys = turned.paths[1].filter((_, i) => i % 2 === 1);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(
      Math.max(...ys) - Math.min(...ys),
    );
  });

  it("has no title words when the run has no title", () => {
    const untitled = videoScene({ ...RUN, title: null }, POST_RESULTS, [], "paper");
    expect(words(untitled.frames[untitled.frames.length - 1])).not.toContain(
      "Heart in Trento",
    );
  });
});

describe("videoScene, at night", () => {
  const night = videoScene(RUN, POST_RESULTS, STICKERS, "night");
  const end = night.frames[night.frames.length - 1];
  const texts = (frame: VideoOp[]) =>
    frame.filter((op): op is Words => op.k === "text");

  it("lays the map under the line, framed on the drawing's box", () => {
    expect(night.look).toBe("night");
    const map = night.map;
    expect(map).not.toBeNull();
    expect([map?.width, map?.height, map?.pixelRatio]).toEqual([360, 640, 3]);
    // The box of the drawing, 20 % to 70 % of the height and 8 % in from
    // the sides, as the room kept clear around the centre.
    expect(map?.camera.padding.top).toBeCloseTo(128, 5);
    expect(map?.camera.padding.bottom).toBeCloseTo(192, 5);
    expect(map?.camera.padding.left).toBeCloseTo(28.8, 5);
    expect(map?.camera.padding.right).toBeCloseTo(28.8, 5);
    // The middle of the run without its ends: longitude first.
    expect(map?.camera.center[0]).toBeCloseTo(11.12, 6);
    expect(map?.camera.center[1]).toBeCloseTo(46.07 + 2600 / 111_195, 5);
    expect(map?.camera.zoom).toBeGreaterThan(11);
    expect(map?.camera.zoom).toBeLessThan(13);
    expect(map?.camera.bearing).toBe(0);
    expect(map?.camera.pitch).toBe(0);
    expect(map?.waitMs).toBe(MAP_WAIT_MS);
    expect(map?.style.layers.length).toBeGreaterThan(5);
  });

  it("takes every colour from the dark tone at its darkest, the line in the yellow", () => {
    expect(night.colors).toEqual({
      paper: NIGHT.map.background,
      ink: NIGHT.text,
      muted: NIGHT.textMuted,
      faint: NIGHT.textFaint,
      accent: NIGHT.accent,
      onAccent: NIGHT.onAccent,
      dot: NIGHT.text,
      scrim: NIGHT.scrim,
    });
    expect(NIGHT.map).toEqual(SHADES.dark.darkest.map);
    const known = new Set<string>(Object.values(NIGHT.map));
    for (const hex of JSON.stringify(night.map?.style).match(/#[0-9A-Fa-f]{6}/g) ??
      []) {
      expect(known.has(hex)).toBe(true);
    }
    expect(runLine(end)).toMatchObject({ color: "accent", width: 17.3 });
  });

  it("writes the title regular and tight, the labels small, spaced and in capitals, the numbers large and light", () => {
    const title = texts(end).find((op) => op.text === "Heart in Trento");
    expect(title).toMatchObject({
      weight: 400,
      size: 83.1,
      tracking: -1.7,
      color: "ink",
    });
    const label = texts(end).find((op) => op.text === "DISTANCE");
    expect(label).toMatchObject({
      weight: 600,
      size: 30.5,
      tracking: 3.3,
      color: "muted",
    });
    expect(texts(end).some((op) => op.text === "Distance")).toBe(false);
    const value = texts(end).find((op) => op.text === resultValue(RUN, "distance"));
    expect(value).toMatchObject({
      weight: 300,
      size: 121.8,
      tracking: -2.8,
      color: "ink",
    });
    expect(texts(end).find((op) => op.text === "MuW")).toMatchObject({ weight: 700 });
  });

  it("puts the map first, the yellow square under the heart, the dark under the words, the credit last", () => {
    const kinds = end.map((op) => op.k);
    expect(kinds[0]).toBe("map");
    expect(kinds.indexOf("rect")).toBeLessThan(kinds.indexOf("line"));
    expect(end.find((op) => op.k === "rect")).toMatchObject({
      color: "accent",
      w: 97.2,
      h: 97.2,
    });
    const scrim = kinds.indexOf("scrim");
    expect(scrim).toBeGreaterThan(kinds.lastIndexOf("line"));
    expect(scrim).toBeLessThan(
      end.findIndex((op) => op.k === "text" && op.text === "DISTANCE"),
    );
    expect(end.find((op) => op.k === "scrim")).toEqual({
      k: "scrim",
      top: 1152,
      alpha: 1,
    });
    const credit = texts(end).find((op) => op.text === MAP_CREDIT);
    expect(credit).toMatchObject({ color: "faint", align: "center", weight: 400 });
    expect(credit?.y).toBeGreaterThan(1920 * 0.95);
    // The numbers sit above the credit.
    const value = texts(end).find((op) => op.text === resultValue(RUN, "pace"));
    expect((value?.y ?? 0) + (value?.size ?? 0) * 1.2).toBeLessThan(credit?.y ?? 0);
  });

  it("brings the map and the dark in with the logo, then keeps them", () => {
    const at = (frame: number, kind: "map" | "scrim") =>
      night.frames[frame].find((op) => op.k === kind)?.alpha;
    expect(at(0, "map")).toBe(0);
    expect(at(0, "scrim")).toBe(0);
    expect(at(VIDEO_FPS / 2, "map")).toBe(1);
    expect(at(VIDEO_FPS * 6, "map")).toBe(1);
    expect(at(VIDEO_FPS * 6, "scrim")).toBe(1);
  });

  it("turns the map as the drawing is turned", () => {
    const turned = videoScene({ ...RUN, rotationDeg: 90 }, POST_RESULTS, [], "night");
    expect(turned.map?.camera.bearing).toBe(-90);
  });

  it("frames no map for a run too short to draw, and stays dark", () => {
    const short = videoScene(
      { ...RUN, track: north(350), distanceM: 350 },
      POST_RESULTS,
      [],
      "night",
    );
    expect(short.map).toBeNull();
    expect(short.colors.paper).toBe(NIGHT.map.background);
    expect(short.frames.every((frame) => frame.every((op) => op.k !== "map"))).toBe(
      true,
    );
  });

  it("keeps the drawing inside its box, and the video the same size as on paper", () => {
    const path = night.paths[1];
    for (let i = 0; i < path.length; i += 2) {
      expect(path[i]).toBeGreaterThanOrEqual(1080 * 0.08);
      expect(path[i]).toBeLessThanOrEqual(1080 * 0.92);
      expect(path[i + 1]).toBeGreaterThanOrEqual(1920 * 0.2);
      expect(path[i + 1]).toBeLessThanOrEqual(1920 * 0.7);
    }
    expect(night.frames).toHaveLength(VIDEO_SECONDS * VIDEO_FPS);
    expect(Math.max(...night.frames.map((frame) => frame.length))).toBeLessThan(24);
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

describe("the size of a video, whatever the run", () => {
  /** A zigzag of `count` fixes 20 m apart, east and back: a long, dense run. */
  function zigzag(count: number): LatLon[] {
    return Array.from({ length: count }, (_, i): LatLon => [
      46.07 + (Math.floor(i / 50) * 20) / 111_195,
      11.12 + (((i % 100 < 50 ? i % 50 : 49 - (i % 50)) * 20) / 111_195) * 1.44,
    ]);
  }

  it("draws at most MAX_POINTS points of a run with a fix a second for hours", () => {
    const long = videoScene(
      { ...RUN, track: zigzag(20_000), distanceM: 400_000 },
      POST_RESULTS,
      [],
      "paper",
    );
    expect(long.paths[1].length / 2).toBeLessThanOrEqual(MAX_POINTS + 2);
    expect(long.frames).toHaveLength(VIDEO_SECONDS * VIDEO_FPS);
    expect(Math.max(...long.frames.map((frame) => frame.length))).toBeLessThan(20);
  });

  it("keeps the line's two ends, and points no closer than 2 pixels", () => {
    const points = Array.from({ length: 1000 }, (_, i): [number, number] => [
      i * 0.5,
      0,
    ]);
    const kept = thinned(points);
    expect(kept[0]).toEqual([0, 0]);
    expect(kept[kept.length - 1]).toEqual([499.5, 0]);
    expect(kept.length).toBeLessThanOrEqual(251);
    for (let i = 1; i < kept.length - 1; i += 1) {
      expect(kept[i][0] - kept[i - 1][0]).toBeGreaterThanOrEqual(2);
    }
  });

  it("thins a long line to the most points asked", () => {
    const points = Array.from({ length: 50_000 }, (_, i): [number, number] => [
      i * 3,
      0,
    ]);
    expect(thinned(points, 100).length).toBeLessThanOrEqual(102);
  });

  it("leaves a line of two points as it is", () => {
    expect(
      thinned([
        [0, 0],
        [1, 1],
      ]),
    ).toEqual([
      [0, 0],
      [1, 1],
    ]);
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
