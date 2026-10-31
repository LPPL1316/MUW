/**
 * «Another place» with «Paddle» (TASK-240): the search of «Draw» offers the
 * lakes and the beaches of «Explore» above the streets, and one chosen is
 * the start, on its shore; a small lake brings the distance down. With
 * «Run» the search is the one of before. The rule is in
 * src/paddle/placeSpots.test.ts, the field in
 * src/places/PlaceSearchSuggest.test.tsx.
 */
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { forgetExamples } from "../src/explore/exampleRoutes";
import { forgetWaterChoice } from "../src/paddle/PaddleExplore";
import { SPOT_SEARCH_HINT } from "../src/paddle/placeSpots";
import { forgetNoticeSeen } from "../src/paddle/safetyNotice";
import { WATER_SPOTS } from "../src/paddle/waterSpots";
import { SUGGEST_DELAY_MS } from "../src/places/PlaceSearch";
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
jest.mock("expo-brightness", () => ({
  getBrightnessAsync: jest.fn(() => Promise.resolve(0.6)),
  setBrightnessAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
// The sport kept on the phone, as each test says.
jest.mock("../src/settings/sport", () => ({
  ...jest.requireActual<typeof import("../src/settings/sport")>(
    "../src/settings/sport",
  ),
  loadSport: jest.fn(),
}));

const API = "http://192.168.1.23:8000";
const LEVICO_TERME: [number, number] = [46.0122, 11.2986];
/** What the API's search answers to a lake's name: a street. */
const STREET = { label: "Via al Lago, Levico Terme", point: [46.0101, 11.3012] };

let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** The bodies the app sent to POST /route-jobs, read back. */
function routeBodies(): unknown[] {
  return fetchSpy.mock.calls
    .filter(
      ([input, init]) =>
        String(input) === `${API}/route-jobs` && (init?.method ?? "GET") === "POST",
    )
    .map(([, init]) => JSON.parse(String(init?.body)));
}

async function atLevico() {
  await render(<App />);
  await act(() => jest.advanceTimersByTimeAsync(0));
  expect(screen.getByText("Starting from your position.")).toBeOnTheScreen();
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
}

/** «Another place», a text typed, and the pause that asks for places. */
async function searchFor(text: string, hint: string) {
  await fireEvent.press(screen.getByRole("button", { name: "Another place" }));
  await fireEvent.changeText(screen.getByPlaceholderText(hint), text);
  await act(() => jest.advanceTimersByTimeAsync(SUGGEST_DELAY_MS));
}

function distanceField() {
  return screen.getByLabelText("Distance in km");
}

beforeEach(() => {
  jest.useFakeTimers();
  forgetNoticeSeen();
  forgetExamples();
  forgetWaterChoice();
  jest.mocked(loadSport).mockReturnValue("paddle");
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: LEVICO_TERME[0], longitude: LEVICO_TERME[1] },
  } as Location.LocationObject);
  jest
    .mocked(Location.watchPositionAsync)
    .mockResolvedValue({ remove: jest.fn() } as Location.LocationSubscription);
  fetchSpy = jest.spyOn(globalThis, "fetch");
  fetchSpy.mockImplementation(async (input, init) => {
    if (String(input).startsWith(`${API}/places`)) {
      return Response.json({ places: [STREET] });
    }
    if ((init?.method ?? "GET") === "POST") {
      return Response.json(
        { job_id: "4f2c9e1a", status: "queued", result: null, error: null },
        { status: 202 },
      );
    }
    return Response.json({
      job_id: "4f2c9e1a",
      status: "computing",
      result: null,
      error: null,
    });
  });
});

afterEach(() => {
  forgetExamples();
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

test("with «Paddle», the user's text finds the lake above the streets, and it is the start", async () => {
  await atLevico();
  await searchFor("lago di Levico Terme", SPOT_SEARCH_HINT);

  const rows = screen.getAllByText(/Lago/).map((node) => String(node.props.children));
  expect(rows).toEqual(["Lago di Levico", STREET.label]);

  await fireEvent.press(screen.getByText("Lago di Levico"));
  expect(screen.getByText("Starting from Lago di Levico.")).toBeOnTheScreen();
  expect(distanceField()).toHaveDisplayValue("2");

  await fireEvent.press(screen.getByTestId("draw-route"));
  await act(() => jest.advanceTimersByTimeAsync(500));
  const [body] = routeBodies() as { start: [number, number] }[];
  expect(body).toMatchObject({
    shape: "heart",
    distance_m: 2000,
    activity: "paddling",
  });
  // A point of the list, on the lake's shore.
  const shore = WATER_SPOTS.filter((spot) => spot.name === "Lago di Levico");
  expect(shore.map((spot) => spot.point)).toContainEqual(body.start);
});

test("a small lake brings the distance down to the one its shapes fit at", async () => {
  const small = WATER_SPOTS.find((spot) => spot.distance_m === 1000);
  if (small === undefined) {
    throw new Error("the list has no lake of 1 km");
  }
  await atLevico();
  await searchFor(small.name, SPOT_SEARCH_HINT);
  await fireEvent.press(screen.getByText(small.name));
  expect(distanceField()).toHaveDisplayValue("1");

  await fireEvent.press(screen.getByTestId("draw-route"));
  await act(() => jest.advanceTimersByTimeAsync(500));
  expect(routeBodies()[0]).toMatchObject({ distance_m: 1000, activity: "paddling" });
});

test("a street chosen with «Paddle» keeps the distance typed", async () => {
  await atLevico();
  await fireEvent.changeText(distanceField(), "3,5");
  await searchFor("via al lago", SPOT_SEARCH_HINT);
  expect(screen.queryByText("Lago di Levico")).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByText(STREET.label));
  expect(screen.getByText(`Starting from ${STREET.label}.`)).toBeOnTheScreen();
  expect(distanceField()).toHaveDisplayValue("3,5");
});

test("with «Run», the same text finds the streets only, in the field of before", async () => {
  jest.mocked(loadSport).mockReturnValue("run");
  await atLevico();
  await searchFor("lago di Levico Terme", "City or street");
  expect(screen.queryByPlaceholderText(SPOT_SEARCH_HINT)).not.toBeOnTheScreen();
  expect(screen.getByText(STREET.label)).toBeOnTheScreen();
  expect(screen.queryByText("Lago di Levico")).not.toBeOnTheScreen();
});
