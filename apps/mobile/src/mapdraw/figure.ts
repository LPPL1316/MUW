import type { LatLon, OutlinePoint, Shape } from "@shaperoute/shared-types";

import catalogue from "./catalogueShapes.json";
import { lineLength } from "./geometry";
import { fromPlane } from "./plane";

/**
 * The figure of «Draw on the map» (TASK-281, ADR-0245): what is on the map
 * and where, before any route is asked for. The app only shows it and
 * measures it; the engine decides the route from it.
 */

/** A point of a figure in its own frame: x to the right, y up, about
 * [-1, 1] (the details of a drawing may go past it). */
export type Unit = OutlinePoint;

/** What is on the map: a line drawn with a finger and the lines drawn after
 * it, hung on it as details (ADR-0074); a shape of the catalogue; or the
 * outline the engine traced from a photo (ADR-0069), or from one of the
 * ready-made pictures of «Draw» (TASK-280), which `sample` names. A
 * drawing's `linked` says, detail by detail, whether its first side is a
 * straight link that joins it to the drawing, not drawn: the map shows it
 * dashed, and the route runs it (TASK-331 part B). */
export type Figure =
  | { kind: "drawing"; outline: Unit[]; details: Unit[][]; linked?: boolean[] }
  | { kind: "shape"; shape: Shape }
  | { kind: "picture"; outline: Unit[]; strokes: Unit[][]; sample?: string };

/** A figure on the map: the middle of its frame, and the metres of one of
 * its units. Its size on the map is all there is to its distance. */
export type Placed = { figure: Figure; centre: LatLon; unitM: number };

/** How a figure is drawn and sized: its lines, how long the engine takes
 * them to be in units (the distance asked for is that times `unitM`), and
 * where the route starts. */
export type Look = { lines: Unit[][]; length: number; start: Unit };

type CatalogueLook = { lines: number[][][]; length: number; start: number[] };
type CatalogueEntry = { down: CatalogueLook; up?: CatalogueLook };

/** The catalogue as the engine draws it (tools/catalogue_shapes.py). */
const SHAPES = catalogue.shapes as Record<Shape, CatalogueEntry>;

/**
 * The length a detail is run, in units: out and back, but a loop at its end
 * once (the engine's `travelled_points`, in length).
 */
export function travelledLength(stroke: readonly Unit[]): number {
  const last = stroke[stroke.length - 1];
  const loop = stroke.findIndex((p) => p[0] === last[0] && p[1] === last[1]);
  if (loop === stroke.length - 1) {
    return 2 * lineLength(stroke);
  }
  return 2 * lineLength(stroke.slice(0, loop + 1)) + lineLength(stroke.slice(loop));
}

/**
 * The look of `figure`. `apart`: a shape of the catalogue asked with the
 * pen up (`shapeAsked`), drawn piece by piece and sized by its pieces alone.
 */
export function lookOf(figure: Figure, apart = false): Look {
  if (figure.kind === "shape") {
    const entry = SHAPES[figure.shape];
    const look = apart && entry.up ? entry.up : entry.down;
    return {
      lines: look.lines as Unit[][],
      length: look.length,
      start: look.start as Unit,
    };
  }
  const outline = figure.outline;
  const details = figure.kind === "drawing" ? figure.details : figure.strokes;
  return {
    lines: [outline, ...details],
    length:
      lineLength(outline) +
      details.reduce((total, detail) => total + travelledLength(detail), 0),
    start: outline[0],
  };
}

/** A point of the figure on the map. */
export function onMap(placed: Placed, [x, y]: Unit): LatLon {
  return fromPlane(placed.centre, [x * placed.unitM, y * placed.unitM]);
}

/** The lines of the figure on the map. */
export function placedLines(placed: Placed, apart = false): LatLon[][] {
  return lookOf(placed.figure, apart).lines.map((line) =>
    line.map((point) => onMap(placed, point)),
  );
}

/** Where the route of the figure starts: its first point. */
export function placedStart(placed: Placed, apart = false): LatLon {
  return onMap(placed, lookOf(placed.figure, apart).start);
}

/** The distance the figure would make, in metres, from its size. */
export function distanceOf(placed: Placed, apart = false): number {
  return lookOf(placed.figure, apart).length * placed.unitM;
}

/** The sizes a figure may take: the metres of a unit for the lowest and the
 * highest distance «Draw» offers. */
export function unitLimits(
  figure: Figure,
  [lowestM, highestM]: readonly [number, number],
  apart = false,
): [number, number] {
  const length = lookOf(figure, apart).length;
  return [lowestM / length, highestM / length];
}

/** `placed`, grown or shrunk about its middle to stay within the
 * distances: beyond them it grows no more. */
export function withinLimits(
  placed: Placed,
  limitsM: readonly [number, number],
  apart = false,
): Placed {
  const [lowest, highest] = unitLimits(placed.figure, limitsM, apart);
  const unitM = Math.min(highest, Math.max(lowest, placed.unitM));
  return unitM === placed.unitM ? placed : { ...placed, unitM };
}

/** `figure` at `centre`, as long as `distanceM`. */
export function placeAt(
  figure: Figure,
  centre: LatLon,
  distanceM: number,
  apart = false,
): Placed {
  return { figure, centre, unitM: distanceM / lookOf(figure, apart).length };
}
