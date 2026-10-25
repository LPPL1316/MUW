import type { ImageRouteRequest, RouteRequest } from "@shaperoute/shared-types";

import { sameRequest } from "../route/useRouteRequest";
import { SAMPLE_PICTURES } from "../route/samplePictures";
import {
  changedRequest,
  drawnTile,
  figureOf,
  isChosen,
  NO_TILE,
  placedTile,
} from "./resultFigure";

// Another figure from the map of the result (TASK-286): the request of the
// tile from the same start, distance and sport, and the tile marked.

const ROCKET = SAMPLE_PICTURES.find((sample) => sample.id === "rocket")!;
const HEART: RouteRequest = {
  start: [46.07, 11.13],
  shape: "heart",
  distance_m: 6200,
  activity: "running",
};
const WORD: RouteRequest = {
  start: [46.07, 11.13],
  word: "CIAO",
  style: "block",
  pen_up: true,
  distance_m: 12000,
  activity: "running",
};
const PHOTO: ImageRouteRequest = {
  start: [46.07, 11.13],
  outline: [
    [0, 1],
    [1, 0],
    [0, -1],
    [0, 1],
  ],
  distance_m: 5000,
  activity: "cycling",
};

describe("changedRequest", () => {
  test("a shape from the same start, as long, for the same sport", () => {
    expect(changedRequest(HEART, { kind: "shape", shape: "star" }, true)).toEqual({
      start: [46.07, 11.13],
      shape: "star",
      distance_m: 6200,
      activity: "running",
    });
  });

  test("a word or a photo gives its place to the shape: nothing of it stays", () => {
    expect(changedRequest(WORD, { kind: "shape", shape: "moon" }, true)).toEqual({
      start: [46.07, 11.13],
      shape: "moon",
      distance_m: 12000,
      activity: "running",
    });
    expect(changedRequest(PHOTO, { kind: "shape", shape: "circle" }, false)).toEqual({
      start: [46.07, 11.13],
      shape: "circle",
      distance_m: 5000,
      activity: "cycling",
    });
  });

  test("a shape offered with the pen up is asked so while the switch is on", () => {
    const smiley = { kind: "shape", shape: "smiley" } as const;
    expect(changedRequest(HEART, smiley, true)).toMatchObject({
      shape: "smiley",
      pen_up: true,
    });
    expect(changedRequest(HEART, smiley, false)).not.toHaveProperty("pen_up");
  });

  test("on the water a shape left somewhere stays there, in pieces as there", () => {
    const moved: RouteRequest = {
      ...HEART,
      distance_m: 2000,
      activity: "paddling",
      near: [45.6, 10.7],
    };
    expect(changedRequest(moved, { kind: "shape", shape: "cat" }, false)).toEqual({
      start: [46.07, 11.13],
      shape: "cat",
      pen_up: true,
      distance_m: 2000,
      activity: "paddling",
      near: [45.6, 10.7],
    });
  });

  test("a picture sends its outline, the very arrays «Draw» sends for it", () => {
    const asked = changedRequest(HEART, { kind: "picture", sample: ROCKET }, true);
    expect(asked).toEqual({
      start: [46.07, 11.13],
      outline: ROCKET.outline.points,
      strokes: ROCKET.outline.strokes,
      distance_m: 6200,
      activity: "running",
    });
    // As «Draw» asks for it once the picture is its choice (App.tsx).
    const drawn = {
      start: HEART.start,
      outline: ROCKET.outline.points,
      strokes: ROCKET.outline.strokes,
      distance_m: 6200,
      activity: "running" as const,
    };
    expect(sameRequest(asked, drawn)).toBe(true);
  });
});

describe("the tile marked", () => {
  test("the shape of a route of «Draw»; none for a word", () => {
    expect(drawnTile(HEART)).toEqual({ shape: "heart", sample: null });
    expect(drawnTile(WORD)).toEqual(NO_TILE);
  });

  test("the ready-made picture whose outline a route sends; none for a photo", () => {
    const asked = changedRequest(HEART, { kind: "picture", sample: ROCKET }, true);
    expect(drawnTile(asked)).toEqual({ shape: null, sample: "rocket" });
    // The same points, not its outline: a picture with a detail drawn on it.
    expect(drawnTile({ ...PHOTO, outline: [...ROCKET.outline.points] })).toEqual(
      NO_TILE,
    );
  });

  test("the figure on the map of «Draw on the map»", () => {
    const centre = [46.07, 11.13] as const;
    const place = (choice: Parameters<typeof figureOf>[0]) => ({
      figure: figureOf(choice),
      centre: [...centre] as [number, number],
      unitM: 500,
    });
    expect(placedTile(null)).toEqual(NO_TILE);
    expect(placedTile(place({ kind: "shape", shape: "sun" }))).toEqual({
      shape: "sun",
      sample: null,
    });
    expect(placedTile(place({ kind: "picture", sample: ROCKET }))).toEqual({
      shape: null,
      sample: "rocket",
    });
    expect(
      placedTile({
        figure: { kind: "drawing", outline: ROCKET.outline.points, details: [] },
        centre: [...centre] as [number, number],
        unitM: 500,
      }),
    ).toEqual(NO_TILE);
  });

  test("the tile marked asks for nothing", () => {
    const chosen = { shape: "heart", sample: null } as const;
    expect(isChosen({ kind: "shape", shape: "heart" }, chosen)).toBe(true);
    expect(isChosen({ kind: "shape", shape: "star" }, chosen)).toBe(false);
    expect(isChosen({ kind: "picture", sample: ROCKET }, chosen)).toBe(false);
    expect(
      isChosen({ kind: "picture", sample: ROCKET }, { shape: null, sample: "rocket" }),
    ).toBe(true);
  });
});

test("a picture on the map keeps its outline, its details and its name", () => {
  expect(figureOf({ kind: "picture", sample: ROCKET })).toEqual({
    kind: "picture",
    outline: ROCKET.outline.points,
    strokes: ROCKET.outline.strokes ?? [],
    sample: "rocket",
  });
});
