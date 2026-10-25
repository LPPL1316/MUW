/**
 * The stretching after a run (TASK-285 part B): «Stretch» on the reminder
 * opens the five exercises over «Your run», and «Skip» or the end of the
 * last one leaves them there. The reminder itself is tested with the free
 * run (AppFreeRun.test.tsx).
 */
import type { LatLon } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { skipCountdown } from "../src/navigation/runControl";
import { clearRun } from "../src/navigation/trackStore";
import { TICK_MS } from "../src/stretch/StretchScreen";

jest.mock("react-native-webview");
jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: "192.168.1.23:8081" } },
}));
jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  class File {
    uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
    }
    get exists(): boolean {
      return files.has(this.uri);
    }
    create(): void {
      files.set(this.uri, "");
    }
    write(text: string): void {
      files.set(this.uri, text);
    }
    textSync(): string {
      return files.get(this.uri) ?? "";
    }
    delete(): void {
      files.delete(this.uri);
    }
  }
  return {
    File,
    Paths: {
      document: { uri: "file:///documents/" },
      cache: { uri: "file:///cache/" },
    },
  };
});
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
const mockPlay = jest.fn();
jest.mock("expo-audio", () => ({
  createAudioPlayer: jest.fn(() => ({
    play: mockPlay,
    seekTo: () => Promise.resolve(),
  })),
}));

const START: LatLon = [46.067, 11.1215];
const METRE = 1 / 111_195;
const BEGAN = new Date("2026-10-13T08:00:00Z");

let onPosition: (position: Location.LocationObject) => void = () => {};
let fetchSpy: jest.SpiedFunction<typeof fetch>;

function position(northM: number, timeMs: number) {
  return {
    coords: { latitude: START[0] + northM * METRE, longitude: START[1], accuracy: 5 },
    timestamp: timeMs,
  } as Location.LocationObject;
}

beforeEach(() => {
  jest.useFakeTimers({ now: BEGAN });
  clearRun();
  mockPlay.mockClear();
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: START[0], longitude: START[1] },
  } as Location.LocationObject);
  jest
    .mocked(Location.watchPositionAsync)
    .mockImplementation(async (_options, callback) => {
      onPosition = callback;
      return { remove: jest.fn() };
    });
  fetchSpy = jest
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => Response.json({}, { status: 404 }));
});

afterEach(() => {
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

/** A run without a route, stopped after 300 m: the reminder is on screen. */
async function runAndStop() {
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
  await fireEvent.press(screen.getByLabelText("Run without a route"));
  await screen.findByText("Finding your position…");
  const now = Date.now();
  await act(async () => {
    skipCountdown();
    onPosition(position(0, now - 59_000));
    onPosition(position(150, now - 30_000));
    onPosition(position(300, now));
  });
  await act(() => jest.advanceTimersByTimeAsync(TICK_MS));
  await fireEvent.press(screen.getByLabelText("Pause"));
  await fireEvent(screen.getByLabelText("Stop"), "longPress");
  expect(await screen.findByText("Remember to stretch")).toBeOnTheScreen();
}

test("«Stretch» opens the five exercises, and «Skip» leaves them for «Your run»", async () => {
  await runAndStop();
  await fireEvent.press(screen.getByText("Stretch"));
  expect(await screen.findByText("1 of 5")).toBeOnTheScreen();
  expect(screen.getByRole("header", { name: "Quad stretch" })).toBeOnTheScreen();
  expect(screen.getByText("0:20")).toBeOnTheScreen();
  expect(screen.queryByText("Remember to stretch")).toBeNull();
  // The time runs on the exercise, not on the run.
  await act(() => jest.advanceTimersByTimeAsync(TICK_MS * 3));
  expect(screen.getByText("0:17")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Skip" }));
  expect(screen.queryByText("1 of 5")).toBeNull();
  expect(await screen.findByText("Your run")).toBeOnTheScreen();
  expect(screen.getByText("0.30 km")).toBeOnTheScreen();
});

test("the exercises go on to the end by themselves, then «Your run»", async () => {
  await runAndStop();
  await fireEvent.press(screen.getByText("Stretch"));
  expect(await screen.findByText("1 of 5")).toBeOnTheScreen();
  // Five exercises, each on two sides of 20 s: 200 s, and a bell at each change.
  await act(() => jest.advanceTimersByTimeAsync(TICK_MS * 199));
  expect(screen.getByText("5 of 5")).toBeOnTheScreen();
  expect(screen.getByText("Left side")).toBeOnTheScreen();
  // «Done» of the exercises, not the one of the card behind them.
  const stretch = within(screen.getByTestId("stretch-screen"));
  expect(stretch.getByRole("button", { name: "Done" })).toBeOnTheScreen();
  await act(() => jest.advanceTimersByTimeAsync(TICK_MS * 2));
  expect(mockPlay).toHaveBeenCalledTimes(10);
  expect(screen.queryByText("5 of 5")).toBeNull();
  expect(await screen.findByText("Your run")).toBeOnTheScreen();
});
