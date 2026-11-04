/**
 * «Start» on a bike route follows it by bike (TASK-216): the route's
 * activity reaches the navigation from «Draw» with «Bike» and from a
 * favorite kept by bike, whatever «Settings» says now. What changes along
 * the way is in src/navigation/ride*.test.ts and src/screens/RunBike.test.tsx.
 */
import favoriteCycling from "@shaperoute/shared-types/fixtures/favorite-cycling.json";
import favoritesCycling from "@shaperoute/shared-types/fixtures/favorites-cycling.json";
import cycling from "@shaperoute/shared-types/fixtures/route-result-cycling.json";
import directions from "@shaperoute/shared-types/fixtures/route-directions.json";
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { apiError, type MemorySecureStore } from "../src/account/testing";
import { loadSport } from "../src/settings/sport";

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
jest.mock("expo-secure-store", () =>
  jest
    .requireActual<typeof import("../src/account/testing")>("../src/account/testing")
    .memorySecureStore(),
);
// The sport kept on the phone, as each test says.
jest.mock("../src/settings/sport", () => ({
  ...jest.requireActual<typeof import("../src/settings/sport")>(
    "../src/settings/sport",
  ),
  loadSport: jest.fn(),
}));

const store = jest.requireMock<MemorySecureStore>("expo-secure-store");
const API = "http://192.168.1.23:8000";
/** The bike route with turns to follow: those of the heart of the job. */
const BIKE_ROUTE = { ...cycling, directions: jobDone.result.directions };

let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** The fake API, by method and path; a route job answers `result`. */
function api(result: unknown, answers: Record<string, () => Response> = {}) {
  fetchSpy.mockImplementation(async (input, init) => {
    const path = String(input).replace(API, "");
    const method = init?.method ?? "GET";
    const answer = answers[`${method} ${path}`];
    if (answer !== undefined) {
      return answer();
    }
    if (method === "POST" && path === "/route-jobs") {
      return Response.json(
        { job_id: "4f2c9e1a", status: "queued", result: null, error: null },
        { status: 202 },
      );
    }
    if (method === "GET" && path === "/route-jobs/4f2c9e1a") {
      return Response.json({ job_id: "4f2c9e1a", status: "done", result, error: null });
    }
    return Response.json(apiError("http_error", path), { status: 404 });
  });
}

async function open() {
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
}

/** «Draw route», the answer at the first poll, then «Start». */
async function drawAndStart() {
  await open();
  await fireEvent.press(screen.getByTestId("draw-route"));
  // The first poll comes after 500 ms.
  await act(() => jest.advanceTimersByTimeAsync(500));
  await fireEvent.press(screen.getByText("Start"));
  // The permission and the GPS are asked for first.
  await act(() => jest.advanceTimersByTimeAsync(0));
}

beforeEach(() => {
  store.kept.clear();
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 46.0671, longitude: 11.1214 },
  } as Location.LocationObject);
  jest.mocked(Location.watchPositionAsync).mockResolvedValue({
    remove: jest.fn(),
  } as unknown as Location.LocationSubscription);
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  fetchSpy.mockRestore();
});

test("a route drawn with «Bike» is followed by bike: speeds, not paces", async () => {
  jest.useFakeTimers();
  try {
    jest.mocked(loadSport).mockReturnValue("bike");
    api(BIKE_ROUTE);
    await drawAndStart();
    expect(screen.getByLabelText("Speed now: – km/h")).toBeOnTheScreen();
    expect(screen.queryByText("Pace now")).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});

test("a route drawn with «Run» is followed as before", async () => {
  jest.useFakeTimers();
  try {
    jest.mocked(loadSport).mockReturnValue("run");
    api(jobDone.result);
    await drawAndStart();
    expect(screen.getByLabelText("Pace now: – /km")).toBeOnTheScreen();
    expect(screen.queryByText("Speed now")).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});

test("a favorite kept by bike is followed by bike, with «Run» chosen", async () => {
  store.kept.set("shaperoute.session", JSON.stringify(session));
  jest.mocked(loadSport).mockReturnValue("run");
  api(jobDone.result, {
    "GET /me": () => Response.json(session.user),
    "GET /me/favorites": () => Response.json(favoritesCycling),
    [`GET /me/favorites/${favoriteCycling.id}`]: () => Response.json(favoriteCycling),
    "POST /route-directions": () =>
      Response.json({
        directions: [
          { ...directions.directions[0], node: 0, point: favoriteCycling.points[0] },
        ],
      }),
  });
  await open();
  await fireEvent.press(screen.getByRole("tab", { name: /^Profile/ }));
  await fireEvent.press(await screen.findByRole("button", { name: "Favorites, 2" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Heart · 20.5 km, open on the map" }),
  );
  expect(await screen.findByText("Back to the list")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("Start"));
  expect(await screen.findByLabelText("Speed now: – km/h")).toBeOnTheScreen();
  expect(screen.queryByText("Pace now")).toBeNull();
});
