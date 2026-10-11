/**
 * A run along a route the app was closed during opens again with the app,
 * paused (TASK-272, ADR-0240: the user's choice): its route, its turns and
 * its track from the run file, «Resume» to go on, «Stop» held to end it.
 * A run without a route is in AppFreeRun.test.tsx.
 */
import type { Direction, LatLon } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";
import * as Speech from "expo-speech";

import App from "../App";
import {
  clearRun,
  loadRun,
  REOPEN_WITHIN_MS,
  type SavedRun,
  saveRun,
} from "../src/navigation/trackStore";
import type { TrackFix } from "../src/navigation/trackRecorder";

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

const START: LatLon = [46.0122, 11.2986];
const METRE = 1 / 111_195;
const north = (m: number): LatLon => [START[0] + m * METRE, START[1]];
/** 2 km north, a point every 100 m. */
const ROUTE: LatLon[] = Array.from({ length: 21 }, (_, i) => north(100 * i));
/** When each test begins, on the clock the tests move by hand. */
const NOW = new Date("2026-10-10T08:00:00Z").getTime();
/** The app was closed five minutes ago, at 1 km. */
const CLOSED = NOW - 5 * 60_000;

const DEPART: Direction = {
  node: 0,
  point: north(0),
  distance_m: 0,
  turn: "depart",
  angle_deg: 0,
  street: "Via Roma",
  road_type: "residential",
  branches: 3,
  joined: false,
};
const DIRECTIONS: Direction[] = [
  DEPART,
  {
    ...DEPART,
    node: 6,
    point: north(600),
    distance_m: 600,
    turn: "left",
    street: "Via Verdi",
  },
  {
    ...DEPART,
    node: 14,
    point: north(1400),
    distance_m: 1400,
    turn: "right",
    street: "Via Bianchi",
  },
];

let onPosition: (position: Location.LocationObject) => void = () => {};
let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** The fixes of a run along ROUTE to `toM` metres, the last at `lastMs`. */
function fixesTo(toM: number, lastMs: number): TrackFix[] {
  const fixes: TrackFix[] = [];
  for (let m = 0; m <= toM; m += 20) {
    fixes.push({ point: north(m), timeMs: lastMs - (toM - m) * 300, accuracyM: 5 });
  }
  return fixes;
}

/** The run in the file as the app left it, closed during the run. */
function closedRun(lastMs: number, more: Partial<SavedRun> = {}): SavedRun {
  return {
    version: 1,
    route: ROUTE,
    similarity: 0.8,
    directions: DIRECTIONS,
    track: { fixes: fixesTo(1000, lastMs), distanceM: 1000 },
    status: "running",
    ...more,
  };
}

function position(m: number, timeMs: number) {
  return {
    coords: { latitude: north(m)[0], longitude: north(m)[1], accuracy: 5 },
    timestamp: timeMs,
  } as Location.LocationObject;
}

function scripts(type: string): string[] {
  return injectJavaScript.mock.calls
    .map(([script]) => String(script))
    .filter((script) => script.includes(`"type":"${type}"`));
}

function said(): string[] {
  return jest.mocked(Speech.speak).mock.calls.map(([words]) => words);
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  clearRun();
  injectJavaScript.mockClear();
  jest.mocked(Speech.speak).mockClear();
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
  // Nothing of a run goes to the API without «Save».
  fetchSpy = jest
    .spyOn(globalThis, "fetch")
    .mockImplementation(async () => Response.json({}, { status: 404 }));
});

