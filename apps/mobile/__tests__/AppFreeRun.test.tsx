/**
 * A run without a route (TASK-149): «Run» on the first screen records the
 * track, Stop shows it, Done forgets it. The rest of the app is in
 * App.test.tsx.
 */
import type { LatLon } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { skipCountdown } from "../src/navigation/runControl";
import { clearRun, loadRun, saveRun } from "../src/navigation/trackStore";
import { TICK_MS } from "../src/screens/RunPanel";

jest.mock("react-native-webview");
jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: "192.168.1.23:8081" } },
}));
// The phone's documents folder, in memory, as after closing the app.
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

const { injectJavaScript } =
  jest.requireMock<typeof import("../__mocks__/react-native-webview")>(
    "react-native-webview",
  );

const START: LatLon = [46.067, 11.1215];
const METRE = 1 / 111_195;
/** When each test begins, on the clock the tests move by hand. */
const BEGAN = new Date("2026-10-02T08:00:00Z");

let onPosition: (position: Location.LocationObject) => void = () => {};
let fetchSpy: jest.SpiedFunction<typeof fetch>;

function position(northM: number, timeMs: number) {
  return {
    coords: { latitude: START[0] + northM * METRE, longitude: START[1], accuracy: 5 },
    timestamp: timeMs,
  } as Location.LocationObject;
}

function scripts(type: string): string[] {
  return injectJavaScript.mock.calls
    .map(([script]) => String(script))
    .filter((script) => script.includes(`"type":"${type}"`));
}

beforeEach(() => {
  // The countdown, the clock of the run and the pause by standing still are
  // timers that read the time: with the real ones, how busy the machine is
  // decides what the screen says. Here time passes only when a test says so.
  jest.useFakeTimers({ now: BEGAN });
  clearRun();
  injectJavaScript.mockClear();
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
  // Nothing of a free run goes to the API.
  fetchSpy = jest
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => Response.json({}, { status: 404 }));
});

