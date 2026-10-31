/**
 * The map turned as the drawing (TASK-232, ADR-0195): a drawn route whose
 * shape is turned turns the map so it reads upright, each route of the
 * choice as its own, and the north arrow puts north up and back. The rest
 * of the app is in App.test.tsx.
 */
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";

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
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const { injectJavaScript } =
  jest.requireMock<typeof import("../__mocks__/react-native-webview")>(
    "react-native-webview",
  );

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

function answering(done: unknown) {
  fetchSpy = jest
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (_input, init) => {
      if ((init?.method ?? "GET") === "POST") {
        const queued = {
          job_id: "4f2c9e1a",
          status: "queued",
          result: null,
          error: null,
        };
        return Response.json(queued, { status: 202 });
      }
      return Response.json(done);
    });
}

beforeEach(() => {
  injectJavaScript.mockClear();
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 46.0671, longitude: 11.1214 },
  } as Location.LocationObject);
});

afterEach(() => {
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

/** The messages of a type handed to the map page, in order. */
function messages(type: string): Record<string, unknown>[] {
  return injectJavaScript.mock.calls
    .map(([script]) => /receive\((.*)\); true;$/.exec(String(script))?.[1])
    .filter((json): json is string => json !== undefined)
    .map((json) => JSON.parse(json) as Record<string, unknown>)
    .filter((message) => message.type === type);
}

function pagePosts(data: string) {
  return fireEvent(screen.getByTestId("map"), "message", { nativeEvent: { data } });
}

async function drawn(done: unknown) {
  answering(done);
  jest.useFakeTimers();
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await pagePosts('{"type":"ready"}');
  await fireEvent.press(screen.getByTestId("draw-route"));
  await act(() => jest.advanceTimersByTimeAsync(2000));
}

test("a drawn route turned 30° turns the map the other way, with a north arrow", async () => {
  await drawn(TURNED);
  expect(messages("showRoute").at(-1)?.bearing).toBe(-30);
  // The arrow is there before the map has turned: it will be.
  expect(screen.getByRole("button", { name: "North arrow" })).toBeOnTheScreen();
});

test("a tap on the arrow puts north up, a second one turns the map back", async () => {
  await drawn(TURNED);
  await pagePosts('{"type":"turned","bearing":-30}');
  const arrow = () => screen.getByTestId("north-arrow");
  expect(arrow().props.accessibilityHint).toBe("Turns the map north up");

  await fireEvent.press(arrow());
  expect(messages("turn")).toEqual([{ type: "turn", bearing: 0 }]);
  await pagePosts('{"type":"turned","bearing":0}');
  // North is up, and the arrow stays: the way back to the drawing.
  expect(arrow().props.accessibilityHint).toBe("Turns the map like the drawing");

  await fireEvent.press(arrow());
  expect(messages("turn").map((message) => message.bearing)).toEqual([0, -30]);
  // The route itself was shown once: the taps only turn the map.
  expect(messages("showRoute")).toHaveLength(1);
});

test("another route of the choice turns the map as its own drawing", async () => {
  await drawn(TURNED);
  await fireEvent.press(screen.getByTestId("route-B"));
  expect(messages("showRoute").at(-1)?.bearing).toBe(20);
  await fireEvent.press(screen.getByTestId("route-A"));
  expect(messages("showRoute").at(-1)?.bearing).toBe(-30);
});

test("a route that does not say how it is turned keeps north up, with no arrow", async () => {
  await drawn(jobDone);
  const shown = messages("showRoute").at(-1);
  expect(shown).toBeDefined();
  expect(shown !== undefined && "bearing" in shown).toBe(false);
  expect(screen.queryByTestId("north-arrow")).toBeNull();
  expect(messages("turn")).toEqual([]);
});

test("a map turned by two fingers gets the arrow, and a tap puts north up", async () => {
  await drawn(jobDone);
  await pagePosts('{"type":"turned","bearing":25}');
  await fireEvent.press(screen.getByTestId("north-arrow"));
  expect(messages("turn")).toEqual([{ type: "turn", bearing: 0 }]);
  await pagePosts('{"type":"turned","bearing":0}');
  expect(screen.queryByTestId("north-arrow")).toBeNull();
});
