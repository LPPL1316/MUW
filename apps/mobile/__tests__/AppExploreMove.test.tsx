/**
 * Moving the shape of an example of «Explore» on the water (TASK-244, a
 * sequel of TASK-238, ADR-0202): «Move the shape» on the card of a paddling
 * example that says where its shape is; a finger drags it on the map, and
 * the app asks for the example again, from its place, with `near`. The moved
 * route stays a route of «Explore» (the user's choice). The hook's part is
 * in src/paddle/useMoveExample.test.ts, the card's in
 * src/explore/ExploredCard.test.tsx.
 */
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import {
  examplesKey,
  forgetExamples,
  PADDLE_EXAMPLES,
} from "../src/explore/exampleRoutes";
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
// A place of «Explore»: its eight examples come with the app (TASK-227).
const RICCIONE: [number, number] = [44.00355, 12.66338];
const [HEART] = PADDLE_EXAMPLES.bundled?.[examplesKey(RICCIONE, PADDLE_EXAMPLES)] ?? [];
const CENTRE = HEART.centre as [number, number];

/** The example drawn again with its shape wanted elsewhere, as the API
 * answers on the water: its line `lonBy` east, its shape at `centre`. */
function waterDone(centre: [number, number], lonBy: number) {
  return {
    ...jobDone,
    result: {
      ...jobDone.result,
      points: HEART.points.map(([lat, lon]) => [lat, lon + lonBy]),
      distance_m: 1840,
      similarity: 1,
      directions: [],
      alternatives: [],
      warnings: [],
      walks: [],
      on_foot: [],
      better_distance_m: null,
      centre,
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
  fetchSpy.mockImplementation(async (_input, init) => {
    if ((init?.method ?? "GET") === "POST") {
      return Response.json(job("queued"), { status: 202 });
    }
    if (init?.method === "DELETE") {
      return new Response(null, { status: 204 });
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

const HEART_CARD = "Heart, 2.0 km, on the water";

/** «Explore» with «Paddle» at Riccione, and the heart of its beach open. */
async function heartOpen() {
  await atRiccione();
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  await fireEvent.press(screen.getByLabelText(HEART_CARD));
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

test("the heart of the beach opens with «Move the shape», and nothing is asked", async () => {
  apiAnswers(waterDone(CENTRE, 0));
  await heartOpen();
  expect(screen.getByRole("button", { name: "Start" })).toBeOnTheScreen();
  expect(screen.getByRole("button", MOVE)).toBeOnTheScreen();
  expect(routeBodies()).toHaveLength(0);
  expect(told("setMove")).toEqual([]);
});

test("«Move the shape» gives the finger the route; «Cancel» gives the map back", async () => {
  apiAnswers(waterDone(CENTRE, 0));
  await heartOpen();
  await fireEvent.press(screen.getByRole("button", MOVE));
  expect(screen.getByText(HINT)).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  expect(told('"setMove","on":true')).toHaveLength(1);

  await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByText(HINT)).toBeNull();
  expect(screen.getByRole("button", { name: "Start" })).toBeOnTheScreen();
  expect(told('"setMove","on":false')).toHaveLength(1);
  expect(routeBodies()).toHaveLength(0);
});

test("left somewhere, the example is asked again with its shape wanted there", async () => {
  // The engine places it where it was left.
  apiAnswers(waterDone([CENTRE[0] - 0.001, CENTRE[1] + 0.002], 0.002));
  await heartOpen();
  await fireEvent.press(screen.getByRole("button", MOVE));
  const shownBefore = told("showRoute").length;

  await pagePosts('{"type":"moved","by":[0.002,-0.001]}');
  const [moved, ...more] = routeBodies() as Record<string, unknown>[];
  expect(more).toEqual([]);
  const { near, ...same } = moved as { near: [number, number] };
  // As the example was drawn: the heart, 2 km, from the place of «Explore».
  expect(same).toEqual({
    shape: "heart",
    distance_m: 2000,
    start: RICCIONE,
    activity: "paddling",
  });
  expect(near[0]).toBeCloseTo(CENTRE[0] - 0.001, 9);
  expect(near[1]).toBeCloseTo(CENTRE[1] + 0.002, 9);
  // The move is over, and the route of before stays on the map, where the
  // finger left it, while the new one is drawn: nothing to start meanwhile.
  expect(told('"setMove","on":false')).toHaveLength(1);
  expect(told("clearRoute")).toEqual([]);
  expect(told("showRoute")).toHaveLength(shownBefore);
  expect(screen.queryByText(HINT)).toBeNull();
  expect(screen.getByText("Drawing a 2 km heart…")).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  expect(screen.queryByRole("button", MOVE)).toBeNull();

  // The first poll comes after 500 ms.
  await act(() => jest.advanceTimersByTimeAsync(500));
  expect(told("showRoute")).toHaveLength(shownBefore + 1);
  expect(told("showRoute").at(-1)).toContain(String(HEART.points[0][1] + 0.002));
  // Still a route of «Explore»: its card, with the new length.
  expect(screen.getByText("1.8 km")).toBeOnTheScreen();
  expect(screen.getByText("Back to the list")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Start" })).toBeOnTheScreen();
  expect(screen.queryByText(ELSEWHERE)).toBeNull();
  // And it can be moved again.
  expect(screen.getByRole("button", MOVE)).toBeOnTheScreen();

  // The list keeps the example as it was drawn: opened again, it is there.
  await fireEvent.press(screen.getByText("Back to the list"));
  await fireEvent.press(screen.getByLabelText(HEART_CARD));
  expect(told("showRoute").at(-1)).toContain(String(HEART.points[0][1]));
  expect(told("showRoute").at(-1)).not.toContain(String(HEART.points[0][1] + 0.002));
});

test("where the shape does not fit, the card says it is at the nearest place", async () => {
  // Left on the beach: the engine keeps it about where it was.
  apiAnswers(waterDone([CENTRE[0] + 0.0005, CENTRE[1]], 0.0001));
  await heartOpen();
  await fireEvent.press(screen.getByRole("button", MOVE));
  await pagePosts('{"type":"moved","by":[0,0.01]}');
  await act(() => jest.advanceTimersByTimeAsync(500));
  expect(screen.getByText(ELSEWHERE)).toBeOnTheScreen();
});

test("the moved route starts as the example does: the notice, then the run", async () => {
  apiAnswers(waterDone([CENTRE[0], CENTRE[1] + 0.002], 0.002));
  await heartOpen();
  await fireEvent.press(screen.getByRole("button", MOVE));
  await pagePosts('{"type":"moved","by":[0.002,0]}');
  await act(() => jest.advanceTimersByTimeAsync(500));
  await fireEvent.press(screen.getByRole("button", { name: "Start" }));
  await fireEvent.press(screen.getByRole("button", { name: "I understand" }));
  await act(() => jest.advanceTimersByTimeAsync(0));
  expect(screen.getByText("Stop")).toBeOnTheScreen();
});

test("a drag told when nobody is moving asks for nothing", async () => {
  apiAnswers(waterDone(CENTRE, 0));
  await heartOpen();
  await pagePosts('{"type":"moved","by":[0.002,-0.001]}');
  expect(routeBodies()).toHaveLength(0);
});

test("a drawing of «Feed» on the water is not moved", async () => {
  // On the shore of Lake Garda: «Explore» shows its examples, and the heart
  // of «Feed» is one of them, known to the app with its centre.
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 45.88114, longitude: 10.84559 },
  } as Location.LocationObject);
  apiAnswers(waterDone(CENTRE, 0));
  await atRiccione();
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  expect(screen.getByLabelText(HEART_CARD)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("tab", { name: "Feed" }));
  // The list draws two drawings at first, and the others once it knows how
  // tall it is.
  let list = screen.getAllByTestId("feed-post")[0].parent;
  while (list !== null && list.props.onContentSizeChange === undefined) {
    list = list.parent;
  }
  if (list === null) {
    throw new Error("the drawings are not in a list");
  }
  await fireEvent(list, "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } },
  });
  await fireEvent(list, "contentSizeChange", 390, 6000);
  await act(() => jest.advanceTimersByTimeAsync(100));
  await fireEvent.press(screen.getByText("A heart on Lake Garda"));
  expect(await screen.findByRole("button", { name: "Start" })).toBeOnTheScreen();
  expect(screen.queryByRole("button", MOVE)).toBeNull();

  // The same heart from «Explore» is.
  await fireEvent.press(screen.getByText("Back to the list"));
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  await fireEvent.press(screen.getByLabelText(HEART_CARD));
  expect(screen.getByRole("button", MOVE)).toBeOnTheScreen();
});
