import { fitLines, type Segment } from "../activities/fitLines";
import { HEART_BOX, HEART_POINTS, heartHeight } from "../intro/heartLine";
import { bearingOf } from "../map/turnedMap";
import { color } from "../theme/tokens";
import {
  POST_RESULTS,
  type PostResult,
  type PostRun,
  resultName,
  resultValue,
  withoutEnds,
} from "./postRun";
import type { Sticker } from "./stickers";

/**
 * The video of a run (TASK-295, ADR-0254), as what to draw in each of its
 * pictures: the post (TASK-231) coming to life. On the yellow of MuW the
 * logo and the title come in; the run's line draws itself from start to end
 * while distance and time count up; then the whole drawing stays, with the
 * results and the emoji the runner chose for the post. The last picture is
 * the post.
 *
 * Only numbers and words here: the hidden WebView (videoPage) draws them on
 * a canvas and encodes them, so what the video shows is decided, and
 * tested, in the app.
 */

/** A vertical video for Stories and Reels: 9 wide, 16 tall. */
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const VIDEO_FPS = 30;
/** About 12 seconds, the user's choice. */
export const VIDEO_SECONDS = 12;

/** When each part starts and how long the line takes, in seconds. */
const INTRO_S = 1;
const DRAW_S = 8;
const HOLD_FROM_S = INTRO_S + DRAW_S;
/** Between one emoji and the next coming in, and how long each takes. */
const EMOJI_STEP_S = 0.15;
const EMOJI_POP_S = 0.35;

// The post's sizes (PostImage), as shares of the width; its places as
// shares of the height.
const SIDE = 0.08;
const LINE = 0.02;
const BADGE = 0.09;
const NAME = 0.05;
const TITLE = 0.065;
const LABEL = 0.035;
const VALUE = 0.075;
const EMOJI = 0.11;
const BRAND_GAP = 0.017;
const ROW_GAP = 0.023;
const TITLE_TOP = 0.1;
const DRAWING_TOP = 0.2;
const DRAWING_BOTTOM = 0.7;
const RESULTS_BOTTOM = 0.04;
/** A line of text is this many times its letters' size, as in the app. */
const LINE_HEIGHT = 1.2;

// The logo's heart (HeartBadge), as shares of its square.
const HEART_SHARE = 0.68;
const HEART_LINE_SHARE = 1 / 16;
const HEART_DOT_SHARE = 1 / 6;
const HEART_RING_SHARE = 1 / 24;

/** One thing to draw. Places and sizes in pixels of the video, y down;
 * `alpha` from 0 (not there) to 1. */
export type VideoOp =
  /** A path of the scene, from its start to `upTo` pixels along it. */
  | { k: "line"; path: number; upTo: number; width: number; alpha: number }
  /** A round dot, `ring` pixels of ink around it. */
  | {
      k: "dot";
      x: number;
      y: number;
      r: number;
      fill: string;
      ring: number;
      alpha: number;
    }
  /** Words, from the top of their first line; at most `lines` lines
   * `maxWidth` wide, the last one cut with «…». */
  | {
      k: "text";
      text: string;
      x: number;
      y: number;
      size: number;
      bold: boolean;
      align: "left" | "center";
      maxWidth: number;
      lines: number;
      alpha: number;
    }
  /** An emoji, centred on x, y, grown by `scale`. */
  | {
      k: "emoji";
      text: string;
      x: number;
      y: number;
      size: number;
      scale: number;
      alpha: number;
    };

export type VideoScene = {
  width: number;
  height: number;
  fps: number;
  /** The yellow under everything, and the ink of the lines and words. */
  paper: string;
  ink: string;
  /** Lines, each as x0, y0, x1, y1, …: the logo's heart, then the run. */
  paths: number[][];
  /** What each picture shows, in order. */
  frames: VideoOp[][];
};

const HEART_PATH = 0;
const RUN_PATH = 1;

/** One decimal: the scene goes to the WebView as text. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Where `t` is from `from` to `to`, from 0 to 1. */
function ramp(t: number, from: number, to: number): number {
  return Math.min(1, Math.max(0, (t - from) / (to - from)));
}

/** Slow at both ends. */
function easeInOut(u: number): number {
  return (1 - Math.cos(Math.PI * u)) / 2;
}

/** Past 1 a little, then back: an emoji that pops. */
function easeOutBack(u: number): number {
  const c = 1.70158;
  return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2;
}

/** The points of segments laid one after the other (fitLines draws each
 * from where the last one ended). */