afterEach(() => {
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

async function openApp() {
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
}

test("the button says what it starts: a run without a route", async () => {
  await openApp();
  // Written in full: "Run" alone read as running the route chosen below.
  expect(screen.getByText("Run without a route")).toBeOnTheScreen();
  expect(screen.queryByText("Run")).toBeNull();
  expect(screen.getByRole("button", { name: "Run without a route" })).toBeOnTheScreen();
});

test("Run records a run without a route, and Stop shows it", async () => {
  await openApp();
  await fireEvent.press(screen.getByLabelText("Run without a route"));

  expect(await screen.findByText("Finding your position…")).toBeOnTheScreen();
  expect(screen.getByText("Stop")).toBeOnTheScreen();
  // The countdown covers the screen, then the run begins (TASK-169).
  expect(screen.getByText("Get ready")).toBeOnTheScreen();
  const now = Date.now();
  await act(async () => {
    skipCountdown();
    onPosition(position(0, now - 59_000));
    onPosition(position(150, now - 30_000));
    onPosition(position(300, now));
  });
  expect(screen.queryByText("Get ready")).toBeNull();
  // The clock of the run is the phone's, read once a second: at its first
  // tick, a second after the last fix, the run is a minute old.
  await act(() => jest.advanceTimersByTimeAsync(TICK_MS));
  // A few numbers of the run under the map, the start over it (TASK-164).
  expect(screen.getByLabelText("Distance: 0.30 km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Pace now: 3:20 /km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Time: 1:00")).toBeOnTheScreen();
  expect(screen.getByText("300 m")).toBeOnTheScreen();
  expect(screen.getByText("Your start, in a straight line")).toBeOnTheScreen();
  expect(screen.getByText("Heading north")).toBeOnTheScreen();
  // The map follows the runner, with an arrow turned north, the way of
  // the run, and draws the line so far.
  expect(scripts("follow").at(-1)).toContain('"heading":0');
  expect(scripts("showTrack").at(-1)).toContain(
    `[${START[1]},${START[0] + 300 * METRE}]`,
  );
  expect(scripts("showRoute")).toHaveLength(0);

  // The run is paused first; then «Stop» is held, not touched.
  expect(screen.queryByText("Stop")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Pause"));
  expect(screen.getByText("Paused")).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText("Stop"));
  expect(screen.queryByText("Your run")).toBeNull();
  await fireEvent(screen.getByLabelText("Stop"), "longPress");
  expect(await screen.findByText("Your run")).toBeOnTheScreen();
  // The arrow is the position marker again.
  expect(scripts("stopFollow")).toHaveLength(1);
  expect(screen.getByText("0.30 km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Time: 1:00")).toBeOnTheScreen();
  expect(screen.getByLabelText("Avg pace: 3:20 /km")).toBeOnTheScreen();
  expect(loadRun()?.route).toEqual([]);
  expect(fetchSpy).not.toHaveBeenCalledWith(
    expect.stringContaining("/track-scores"),
    expect.anything(),
  );

  // Done: back to the first screen, and the run leaves the phone.
  await fireEvent.press(screen.getByText("Done"));
  expect(await screen.findByText("Starting from your position.")).toBeOnTheScreen();
  expect(loadRun()).toBeNull();
});

test("Keep running goes on with the same track", async () => {
  await openApp();
  await fireEvent.press(screen.getByLabelText("Run without a route"));
  await screen.findByText("Stop");
  const now = Date.now();
  await act(async () => {
    skipCountdown();
    onPosition(position(0, now - 20_000));
    onPosition(position(100, now));
  });
  await fireEvent.press(screen.getByLabelText("Pause"));
  await fireEvent(screen.getByLabelText("Stop"), "longPress");
  await fireEvent.press(await screen.findByText("Keep running"));

  // The run goes on at once: no countdown, and «Pause» again.
  await screen.findByLabelText("Pause");
  expect(screen.queryByText("Get ready")).toBeNull();
  await act(async () => {
    // Where the runner is now is not joined to where the run was left.
    onPosition(position(200, now + 20_000));
    onPosition(position(300, now + 40_000));
  });
  expect(screen.getByLabelText("Distance: 0.20 km")).toBeOnTheScreen();
  expect(loadRun()?.track.fixes).toHaveLength(4);
});

test("Stop before the first fix goes back to the first screen", async () => {
  await openApp();
  await fireEvent.press(screen.getByLabelText("Run without a route"));
  await fireEvent.press(await screen.findByText("Stop"));
  expect(await screen.findByText("Starting from your position.")).toBeOnTheScreen();
  expect(screen.queryByText("Your run")).toBeNull();
});

/** A free run of 500 m in a minute the app was closed during, its last fix
 * `agoMs` ago: when that was. */
function closedFreeRun(agoMs: number): number {
  const now = Date.now();
  saveRun({
    version: 1,
    route: [],
    track: {
      fixes: [
        { point: START, timeMs: now - agoMs - 60_000, accuracyM: 5 },
        {
          point: [START[0] + 500 * METRE, START[1]],
          timeMs: now - agoMs,
          accuracyM: 5,
        },
      ],
      distanceM: 500,
    },
    status: "running",
  });
  return now - agoMs;
}

test("a free run left when the app closed opens again, paused (TASK-272)", async () => {
  const closed = closedFreeRun(60_000);
  await render(<App />);
  // Its run screen, as a run along a route: paused, the numbers so far.
  expect(await screen.findByText("Paused")).toBeOnTheScreen();
  expect(screen.getByLabelText("Distance: 0.50 km")).toBeOnTheScreen();
  expect(screen.queryByText("Get ready")).toBeNull();

  // «Resume» goes on: the minute closed is a pause, not a minute of the run.
  const resumed = Date.now();
  await fireEvent.press(screen.getByLabelText("Resume"));
  await screen.findByLabelText("Pause");
  await act(async () => {
    onPosition(position(700, resumed + 10_000));
    onPosition(position(800, resumed + 40_000));
  });
  expect(loadRun()?.track.pauses).toEqual([{ fromMs: closed, toMs: resumed }]);
  expect(loadRun()?.track.distanceM).toBeCloseTo(600, 0);

  await fireEvent.press(screen.getByLabelText("Pause"));
  await fireEvent(screen.getByLabelText("Stop"), "longPress");
  expect(await screen.findByText("Your run")).toBeOnTheScreen();
  expect(screen.getByText("0.60 km")).toBeOnTheScreen();
  // A minute before the app closed, 40 seconds after «Resume».
  expect(screen.getByLabelText("Time: 1:40")).toBeOnTheScreen();
});

test("a free run closed long ago opens on its end, to be saved (TASK-272)", async () => {
  closedFreeRun(3 * 60 * 60_000);
  await render(<App />);
  expect(await screen.findByText("Your run")).toBeOnTheScreen();
  expect(screen.getByText("0.50 km")).toBeOnTheScreen();
  expect(screen.queryByText("Keep running")).toBeNull();
});
