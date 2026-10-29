import type { LatLon, Stretch, Walk } from "@shaperoute/shared-types";

import { onFootLines } from "../route/onFoot";
import { piecesOf, walksOf } from "../route/walks";
import { type LngLat, metresBetween, toLngLat } from "./coordinates";
import type { MapKind } from "./mapKind";
import type { RouteSplit } from "./routeSplit";

/**
 * A route that begins farther than this from the requested start gets a
 * "Start here" marker: the engine moved it where the shape fits (ADR-0025,
 * ADR-0040). Closer, it begins on the nearest road.
 */
export const START_HERE_M = 50;

/** From the app to the map page, delivered by `pageScript`. */
export type ToPage =
  | { type: "setPosition"; lngLat: LngLat }
  | {
      type: "showRoute";
      coordinates: LngLat[];
      startHere: LngLat | null;
      /** A word with the pen up (TASK-198): the letters, drawn as the
       * route, and the walks between them, dashed. Absent otherwise. */
      letters?: LngLat[][];
      walks?: LngLat[][];
      /** A bike route (TASK-206): the stretches with the bike on foot,
       * marked over the route. Absent otherwise. */
      onFoot?: LngLat[][];
      /** A route whose shape is turned (TASK-232): the bearing the map
       * takes so the drawing is upright. Absent with north up. */
      bearing?: number;
    }
  | { type: "clearRoute" }
  | {
      /** While running the route (TASK-224): the part run, solid, and the
       * part left, dashed; with `blink`, the dashes blink. */
      type: "showProgress";
      done: LngLat[][];
      ahead: LngLat[][];
      blink: boolean;
    }
  | { type: "clearProgress" }
  | { type: "showOthers"; lines: LngLat[][] }
  | { type: "showTrack"; coordinates: LngLat[] }
  | { type: "clearTrack" }
  | { type: "follow"; lngLat: LngLat; heading: number | null }
  | { type: "stopFollow" }
  | { type: "showStops"; stops: StopFeature[] }
  | { type: "clearStops" }
  /** A place of a themed route tapped under the map (TASK-329): the map
   * goes there, as close as a street. */
  | { type: "focus"; lngLat: LngLat }
  /** With `on`, a double tap is told to the app and no longer zooms the
   * map (TASK-119); two fingers still do. */
  | { type: "setDoubleTap"; on: boolean }
  /** With `on`, one finger drags the route and no longer the map
   * (TASK-238); lifted, the page tells the app by how much (`moved`). */
  | { type: "setMove"; on: boolean }
  /** The north arrow (TASK-232): the map turns to `bearing`, in degrees
   * clockwise from north; 0 is north up. */
  | { type: "turn"; bearing: number }
  /** The map's kind (TASK-264): standard, the aerial photos, or 3D. */
  | { type: "setKind"; kind: MapKind }
  /** «Draw on the map» (TASK-281): what fingers do on the map, and the
   * figure on it (`setCanvas`). */
  | ({ type: "setCanvas" } & CanvasOnPage)
  | { type: "clearCanvas" }
  /** Choosing the start on the map (TASK-292): with `on`, the start's pin
   * stays in the middle of the map, which moves under it, and the page
   * tells where the middle is (`centre`). */
  | { type: "setPick"; on: boolean }
  /** Off the route (TASK-303): a dotted line from the runner to where the
   * route goes on, `showRejoin`; none after. */
  | { type: "showRejoin"; line: LngLat[] }
  | { type: "clearRejoin" };

/** What fingers do on the map of «Draw on the map» (TASK-281): «Draw», one
 * finger draws, and two move and zoom the map (TASK-331); «Line» (TASK-331
 * part B), a finger taps the points of a straight line, told as a line
 * drawn, a band from the last point following it; «Erase», a finger rubs
 * lines out, told as a line drawn; «Move», one finger moves the figure, or
 * the map away from it, or bends a line held still first (`bent`), and two
 * fingers size the figure, or zoom the map away from it. With «Line» and
 * «Erase» too, two fingers move and zoom the map. */
export type CanvasMode = "draw" | "line" | "erase" | "move";

