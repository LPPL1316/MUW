/**
 * Moving the shape of a route on the water (TASK-238, ADR-0202): «Move the
 * shape» under a paddling route whose result says where its shape is; a
 * finger drags it on the map, and the app asks for the same route with
 * `near`. The page's part is in src/map/mapPageMove.test.ts, the hook's in
 * src/paddle/useMoveShape.test.ts.
 */
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { forgetExamples } from "../src/explore/exampleRoutes";
import { forgetWaterChoice } from "../src/paddle/PaddleExplore";
import { forgetNoticeSeen } from "../src/paddle/safetyNotice";
import { loadSport, saveSport } from "../src/settings/sport";

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
jest.mock("expo-brightness", () => ({
  getBrightnessAsync: jest.fn(() => Promise.resolve(0.6)),
  setBrightnessAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
// The sport kept on the phone, as each test says; saving and telling the
// app are the real ones.
jest.mock("../src/settings/sport", () => ({
  ...jest.requireActual<typeof import("../src/settings/sport")>(
    "../src/settings/sport",
  ),
  loadSport: jest.fn(),
}));

const API = "http://192.168.1.23:8000";
const RICCIONE: [number, number] = [44.00355, 12.66338];

const CENTRE: [number, number] = [44.0105, 12.6702];

/** A route on the water as the API sends it since TASK-238: no turns, and
 * where the centre of its shape is. */
function waterDone(centre: [number, number] | undefined, lonBy = 0) {
  return {
    ...jobDone,
    result: {
      ...jobDone.result,
      points: jobDone.result.points.map(([lat, lon]) => [lat, lon + lonBy]),
      similarity: 1,
      directions: [],
      alternatives: [],
      warnings: [],
      // As the API of today answers on the water: none, but there.
      walks: [],
      on_foot: [],
      better_distance_m: null,
      ...(centre === undefined ? {} : { centre }),
    },
  };
}

jest.mock("react-native-webview");
const { injectJavaScript } =
  jest.requireMock<typeof import("../__mocks__/react-native-webview")>(
    "react-native-webview",
  );

/** What the app told the map page, in order. */
function told(what: string): string[] {
  return injectJavaScript.mock.calls
    .map(([script]: [string]) => script)
    .filter((script: string) => script.includes(what));
}

function pagePosts(data: string) {
  return fireEvent(screen.getByTestId("map"), "message", { nativeEvent: { data } });
}

const MOVE = { name: "Move the shape" };
const HINT = "Drag the shape where you want it, then let go.";
const ELSEWHERE = "The shape does not fit there: this is the nearest place.";

let fetchSpy: jest.SpiedFunction<typeof fetch>;

function job(status: string) {
  return { job_id: "4f2c9e1a", status, result: null, error: null };
}

/** The API accepts each route job, then answers each poll with the next
 * body (the last one repeats). */
function apiAnswers(...polls: unknown[]) {
  fetchSpy.mockImplementation(async (input, init) => {
    if ((init?.method ?? "GET") === "POST") {
      return Response.json(job("queued"), { status: 202 });
    }
    if (init?.method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    if (String(input) === `${API}/game/catalog`) {
      // An API without the shape game (TASK-296): no «Play» page.
      return Response.json(
        { error: { code: "http_error", message: "no game" } },
        { status: 404 },
      );
    }
    return Response.json(polls.length > 1 ? polls.shift() : polls[0]);
  });
}

/** The bodies the app sent to POST /route-jobs, read back. */
function routeBodies(): unknown[] {
  return fetchSpy.mock.calls
    .filter(
      ([input, init]) =>
        String(input) === `${API}/route-jobs` && (init?.method ?? "GET") === "POST",
    )
    .map(([, init]) => JSON.parse(String(init?.body)));
}

async function atRiccione() {
  await render(<App />);
  await act(() => jest.advanceTimersByTimeAsync(0));
  expect(screen.getByText("Starting from your position.")).toBeOnTheScreen();
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
}

async function draw() {
  await fireEvent.press(screen.getByText("Draw route"));
  // The first poll comes after 500 ms.
  await act(() => jest.advanceTimersByTimeAsync(500));
}

beforeEach(() => {
  jest.useFakeTimers();
  injectJavaScript.mockClear();
  forgetNoticeSeen();
  forgetExamples();
  forgetWaterChoice();
  jest.mocked(loadSport).mockReturnValue("paddle");
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: RICCIONE[0], longitude: RICCIONE[1] },
  } as Location.LocationObject);
  jest
    .mocked(Location.watchPositionAsync)
    .mockResolvedValue({ remove: jest.fn() } as Location.LocationSubscription);
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  forgetExamples();
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

test("an API of before says no centre: the shape is not moved", async () => {
  apiAnswers(waterDone(undefined));
  await atRiccione();
  await draw();
  expect(screen.getByRole("button", { name: "Start" })).toBeOnTheScreen();
  expect(screen.queryByRole("button", MOVE)).toBeNull();
  expect(told("setMove")).toEqual([]);
});

test("«Move the shape» gives the finger the route; «Cancel» gives the map back", async () => {
  apiAnswers(waterDone(CENTRE));
  await atRiccione();
  await draw();
  await fireEvent.press(screen.getByRole("button", MOVE));
  expect(screen.getByText(HINT)).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  expect(told('"setMove","on":true')).toHaveLength(1);

  await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByText(HINT)).toBeNull();
  expect(screen.getByRole("button", { name: "Start" })).toBeOnTheScreen();
  expect(told('"setMove","on":false')).toHaveLength(1);
  expect(routeBodies()).toHaveLength(1);
});

test("left somewhere, the same route is asked for with the shape wanted there", async () => {
  // The engine places it where it was left.
  apiAnswers(
    waterDone(CENTRE),
    waterDone([CENTRE[0] - 0.001, CENTRE[1] + 0.002], 0.002),
  );
  await atRiccione();
  await draw();
  await fireEvent.press(screen.getByRole("button", MOVE));
  const shownBefore = told("showRoute").length;

  await pagePosts('{"type":"moved","by":[0.002,-0.001]}');
  const [first, moved, ...more] = routeBodies() as Record<string, unknown>[];
  expect(more).toEqual([]);
  const { near, ...same } = moved as { near: [number, number] };
  expect(same).toEqual(first);
  expect(near[0]).toBeCloseTo(CENTRE[0] - 0.001, 9);
  expect(near[1]).toBeCloseTo(CENTRE[1] + 0.002, 9);
  // The move is over, and the route of before stays on the map, where the
  // finger left it, while the new one is drawn.
  expect(told('"setMove","on":false')).toHaveLength(1);
  expect(told("clearRoute")).toEqual([]);
  expect(told("showRoute")).toHaveLength(shownBefore);
  expect(screen.queryByText(HINT)).toBeNull();

  await act(() => jest.advanceTimersByTimeAsync(500));
  expect(told("showRoute")).toHaveLength(shownBefore + 1);
  expect(screen.getByRole("button", { name: "Start" })).toBeOnTheScreen();
  expect(screen.queryByText(ELSEWHERE)).toBeNull();
  // And it can be moved again.
  expect(screen.getByRole("button", MOVE)).toBeOnTheScreen();
});

test("where the shape does not fit, the screen says it is at the nearest place", async () => {
  // Left on the beach: the engine keeps it about where it was.
  apiAnswers(waterDone(CENTRE), waterDone([CENTRE[0] + 0.0005, CENTRE[1]], 0.0001));
  await atRiccione();
  await draw();
  await fireEvent.press(screen.getByRole("button", MOVE));
  await pagePosts('{"type":"moved","by":[0,0.01]}');
  await act(() => jest.advanceTimersByTimeAsync(500));
  expect(screen.getByText(ELSEWHERE)).toBeOnTheScreen();
});

test("a drag told when nobody is moving asks for nothing", async () => {
  apiAnswers(waterDone(undefined));
  await atRiccione();
  await draw();
  await pagePosts('{"type":"moved","by":[0.002,-0.001]}');
  expect(routeBodies()).toHaveLength(1);
});