export function pointsOf(segments: readonly Segment[]): [number, number][] {
  const ends = (s: Segment, sign: number): [number, number] => {
    const angle = (s.angle * Math.PI) / 180;
    return [
      s.left + s.length / 2 + (sign * Math.cos(angle) * s.length) / 2,
      s.top + (sign * Math.sin(angle) * s.length) / 2,
    ];
  };
  if (segments.length === 0) {
    return [];
  }
  return [ends(segments[0], -1), ...segments.map((s) => ends(s, 1))];
}

/** How long a path is, in pixels. */
export function lengthOf(path: readonly number[]): number {
  let length = 0;
  for (let i = 2; i < path.length; i += 2) {
    length += Math.hypot(path[i] - path[i - 2], path[i + 1] - path[i - 1]);
  }
  return length;
}

/** The point `upTo` pixels along `path`; its end past its length. */
export function pointAlong(path: readonly number[], upTo: number): [number, number] {
  let walked = 0;
  for (let i = 2; i < path.length; i += 2) {
    const step = Math.hypot(path[i] - path[i - 2], path[i + 1] - path[i - 1]);
    if (walked + step >= upTo && step > 0) {
      const share = (upTo - walked) / step;
      return [
        path[i - 2] + (path[i] - path[i - 2]) * share,
        path[i - 1] + (path[i + 1] - path[i - 1]) * share,
      ];
    }
    walked += step;
  }
  return [path[path.length - 2], path[path.length - 1]];
}

/** The results the video shows, in the post's order: the ones on that the
 * run has. */
function resultsShown(run: PostRun, shown: readonly PostResult[]): PostResult[] {
  return POST_RESULTS.filter(
    (result) => shown.includes(result) && resultValue(run, result) !== null,
  );
}

/** The run as far as `share` of it: distance and time count up, the pace
 * is the whole run's. */
function valueAt(run: PostRun, result: PostResult, share: number): string | null {
  if (result === "pace") {
    return resultValue(run, result);
  }
  return resultValue(
    { ...run, distanceM: run.distanceM * share, durationMs: run.durationMs * share },
    result,
  );
}

/** The parts that do not move: the logo, the drawing's path, the places. */
function layoutOf(run: PostRun, shown: readonly PostResult[]) {
  const w = VIDEO_WIDTH;
  const h = VIDEO_HEIGHT;
  const badge = w * BADGE;
  const corner = w * SIDE * 0.6;
  const heartWidth = badge * HEART_SHARE;
  const heartScale = heartWidth / HEART_BOX.width;
  const heartLeft = corner + (badge - heartWidth) / 2;
  const heartTop = corner + (badge - heartHeight(heartWidth)) / 2;
  const heart = HEART_POINTS.flatMap(([x, y]) => [
    round(heartLeft + x * heartScale),
    round(heartTop + y * heartScale),
  ]);

  const boxWidth = w * (1 - 2 * SIDE);
  const boxHeight = h * (DRAWING_BOTTOM - DRAWING_TOP);
  const line = w * LINE;
  const [segments] = fitLines(
    [withoutEnds(run.track)],
    boxWidth,
    boxHeight,
    line,
    bearingOf(run.rotationDeg),
  );
  const track = pointsOf(segments).flatMap(([x, y]) => [
    round(w * SIDE + x),
    round(h * DRAWING_TOP + y),
  ]);

  const results = resultsShown(run, shown);
  const labelHeight = w * LABEL * LINE_HEIGHT;
  const valueHeight = w * VALUE * LINE_HEIGHT;
  const rows = Math.ceil(results.length / 2);
  const resultsHeight =
    rows * (labelHeight + valueHeight) + Math.max(0, rows - 1) * w * ROW_GAP;
  const resultsTop = h * (1 - RESULTS_BOTTOM) - resultsHeight;
  const columnWidth = (w * (1 - 2 * SIDE)) / 2;
  const placed = results.map((result, i) => ({
    result,
    x: w * SIDE + (i % 2) * columnWidth,
    y: resultsTop + Math.floor(i / 2) * (labelHeight + valueHeight + w * ROW_GAP),
  }));

  return {
    badge,
    corner,
    heart,
    heartLength: lengthOf(heart),
    heartLine: badge * HEART_LINE_SHARE,
    heartDot: {
      x: heart[0],
      y: heart[1],
      r: (badge * HEART_DOT_SHARE) / 2,
      ring: badge * HEART_RING_SHARE,
    },
    track,
    trackLength: lengthOf(track),
    line,
    placed,
    labelHeight,
    columnWidth,
  };
}