/** The figure on the map of «Draw on the map», as the page draws it. */
export type CanvasOnPage = {
  mode: CanvasMode;
  /** The figure's lines; none without a figure. */
  lines: LngLat[][];
  /** Line by line, whether its first side is a link, drawn dashed
   * (TASK-331 part B). */
  links: boolean[];
  /** The lines a finger may bend with «Move», by their index. */
  bendable: number[];
  /** The points of a straight line being tapped, the first to close it. */
  marks: LngLat[];
  /** The middle of the figure's frame, told back moved or sized. */
  centre: LngLat | null;
  /** How much two fingers may shrink and grow the figure: beyond, it stays
   * as big as the distances of «Draw» allow. */
  shrink: number;
  grow: number;
  /** Frame the map on the figure, or on the start without one: as the
   * screen opens and as a figure is put on it. */
  frame: boolean;
};

/** A place of a themed route on the map (TASK-129). */
export type StopFeature = { name: string; lngLat: LngLat; passed: boolean };

/** From the map page to the app, through `window.ReactNativeWebView`. */
export type FromPage =
  | { type: "ready" }
  /** The first tiles are drawn: the map has finished loading (TASK-058). */
  | { type: "loaded" }
  /** A double tap on the map, while the app asked for them (TASK-119). */
  | { type: "doubleTap" }
  /** The route was dragged and left, while the app asked (TASK-238): by
   * how many degrees of longitude and of latitude. */
  | { type: "moved"; by: LngLat }
  /** The map turned, by the app or by two fingers (TASK-232): its bearing
   * now, in whole degrees clockwise from north. */
  | { type: "turned"; bearing: number }
  /** «Draw on the map» (TASK-281): a line drawn with one finger, lifted;
   * and how many metres a pixel of the map is then, so the app knows a
   * finger's reach (TASK-331 part B). */
  | { type: "drawn"; line: LngLat[]; metresPerPx: number }
  /** A line held and dragged with «Move» (TASK-331 part B): from the point
   * held to where the finger left it. */
  | { type: "bent"; from: LngLat; to: LngLat; metresPerPx: number }
  /** The figure moved or sized by the fingers: the middle of its frame
   * now, and how many times bigger. While two fingers still size it
   * `done` is false, for the distance on screen. */
  | { type: "figure"; centre: LngLat; factor: number; done: boolean }
  /** The middle of the map, where a figure is put (TASK-281), or the
   * point chosen as the start (TASK-292). */
  | { type: "centre"; lngLat: LngLat }
  | { type: "error"; message: string };

export function setPosition(point: LatLon): ToPage {
  return { type: "setPosition", lngLat: toLngLat(point) };
}

/**
 * Draws the route and frames the map on it. When it begins away from
 * `requested`, the start the user asked for, it marks where to go. With the
 * walks of a word with the pen up (TASK-198) the letters are the route and
 * the walks are dashed; without, the message is the one of before. With the
 * stretches of a bike route walked with the bike on foot (TASK-206) they
 * are marked over the route. With the `bearing` of a turned shape
 * (TASK-232, `bearingOf`) the map turns so the drawing is upright.
 */
export function showRoute(
  points: LatLon[],
  requested: LatLon | null = null,
  walks: readonly Walk[] | null = null,
  onFoot: readonly Stretch[] | null = null,
  bearing: number = 0,
): ToPage {
  const moved =
    requested !== null && metresBetween(requested, points[0]) > START_HERE_M;
  const lines = onFootLines(points, onFoot, walks);
  const shown = {
    type: "showRoute" as const,
    coordinates: points.map(toLngLat),
    startHere: moved ? toLngLat(points[0]) : null,
    ...(lines.length > 0 ? { onFoot: lines.map((line) => line.map(toLngLat)) } : {}),
    ...(bearing !== 0 ? { bearing } : {}),
  };
  const walked = walksOf(points, walks);
  if (walked.length === 0) {
    return shown;
  }
  const pieces = piecesOf(points, walked);
  return {
    ...shown,
    letters: pieces.letters.map((line) => line.map(toLngLat)),
    walks: pieces.walks.map((line) => line.map(toLngLat)),
  };
}

