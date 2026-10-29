/**
 * «Freehand» in «Draw» (TASK-320, ADR-0280), in the app itself: the fourth
 * choice, the board that draws the outline, «Draw route» that sends it as
 * a picture's outline and nothing before it, the result that says
 * «Drawing», and «Edit the drawing» under the shape chosen and under the
 * route. The lines themselves are in src/route/freehand.test.ts.
 */
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { forgetExamples } from "../src/explore/exampleRoutes";
import { loadSport } from "../src/settings/sport";

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
jest.mock("../src/settings/sport", () => ({
  ...jest.requireActual<typeof import("../src/settings/sport")>(
    "../src/settings/sport",
  ),
  loadSport: jest.fn(),
}));

const API = "http://192.168.1.23:8000";
const TRENTO: [number, number] = [46.0679, 11.1211];

/** The route of a drawing: the engine says neither a shape nor a word. */
const DRAWING_DONE = {
  ...jobDone,
  result: { ...jobDone.result, shape: null, word: null },
};

let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** The API: each route job is accepted, and is `done` at the first poll;
 * nothing else answers. */
function apiAnswers() {
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
    return Response.json(DRAWING_DONE);
  });
}

/** The bodies the app sent with POST, by path. */
function posted(): { path: string; body: Record<string, unknown> }[] {
  return fetchSpy.mock.calls
    .filter(([, init]) => (init?.method ?? "GET") === "POST")
    .map(([input, init]) => ({
      path: String(input).replace(API, ""),
      body: JSON.parse(String(init?.body)),
    }));
}

async function onDraw() {
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: TRENTO[0], longitude: TRENTO[1] },
  } as Location.LocationObject);
  await render(<App />);
  await act(() => jest.advanceTimersByTimeAsync(0));
  expect(screen.getByText("Starting from your position.")).toBeOnTheScreen();
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
}

function fingers(...points: [number, number][]) {
  const [x, y] = points[0];
  return {
    nativeEvent: {
      locationX: x,
      locationY: y,
      touches: points.map(([locationX, locationY]) => ({ locationX, locationY })),
    },
  };
}

/** The board on a 400 × 700 screen: its square is 400 wide, 150 down. */
async function boardShown() {
  const area = screen.getByTestId("freehand-board");
  await fireEvent(area, "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 700 } },
  });
  return area;
}

/** A square drawn with one finger, almost closed. */
async function drawSquare(area: ReturnType<typeof screen.getByTestId>) {
  await fireEvent(area, "responderGrant", fingers([80, 230]));
  for (const point of [
    [320, 230],
    [320, 470],
    [80, 470],
    [80, 240],
  ] as [number, number][]) {
    await fireEvent(area, "responderMove", fingers(point));
  }
  await fireEvent(area, "responderRelease", fingers([80, 240]));
}

/** «Draw route», and the route at the first poll, after 500 ms. */
async function drawRoute() {
  await fireEvent.press(screen.getByRole("button", { name: "Draw route" }));
  await act(() => jest.advanceTimersByTimeAsync(500));
}

