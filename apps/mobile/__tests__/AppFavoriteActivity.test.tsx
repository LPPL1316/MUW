/**
 * A favorite remembers the activity it was drawn for (TASK-200): the heart
 * keeps a bike route with `activity: "cycling"` and a run's with the
 * request of before, byte for byte; a bike favorite opened with «Run» in
 * «Settings» exports as a bike route. The pieces alone are in
 * src/api/favorites.test.ts and src/favorites/favoriteRoute.test.ts.
 */
import favoriteCycling from "@shaperoute/shared-types/fixtures/favorite-cycling.json";
import favoritesCycling from "@shaperoute/shared-types/fixtures/favorites-cycling.json";
import directions from "@shaperoute/shared-types/fixtures/route-directions.json";
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Location from "expo-location";
import * as Sharing from "expo-sharing";

import App from "../App";
import { apiError, type MemorySecureStore } from "../src/account/testing";
import { favoriteKey } from "../src/favorites/favoriteKey";
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
const SESSION_KEY = "shaperoute.session";
const [BIKE_LISTED] = favoritesCycling.favorites;
/** The heart of the route job's result, drawn from Trento. */
const DRAWN = jobDone.result;
const DRAWN_KEY = favoriteKey(DRAWN.points as [number, number][]);

let fetchSpy: jest.SpiedFunction<typeof fetch>;

type Answers = Record<string, () => Response>;

/** The fake API, by method and path. */
function api(answers: Answers) {
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
      return Response.json(jobDone);
    }
    return Response.json(apiError("http_error", path), { status: 404 });
  });
}

/** The bodies sent with `method` to `path`, as sent. */
function sent(method: string, path: string): string[] {
  return fetchSpy.mock.calls
    .filter(
      ([input, init]) =>
        String(input) === `${API}${path}` && (init?.method ?? "GET") === method,
    )
    .map(([, init]) => String(init?.body));
}

async function open() {
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
}

beforeEach(() => {
  store.kept.clear();
  store.kept.set(SESSION_KEY, JSON.stringify(session));
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 46.0671, longitude: 11.1214 },
  } as Location.LocationObject);
  jest.mocked(Location.watchPositionAsync).mockResolvedValue({
    remove: jest.fn(),
  } as unknown as Location.LocationSubscription);
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined);
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  fetchSpy.mockRestore();
});

test.each([
  ["run" as const, 5000, null],
  ["bike" as const, 10000, "cycling"],
])(
  "with «%s» the heart keeps the route drawn with its activity",
  async (sport, distance_m, activity) => {
    jest.useFakeTimers();
    try {
      jest.mocked(loadSport).mockReturnValue(sport);
      api({
        "GET /me": () => Response.json(session.user),
        "GET /me/favorites": () => Response.json({ favorites: [] }),
        [`PUT /me/favorites/${DRAWN_KEY}`]: () =>
          Response.json({ ...BIKE_LISTED, id: DRAWN_KEY }, { status: 201 }),
      });
      await open();
      await fireEvent.press(screen.getByTestId("draw-route"));
      // The first poll comes after 500 ms.
      await act(() => jest.advanceTimersByTimeAsync(500));
      await fireEvent.press(screen.getByRole("button", { name: "Add to favorites" }));
      await waitFor(() =>
        expect(sent("PUT", `/me/favorites/${DRAWN_KEY}`)).toHaveLength(1),
      );
      // The text of before TASK-200 for a run; by bike, the activity too.
      const before = {
        city: "",
        shape: "heart",
        word: null,
        style: null,
        title: null,
        distance_m,
        route_m: Math.round(DRAWN.distance_m),
        points: DRAWN.points,
      };
      expect(sent("PUT", `/me/favorites/${DRAWN_KEY}`)[0]).toBe(
        JSON.stringify({
          ...before,
          ...(activity === null ? {} : { activity }),
          similarity: DRAWN.similarity,
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  },
);

test("a bike favorite opened with «Run» chosen exports as a bike route", async () => {
  jest.mocked(loadSport).mockReturnValue("run");
  api({
    "GET /me": () => Response.json(session.user),
    "GET /me/favorites": () => Response.json(favoritesCycling),
    [`GET /me/favorites/${favoriteCycling.id}`]: () => Response.json(favoriteCycling),
    "POST /gpx": () =>
      new Response("<gpx/>", {
        headers: {
          "Content-Type": "application/gpx+xml",
          "Content-Disposition": 'attachment; filename="sgrava-heart-20km.gpx"',
        },
      }),
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

  await fireEvent.press(screen.getByText("Export GPX"));
  await waitFor(() => expect(sent("POST", "/gpx")).toHaveLength(1));
  const { request } = JSON.parse(sent("POST", "/gpx")[0]) as { request: unknown };
  expect(request).toEqual({
    start: favoriteCycling.points[0],
    distance_m: favoriteCycling.distance_m,
    activity: "cycling",
    shape: "heart",
  });

  // Start asks for the directions of the line, as for any route of
  // «Explore»: the request has no activity (docs/API.md).
  await fireEvent.press(screen.getByText("Start"));
  await waitFor(() => expect(sent("POST", "/route-directions")).toHaveLength(1));
  expect(sent("POST", "/route-directions")[0]).toBe(
    JSON.stringify({ points: favoriteCycling.points }),
  );
});
