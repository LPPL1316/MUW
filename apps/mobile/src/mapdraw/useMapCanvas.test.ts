import type { ImageOutline, LatLon } from "@shaperoute/shared-types";
import { act, renderHook } from "@testing-library/react-native";

import { requestImageOutline } from "../api/imageOutlines";
import { isImageRequest } from "../api/routes";
import { metresBetween } from "../map/coordinates";
import type { Picked } from "../route/pickImage";
import { SAMPLE_PICTURES } from "../route/samplePictures";
import { lookOf } from "./figure";
import { fromPlane } from "./plane";
import { type MapCanvasOptions, useMapCanvas } from "./useMapCanvas";

jest.mock("../api/imageOutlines", () => ({ requestImageOutline: jest.fn() }));

const TRENTO: LatLon = [46.0671, 11.1214];
const MIDDLE: LatLon = [46.07, 11.13];
const LIMITS: [number, number] = [1000, 21_000];

function setUp(options: Partial<MapCanvasOptions> = {}) {
  return renderHook(() =>
    useMapCanvas({
      apiUrl: "http://api.test",
      penUp: true,
      activity: "running",
      limitsM: LIMITS,
      distanceM: 5000,
      start: TRENTO,
      ...options,
    }),
  );
}

/** A round line about `radius` metres wide around `centre`. */
function roundLine(radius: number, centre: LatLon = MIDDLE): LatLon[] {
  return Array.from({ length: 120 }, (_, i) => {
    const a = (2 * Math.PI * 0.97 * i) / 119;
    return fromPlane(centre, [radius * Math.cos(a), radius * Math.sin(a)]);
  });
}

test("a tile puts the shape in the middle of the map, as long as «Draw» asks", async () => {
  const { result } = await setUp();
  expect(result.current.placed).toBeNull();
  expect(result.current.request).toBeNull();
  expect(result.current.canUndo).toBe(false);
  const framing = result.current.canvas.framing;

  await act(async () => result.current.onCanvas({ type: "centre", point: MIDDLE }));
  await act(async () => result.current.pick("heart"));
  const placed = result.current.placed;
  expect(placed?.centre).toEqual(MIDDLE);
  expect(result.current.distanceM).toBeCloseTo(5000);
  // Framed on it, and moving it is what comes next.
  expect(result.current.canvas.framing).toBe(framing + 1);
  expect(result.current.mode).toBe("move");
  expect(result.current.canvas.lines).toHaveLength(1);
  expect(result.current.request).toMatchObject({ shape: "heart", distance_m: 5000 });
});

test("without a word from the map the shape goes on the start", async () => {
  const { result } = await setUp();
  await act(async () => result.current.pick("star"));
  expect(result.current.placed?.centre).toEqual(TRENTO);
});

test("another tile changes the figure where it is, as big; «Undo» takes it back", async () => {
  const { result } = await setUp();
  await act(async () => result.current.pick("heart"));
  // Moved and sized by the fingers: kept, and not undone.
  await act(async () =>
    result.current.onCanvas({
      type: "figure",
      centre: MIDDLE,
      factor: 1.5,
      done: true,
    }),
  );
  const heart = result.current.placed;
  expect(result.current.distanceM).toBeCloseTo(7500);
  await act(async () => result.current.pick("star"));
  const star = result.current.placed;
  expect(star?.figure).toEqual({ kind: "shape", shape: "star" });
  expect(star?.centre).toEqual(heart?.centre);
  expect(star?.unitM).toBe(heart?.unitM);
  // The star is longer for its size: its distance follows.
  expect(result.current.distanceM).toBeCloseTo(
    (7500 / lookOf(heart!.figure).length) * lookOf(star!.figure).length,
  );

  await act(async () => result.current.undo());
  expect(result.current.placed).toEqual(heart);
  await act(async () => result.current.undo());
  expect(result.current.placed).toBeNull();
  expect(result.current.canUndo).toBe(false);
});

test("two fingers sizing the figure: the distance follows, the figure is kept at the end", async () => {
  const { result } = await setUp();
  await act(async () => result.current.pick("heart"));
  const before = result.current.placed;
  await act(async () =>
    result.current.onCanvas({ type: "figure", centre: MIDDLE, factor: 2, done: false }),
  );
  expect(result.current.distanceM).toBeCloseTo(10_000);
  expect(result.current.placed).toBe(before);
  await act(async () =>
    result.current.onCanvas({ type: "figure", centre: MIDDLE, factor: 2, done: true }),
  );
  expect(result.current.distanceM).toBeCloseTo(10_000);
  expect(result.current.placed?.centre).toEqual(MIDDLE);
  // The room left to grow, for the page: up to 21 km.
  expect(result.current.canvas.grow).toBeCloseTo(2.1);
  expect(result.current.canvas.shrink).toBeCloseTo(0.1);
  // Beyond the distances it grows no more.
  await act(async () =>
    result.current.onCanvas({ type: "figure", centre: MIDDLE, factor: 5, done: true }),
  );
  expect(result.current.distanceM).toBeCloseTo(21_000);
});