/** What the API checks of an outline sent (ADR-0069), as a drawing's. */
function expectDrawingRequest(body: Record<string, unknown>) {
  expect(body).toMatchObject({ start: TRENTO, distance_m: 5000, activity: "running" });
  expect(body).not.toHaveProperty("strokes");
  const outline = body.outline as [number, number][];
  expect(outline.length).toBeGreaterThanOrEqual(4);
  expect(outline.length).toBeLessThanOrEqual(101);
  expect(outline[outline.length - 1]).toEqual(outline[0]);
  for (const [x, y] of outline) {
    expect(Math.abs(x)).toBeLessThanOrEqual(1);
    expect(Math.abs(y)).toBeLessThanOrEqual(1);
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  forgetExamples();
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

test("«Freehand»: the board draws the outline, «Draw route» sends it as a picture's, the result says «Drawing»", async () => {
  await onDraw();
  await fireEvent.press(screen.getByRole("button", { name: "Freehand" }));
  expect(screen.getByRole("button", { name: "Freehand" })).toBeSelected();
  // Nothing drawn yet: nothing to ask for.
  expect(screen.getByRole("button", { name: "Draw route" })).toBeDisabled();
  expect(screen.queryByTestId("freehand-preview")).toBeNull();

  await fireEvent.press(screen.getByRole("button", { name: "Draw with your finger" }));
  const area = await boardShown();
  expect(
    screen.getByText("Draw the outline with one finger: it closes by itself."),
  ).toBeOnTheScreen();
  await drawSquare(area);
  // The outline, closed by the app: four sides.
  expect(within(area).getAllByTestId("outline-side")).toHaveLength(4);
  // Nothing has left the phone.
  expect(posted()).toEqual([]);

  await fireEvent.press(screen.getByRole("button", { name: "Save" }));
  expect(screen.queryByTestId("freehand-board")).toBeNull();
  expect(screen.getByTestId("freehand-preview")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Edit the drawing" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Draw route" })).toBeEnabled();
  expect(posted()).toEqual([]);

  await drawRoute();
  const sent = posted();
  expect(sent).toHaveLength(1);
  expect(sent[0].path).toBe("/image-route-jobs");
  expectDrawingRequest(sent[0].body);
  // The result: a drawing, not a picture.
  expect(screen.getByText("Drawing · on roads · target 5 km")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Start" })).toBeOnTheScreen();

  // «Edit the drawing» under the route: the figure asked for, in the board;
  // «Save» comes back to «Draw» with «Freehand», the same distance.
  await fireEvent.press(screen.getByRole("button", { name: "Edit the drawing" }));
  const again = await boardShown();
  expect(within(again).getAllByTestId("outline-side")).toHaveLength(4);
  await fireEvent.press(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByRole("button", { name: "Freehand" })).toBeSelected();
  expect(screen.getByLabelText("Distance in km")).toHaveDisplayValue("5");
  expect(screen.getByTestId("freehand-preview")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Draw route" })).toBeEnabled();
  // Only the one request so far.
  expect(posted()).toHaveLength(1);
});

test("«Edit the drawing» under the shape opens its lines; «Save» chooses «Freehand» with them", async () => {
  await onDraw();
  // The heart is chosen at the start.
  await fireEvent.press(screen.getByRole("button", { name: "Edit the drawing" }));
  const area = await boardShown();
  // The heart's outline, many sides.
  expect(within(area).getAllByTestId("outline-side").length).toBeGreaterThan(20);
  expect(posted()).toEqual([]);
  await fireEvent.press(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByRole("button", { name: "Freehand" })).toBeSelected();
  expect(screen.getByTestId("freehand-preview")).toBeOnTheScreen();

  await drawRoute();
  const sent = posted();
  expect(sent).toHaveLength(1);
  expect(sent[0].path).toBe("/image-route-jobs");
  expectDrawingRequest(sent[0].body);
  // The same figure again is shown, not asked for again.
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await fireEvent.press(screen.getByRole("button", { name: "Draw route" }));
  expect(posted()).toHaveLength(1);
  expect(screen.getByText("Drawing · on roads · target 5 km")).toBeOnTheScreen();
});

test("the drawing stays past «Image» and back", async () => {
  await onDraw();
  await fireEvent.press(screen.getByRole("button", { name: "Freehand" }));
  await fireEvent.press(screen.getByRole("button", { name: "Draw with your finger" }));
  await drawSquare(await boardShown());
  await fireEvent.press(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByTestId("freehand-preview")).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole("button", { name: "Image" }));
  expect(screen.queryByTestId("freehand-preview")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Freehand" }));
  expect(screen.getByTestId("freehand-preview")).toBeOnTheScreen();
  expect(posted()).toEqual([]);
});

test("with «Paddle» there is neither «Freehand» nor «Edit the drawing»", async () => {
  jest.mocked(loadSport).mockReturnValue("paddle");
  await onDraw();
  expect(screen.getByText("On the water, a shape of the catalogue.")).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Freehand" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Edit the drawing" })).toBeNull();
});
