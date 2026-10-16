import type { LatLon } from "@shaperoute/shared-types";
import { act, renderHook } from "@testing-library/react-native";

import { isImageRequest } from "../api/routes";
import { SAMPLE_PICTURES } from "../route/samplePictures";
import { sameRequest } from "../route/useRouteRequest";
import { type MapCanvasOptions, useMapCanvas } from "./useMapCanvas";

// A tile under the route of the figure (TASK-286): the new figure takes the
// place of the one on the map, with its middle and the route's distance,
// and «Undo» on the map puts back the one of before.

jest.mock("../api/imageOutlines", () => ({ requestImageOutline: jest.fn() }));

const TRENTO: LatLon = [46.0671, 11.1214];
const MIDDLE: LatLon = [46.07, 11.13];
const ROCKET = SAMPLE_PICTURES.find((sample) => sample.id === "rocket")!;

function setUp(options: Partial<MapCanvasOptions> = {}) {
  return renderHook(() =>
    useMapCanvas({
      apiUrl: "http://api.test",
      penUp: true,
      activity: "running",
      limitsM: [1000, 21_000],
      distanceM: 5000,
      start: TRENTO,
      ...options,
    }),
  );
}

test("a shape in place of the figure: the same middle, the route's distance", async () => {
  const { result } = await setUp();
  await act(async () => result.current.onCanvas({ type: "centre", point: MIDDLE }));
  await act(async () => result.current.pick("heart"));
  // Made bigger by two fingers: the route asked is 7.5 km.
  await act(async () =>
    result.current.onCanvas({
      type: "figure",
      centre: MIDDLE,
      factor: 1.5,
      done: true,
    }),
  );
  const heart = result.current.placed;
  expect(result.current.request?.distance_m).toBe(7500);

  let asked = null as ReturnType<typeof result.current.changeTo>;
  await act(async () => {
    asked = result.current.changeTo({ kind: "shape", shape: "star" }, 7500);
  });
  expect(result.current.placed).toMatchObject({
    figure: { kind: "shape", shape: "star" },
    centre: MIDDLE,
  });
  expect(result.current.distanceM).toBeCloseTo(7500);
  expect(asked).toMatchObject({ shape: "star", distance_m: 7500, activity: "running" });
  // The request the map's figure gives now: its route is the one asked.
  expect(sameRequest(asked!, result.current.request!)).toBe(true);

  // Back on the map, «Undo»: the heart as it was, where it was.
  await act(async () => result.current.undo());
  expect(result.current.placed).toEqual(heart);
});

test("a ready-made picture in place of a shape, its outline asked", async () => {
  const { result } = await setUp();
  await act(async () => result.current.onCanvas({ type: "centre", point: MIDDLE }));
  await act(async () => result.current.pick("moon"));

  let asked = null as ReturnType<typeof result.current.changeTo>;
  await act(async () => {
    asked = result.current.changeTo({ kind: "picture", sample: ROCKET }, 6000);
  });
  expect(result.current.placed).toMatchObject({
    figure: { kind: "picture", sample: "rocket" },
    centre: MIDDLE,
  });
  expect(asked !== null && isImageRequest(asked)).toBe(true);
  expect(asked?.distance_m).toBe(6000);
  // The same arrays as the request of the figure: known as the same route.
  expect(sameRequest(asked!, result.current.request!)).toBe(true);
});

test("a shape asked with the pen up, as «Draw» asks it", async () => {
  const { result } = await setUp({ penUp: true });
  await act(async () => result.current.pick("heart"));
  let asked = null as ReturnType<typeof result.current.changeTo>;
  await act(async () => {
    asked = result.current.changeTo({ kind: "shape", shape: "smiley" }, 5000);
  });
  expect(asked).toMatchObject({ shape: "smiley", pen_up: true, distance_m: 5000 });
});

test("without a figure on the map there is nothing to change", async () => {
  const { result } = await setUp();
  let asked = null as ReturnType<typeof result.current.changeTo>;
  await act(async () => {
    asked = result.current.changeTo({ kind: "shape", shape: "star" }, 5000);
  });
  expect(asked).toBeNull();
  expect(result.current.placed).toBeNull();
  expect(result.current.canUndo).toBe(false);
});
