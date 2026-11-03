import {
  type Activity,
  PEN_UP_SHAPES,
  type PenUpShape,
  type Shape,
} from "@shaperoute/shared-types";

import { isOnWater } from "../swim/water";

/**
 * The shapes «Draw» offers with the pen up (TASK-223, ADR-0185): those the
 * user judged so on real roads, each piece drawn on its own and walked to.
 * The smiley, the ghost and the donut first; then the eyes of the cat, the
 * fish, the two heads and the pumpkin (judged on 2026-10-05, TASK-226). The
 * sun is drawn with the pen down, though the API takes it (PEN_UP_SHAPES).
 */
const OFFERED: ReadonlySet<Shape> = new Set<PenUpShape>([
  "smiley",
  "ghost",
  "donut",
  "cat",
  "fish",
  "dog_head",
  "rabbit_head",
  "pumpkin",
]);

/**
 * The shapes drawn in pieces on the water (TASK-226, ADR-0188; the user's
 * choice on real samples): every shape in pieces but the sun, whose rays
 * would be nine pauses and a third of the way with the pen up. There the
 * pen goes up by itself: no switch.
 */
const APART_ON_WATER: ReadonlySet<Shape> = new Set<PenUpShape>([
  "cat",
  "fish",
  "dog_head",
  "rabbit_head",
  "pumpkin",
  "smiley",
  "ghost",
  "donut",
]);

/** Whether «Draw» offers `shape` with the pen up. */
export function offersPenUp(shape: Shape | null): shape is PenUpShape {
  return shape !== null && OFFERED.has(shape);
}

/** Whether `shape` names a shape that may be drawn with the pen up: a route
 * of it may have walks, as a word's (TASK-223). */
export function isPenUpShape(shape: string | null | undefined): shape is PenUpShape {
  return (PEN_UP_SHAPES as readonly unknown[]).includes(shape);
}

/** Whether `shape` is drawn in pieces on the water, the pen up between
 * them (TASK-226). */
export function apartOnWater(shape: Shape | null): shape is PenUpShape {
  return shape !== null && APART_ON_WATER.has(shape);
}

/**
 * What «Draw» sends for `shape`. On the roads, with the pen up when the
 * switch is on and the shape is offered so. On the water the switch does
 * not count: a shape drawn in pieces there is always asked so (TASK-226),
 * paddled or swum (TASK-323).
 * Otherwise the request of before, field for field.
 */
export function shapeAsked(
  shape: Shape,
  penUp: boolean,
  activity: Activity,
): { shape: Shape } | { shape: PenUpShape; pen_up: true } {
  const lifted = isOnWater(activity)
    ? apartOnWater(shape)
    : penUp && offersPenUp(shape);
  return lifted ? { shape: shape as PenUpShape, pen_up: true } : { shape };
}