/**
 * Moves the position marker and keeps the map on it, close up, without
 * framing the route again: navigation (TASK-049). With `heading`, degrees
 * clockwise from north, the marker is an arrow turned that way (TASK-164).
 */
export function follow(point: LatLon, heading: number | null = null): ToPage {
  return {
    type: "follow",
    lngLat: toLngLat(point),
    heading: heading === null ? null : Math.round(heading) % 360,
  };
}

/** The run is over: the arrow goes back to being the position marker. */
export function stopFollow(): ToPage {
  return { type: "stopFollow" };
}

/** Draws the run over the route, without moving the map (TASK-113). */
export function showTrack(points: LatLon[]): ToPage {
  return { type: "showTrack", coordinates: points.map(toLngLat) };
}

export function clearTrack(): ToPage {
  return { type: "clearTrack" };
}

/** Marks the places of a themed route, named when the route passes by. */
export function showStops(
  stops: { name: string; point: LatLon; passed: boolean }[],
): ToPage {
  return {
    type: "showStops",
    stops: stops.map((s) => ({
      name: s.name,
      lngLat: toLngLat(s.point),
      passed: s.passed,
    })),
  };
}

export function clearStops(): ToPage {
  return { type: "clearStops" };
}

/** Takes the map to `point`, a place of a themed route (TASK-329). */
export function focus(point: LatLon): ToPage {
  return { type: "focus", lngLat: toLngLat(point) };
}

export function clearRoute(): ToPage {
  return { type: "clearRoute" };
}

/**
 * Draws the route as the runner has got along it (TASK-224): the part run
 * solid yellow, the part left dashed, blinking unless `blink` is false
 * (pocket mode). The route of `showRoute` is kept, and comes back whole
 * with `clearProgress`.
 */
export function showProgress(split: RouteSplit, blink: boolean): ToPage {
  return {
    type: "showProgress",
    done: split.done.map((line) => line.map(toLngLat)),
    ahead: split.ahead.map((line) => line.map(toLngLat)),
    blink,
  };
}

/** The run is over: the route is drawn whole again, and nothing blinks. */
export function clearProgress(): ToPage {
  return { type: "clearProgress" };
}

/** Off the route (TASK-303): the dotted line from the runner, `from`, to
 * the point of the route to get back to, `to`, in a straight line. */
export function showRejoin(from: LatLon, to: LatLon): ToPage {
  return { type: "showRejoin", line: [toLngLat(from), toLngLat(to)] };
}

/** Back on the route, or the run over: no dotted line. */
export function clearRejoin(): ToPage {
  return { type: "clearRejoin" };
}

/** Draws the other routes to choose from under the route, without moving
 * the map (TASK-093); none clears them. */
export function showOthers(routes: LatLon[][]): ToPage {
  return { type: "showOthers", lines: routes.map((points) => points.map(toLngLat)) };
}

/**
 * Asks the map for its double taps, in place of its zoom on a double tap
 * (TASK-119): on a drawing they are the super like. `false` gives the zoom
 * back.
 */
export function setDoubleTap(on: boolean): ToPage {
  return { type: "setDoubleTap", on };
}

/**
 * Lets one finger drag the route in place of the map (TASK-238): the shape
 * of a route on the water, moved by the user. The page draws the route
 * under the finger and, when it is lifted, tells the app by how much
 * (`moved`); the engine then places the shape near there. `false` gives
 * the map its drag back.
 */
export function setMove(on: boolean): ToPage {
  return { type: "setMove", on };
}

/**
 * Turns the map to `bearing`, in degrees clockwise from north (TASK-232):
 * a tap on the north arrow. Still framed on its route, the map frames it
 * again as turned; otherwise it turns where it is.
 */
export function turn(bearing: number): ToPage {
  return { type: "turn", bearing };
}

/**
 * Shows the map as `kind` (TASK-264): the photos with the names over them,
 * or the 3D map leaning, with its hills and buildings. The route, the
 * camera and the marks stay as they are.
 */
export function setKind(kind: MapKind): ToPage {
  return { type: "setKind", kind };
}

/**
 * «Draw on the map» (TASK-281): the figure drawn on the map, and what
 * fingers do there. The page tells the app of lines drawn (`drawn`), of
 * lines bent (`bent`), of the figure moved or sized (`figure`) and of where
 * the map is (`centre`).
 */