type Layout = ReturnType<typeof layoutOf>;

function text(
  words: string,
  x: number,
  y: number,
  size: number,
  bold: boolean,
  maxWidth: number,
  alpha: number,
  align: "left" | "center" = "left",
  lines = 1,
): VideoOp {
  return {
    k: "text",
    text: words,
    x: round(x),
    y: round(y),
    size: round(size),
    bold,
    align,
    maxWidth: round(maxWidth),
    lines,
    alpha: round3(alpha),
  };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** What the picture at `t` seconds shows. */
function frameAt(
  t: number,
  run: PostRun,
  stickers: readonly Sticker[],
  layout: Layout,
): VideoOp[] {
  const w = VIDEO_WIDTH;
  const h = VIDEO_HEIGHT;
  const ops: VideoOp[] = [];

  const brand = round3(ramp(t, 0, 0.5));
  ops.push(
    {
      k: "line",
      path: HEART_PATH,
      upTo: round(layout.heartLength),
      width: round(layout.heartLine),
      alpha: brand,
    },
    {
      k: "dot",
      ...layout.heartDot,
      r: round(layout.heartDot.r),
      ring: round(layout.heartDot.ring),
      fill: color.text,
      alpha: brand,
    },
    text(
      "MuW",
      layout.corner + layout.badge + w * BRAND_GAP,
      layout.corner + (layout.badge - w * NAME * LINE_HEIGHT) / 2,
      w * NAME,
      true,
      w / 2,
      brand,
    ),
  );
  if (run.title !== null) {
    ops.push(
      text(
        run.title,
        w / 2,
        h * TITLE_TOP,
        w * TITLE,
        true,
        w * (1 - 2 * SIDE),
        ramp(t, 0.2, 0.8),
        "center",
        2,
      ),
    );
  }

  const share = easeInOut(ramp(t, INTRO_S, HOLD_FROM_S));
  if (layout.trackLength > 0 && share > 0) {
    const upTo = layout.trackLength * share;
    ops.push({
      k: "line",
      path: RUN_PATH,
      upTo: round(upTo),
      width: round(layout.line),
      alpha: 1,
    });
    // The pen's tip while it draws, gone once the drawing is whole.
    const tip = 1 - ramp(t, HOLD_FROM_S, HOLD_FROM_S + 0.3);
    if (tip > 0) {
      const [x, y] = pointAlong(layout.track, upTo);
      ops.push({
        k: "dot",
        x: round(x),
        y: round(y),
        r: round(layout.line * 1.3),
        ring: round(layout.line * 0.5),
        fill: color.accent,
        alpha: round3(tip),
      });
    }
  }

  const numbers = ramp(t, 0.6, 1);
  for (const { result, x, y } of layout.placed) {
    const value = valueAt(run, result, share);
    ops.push(
      text(resultName(result), x, y, w * LABEL, false, layout.columnWidth, numbers),
    );
    if (value !== null) {
      ops.push(
        text(
          value,
          x,
          y + layout.labelHeight,
          w * VALUE,
          true,
          layout.columnWidth,
          numbers,
        ),
      );
    }
  }

  stickers.forEach((sticker, i) => {
    const pop = ramp(
      t,
      HOLD_FROM_S + 0.2 + i * EMOJI_STEP_S,
      HOLD_FROM_S + 0.2 + i * EMOJI_STEP_S + EMOJI_POP_S,
    );
    if (pop > 0) {
      ops.push({
        k: "emoji",
        text: sticker.emoji,
        x: round(sticker.x * w),
        y: round(sticker.y * h),
        size: round(w * EMOJI),
        scale: round3(easeOutBack(pop)),
        alpha: round3(Math.min(1, pop * 2)),
      });
    }
  });
  return ops;
}

/**
 * The video of `run`'s post as it is now: the results on in `shown`, the
 * emoji where the runner put them.
 */
export function videoScene(
  run: PostRun,
  shown: readonly PostResult[],
  stickers: readonly Sticker[],
): VideoScene {
  const layout = layoutOf(run, shown);
  const count = VIDEO_SECONDS * VIDEO_FPS;
  return {
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    fps: VIDEO_FPS,
    paper: color.accent,
    ink: color.onAccent,
    paths: [layout.heart, layout.track],
    frames: Array.from({ length: count }, (_, i) =>
      frameAt(i / VIDEO_FPS, run, stickers, layout),
    ),
  };
}
