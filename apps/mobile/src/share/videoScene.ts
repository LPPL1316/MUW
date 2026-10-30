import { fitLines, type Segment } from "../activities/fitLines";
import { appLanguage } from "../i18n/language";
import { HEART_BOX, HEART_POINTS, heartHeight } from "../intro/heartLine";
import { bearingOf } from "../map/turnedMap";
import { color, font, type Palette, tracking } from "../theme/tokens";
import {
  POST_RESULTS,
  type PostResult,
  type PostRun,
  resultName,
  resultValue,
  withoutEnds,
} from "./postRun";
import type { Sticker } from "./stickers";
import {
  MAP_CREDIT,
  MAP_PIXEL_RATIO,
  NIGHT,
  type VideoMap,
  videoMap,
} from "./videoMap";

/**
 * The video of a run (TASK-295, ADR-0254; TASK-351, ADR-0303), as what to
 * draw in each of its pictures. In the «night» look the map of the run lies
 * under everything, dark and warm, and the line draws itself in the yellow
 * of a route while distance and time count up, the words in the type scale
 * of the premium look (ADR-0293); then the whole drawing stays, with the
 * results and the emoji the runner chose for the post. The «paper» look is
 * the post on the yellow of MuW coming to life, as the video was before:
 * the page falls back on it when the map does not come.
 *
 * Only numbers and words here: the hidden WebView (videoPage) draws them on
 * a canvas and encodes them, so what the video shows is decided, and
 * tested, in the app. Where the line lies on the map is decided here too,
 * with the same fit the Feed lays its maps under a drawing with (ADR-0131).
 */

/** A vertical video for Stories and Reels: 9 wide, 16 tall. */
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const VIDEO_FPS = 30;
/** About 12 seconds, the user's choice. */
export const VIDEO_SECONDS = 12;

/** The two looks of the video: the map under the line, or the yellow post. */
export type VideoLook = "paper" | "night";

/** When each part starts and how long the line takes, in seconds. */
const INTRO_S = 1;
const DRAW_S = 8;
const HOLD_FROM_S = INTRO_S + DRAW_S;
/** Between one emoji and the next coming in, and how long each takes. */
const EMOJI_STEP_S = 0.15;
const EMOJI_POP_S = 0.35;

// The post's places (PostImage), as shares of the width and of the height.
const SIDE = 0.08;
const BADGE = 0.09;
const NAME = 0.05;
const EMOJI = 0.11;
const BRAND_GAP = 0.017;
const TITLE_TOP = 0.1;
const DRAWING_TOP = 0.2;
const DRAWING_BOTTOM = 0.7;
/** A line of text is this many times its letters' size, as in the app. */
const LINE_HEIGHT = 1.2;

// The logo's heart (HeartBadge), as shares of its square.
const HEART_SHARE = 0.68;
const HEART_LINE_SHARE = 1 / 16;
const HEART_DOT_SHARE = 1 / 6;
const HEART_RING_SHARE = 1 / 24;
/** The corner of the yellow square behind the heart (HeartBadge). */
const BADGE_CORNER_SHARE = 0.22;

/** Where the dark rises from, on the map looks, as a share of the height. */
const SCRIM_TOP = 0.6;
/** The credit's letters and its room from the bottom edge. */
const CREDIT = 0.02;
const CREDIT_BOTTOM = 0.012;

/** The width of the phone the type scale (`font`) is drawn for, in points:
 * a size in points is that share of the video's width. */
const PHONE_WIDTH = 390;

/** A colour of the look an op is drawn in. */
export type ColorRole = "ink" | "muted" | "faint" | "accent" | "onAccent" | "dot";

/** The colours of a look, from the tokens: what each role means. */
export type VideoColors = {
  /** Under everything: the yellow of the post, or the map's own ground. */
  paper: string;
  ink: string;
  muted: string;
  faint: string;
  accent: string;
  onAccent: string;
  /** The start of the logo's heart. */
  dot: string;
  /** The dark that rises under the words on the map looks. */
  scrim: string;
};

/** One thing to draw. Places and sizes in pixels of the video, y down;
 * `alpha` from 0 (not there) to 1. */
