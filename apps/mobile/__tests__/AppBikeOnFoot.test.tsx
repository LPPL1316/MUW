/**
 * A bike route with the bike on foot (TASK-206, ADR-0167): the stretches
 * marked on the map and the metres in the card. The marks are in
 * src/map/messages.test.ts, the card's text in src/route/warnings.test.ts,
 * the voice in src/navigation; the rest of the bike in AppBike.test.tsx.
 */
import cycling from "@shaperoute/shared-types/fixtures/route-result-cycling.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
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
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock("../src/settings/sport", () => ({
  ...jest.requireActual<typeof import("../src/settings/sport")>(
    "../src/settings/sport",
  ),
  loadSport: jest.fn(),
}));

const { injectJavaScript } =
  jest.requireMock<typeof import("../__mocks__/react-native-webview")>(
    "react-native-webview",
  );

let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** The API accepts the route job, and the job is done at the first poll
 * with `result`. */
function apiAnswers(result: unknown) {
  fetchSpy.mockImplementation(async (_input, init) => {
    if ((init?.method ?? "GET") === "POST") {
      return Response.json(
        { job_id: "4f2c9e1a", status: "queued", result: null, error: null },
        { status: 202 },
      );
    }
    return Response.json({ job_id: "4f2c9e1a", status: "done", result, error: null });
  });
}

/** The last route the map was told to draw. */
function lastShown(): string | undefined {
  return injectJavaScript.mock.calls
    .map(([script]) => String(script))
    .findLast((script) => script.includes('"type":"showRoute"'));
}

async function drawAtTrento() {
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 46.0671, longitude: 11.1214 },
  } as Location.LocationObject);
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
  await fireEvent.press(screen.getByTestId("draw-route"));
  // The first poll comes after 500 ms.
  await act(() => jest.advanceTimersByTimeAsync(500));
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(loadSport).mockReturnValue("bike");
  injectJavaScript.mockClear();
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

test("a bike route marks its stretches on foot and says their metres", async () => {
  apiAnswers(cycling);
  await drawAtTrento();
  // The route whole, and the stretch on foot over it, of its own points.
  const shown = lastShown();
  expect(shown).toContain('"onFoot":[[');
  const [from, to] = cycling.on_foot[0];
  const marked = cycling.points.slice(from, to + 1).map(([lat, lon]) => [lon, lat]);
  expect(shown).toContain(`"onFoot":${JSON.stringify([marked])}`);
  expect(shown).not.toContain('"letters"');
  // The engine's warning, in the card's words.
  expect(screen.getByText("Includes 920 m walking the bike.")).toBeOnTheScreen();
  expect(screen.queryByText(/with the bike on foot/)).toBeNull();
});

test("from an API before TASK-206 the bike route is drawn as before", async () => {
  const { on_foot: _onFoot, alternatives: _alternatives, ...older } = cycling;
  apiAnswers({ ...older, warnings: [] });
  await drawAtTrento();
  const shown = lastShown();
  expect(shown).toContain('"type":"showRoute"');
  expect(shown).not.toContain("onFoot");
  expect(screen.queryByText(/walking the bike/)).toBeNull();
});