afterEach(() => {
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

/** The app opens; the map says it is ready for the route. */
async function openApp() {
  await render(<App />);
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
}

test("the run the app was closed during opens again, paused, on its route", async () => {
  saveRun(closedRun(CLOSED));
  await openApp();

  // The run screen, paused: «Resume», «Stop» to hold, the numbers so far.
  expect(await screen.findByText("Paused")).toBeOnTheScreen();
  expect(screen.getByLabelText("Resume")).toBeOnTheScreen();
  expect(screen.getByLabelText("Stop")).toBeOnTheScreen();
  expect(screen.getByLabelText("Distance: 1.00 km")).toBeOnTheScreen();
  // No countdown and no «Head out»: the run goes on, it does not start.
  expect(screen.queryByText("Get ready")).toBeNull();
  expect(said()).not.toContainEqual("Head out on Via Roma");
  // The route of the file on the map, and the turn ahead of 1 km in the
  // banner: the navigation is the one of before the app closed.
  expect(scripts("showRoute").at(-1)).toContain(`[${START[1]},${START[0]}]`);
  expect(screen.getByText(/Via Bianchi/)).toBeOnTheScreen();
  expect(screen.queryByText(/Via Verdi/)).toBeNull();

  // «Resume», two minutes later: the runner went on 600 m without the app.
  jest.setSystemTime(NOW + 2 * 60_000);
  await fireEvent.press(screen.getByLabelText("Resume"));
  expect(await screen.findByLabelText("Pause")).toBeOnTheScreen();
  await act(async () => {
    onPosition(position(1600, NOW + 2 * 60_000 + 1000));
    onPosition(position(1620, NOW + 2 * 60_000 + 7000));
    // Over 15 s after the first: the file has it too.
    onPosition(position(1640, NOW + 2 * 60_000 + 17_000));
  });
  // Found on the route there (TASK-270), not off it: past the last turn.
  expect(screen.queryByText("Off the route")).toBeNull();
  expect(screen.getByText("Follow the route to the end.")).toBeOnTheScreen();
  expect(said()).not.toContainEqual("You are off the route. Head back to it.");
  // The time closed and paused is a pause; the line is not joined across it.
  const saved = loadRun();
  expect(saved?.track.pauses?.at(-1)).toEqual({
    fromMs: CLOSED,
    toMs: NOW + 2 * 60_000,
  });
  expect(saved?.track.fixes[51]).toMatchObject({ gap: true });
  expect(saved?.track.distanceM).toBeCloseTo(1040, 0);
  // The file keeps the route's directions for a next time.
  expect(saved?.directions).toEqual(DIRECTIONS);

  // «Stop» held, from the pause, ends it as any run.
  await fireEvent.press(screen.getByLabelText("Pause"));
  await fireEvent(screen.getByLabelText("Stop"), "longPress");
  expect(await screen.findByText("Your run")).toBeOnTheScreen();
  expect(screen.getByText("Keep running")).toBeOnTheScreen();
  // Done, without an account: to the first screen, not to a route card.
  await fireEvent.press(screen.getByText("Done"));
  expect(await screen.findByText("Starting from your position.")).toBeOnTheScreen();
  expect(loadRun()).toBeNull();
});

test("Keep running after Stop goes on at once, no longer paused", async () => {
  saveRun(closedRun(CLOSED));
  await openApp();
  await fireEvent(await screen.findByLabelText("Stop"), "longPress");
  await fireEvent.press(await screen.findByText("Keep running"));
  expect(await screen.findByLabelText("Pause")).toBeOnTheScreen();
  expect(screen.queryByText("Paused")).toBeNull();
  expect(screen.queryByText("Get ready")).toBeNull();
});

test("a bike route opens again with its stretches on foot, turned as it was", async () => {
  saveRun(
    closedRun(CLOSED, { activity: "cycling", on_foot: [[12, 14]], rotation_deg: 30 }),
  );
  await openApp();
  expect(await screen.findByText("Paused")).toBeOnTheScreen();
  const shown = scripts("showRoute").at(-1) ?? "";
  expect(shown).toContain('"onFoot"');
  expect(shown).toContain('"bearing"');
  // On a bike the numbers are speeds (TASK-216).
  expect(screen.getAllByText(/km\/h/).length).toBeGreaterThan(0);
});

test("a run closed longer ago than REOPEN_WITHIN_MS opens on its end, to be saved", async () => {
  saveRun(closedRun(NOW - REOPEN_WITHIN_MS - 60_000));
  await render(<App />);
  expect(await screen.findByText("Your run")).toBeOnTheScreen();
  expect(screen.queryByText("Paused")).toBeNull();
  // Its route is not in memory: there is nothing to keep running along.
  expect(screen.queryByText("Keep running")).toBeNull();
  expect(loadRun()?.status).toBe("running");
});

test("a run stopped by the runner opens on its end, as before", async () => {
  saveRun(closedRun(CLOSED, { status: "stopped" }));
  await render(<App />);
  expect(await screen.findByText("Your run")).toBeOnTheScreen();
  expect(screen.queryByText("Paused")).toBeNull();
});