export type VideoOp =
  /** The map's picture, once the page has it. */
  | { k: "map"; alpha: number }
  /** The dark rising from `top` to the bottom edge. */
  | { k: "scrim"; top: number; alpha: number }
  /** A filled square with round corners. */
  | {
      k: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      r: number;
      color: ColorRole;
      alpha: number;
    }
  /** A path of the scene, from its start to `upTo` pixels along it. */
  | {
      k: "line";
      path: number;
      upTo: number;
      width: number;
      color: ColorRole;
      alpha: number;
    }
  /** A round dot, `ring` pixels of `ringColor` inside its edge. */
  | {
      k: "dot";
      x: number;
      y: number;
      r: number;
      fill: ColorRole;
      ring: number;
      ringColor: ColorRole;
      alpha: number;
    }
  /** Words, from the top of their first line; at most `lines` lines
   * `maxWidth` wide, the last one cut with «…». `tracking` in pixels
   * between letters, `weight` as CSS has it. */
  | {
      k: "text";
      text: string;
      x: number;
      y: number;
      size: number;
      weight: number;
      tracking: number;
      color: ColorRole;
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
  look: VideoLook;
  colors: VideoColors;
  /** The map under the pictures; null on paper, or with nothing to frame. */
  map: VideoMap | null;
  /** Lines, each as x0, y0, x1, y1, …: the logo's heart, then the run. */
  paths: number[][];
  /** What each picture shows, in order. */
  frames: VideoOp[][];
};

const HEART_PATH = 0;
const RUN_PATH = 1;

/** The most points of the run's line, and the closest two may be. */
export const MAX_POINTS = 2000;
const MIN_STEP_PX = 2;

/** A size of text: letters, weight, tracking, as shares of the width (the
 * tracking too), and the line as a multiple of the letters. */
type TextStyle = {
  size: number;
  weight: number;
  tracking: number;
  lineHeight: number;
};

/** How a look draws the video. */
type Look = {
  colors: VideoColors;
  title: TextStyle;
  label: TextStyle & { upper: boolean; color: ColorRole };
  value: TextStyle;
  line: { width: number; color: ColorRole };
  /** The yellow square behind the logo's heart. */
  badge: boolean;
  scrim: boolean;
  credit: string | null;
  /** The results' room from the bottom edge, as a share of the height; the
   * gap between their rows, of the width. */
  resultsBottom: number;
  rowGap: number;
};

/** A measure in points of the phone, as a share of the video's width. */
function ofPhone(points: number): number {
  return points / PHONE_WIDTH;
}

/** A style of `font`, as the video draws it. */
function textStyle(
  style: { fontSize: number; fontWeight: string; lineHeight: number },
  letterTracking: number,
): TextStyle {
  return {
    size: ofPhone(style.fontSize),
    weight: Number(style.fontWeight),
    tracking: ofPhone(letterTracking),
    lineHeight: style.lineHeight / style.fontSize,
  };
}

/** The post on the yellow of MuW, as the video was (ADR-0254): the ink is
 * the text on yellow, in the app's own tone. */
const PAPER: Look = {
  colors: {
    paper: color.accent,
    ink: color.onAccent,
    muted: color.onAccent,
    faint: color.onAccent,
    accent: color.accent,
    onAccent: color.onAccent,
    dot: color.text,
    scrim: color.scrim,
  },
  title: { size: 0.065, weight: 700, tracking: 0, lineHeight: LINE_HEIGHT },
  label: {
    size: 0.035,
    weight: 500,
    tracking: 0,
    lineHeight: LINE_HEIGHT,
    upper: false,
    color: "ink",
  },
  value: { size: 0.075, weight: 700, tracking: 0, lineHeight: LINE_HEIGHT },
  line: { width: 0.02, color: "ink" },
  badge: false,
  scrim: false,
  credit: null,
  resultsBottom: 0.04,
  rowGap: 0.023,
};

/** The map under the line, in the colours of `palette` and the type scale
 * of the premium look (ADR-0293): large light numbers, small spaced labels,
 * a regular title, the line in the yellow of a route. */
