/**
 * The map turned as an example of "Explore" (TASK-232 part B2, ADR-0195):
 * an example whose shape the engine turned opens with the map turned the
 * other way, each route of its choice as its own, and stays so while it is
 * run. One that does not say keeps north up. The drawn route's part is in
 * AppTurnedMap.test.tsx.
 */
import answered from "@shaperoute/shared-types/fixtures/route-directions.json";
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { forgetExamples } from "../src/explore/exampleRoutes";
import { forgetFeedMaps } from "../src/feed/FeedMaps";

jest.mock("react-native-webview");
jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: "192.168.1.23:8081" } },
}));
jest.mock("expo-file-system");
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
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

const { injectJavaScript } =
  jest.requireMock<typeof import("../__mocks__/react-native-webview")>(
    "react-native-webview",
  );
const API = "http://192.168.1.23:8000";
const newYork = { label: "New York, United States", point: [40.7127, -74.006] };
const [other] = jobDone.result.alternatives;
/** The engine's route turned 30° counterclockwise, the other 20° clockwise. */
const TURNED = {
  ...jobDone,
  result: {
    ...jobDone.result,
    rotation_deg: 30,
    alternatives: [{ ...other, rotation_deg: -20 }],
  },
};

let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** A city the catalog does not have: its examples are drawn as `done`. */
function answering(done: unknown) {
  fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url === `${API}/route-directions`) {
      return Response.json(answered);
    }
    if (url.startsWith(`${API}/cities`)) {
      return Response.json({ places: [newYork] });
    }
    if (url.startsWith(`${API}/recommended-routes`)) {
      return Response.json({ routes: [] });
    }
    if (url === `${API}/route-jobs`) {
      return Response.json(done, { status: 202 });
    }
    return Response.json({});
  });
}

/** The messages of a type handed to the pages, in order. */
function messages(type: string): Record<string, unknown>[] {
  return injectJavaScript.mock.calls
    .map(([script]) => /receive\((.*)\); true;$/.exec(String(script))?.[1])
    .filter((json): json is string => json !== undefined)
    .map((json) => JSON.parse(json) as Record<string, unknown>)
    .filter((message) => message.type === type);
}

beforeEach(() => {
  forgetExamples();
  forgetFeedMaps();
  injectJavaScript.mockClear();
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 46.067, longitude: 11.1215 },
  } as Location.LocationObject);
  jest
    .mocked(Location.watchPositionAsync)
    .mockResolvedValue({ remove: jest.fn() } as Location.LocationSubscription);
});

afterEach(() => {
  fetchSpy.mockRestore();
});

/** «Explore», New York, its heart opened on the map. */
async function heartOpened(done: unknown) {
  answering(done);
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
  await fireEvent.press(screen.getByText("Explore"));
  await fireEvent.press(screen.getByText("New York"));
  await fireEvent.press(await screen.findByLabelText(/^Heart, /));
  await screen.findByText("Back to the list");
}

test("a turned example opens with the map turned the other way, and a north arrow", async () => {
  await heartOpened(TURNED);
  expect(messages("showRoute").at(-1)?.bearing).toBe(-30);
  expect(screen.getByRole("button", { name: "North arrow" })).toBeOnTheScreen();
});

test("the other route of the example turns the map as its own drawing", async () => {
  await heartOpened(TURNED);
  await fireEvent.press(screen.getByTestId("route-B"));
  expect(messages("showRoute").at(-1)?.bearing).toBe(20);
  await fireEvent.press(screen.getByTestId("route-A"));
  expect(messages("showRoute").at(-1)?.bearing).toBe(-30);
});

test("run, the example keeps the map turned, and after the run too", async () => {
  await heartOpened(TURNED);
  await fireEvent.press(screen.getByTestId("route-B"));
  await fireEvent.press(screen.getByText("Start"));
  expect(await screen.findByText("Stop")).toBeOnTheScreen();
  // Whatever the map was told since Start, it was never told north up.
  expect(messages("showRoute").at(-1)?.bearing).toBe(20);
  expect(messages("turn")).toEqual([]);
  expect(screen.getByTestId("north-arrow")).toBeOnTheScreen();

  await fireEvent.press(screen.getByText("Stop"));
  await screen.findByText("Back to the list");
  expect(messages("showRoute").at(-1)?.bearing).toBe(20);
});

test("an example that does not say how it is turned keeps north up, with no arrow", async () => {
  await heartOpened(jobDone);
  const shown = messages("showRoute").at(-1);
  expect(shown).toBeDefined();
  expect(shown !== undefined && "bearing" in shown).toBe(false);
  expect(screen.queryByTestId("north-arrow")).toBeNull();

  await fireEvent.press(screen.getByText("Start"));
  expect(await screen.findByText("Stop")).toBeOnTheScreen();
  const run = messages("showRoute").at(-1);
  expect(run !== undefined && "bearing" in run).toBe(false);
  expect(screen.queryByTestId("north-arrow")).toBeNull();
});

test("the card of a turned example asks for its map turned the same way", async () => {
  answering(TURNED);
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent.press(screen.getByText("Explore"));
  await fireEvent.press(screen.getByText("New York"));
  await screen.findByLabelText(/^Heart, /);
  // The page that takes the pictures, one at a time: those «Feed» asked
  // for and the cards of our ideas (TASK-329), north up, come first, and are
  // given up on here, until the turned card's is asked.
  const page = await screen.findByTestId("feed-map-page", {
    includeHiddenElements: true,
  });
  await fireEvent(page, "message", { nativeEvent: { data: '{"type":"ready"}' } });
  const last = () => messages("shoot").at(-1);
  const turned = () => /^card:.*@-30$/.test(String(last()?.key));
  for (let i = 0; i < 100 && !turned(); i += 1) {
    await fireEvent(page, "message", {
      nativeEvent: { data: JSON.stringify({ type: "miss", key: last()?.key }) },
    });
  }
  expect(last()?.bearing).toBe(-30);
  expect(String(last()?.key)).toMatch(/^card:.*@-30$/);
});
