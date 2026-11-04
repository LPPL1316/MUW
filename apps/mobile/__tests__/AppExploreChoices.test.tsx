/**
 * The routes to choose from on a city's example of "Explore" (TASK-151):
 * the tiles A · B under the map, and the map, Start and the directions
 * about the one chosen. The rest of the app is in App.test.tsx.
 */
import answered from "@shaperoute/shared-types/fixtures/route-directions.json";
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { forgetExamples } from "../src/explore/exampleRoutes";

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

let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** The line the map shows last, as the page receives it. */
function shownRoute(): string | undefined {
  return injectJavaScript.mock.calls
    .map(([script]) => String(script))
    .findLast((s) => s.includes('"type":"showRoute"'));
}

/** The grey lines the map shows last: the routes not chosen (TASK-155). */
function shownOthers(): string | undefined {
  return injectJavaScript.mock.calls
    .map(([script]) => String(script))
    .findLast((s) => s.includes('"type":"showOthers"'));
}

function lineStart([lat, lon]: number[]): string {
  return `"coordinates":[[${lon},${lat}]`;
}

beforeEach(() => {
  forgetExamples();
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
  // A city the catalog does not have: its examples are drawn, each with
  // one more route to choose.
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
      return Response.json(jobDone, { status: 202 });
    }
    return Response.json({});
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
});

test("an example of a city: A · B to choose, and Start on the one chosen", async () => {
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  await fireEvent.press(screen.getByText("New York"));
  await fireEvent.press(await screen.findByLabelText(/^Heart, /));

  // The engine's route first, as the list showed it.
  await screen.findByText("Back to the list");
  expect(screen.getByTestId("route-A")).toBeSelected();
  expect(shownRoute()).toContain(lineStart(jobDone.result.points[0]));
  expect(shownRoute()).toContain(JSON.stringify(jobDone.result.points[1].toReversed()));
  // The other route is grey under it.
  expect(shownOthers()).toContain(JSON.stringify(other.points[1].toReversed()));

  // B: the card and the map are about it.
  await fireEvent.press(screen.getByTestId("route-B"));
  expect(screen.getByTestId("route-B")).toBeSelected();
  expect(screen.getByText("4.2 km")).toBeOnTheScreen();
  expect(screen.getByText(/looks 88% like it/)).toBeOnTheScreen();
  expect(shownRoute()).toContain(JSON.stringify(other.points[1].toReversed()));
  expect(shownOthers()).toContain(
    JSON.stringify(jobDone.result.points[1].toReversed()),
  );

  // Start asks for the directions of B, and follows it.
  await fireEvent.press(screen.getByText("Start"));
  expect(await screen.findByText("Stop")).toBeOnTheScreen();
  const [, init] =
    fetchSpy.mock.calls.find(([url]) => String(url) === `${API}/route-directions`) ??
    [];
  expect(JSON.parse(String(init?.body))).toEqual({ points: other.points });
  // Running, one route is the route: no grey lines.
  expect(shownOthers()).toContain('"lines":[]');

  // Back to the list: the grey lines do not stay on the map.
  await fireEvent.press(screen.getByText("Stop"));
  await screen.findByText("Back to the list");
  expect(shownOthers()).toContain(
    JSON.stringify(jobDone.result.points[1].toReversed()),
  );
  await fireEvent.press(screen.getByText("Back to the list"));
  expect(shownOthers()).toContain('"lines":[]');
});