function mapLook(palette: Palette): Look {
  return {
    colors: {
      paper: palette.map.background,
      ink: palette.text,
      muted: palette.textMuted,
      faint: palette.textFaint,
      accent: palette.accent,
      onAccent: palette.onAccent,
      dot: palette.text,
      scrim: palette.scrim,
    },
    title: textStyle(font.title, tracking.title),
    label: { ...textStyle(font.label, tracking.label), upper: true, color: "muted" },
    value: textStyle(font.display, tracking.display),
    line: { width: 0.016, color: "accent" },
    badge: true,
    scrim: true,
    credit: MAP_CREDIT,
    resultsBottom: 0.06,
    rowGap: 0.036,
  };
}

/** One decimal: the scene goes to the WebView as text. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
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

/**
 * The run's line with at most `most` points (and its two ends): the scene,
 * and the page's work for each picture, stay the same size however long
 * the run (a fix a second for hours). Points closer than `MIN_STEP_PX` are
 * under the line's own width anyway.
 */
export function thinned(
  points: readonly [number, number][],
  most: number = MAX_POINTS,
): [number, number][] {
  if (points.length <= 2) {
    return [...points];
  }
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length += Math.hypot(
      points[i][0] - points[i - 1][0],
      points[i][1] - points[i - 1][1],
    );
  }
  // Each point kept is at least `step` from the one before, so at most
  // length / step of them.
  const step = Math.max(MIN_STEP_PX, length / most);
  const kept: [number, number][] = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    const [x, y] = kept[kept.length - 1];
    if (Math.hypot(points[i][0] - x, points[i][1] - y) >= step) {
      kept.push(points[i]);
    }
  }
  kept.push(points[points.length - 1]);
  return kept;
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

/** The parts that do not move: the logo, the drawing's path, the places,
 * and the map under them. */
