import traced from "@shaperoute/shared-types/fixtures/image-outline-pieces.json";
import tracedAlone from "@shaperoute/shared-types/fixtures/image-outline.json";
import type { ImageOutline } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { requestImageOutline, withUsablePieces } from "../api/imageOutlines";
import { ImageChoice } from "./ImageChoice";
import { type ImageEdits, ImageEditsContext } from "./imageEdits";
import { drawnApart, imageAsked, linesOver, piecesOf } from "./imagePieces";
import { sameRequest } from "./useRouteRequest";

// A picture with the pen up (TASK-297 part C2, ADR-0258): the pieces of its
// outline, how they are asked for and shown. The whole app in
// __tests__/AppImagePenUp.test.tsx.

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

// JSON arrays are not tuples to tsc: through unknown.
const APART = traced as unknown as ImageOutline;
const ALONE = tracedAlone as unknown as ImageOutline;
const START: [number, number] = [46.0671, 11.1214];

test("with the pen up and pieces, the outline and its pieces are asked for", () => {
  expect(drawnApart(APART, true)).toBe(true);
  expect(imageAsked(APART, true)).toEqual({
    outline: APART.points,
    pieces: APART.pieces,
    pen_up: true,
  });
  expect(linesOver(APART, true)).toBe(APART.image_pieces);
});

test("with the pen down, or no pieces, the outline and its strokes, as before", () => {
  for (const [outline, penUp] of [
    [APART, false],
    [ALONE, true],
    [ALONE, false],
  ] as const) {
    expect(drawnApart(outline, penUp)).toBe(false);
    expect(imageAsked(outline, penUp)).toEqual({
      outline: outline.points,
      strokes: outline.strokes,
    });
    expect(linesOver(outline, penUp)).toBe(outline.image_strokes);
  }
  // An API older than TASK-297, or an edited outline: none.
  expect(piecesOf(ALONE)).toEqual([]);
  expect(piecesOf({ ...APART, pieces: [], image_pieces: [] })).toEqual([]);
});

test("pieces that cannot be drawn or sent back are left out, not the outline", () => {
  expect(withUsablePieces(APART)).toBe(APART);
  const [piece] = APART.pieces ?? [];
  const wrong: Partial<ImageOutline>[] = [
    // Not one for one over the picture.
    { image_pieces: [] },
    { image_pieces: [[...(APART.image_pieces?.[0] ?? []), [0.5, 0.5]]] },
    // Out of the frame, or a single point.
    { pieces: [[[2, 0], ...piece.slice(1)]] },
    { pieces: [[piece[0]]], image_pieces: [[[0.5, 0.5]]] },
  ];
  for (const change of wrong) {
    const kept = withUsablePieces({ ...APART, ...change });
    expect(kept.pieces).toBeUndefined();
    expect(kept.image_pieces).toBeUndefined();
    expect(kept.points).toBe(APART.points);
  }
});

test("an answer with unusable pieces is still the outline", async () => {
  const fetchFn = jest.fn(async () =>
    Response.json({ ...traced, image_pieces: [] }),
  ) as unknown as typeof fetch;
  const outcome = await requestImageOutline("http://api", "/9j/4AAQ", {
    fetchFn,
    key: null,
  });
  expect(outcome.kind).toBe("outline");
  if (outcome.kind === "outline") {
    expect(outcome.outline.points).toEqual(traced.points);
    expect(piecesOf(outcome.outline)).toEqual([]);
  }
});

test("the pen up of a picture is another route than the pen down", () => {
  const base = { start: START, distance_m: 6000, activity: "running" as const };
  const down = { ...base, ...imageAsked(APART, false) };
  const up = { ...base, ...imageAsked(APART, true) };
  expect(sameRequest(down, { ...base, ...imageAsked(APART, false) })).toBe(true);
  expect(sameRequest(up, { ...base, ...imageAsked(APART, true) })).toBe(true);
  expect(sameRequest(down, up)).toBe(false);
});

function edits(): ImageEdits {
  return { earlier: [], edit: { status: "idle" }, add: jest.fn(), undo: jest.fn() };
}

async function shown(penUp: boolean) {
  await render(
    <ImageEditsContext.Provider value={edits()}>
      <ImageChoice
        state={{
          status: "traced",
          picture: { uri: "file:///logo.jpg", width: 800, height: 800 },
          outline: APART,
        }}
        onChoose={jest.fn()}
        penUp={penUp}
      />
    </ImageEditsContext.Provider>,
  );
  await fireEvent(screen.getByTestId("image-preview"), "layout", {
    nativeEvent: { layout: { width: 400, height: 0 } },
  });
}

test("the pieces are drawn over the picture as the strokes, only with the pen up", async () => {
  await shown(true);
  // The piece of the fixture: a triangle, three sides.
  expect(screen.getAllByTestId("detail-side")).toHaveLength(3);
  expect(screen.queryByRole("button", { name: "Edit the outline" })).toBeNull();
  await shown(false);
  // Its strokes: none.
  expect(screen.queryAllByTestId("detail-side")).toHaveLength(0);
  expect(screen.getByRole("button", { name: "Edit the outline" })).toBeOnTheScreen();
});
