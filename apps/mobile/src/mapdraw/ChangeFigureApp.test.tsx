/**
 * Another figure from the map of the result (TASK-286, an addition to
 * ADR-0245), in the app itself: the row of shapes and pictures above
 * «Start», a tile that asks for the route of its figure from the same start
 * and as long, and the way back to «Draw» or to the map with the new figure
 * chosen. The requests alone are in resultFigure.test.ts, the figure on the
 * map in useMapCanvasChange.test.ts.
 */
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../../App";
import { forgetExamples } from "../explore/exampleRoutes";
import { forgetWaterChoice } from "../paddle/PaddleExplore";
import { forgetNoticeSeen } from "../paddle/safetyNotice";
import { SAMPLE_PICTURES } from "../route/samplePictures";
import { loadSport } from "../settings/sport";

jest.mock("react-native-webview");
jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
// The Expo dev server as the phone sees it: the API is on the same PC.
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: "192.168.1.23:8081" } },
}));
jest.mock("expo-file-system");
jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3, BestForNavigation: 6 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));
jest.mock("expo-speech", () => ({ speak: jest.fn(), stop: jest.fn() }));
// The sport kept on the phone, as each test says.
jest.mock("../settings/sport", () => ({
  ...jest.requireActual<typeof import("../settings/sport")>("../settings/sport"),
  loadSport: jest.fn(),
}));

const API = "http://192.168.1.23:8000";
const TRENTO: [number, number] = [46.0679, 11.1211];
const RICCIONE: [number, number] = [44.00355, 12.66338];
const ROCKET = SAMPLE_PICTURES.find((picture) => picture.id === "rocket")!;
const MOVE = { name: "Move the shape" };

/** A route on the water, with where the centre of its shape is (TASK-238). */
const WATER_DONE = {
  ...jobDone,
  result: {
    ...jobDone.result,
    similarity: 1,
    directions: [],
    alternatives: [],
    warnings: [],
    walks: [],
    on_foot: [],
    better_distance_m: null,
    centre: [44.0105, 12.6702],
  },
};

let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** The API: each route job is accepted, and is `done` at the first poll. */
function apiAnswers(done: unknown = jobDone) {
  fetchSpy.mockImplementation(async (input, init) => {
    const method = init?.method ?? "GET";
    if (!String(input).includes("route-jobs")) {
      return Response.json({}, { status: 404 });
    }
    if (method === "POST") {
      return Response.json(
        { job_id: "4f2c9e1a", status: "queued", result: null, error: null },
        { status: 202 },
      );
    }
    if (method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    return Response.json(done);
  });
}

/** The bodies the app sent to `path` with POST, read back. */
function posted(path: string): Record<string, unknown>[] {
  return fetchSpy.mock.calls
    .filter(
      ([input, init]) =>
        String(input) === `${API}${path}` && (init?.method ?? "GET") === "POST",
    )
    .map(([, init]) => JSON.parse(String(init?.body)));
}

async function startingAt(where: [number, number]) {
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: where[0], longitude: where[1] },
  } as Location.LocationObject);
  await render(<App />);
  await act(() => jest.advanceTimersByTimeAsync(0));
  expect(screen.getByText("Starting from your position.")).toBeOnTheScreen();
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
}

/** «Draw route», and the route at the first poll, after 500 ms. */
async function drawRoute() {
  await fireEvent.press(screen.getByRole("button", { name: "Draw route" }));
  await act(() => jest.advanceTimersByTimeAsync(500));
}

/** The row under the route. */
function row() {
  return within(screen.getByTestId("result-figures"));
}

/** A tile of the row pressed, and the new route at the first poll. */
async function change(name: string) {
  await fireEvent.press(row().getByRole("button", { name }));
  // The wait, as for any new drawing: no row until the route comes.
  expect(screen.queryByTestId("result-figures")).toBeNull();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeOnTheScreen();
  await act(() => jest.advanceTimersByTimeAsync(500));
}

beforeEach(() => {
  jest.useFakeTimers();
  forgetExamples();
  forgetNoticeSeen();
  forgetWaterChoice();
  jest.mocked(loadSport).mockReturnValue("run");
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest
    .mocked(Location.watchPositionAsync)
    .mockResolvedValue({ remove: jest.fn() } as Location.LocationSubscription);
  fetchSpy = jest.spyOn(globalThis, "fetch");
  apiAnswers();
});