function layoutOf(
  run: PostRun,
  shown: readonly PostResult[],
  look: Look,
  withMap: boolean,
) {
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
  const line = w * look.line.width;
  const cut = withoutEnds(run.track);
  const bearing = bearingOf(run.rotationDeg);
  const [segments] = fitLines([cut], boxWidth, boxHeight, line, bearing);
  const track = thinned(pointsOf(segments)).flatMap(([x, y]) => [
    round(w * SIDE + x),
    round(h * DRAWING_TOP + y),
  ]);
  // The same fit, in points of the map, so the map lies under the line.
  const map = withMap
    ? videoMap(
        cut,
        {
          left: (w * SIDE) / MAP_PIXEL_RATIO,
          top: (h * DRAWING_TOP) / MAP_PIXEL_RATIO,
          width: boxWidth / MAP_PIXEL_RATIO,
          height: boxHeight / MAP_PIXEL_RATIO,
          pad: line / MAP_PIXEL_RATIO,
        },
        bearing,
      )
    : null;

  const results = resultsShown(run, shown);
  const labelHeight = w * look.label.size * look.label.lineHeight;
  const valueHeight = w * look.value.size * look.value.lineHeight;
  const rows = Math.ceil(results.length / 2);
  const resultsHeight =
    rows * (labelHeight + valueHeight) + Math.max(0, rows - 1) * w * look.rowGap;
  const resultsTop = h * (1 - look.resultsBottom) - resultsHeight;
  const columnWidth = (w * (1 - 2 * SIDE)) / 2;
  const placed = results.map((result, i) => ({
    result,
    x: w * SIDE + (i % 2) * columnWidth,
    y: resultsTop + Math.floor(i / 2) * (labelHeight + valueHeight + w * look.rowGap),
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
    map,
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
  style: TextStyle,
  colorRole: ColorRole,
  maxWidth: number,
  alpha: number,
  align: "left" | "center" = "left",
  lines = 1,
): VideoOp {
  const w = VIDEO_WIDTH;
  return {
    k: "text",
    text: words,
    x: round(x),
    y: round(y),
    size: round(w * style.size),
    weight: style.weight,
    tracking: round(w * style.tracking),
    color: colorRole,
    align,
    maxWidth: round(maxWidth),
    lines,
    alpha: round3(alpha),
  };
}

/** The brand's name next to the heart: bold in every look. */
const NAME_STYLE: TextStyle = {
  size: NAME,
  weight: 700,
  tracking: 0,
  lineHeight: LINE_HEIGHT,
};
/** The credit's line, small and faint. */
const CREDIT_STYLE: TextStyle = {
  size: CREDIT,
  weight: 400,
  tracking: 0,
  lineHeight: LINE_HEIGHT,
};

/** What the picture at `t` seconds shows. */
function frameAt(
  t: number,
  run: PostRun,
  stickers: readonly Sticker[],
  layout: Layout,
  look: Look,
  language: string,
): VideoOp[] {
  const w = VIDEO_WIDTH;
  const h = VIDEO_HEIGHT;
  const ops: VideoOp[] = [];

  // The map comes in with the logo, and the dark under the words with it.
  const ground = round3(ramp(t, 0, 0.5));
  if (layout.map !== null) {
    ops.push({ k: "map", alpha: ground });
  }

  const brand = round3(ramp(t, 0, 0.5));
  if (look.badge) {
    ops.push({
      k: "rect",
      x: round(layout.corner),
      y: round(layout.corner),
      w: round(layout.badge),
      h: round(layout.badge),
      r: round(layout.badge * BADGE_CORNER_SHARE),
      color: "accent",
      alpha: brand,
    });
  }
  ops.push(
    {
      k: "line",
      path: HEART_PATH,
      upTo: round(layout.heartLength),
      width: round(layout.heartLine),
      color: "onAccent",
      alpha: brand,
    },
    {
      k: "dot",
      ...layout.heartDot,
      r: round(layout.heartDot.r),
      ring: round(layout.heartDot.ring),
      fill: "dot",
      ringColor: "onAccent",
      alpha: brand,
    },
    text(
      "MuW",
      layout.corner + layout.badge + w * BRAND_GAP,
      layout.corner + (layout.badge - w * NAME * LINE_HEIGHT) / 2,
      NAME_STYLE,
      "ink",
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
        look.title,
        "ink",
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
      color: look.line.color,
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
        fill: "accent",
        ringColor: "onAccent",
        alpha: round3(tip),
      });
    }
  }

  if (look.scrim) {
    ops.push({ k: "scrim", top: round(h * SCRIM_TOP), alpha: ground });
  }

  const numbers = ramp(t, 0.6, 1);
  for (const { result, x, y } of layout.placed) {
    const value = valueAt(run, result, share);
    const name = resultName(result);
    ops.push(
      text(
        look.label.upper ? name.toLocaleUpperCase(language) : name,
        x,
        y,
        look.label,
        look.label.color,
        layout.columnWidth,
        numbers,
      ),
    );
    if (value !== null) {
      ops.push(
        text(
          value,
          x,
          y + layout.labelHeight,
          look.value,
          "ink",
          layout.columnWidth,
          numbers,
        ),
      );
    }
  }
  if (look.credit !== null) {
    ops.push(
      text(
        look.credit,
        w / 2,
        h * (1 - CREDIT_BOTTOM) - w * CREDIT * LINE_HEIGHT,
        CREDIT_STYLE,
        "faint",
        w * (1 - 2 * SIDE),
        numbers,
        "center",
      ),
    );
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
 * The video of `run`'s post as it is now, in `look`: the results on in
 * `shown`, the emoji where the runner put them.
 */
export function videoScene(
  run: PostRun,
  shown: readonly PostResult[],
  stickers: readonly Sticker[],
  look: VideoLook,
): VideoScene {
  const spec = look === "paper" ? PAPER : mapLook(NIGHT);
  const layout = layoutOf(run, shown, spec, look !== "paper");
  const language = appLanguage();
  const count = VIDEO_SECONDS * VIDEO_FPS;
  return {
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    fps: VIDEO_FPS,
    look,
    colors: spec.colors,
    map: layout.map,
    paths: [layout.heart, layout.track],
    frames: Array.from({ length: count }, (_, i) =>
      frameAt(i / VIDEO_FPS, run, stickers, layout, spec, language),
    ),
  };
}
