/**
 * Our ideas in «Ask for a route» (TASK-329, ADR-0287), in the app itself:
 * «Draw» has no city tours or pictures any more; in «Explore» «Ask for a
 * route» is open with the ideas; one opens on the map asking nothing, and
 * far from the start «Make it near me» asks its words from the start. The
 * row alone is in src/explore/IdeasFromEurope.test.tsx. Opened, an idea's
 * places are numbered on the map and under it, with their photos asked of
 * the API by their items; a tap on one takes the map there (TASK-329).
 */
import list from "@shaperoute/shared-types/fixtures/recommended-routes.json";
import themedDone from "@shaperoute/shared-types/fixtures/themed-route-job-done.json";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { forgetExamples } from "../src/explore/exampleRoutes";
import { forgetPlacePhotos } from "../src/explore/placePhotos";
import { THEMED_IDEAS } from "../src/explore/themedIdeas";
import { POLL_MS } from "../src/explore/useThemedRoute";
import { loadSport } from "../src/settings/sport";

jest.mock("react-native-webview");
const { injectJavaScript } =
  jest.requireMock<typeof import("../__mocks__/react-native-webview")>(
    "react-native-webview",
  );
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
const [IDEA] = THEMED_IDEAS;

let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** The API: the routes near the start, and every themed job done at once. */
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
    if (url.startsWith(`${API}/recommended-routes`)) {
      return Response.json(list);
    }
    if (url.startsWith(`${API}/place-photos`)) {
      // No free photo: the names alone.
      return Response.json({ photos: {} });
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

/** The messages of a type handed to the map page, in order. */
function mapMessages(type: string): Record<string, unknown>[] {
  return injectJavaScript.mock.calls
    .map(([script]: [string]) => /receive\((.*)\); true;$/.exec(script)?.[1])
    .filter((json): json is string => json !== undefined)
    .map((json) => JSON.parse(json) as Record<string, unknown>)
    .filter((message) => message.type === type);
}

beforeEach(() => {
  jest.useFakeTimers();
  forgetExamples();
  forgetPlacePhotos();
  injectJavaScript.mockClear();
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

test("«Draw» has no city tours and no pictures any more", async () => {
  await atTrento();
  expect(screen.getByRole("button", { name: "Draw route" })).toBeOnTheScreen();
  expect(screen.queryByTestId("city-tours")).toBeNull();
  expect(screen.queryByTestId("pictures")).toBeNull();
  expect(screen.queryByText("CITY TOURS")).toBeNull();
  expect(screen.queryByText("PICTURES")).toBeNull();
});

test("an idea opens at once on the map; from Trento, «Make it near me» asks it here", async () => {
  await atTrento();
  await fireEvent.press(screen.getByText("Explore"));
  expect(await screen.findByText("ASK FOR A ROUTE")).toBeOnTheScreen();
  const ideas = within(screen.getByTestId("themed-ideas"));
  await fireEvent.press(ideas.getAllByRole("button")[0]);

  // Planned already: nothing asked, the card at once.
  expect(posted("/themed-route-jobs")).toEqual([]);
  expect(screen.getByText(new RegExp(`· ${IDEA.city} ·`))).toBeOnTheScreen();
  expect(screen.queryByText("Start")).toBeNull();
  expect(screen.getByText("Export GPX")).toBeOnTheScreen();

  await fireEvent.press(screen.getByText("Make it near me"));
  expect(posted("/themed-route-jobs")).toEqual([
    { text: IDEA.text, centre: TRENTO, city: null },
  ]);
  await act(() => jest.advanceTimersByTimeAsync(POLL_MS));
  // The route made near the start, as any asked for: «Start» is there.
  expect(await screen.findByText("Start")).toBeOnTheScreen();
  expect(screen.queryByText("Make it near me")).toBeNull();

  await fireEvent.press(screen.getByText("Back to Explore"));
  expect(screen.getByText("ASK FOR A ROUTE")).toBeOnTheScreen();
});

test("an idea's places, numbered on the map and under it; a tap takes the map there", async () => {
  await atTrento();
  await fireEvent.press(screen.getByText("Explore"));
  const ideas = within(await screen.findByTestId("themed-ideas"));
  await fireEvent.press(ideas.getAllByRole("button")[0]);
  await act(() => jest.advanceTimersByTimeAsync(0));

  const passed = IDEA.result.stops.filter((s) => s.passed);
  // Their photos asked of the API by their items, the row's and the idea's.
  const asked = fetchSpy.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.startsWith(`${API}/place-photos?`))
    .flatMap((url) => new URL(url).searchParams.get("items")?.split(",") ?? []);
  expect(asked).toEqual(
    expect.arrayContaining(passed.flatMap((s) => (s.wikidata ? [s.wikidata] : []))),
  );
  // On the map, the places passed by have their numbers.
  const shown = mapMessages("showStops").at(-1)?.stops as { name: string }[];
  expect(shown.slice(0, 2).map((s) => s.name)).toEqual([
    `1 ${passed[0].name}`,
    `2 ${passed[1].name}`,
  ]);
  // Under it, the same: without a free photo, the names alone.
  const row = within(screen.getByTestId("stop-photos"));
  expect(row.getAllByTestId("stop-photo")).toHaveLength(passed.length);
  expect(row.queryByTestId("stop-photo-image")).toBeNull();

  await fireEvent.press(row.getByRole("button", { name: `2 ${passed[1].name}` }));
  const [lat, lon] = passed[1].point;
  expect(mapMessages("focus")).toEqual([{ type: "focus", lngLat: [lon, lat] }]);
});