afterEach(() => {
  forgetExamples();
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

test("from «Draw» a shape of the row is drawn from the same start, as long; «←» finds it chosen", async () => {
  await startingAt(TRENTO);
  await drawRoute();
  // The 17 shapes and the 16 pictures, the heart drawn marked.
  expect(row().getAllByRole("button")).toHaveLength(33);
  expect(row().getByRole("button", { name: "heart" })).toBeSelected();
  expect(row().getByRole("button", { name: "Rocket" })).toBeOnTheScreen();

  await change("star");
  const [first, star, ...more] = posted("/route-jobs");
  expect(more).toEqual([]);
  expect(first).toEqual({
    start: TRENTO,
    shape: "heart",
    distance_m: 5000,
    activity: "running",
  });
  expect(star).toEqual({ ...first, shape: "star" });
  expect(row().getByRole("button", { name: "star" })).toBeSelected();
  expect(row().getByRole("button", { name: "heart" })).not.toBeSelected();

  // The tile of the figure drawn asks for nothing.
  await fireEvent.press(row().getByRole("button", { name: "star" }));
  expect(posted("/route-jobs")).toHaveLength(2);

  // «Draw» has the star chosen, and the same route is shown again, not
  // asked for again.
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(
    within(screen.getByTestId("shape-tiles")).getByRole("button", { name: "star" }),
  ).toBeSelected();
  await fireEvent.press(screen.getByRole("button", { name: "Draw route" }));
  expect(posted("/route-jobs")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Start" })).toBeOnTheScreen();
});

test("from «Draw» a picture of the row sends its outline and puts «Draw» on «Image»", async () => {
  await startingAt(TRENTO);
  await drawRoute();

  await change("Rocket");
  expect(posted("/image-route-jobs")).toEqual([
    {
      start: TRENTO,
      outline: ROCKET.outline.points,
      strokes: ROCKET.outline.strokes,
      distance_m: 5000,
      activity: "running",
    },
  ]);
  expect(row().getByRole("button", { name: "Rocket" })).toBeSelected();
  expect(row().getByRole("button", { name: "heart" })).not.toBeSelected();

  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("button", { name: "Image" })).toBeSelected();
  expect(screen.getByTestId("image-preview")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Draw route" }));
  expect(posted("/image-route-jobs")).toHaveLength(1);
});

test("on the water only the shapes, and a shape left somewhere stays there", async () => {
  jest.mocked(loadSport).mockReturnValue("paddle");
  apiAnswers(WATER_DONE);
  await startingAt(RICCIONE);
  await drawRoute();
  expect(row().getAllByRole("button")).toHaveLength(17);
  expect(row().queryByRole("button", { name: "Rocket" })).toBeNull();

  // Moved with a finger (TASK-238): asked again with `near`.
  await fireEvent.press(screen.getByRole("button", MOVE));
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"moved","by":[0.002,-0.001]}' },
  });
  await act(() => jest.advanceTimersByTimeAsync(500));
  const moved = posted("/route-jobs")[1];
  expect(moved.near).toBeDefined();

  await change("star");
  const [first, , star] = posted("/route-jobs");
  expect(star).toEqual({ ...first, shape: "star", near: moved.near });
});

test("from «Draw on the map» the new figure takes the place of the old; «Undo» brings it back", async () => {
  await startingAt(TRENTO);
  await fireEvent.press(screen.getByRole("button", { name: "Draw on the map" }));
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"centre","lngLat":[11.13,46.07]}' },
  });
  const tiles = () => within(screen.getByTestId("map-tiles"));
  await fireEvent.press(tiles().getByRole("button", { name: "heart" }));
  expect(screen.getByText("≈ 5.0 km")).toBeOnTheScreen();
  await drawRoute();
  expect(row().getByRole("button", { name: "heart" })).toBeSelected();
  // The tiles of the map, without «+ photo».
  expect(row().getAllByRole("button")).toHaveLength(33);
  expect(row().queryByText("+ photo")).toBeNull();

  await change("star");
  const [heart, star, ...more] = posted("/route-jobs");
  expect(more).toEqual([]);
  expect(heart).toMatchObject({ shape: "heart", distance_m: 5000 });
  // Its own start: where the star starts on the map.
  expect(star).toMatchObject({ shape: "star", distance_m: 5000, activity: "running" });
  expect(star.start).not.toEqual(heart.start);
  expect(row().getByRole("button", { name: "star" })).toBeSelected();

  // Back to the map: the star there, as long as its route.
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(tiles().getByRole("button", { name: "star" })).toBeSelected();
  expect(screen.getByText("≈ 5.0 km")).toBeOnTheScreen();
  // The same figure: its route shown again, not asked for again.
  await fireEvent.press(screen.getByRole("button", { name: "Draw route" }));
  expect(posted("/route-jobs")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Start" })).toBeOnTheScreen();

  // «Undo» on the map: the heart again.
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await fireEvent.press(screen.getByRole("button", { name: "Undo" }));
  expect(tiles().getByRole("button", { name: "heart" })).toBeSelected();
});