export function setCanvas(canvas: {
  mode: CanvasMode;
  lines: LatLon[][];
  links: boolean[];
  bendable: number[];
  marks: LatLon[];
  centre: LatLon | null;
  shrink: number;
  grow: number;
  frame: boolean;
}): ToPage {
  return {
    type: "setCanvas",
    ...canvas,
    lines: canvas.lines.map((line) => line.map(toLngLat)),
    marks: canvas.marks.map(toLngLat),
    centre: canvas.centre === null ? null : toLngLat(canvas.centre),
  };
}

/** The map is the map again: fingers move it, and no figure is on it. */
export function clearCanvas(): ToPage {
  return { type: "clearCanvas" };
}

/**
 * Choosing the start on the map (TASK-292): the map is framed on the start,
 * north up, and the start's pin stays in its middle while fingers move the
 * map under it; the page tells the app where the middle is each time the
 * map stops (`centre`). `false` puts the pin back on the start.
 */
export function setPick(on: boolean): ToPage {
  return { type: "setPick", on };
}

/** JavaScript that hands a message to the page (see `mapPage.ts`). */
export function pageScript(message: ToPage): string {
  // The trailing `true` is what injectJavaScript expects as a result.
  return `window.shaperoute && window.shaperoute.receive(${JSON.stringify(message)}); true;`;
}

/** A [lng, lat] pair of finite numbers, as the page sends points. */
function isLngLat(value: unknown): value is LngLat {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

/** Metres a pixel of the map is: a number above nought. */
function isScale(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Reads a message posted by the page; anything unexpected gives null. */
export function parsePageMessage(data: string): FromPage | null {
  let message: unknown;
  try {
    message = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof message !== "object" || message === null || !("type" in message)) {
    return null;
  }
  if (
    message.type === "ready" ||
    message.type === "loaded" ||
    message.type === "doubleTap"
  ) {
    return { type: message.type };
  }
  if (message.type === "moved" && "by" in message) {
    const by = message.by;
    if (
      Array.isArray(by) &&
      by.length === 2 &&
      typeof by[0] === "number" &&
      typeof by[1] === "number" &&
      Number.isFinite(by[0]) &&
      Number.isFinite(by[1])
    ) {
      return { type: "moved", by: [by[0], by[1]] };
    }
    return null;
  }
  if (message.type === "drawn" && "line" in message && "metresPerPx" in message) {
    const { line, metresPerPx } = message;
    return Array.isArray(line) &&
      line.length > 0 &&
      line.every(isLngLat) &&
      isScale(metresPerPx)
      ? {
          type: "drawn",
          line: line.map(([lng, lat]) => [lng, lat] as LngLat),
          metresPerPx,
        }
      : null;
  }
  if (
    message.type === "bent" &&
    "from" in message &&
    "to" in message &&
    "metresPerPx" in message
  ) {
    const { from, to, metresPerPx } = message;
    return isLngLat(from) && isLngLat(to) && isScale(metresPerPx)
      ? { type: "bent", from: [from[0], from[1]], to: [to[0], to[1]], metresPerPx }
      : null;
  }
  if (
    message.type === "figure" &&
    "centre" in message &&
    "factor" in message &&
    "done" in message
  ) {
    const { centre, factor, done } = message;
    return isLngLat(centre) &&
      typeof factor === "number" &&
      Number.isFinite(factor) &&
      factor > 0 &&
      typeof done === "boolean"
      ? { type: "figure", centre: [centre[0], centre[1]], factor, done }
      : null;
  }
  if (message.type === "centre" && "lngLat" in message) {
    const lngLat = message.lngLat;
    return isLngLat(lngLat) ? { type: "centre", lngLat: [lngLat[0], lngLat[1]] } : null;
  }
  if (message.type === "turned" && "bearing" in message) {
    const bearing = message.bearing;
    return typeof bearing === "number" && Number.isFinite(bearing)
      ? { type: "turned", bearing }
      : null;
  }
  if (
    message.type === "error" &&
    "message" in message &&
    typeof message.message === "string"
  ) {
    return { type: "error", message: message.message };
  }
  return null;
}