test("with «Draw» a line is the figure, the next one a detail; «Undo» one at a time", async () => {
  const { result } = await setUp();
  expect(result.current.mode).toBe("draw");
  await act(async () =>
    result.current.onCanvas({ type: "drawn", line: roundLine(800) }),
  );
  const drawing = result.current.placed;
  expect(drawing?.figure.kind).toBe("drawing");
  expect(metresBetween(drawing!.centre, MIDDLE)).toBeLessThan(30);
  expect(isImageRequest(result.current.request!)).toBe(true);
  const answered = result.current.canvas;

  await act(async () =>
    result.current.onCanvas({
      type: "drawn",
      line: [
        fromPlane(MIDDLE, [0, 0]),
        fromPlane(MIDDLE, [0, -400]),
        fromPlane(MIDDLE, [0, -780]),
      ],
    }),
  );
  const withDetail = result.current.placed;
  expect(
    withDetail?.figure.kind === "drawing" && withDetail.figure.details,
  ).toHaveLength(1);
  // A new canvas for the page: the line drawn is cleared.
  expect(result.current.canvas).not.toBe(answered);

  await act(async () => result.current.undo());
  expect(result.current.placed?.figure).toEqual(drawing?.figure);
  await act(async () => result.current.undo());
  expect(result.current.placed).toBeNull();
});

test("a line drawn over a shape takes its place; «Undo» brings the shape back", async () => {
  const { result } = await setUp();
  await act(async () => result.current.pick("heart"));
  const heart = result.current.placed;
  await act(async () => result.current.setMode("draw"));
  await act(async () =>
    result.current.onCanvas({ type: "drawn", line: roundLine(500) }),
  );
  expect(result.current.placed?.figure.kind).toBe("drawing");
  await act(async () => result.current.undo());
  expect(result.current.placed).toEqual(heart);
});

test("a line that crosses itself says so, and changes nothing; with «Move» lines are nobody's", async () => {
  const { result } = await setUp();
  const zigzag = [
    [0, 0],
    [1000, 1000],
    [1000, 0],
    [0, 1000],
    [-1000, 0],
    [-1000, 1000],
  ].map((p) => fromPlane(MIDDLE, p as [number, number]));
  await act(async () => result.current.onCanvas({ type: "drawn", line: zigzag }));
  expect(result.current.problem).toBe("crosses");
  expect(result.current.placed).toBeNull();
  await act(async () => result.current.setMode("move"));
  expect(result.current.problem).toBeNull();
  await act(async () =>
    result.current.onCanvas({ type: "drawn", line: roundLine(500) }),
  );
  expect(result.current.placed).toBeNull();
});

test("«+ photo»: the outline the engine traced is put on the map", async () => {
  const outline: ImageOutline = {
    points: [
      [-1, -1],
      [1, -1],
      [0, 1],
      [-1, -1],
    ],
    image_points: [
      [0, 1],
      [1, 1],
      [0.5, 0],
      [0, 1],
    ],
    aspect: 1,
    strokes: [],
  };
  jest.mocked(requestImageOutline).mockResolvedValue({ kind: "outline", outline });
  const pick = jest.fn(async (): Promise<Picked> => ({
    kind: "picked",
    picture: { uri: "file:///cat.jpg", width: 640, height: 480 },
    base64: "abc",
  }));
  const { result } = await setUp({ pick });
  await act(async () => result.current.onCanvas({ type: "centre", point: MIDDLE }));
  await act(async () => result.current.choosePhoto());
  expect(pick).toHaveBeenCalledWith("library");
  expect(result.current.photo.status).toBe("traced");
  expect(result.current.placed?.figure).toEqual({
    kind: "picture",
    outline: outline.points,
    strokes: [],
  });
  expect(result.current.distanceM).toBeCloseTo(5000);
  expect(result.current.request).toMatchObject({
    outline: outline.points,
    distance_m: 5000,
  });
});

test("«Try 8 km» makes the figure that size and gives its request", async () => {
  const { result } = await setUp();
  await act(async () => result.current.pick("heart"));
  let sized: ReturnType<typeof result.current.sizeTo> = null;
  await act(async () => {
    sized = result.current.sizeTo(8000);
  });
  expect(sized).toMatchObject({ shape: "heart", distance_m: 8000 });
  expect(result.current.request).toEqual(sized);
  expect(result.current.distanceM).toBeCloseTo(8000);
});

test("a ready-made picture of «Draw» is a tile: its outline goes on the map", async () => {
  const [first, second] = SAMPLE_PICTURES;
  const { result } = await setUp();
  await act(async () => result.current.onCanvas({ type: "centre", point: MIDDLE }));
  await act(async () => result.current.pickSample(first));
  expect(result.current.placed?.figure).toEqual({
    kind: "picture",
    outline: first.outline.points,
    strokes: first.outline.strokes ?? [],
    sample: first.id,
  });
  expect(result.current.distanceM).toBeCloseTo(5000);
  expect(isImageRequest(result.current.request!)).toBe(true);
  // The same tile again changes nothing; another takes its place, as big.
  const placed = result.current.placed;
  await act(async () => result.current.pickSample(first));
  expect(result.current.placed).toBe(placed);
  await act(async () => result.current.pickSample(second));
  expect(result.current.placed?.figure).toMatchObject({ sample: second.id });
  expect(result.current.placed?.unitM).toBe(placed?.unitM);
});
