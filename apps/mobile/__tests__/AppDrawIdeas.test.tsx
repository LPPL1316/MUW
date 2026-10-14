/**
 * The city tours and the ready-made pictures at the foot of «Draw»
 * (TASK-280): a tour is asked for as «Ask for a route» asks, around the
 * start, and opens on the map, from where the way back is «Draw»; a picture
 * puts the switch on «Image» with its outline, and «Draw route» sends that
 * outline. On the water neither row is there. The rows alone are in
 * src/route/DrawIdeas.test.tsx.
 */
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import themedDone from "@shaperoute/shared-types/fixtures/themed-route-job-done.json";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { forgetExamples } from "../src/explore/exampleRoutes";
import { POLL_MS } from "../src/explore/useThemedRoute";
import { SAMPLE_PICTURES } from "../src/route/samplePictures";
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
const ROCKET = SAMPLE_PICTURES.find((picture) => picture.id === "rocket")!;

let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** The API: every job is accepted, and is done at the first poll. */
function apiAnswers() {
  fetchSpy.mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.includes("/themed-route-jobs")) {
      return method === "POST"
        ? Response.json(
            { ...themedDone, status: "queued", result: null },
            { status: 202 },
          )
        : Response.json(themedDone);
    }
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

async function atTrento() {
  await render(<App />);
  await act(() => jest.advanceTimersByTimeAsync(0));
  expect(screen.getByText("Starting from your position.")).toBeOnTheScreen();
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  forgetExamples();
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
  forgetExamples();
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

test("a city tour is asked for around the start and opens on the map; «Back to Draw» goes back", async () => {
  await atTrento();
  const tours = within(screen.getByTestId("city-tours"));
  await fireEvent.press(
    tours.getByRole("button", { name: "Famous Places, near your start" }),
  );
  // As «Ask for a route» with «Near me»: the category alone, from the start.
  expect(posted("/themed-route-jobs")).toEqual([
    { text: "Famous Places", centre: TRENTO, city: null },
  ]);
  // The map, with the places' card: the pages are gone.
  expect(screen.queryByText("CITY TOURS")).toBeNull();
  await act(() => jest.advanceTimersByTimeAsync(POLL_MS));
  expect(screen.getByText("Strada di Galliera", { exact: false })).toBeOnTheScreen();
  expect(screen.queryByText("Back to Explore")).toBeNull();

  await fireEvent.press(screen.getByRole("button", { name: "Back to Draw" }));
  expect(screen.getByText("CITY TOURS")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Draw route" })).toBeOnTheScreen();
});

test("«←» on a tour of «Draw» goes back to «Draw»", async () => {
  await atTrento();
  await fireEvent.press(
    within(screen.getByTestId("city-tours")).getByRole("button", {
      name: "Romantic, near your start",
    }),
  );
  expect(posted("/themed-route-jobs")).toEqual([
    { text: "Romantic", centre: TRENTO, city: null },
  ]);
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByText("CITY TOURS")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Draw route" })).toBeOnTheScreen();
});

test("a picture puts the switch on «Image» with its outline, and «Draw route» sends it", async () => {
  await atTrento();
  expect(screen.queryByTestId("image-preview")).toBeNull();
  await fireEvent.press(
    within(screen.getByTestId("pictures")).getByRole("button", { name: "Rocket" }),
  );
  expect(screen.getByRole("button", { name: "Image" })).toBeSelected();
  expect(screen.getByTestId("image-preview")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Edit the outline" })).toBeOnTheScreen();
  expect(
    within(screen.getByTestId("pictures")).getByRole("button", { name: "Rocket" }),
  ).toBeSelected();
  // Nothing traced by the API: the outline was in the app.
  expect(posted("/image-outlines")).toEqual([]);

  await fireEvent.press(screen.getByRole("button", { name: "Draw route" }));
  expect(posted("/image-route-jobs")).toEqual([
    {
      start: TRENTO,
      outline: ROCKET.outline.points,
      strokes: [],
      distance_m: 5000,
      activity: "running",
    },
  ]);
});

test("back on «Shape», the picture is no longer the one chosen", async () => {
  await atTrento();
  const pictures = within(screen.getByTestId("pictures"));
  await fireEvent.press(pictures.getByRole("button", { name: "Leaf" }));
  expect(pictures.getByRole("button", { name: "Leaf" })).toBeSelected();
  // Back to a shape: the picture waits, unselected.
  await fireEvent.press(screen.getByRole("button", { name: "Shape" }));
  expect(pictures.getByRole("button", { name: "Leaf" })).not.toBeSelected();
});

test("with «Paddle» neither row is there", async () => {
  jest.mocked(loadSport).mockReturnValue("paddle");
  await atTrento();
  expect(screen.queryByText("CITY TOURS")).toBeNull();
  expect(screen.queryByText("PICTURES")).toBeNull();
  expect(screen.queryByTestId("city-tours")).toBeNull();
  expect(screen.queryByTestId("pictures")).toBeNull();
});

test("with «Bike» both rows are there", async () => {
  jest.mocked(loadSport).mockReturnValue("bike");
  await atTrento();
  expect(screen.getByTestId("city-tours")).toBeOnTheScreen();
  expect(screen.getByTestId("pictures")).toBeOnTheScreen();
});
