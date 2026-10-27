/**
 * «NEAR YOU» under the distance of «Draw» (TASK-306): once the first page
 * shows, a circle, a heart and a star of 5 km from the phone's position; a
 * card opens on the map, from where the way back is «Draw». «Explore» is
 * asked for around the start before it is opened. Nothing before the first
 * page, nothing with «Bike». The row alone is in src/route/NearYou.test.tsx,
 * what fills it in src/route/nearYouShapes.test.ts.
 */
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { forgetExamples } from "../src/explore/exampleRoutes";
import { forgetExploreAhead } from "../src/explore/exploreAhead";
import { forgetFirstPage, markFirstPage } from "../src/intro/firstPage";
import { forgetNearYou, ZONE_WAIT_MS } from "../src/route/nearYouShapes";
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

let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** The API: every job is accepted, and is done at the first poll; no maps
 * for the phone, no towns, no routes near. */
function apiAnswers() {
  fetchSpy.mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.includes("route-jobs")) {
      return method === "POST"
        ? Response.json({ ...jobDone, status: "queued", result: null }, { status: 202 })
        : Response.json(jobDone);
    }
    return Response.json({}, { status: 404 });
  });
}

/** The bodies the app sent to `path` with POST, read back. */
function posted(path: string): unknown[] {
  return fetchSpy.mock.calls
    .filter(
      ([input, init]) =>
        String(input) === `${API}${path}` && (init?.method ?? "GET") === "POST",
    )
    .map(([, init]) => JSON.parse(String(init?.body)));
}

function asked(path: string): number {
  return fetchSpy.mock.calls.filter(([input]) => String(input).includes(path)).length;
}

async function atTrento() {
  await render(<App />);
  await act(() => jest.advanceTimersByTimeAsync(0));
  expect(screen.getByText("Starting from your position.")).toBeOnTheScreen();
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
}

/** Past the wait for the phone's maps, and each shape's poll. */
async function shapesDrawn() {
  await act(() => jest.advanceTimersByTimeAsync(ZONE_WAIT_MS));
  for (let i = 0; i < 3; i += 1) {
    await act(() => jest.advanceTimersByTimeAsync(2_000));
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  forgetExamples();
  forgetNearYou();
  forgetExploreAhead();
  forgetFirstPage();
  jest.mocked(loadSport).mockReturnValue("run");
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: TRENTO[0], longitude: TRENTO[1] },
  } as Location.LocationObject);
  jest
    .mocked(Location.watchPositionAsync)
    .mockResolvedValue({ remove: jest.fn() } as Location.LocationSubscription);
  fetchSpy = jest.spyOn(globalThis, "fetch");
  apiAnswers();
});

afterEach(() => {
  forgetNearYou();
  forgetExamples();
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

test("before the first page shows, nothing is asked and there is no row", async () => {
  await atTrento();
  await act(() => jest.advanceTimersByTimeAsync(ZONE_WAIT_MS));
  expect(screen.queryByText("NEAR YOU")).toBeNull();
  expect(posted("/route-jobs")).toEqual([]);
  expect(asked("/recommended-routes")).toBe(0);
});

test("the three shapes from the position; one opens on the map, «←» goes back to «Draw»", async () => {
  markFirstPage();
  await atTrento();
  await shapesDrawn();
  expect(posted("/route-jobs")).toEqual(
    ["circle", "heart", "star"].map((shape) => ({
      shape,
      distance_m: 5000,
      start: TRENTO,
      activity: "running",
    })),
  );
  // «Explore» asked for around the start, before it is opened.
  expect(asked("/recommended-routes")).toBe(1);
  expect(screen.getByText("NEAR YOU")).toBeOnTheScreen();
  const row = within(screen.getByTestId("near-you"));
  const heart = row.getByLabelText(/^Heart, /);
  await fireEvent.press(heart);
  // The map: the pages are gone.
  expect(screen.queryByText("NEAR YOU")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByText("NEAR YOU")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Draw route" })).toBeOnTheScreen();
});

test("with «Bike» there is no row, and nothing near is asked", async () => {
  jest.mocked(loadSport).mockReturnValue("bike");
  markFirstPage();
  await atTrento();
  await shapesDrawn();
  expect(screen.queryByText("NEAR YOU")).toBeNull();
  expect(screen.queryByText("SHAPES TO TRY")).toBeNull();
  expect(posted("/route-jobs")).toEqual([]);
});
