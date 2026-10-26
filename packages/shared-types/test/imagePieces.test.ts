import assert from "node:assert/strict";
import { test } from "node:test";

import traced from "../fixtures/image-outline-pieces.json" with { type: "json" };
import request from "../fixtures/image-route-request-pen-up.json" with { type: "json" };
import type {
  ImageOutline,
  ImagePenUpRouteRequest,
  OutlinePoint,
} from "../src/index.ts";

// The same JSON is read by the API's test_images.py (TASK-297 part C2).
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const fields: Same<keyof typeof traced, keyof ImageOutline> &
  Same<keyof typeof request, keyof Omit<ImagePenUpRouteRequest, "strokes">> = true;

// JSON arrays are not tuples to tsc: through unknown.
const outline = traced as unknown as ImageOutline;
const penUp = request as unknown as ImagePenUpRouteRequest;
const lines = (all: OutlinePoint[][] | undefined): OutlinePoint[][] => all ?? [];

test("the pieces of an outline come over the picture too", () => {
  assert.equal(fields, true);
  assert.equal(lines(outline.pieces).length, 1);
  assert.deepEqual(
    lines(outline.pieces).map((piece) => piece.length),
    lines(outline.image_pieces).map((piece) => piece.length),
  );
  for (const piece of lines(outline.pieces)) {
    assert.deepEqual(piece[0], piece[piece.length - 1]);
  }
});

test("the request with the pen up sends the outline and its pieces back", () => {
  assert.equal(penUp.pen_up, true);
  assert.deepEqual(penUp.outline, outline.points);
  assert.deepEqual(penUp.pieces, outline.pieces);
});
