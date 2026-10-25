import type { Segment } from "../activities/fitLines";

/**
 * A shape of the game's catalog (TASK-296) as thin turned Views, like the
 * run's drawing (`activities/fitLines`): the outline comes from the API
 * from 0 to 1, y downwards, and is fitted inside a square of `size` points
 * with `pad` around, proportions kept and centred. In the order the pen
 * draws it, so a card can draw it stroke by stroke.
 */
export function outlineSegments(
  outline: readonly (readonly [number, number])[],
  size: number,
  pad: number,
): Segment[] {
  if (outline.length < 2) {
    return [];
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of outline) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const scale = (size - 2 * pad) / Math.max(spanX, spanY);
  const offX = (size - spanX * scale) / 2;
  const offY = (size - spanY * scale) / 2;
  const at = ([x, y]: readonly [number, number]): [number, number] => [
    offX + (x - minX) * scale,
    offY + (y - minY) * scale,
  ];
  const segments: Segment[] = [];
  let [x1, y1] = at(outline[0]);
  for (let i = 1; i < outline.length; i += 1) {
    const [x2, y2] = at(outline[i]);
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length < 0.5) {
      continue;
    }
    segments.push({
      left: (x1 + x2) / 2 - length / 2,
      top: (y1 + y2) / 2,
      length,
      angle: (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI,
    });
    [x1, y1] = [x2, y2];
  }
  return segments;
}
