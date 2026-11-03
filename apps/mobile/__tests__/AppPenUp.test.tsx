/**
 * A word with the pen up (TASK-198): the switch in «Draw», what the request
 * says, and the route drawn with its walks. The run along it is in
 * src/navigation/penUpRun.test.ts; the rest of the app in App.test.tsx.
 */
import penUpResult from "@shaperoute/shared-types/fixtures/route-result-pen-up.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";
import * as Sharing from "expo-sharing";

import App from "../App";

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
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const { injectJavaScript } =
  jest.requireMock<typeof import("../__mocks__/react-native-webview")>(
    "react-native-webview",
  );

const API = "http://192.168.1.23:8000";
const PEN_SWITCH = "Lift the pen between letters";

let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** The API accepts the route job, and the job is done at the first poll
 * with `result`. */
function apiAnswers(result: unknown) {
  fetchSpy.mockImplementation(async (input, init) => {
    const method = init?.method ?? "GET";
    if (String(input) === `${API}/gpx`) {
      return new Response('<?xml version="1.0"?><gpx version="1.1"></gpx>', {
        headers: { "Content-Disposition": 'attachment; filename="sgrava-io.gpx"' },
      });
    }
    if (method === "POST") {
      return Response.json(
        { job_id: "4f2c9e1a", status: "queued", result: null, error: null },
        { status: 202 },
      );
    }
    return Response.json({ job_id: "4f2c9e1a", status: "done", result, error: null });
  });
}

/** What the app sent to the API in its last route request. */
function lastRouteRequest(): unknown {
  const posts = fetchSpy.mock.calls.filter(
    ([input, init]) =>
      String(input) === `${API}/route-jobs` && (init?.method ?? "GET") === "POST",
  );
  return JSON.parse(String(posts.at(-1)?.[1]?.body));
}

async function atTrento() {
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
}

async function drawWord(word: string, km: string) {
  await fireEvent.press(screen.getByRole("button", { name: "Word" }));
  await fireEvent.changeText(screen.getByLabelText("Word"), word);
  await fireEvent.changeText(screen.getByLabelText("Distance in km"), km);
}

async function draw() {
  await fireEvent.press(screen.getByTestId("draw-route"));
  // The first poll comes after 500 ms.
  await act(() => jest.advanceTimersByTimeAsync(500));
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(Sharing.shareAsync).mockResolvedValue();
  injectJavaScript.mockClear();
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

test("the switch is on until the user turns it off: then no pen_up is sent", async () => {
  apiAnswers({ ...penUpResult, walks: [] });
  await atTrento();
  await drawWord("io", "6");
  // On by default, the user's choice (TASK-202).
  expect(screen.getByRole("switch", { name: PEN_SWITCH, checked: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole("switch", { name: PEN_SWITCH }));
  expect(screen.getByRole("switch", { name: PEN_SWITCH, checked: false })).toBeTruthy();
  await draw();
  expect(lastRouteRequest()).toEqual({
    start: [46.0671, 11.1214],
    word: "IO",
    style: "round",
    distance_m: 6000,
    activity: "running",
  });
});

test("on, the word is asked with the pen up and its walks are drawn apart", async () => {
  apiAnswers(penUpResult);
  await atTrento();
  await drawWord("io", "6");
  // Nothing to press: the switch starts on (TASK-202).
  await draw();
  expect(lastRouteRequest()).toEqual({
    start: [46.0671, 11.1214],
    word: "IO",
    style: "round",
    pen_up: true,
    distance_m: 6000,
    activity: "running",
  });
  // The letters and the walk, apart, on the map.
  const shown = injectJavaScript.mock.calls
    .map(([script]) => String(script))
    .findLast((script) => script.includes('"type":"showRoute"'));
  expect(shown).toContain('"letters":[[');
  expect(shown).toContain('"walks":[[');
  // The km of the letters, apart from the walk.
  expect(screen.getByText(/km of letters \+ .* km walking between them$/)).toBeTruthy();

  // The GPX is asked for with the pen up and the walks, as they came.
  await fireEvent.press(screen.getByText("Export GPX"));
  await act(() => jest.advanceTimersByTimeAsync(0));
  const gpx = fetchSpy.mock.calls.find(([input]) => String(input) === `${API}/gpx`);
  const body = JSON.parse(String(gpx?.[1]?.body)) as {
    request: { pen_up?: boolean };
    result: { walks?: unknown };
  };
  expect(body.request.pen_up).toBe(true);
  expect(body.result.walks).toEqual([[2, 5]]);
});

test("a shape never carries the pen, even with the switch on", async () => {
  apiAnswers({ ...penUpResult, shape: "heart", word: null, walks: [] });
  await atTrento();
  await drawWord("io", "6");
  // On by default (TASK-202): left on while the shape is chosen.
  expect(screen.getByRole("switch", { name: PEN_SWITCH, checked: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Shape" }));
  await draw();
  expect(lastRouteRequest()).toEqual({
    start: [46.0671, 11.1214],
    shape: "heart",
    distance_m: 6000,
    activity: "running",
  });
  expect(screen.queryByRole("switch", { name: PEN_SWITCH })).toBeNull();
});
