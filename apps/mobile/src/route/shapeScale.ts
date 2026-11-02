import type { OutlinePoint, Shape } from "@shaperoute/shared-types";

import { lookOf } from "../mapdraw/figure";

/**
 * How big a shape of the catalogue comes out on the ground at a distance
 * (TASK-361), for the preview of «Draw»: the engine's own outline
 * (`catalogueShapes.json`, as «Draw on the map» places it), sized so its
 * length is the distance. The route follows streets, so the real one is
 * close to this, never exactly it.
 */
export type ShapeScale = {
  /** The outline's lines as shares of a square box, y down, centred. */
  lines: OutlinePoint[][];
  /** The shape's width and height on the ground, in metres. */
  widthM: number;
  heightM: number;
  /** The metres of the box's side: the larger of the two. */
  boxM: number;
};

export function shapeScale(shape: Shape, distanceM: number): ShapeScale {
  const look = lookOf({ kind: "shape", shape });
  const unitM = distanceM / look.length;
  const points = look.lines.flat();
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
  const side = Math.max(maxX - minX, maxY - minY);
  // Centred in the square; y turned, the plane's north up.
  const left = minX - (side - (maxX - minX)) / 2;
  const top = maxY + (side - (maxY - minY)) / 2;
  return {
    lines: look.lines.map((line) =>
      line.map(([x, y]): OutlinePoint => [(x - left) / side, (top - y) / side]),
    ),
    widthM: (maxX - minX) * unitM,
    heightM: (maxY - minY) * unitM,
    boxM: side * unitM,
  };
}

/** The lengths a scale bar may take, in metres: round ones. */
const BAR_STEPS_M = [50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];

/**
 * The scale bar for a box `boxM` wide: the longest round length no more
 * than `share` of it, and that share. With «Miles» the same lengths are
 * written in miles by the caller.
 */
export function scaleBar(boxM: number, share = 0.4): { metres: number; share: number } {
  const fits = BAR_STEPS_M.filter((step) => step <= boxM * share);
  const metres = fits.length > 0 ? fits[fits.length - 1] : BAR_STEPS_M[0];
  return { metres, share: metres / boxM };
}
