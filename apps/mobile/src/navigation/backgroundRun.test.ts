/**
 * A run with the phone locked (TASK-261, ADR-0225): the positions come from
 * the background task, through the hooks the run screens use. The line and
 * the voice go on, standing still pauses the run as in front, and only a
 * freeze of the app by iOS cuts the line. Where the GPS is followed in front
 * only (Expo Go), a freeze counts too.
 */
import type { Direction, LatLon } from "@shaperoute/shared-types";
import { act, renderHook } from "@testing-library/react-native";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import * as TaskManager from "expo-task-manager";
import { AppState, type AppStateStatus, Vibration } from "react-native";

import { runControl, skipCountdown } from "./runControl";
import { RUN_LOCATION_TASK } from "./runPosition";
import { activeMs, type Track } from "./trackRecorder";
import { clearRun } from "./trackStore";
import { useFreeRun } from "./useFreeRun";
import { useNavigation } from "./useNavigation";

jest.mock("expo-speech", () => ({ speak: jest.fn(), stop: jest.fn() }));
jest.mock("expo-location", () => ({
  Accuracy: { BestForNavigation: 6 },
  ActivityType: { Fitness: 3 },
  isBackgroundLocationAvailableAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));
jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn(),
  isAvailableAsync: jest.fn(),
}));
// The phone's documents folder, in memory.
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
  return { File, Paths: { document: { uri: "file:///documents/" } } };
});

const START: LatLon = [46.0122, 11.2986];
const METRE = 1 / 111_195;
const BEGAN = Date.UTC(2026, 9, 8, 7, 0, 0);
/** 6:00 a kilometre: 10 m every 3.6 s. */
const STEP_MS = 3600;

/** The task as the app defined it when it loaded. */
const [[, runTask]] = jest.mocked(TaskManager.defineTask).mock.calls;

/** iOS hands the task the runner `northM` metres on, now. */
async function fix(northM: number): Promise<void> {
  await runTask({
    data: {
      locations: [
        {
          coords: {
            latitude: START[0] + northM * METRE,
            longitude: START[1],
            accuracy: 5,
            altitude: null,
          },
          timestamp: Date.now(),
        } as Location.LocationObject,
      ],
    },
    error: null,
    executionInfo: { eventId: "1", taskName: RUN_LOCATION_TASK },
  });
}

/** Runs from `fromM` to `toM` at 6:00 a km, the app alive all along. */
async function run(fromM: number, toM: number): Promise<void> {
  for (let m = fromM; m <= toM; m += 10) {
    jest.advanceTimersByTime(STEP_MS);
    await fix(m);
  }
}

function said(): string[] {
  return jest.mocked(Speech.speak).mock.calls.map(([text]) => text);
}

jest.spyOn(Vibration, "vibrate").mockImplementation(() => {});

let appState: (next: AppStateStatus) => void = () => {};

beforeEach(() => {
  jest.useFakeTimers({ now: BEGAN });
  clearRun();
  jest.mocked(Speech.speak).mockClear();
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.isBackgroundLocationAvailableAsync).mockResolvedValue(true);
  jest.mocked(TaskManager.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(Location.startLocationUpdatesAsync).mockReset().mockResolvedValue();
  jest.mocked(Location.stopLocationUpdatesAsync).mockReset().mockResolvedValue();
  jest.mocked(Location.watchPositionAsync).mockReset();
  // React Native's own mock of AppState keeps its calls: cleared here.
  appState = () => {};
  jest
    .spyOn(AppState, "addEventListener")
    .mockClear()
    .mockImplementation((_type, listener) => {
      appState = listener;
      return { remove: jest.fn() };
    });
});

afterEach(() => {
  jest.useRealTimers();
});

/** A free run past its countdown. */
async function freeRun() {
  const hook = await renderHook(() => useFreeRun(true));
  // The permission and the GPS are asked for first.
  await act(async () => {});
  await act(async () => {
    skipCountdown();
  });
  return hook;
}

function trackOfState(state: ReturnType<typeof useFreeRun>): Track {
  if (state.status !== "running") {
    throw new Error(`not running: ${state.status}`);
  }
  return state.track;
}

test("with the phone locked the line, its metres and the voice go on", async () => {
  const { result, unmount } = await freeRun();
  expect(Location.startLocationUpdatesAsync).toHaveBeenCalled();
  expect(Location.watchPositionAsync).not.toHaveBeenCalled();
  await act(async () => {
    await run(0, 200);
    // The phone locks: nothing tells the run, the fixes go on.
    appState("background");
    await run(210, 1200);
  });
  const track = trackOfState(result.current);
  expect(track.distanceM).toBeCloseTo(1200, 0);
  expect(track.fixes.some((kept) => kept.gap)).toBe(false);
  expect(track.pauses ?? []).toEqual([]);
  // The kilometre is said once, in the background, and not again.
  const kilometres = () => said().filter((words) => /kilometre|mile/.test(words));
  expect(kilometres()).toHaveLength(1);
  await act(async () => {
    appState("active");
    await run(1210, 1500);
  });
  expect(kilometres()).toHaveLength(1);
  await unmount();
  await act(async () => {});
  expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(RUN_LOCATION_TASK);
});

test("standing still at a light, phone locked: a pause as in front, not a cut", async () => {
  const { result, unmount } = await freeRun();
  await act(async () => {
    await run(0, 100);
    // The phone locked at a light, 70 s there: no fix (the GPS gives one
    // every 5 m), the app alive.
    appState("background");
    jest.advanceTimersByTime(70_000);
  });
  expect(runControl()).toMatchObject({ phase: "paused", auto: true });
  expect(said()).toContain("Paused.");
  await act(async () => {
    await run(110, 200);
  });
  expect(runControl().phase).toBe("running");
  expect(said()).toContain("Resumed.");
  const track = trackOfState(result.current);
  // The step after the light counts, as it would with the app in front.
  expect(track.fixes.some((kept) => kept.gap)).toBe(false);
  expect(track.distanceM).toBeCloseTo(200, 0);
  expect(track.pauses).toEqual([
    { fromMs: expect.any(Number), toMs: expect.any(Number), auto: true },
  ]);
  await unmount();
});

test("iOS freezing the app past AWAY_AFTER_MS cuts the line: neither metres nor time in between", async () => {
  const { result, unmount } = await freeRun();
  let frozeAt = 0;
  await act(async () => {
    await run(0, 100);
    frozeAt = Date.now();
    // Frozen for a quarter of an hour: no tick, no fix; the runner goes on.
    jest.setSystemTime(frozeAt + 900_000);
    await fix(800);
    await run(810, 900);
  });
  const track = trackOfState(result.current);
  const cut = track.fixes.findIndex((kept) => kept.gap);
  expect(track.fixes[cut].point[0]).toBeCloseTo(START[0] + 800 * METRE, 9);
  expect(track.fixes.filter((kept) => kept.gap)).toHaveLength(1);
  // 100 m before, 100 m after: the 700 m of the freeze are not run.
  expect(track.distanceM).toBeCloseTo(200, 0);
  expect(track.pauses).toEqual([
    { fromMs: frozeAt, toMs: frozeAt + 900_000, away: true },
  ]);
  expect(activeMs(track, Date.now())).toBe(Date.now() - BEGAN - 900_000 - STEP_MS);
  await unmount();
});

test("a short freeze, back within a minute, joins the line as before", async () => {
  const { result, unmount } = await freeRun();
  await act(async () => {
    await run(0, 100);
    jest.setSystemTime(Date.now() + 40_000);
    await fix(220);
  });
  const track = trackOfState(result.current);
  expect(track.fixes.some((kept) => kept.gap)).toBe(false);
  expect(track.distanceM).toBeCloseTo(220, 0);
  await unmount();
});

test("along a route, the turn is said with the phone locked, and a long freeze cuts the line", async () => {
  const route: LatLon[] = [START, [START[0] + 2000 * METRE, START[1]]];
  const directions: Direction[] = [
    {
      node: 0,
      point: START,
      distance_m: 0,
      turn: "depart",
      angle_deg: 0,
      street: "Via Roma",
      road_type: "residential",
      branches: 3,
      joined: false,
    },
    {
      node: 1,
      point: [START[0] + 600 * METRE, START[1]],
      distance_m: 600,
      turn: "left",
      angle_deg: 0,
      street: "Via Verdi",
      road_type: "residential",
      branches: 3,
      joined: false,
    },
  ];
  const { result, unmount } = await renderHook(() =>
    useNavigation(route, directions, true, 0.9),
  );
  await act(async () => {});
  await act(async () => {
    skipCountdown();
  });
  await act(async () => {
    appState("background");
    await run(0, 600);
  });
  expect(said().some((words) => /Via Verdi/.test(words))).toBe(true);
  await act(async () => {
    jest.setSystemTime(Date.now() + 900_000);
    await fix(1000);
  });
  const state = result.current;
  expect(state.status).toBe("following");
  if (state.status === "following") {
    expect(state.track.fixes.at(-1)?.gap).toBe(true);
    expect(state.track.distanceM).toBeCloseTo(600, 0);
  }
  await unmount();
  await act(async () => {});
  expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(RUN_LOCATION_TASK);
});

describe("with the GPS in front only (Expo Go)", () => {
  let onPosition: (position: Location.LocationObject) => void = () => {};

  beforeEach(() => {
    jest.mocked(Location.isBackgroundLocationAvailableAsync).mockResolvedValue(false);
    jest
      .mocked(Location.watchPositionAsync)
      .mockImplementation(async (_options, callback) => {
        onPosition = callback;
        return { remove: jest.fn() };
      });
  });

  function inFront(northM: number): void {
    onPosition({
      coords: {
        latitude: START[0] + northM * METRE,
        longitude: START[1],
        accuracy: 5,
        altitude: null,
      },
      timestamp: Date.now(),
    } as Location.LocationObject);
  }

  test("leaving the front still pauses the run after AWAY_AFTER_MS away (TASK-255)", async () => {
    const { result, unmount } = await freeRun();
    expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
    await act(async () => {
      for (let m = 0; m <= 100; m += 10) {
        jest.advanceTimersByTime(STEP_MS);
        inFront(m);
      }
      appState("background");
      // Away 11 minutes, the clock running (the app not yet frozen).
      jest.advanceTimersByTime(11 * 60_000);
      appState("active");
      inFront(400);
    });
    const track = trackOfState(result.current);
    expect(track.fixes.at(-1)?.gap).toBe(true);
    expect(track.distanceM).toBeCloseTo(100, 0);
    await unmount();
  });

  test("a fix just after leaving the front no longer hides the freeze that follows", async () => {
    const { result, unmount } = await freeRun();
    await act(async () => {
      for (let m = 0; m <= 100; m += 10) {
        jest.advanceTimersByTime(STEP_MS);
        inFront(m);
      }
      appState("background");
      // One more fix before iOS freezes the app, then a quarter of an hour
      // frozen.
      jest.advanceTimersByTime(STEP_MS);
      inFront(110);
      jest.setSystemTime(Date.now() + 900_000);
      appState("active");
      inFront(700);
    });
    const track = trackOfState(result.current);
    expect(track.fixes.at(-1)?.gap).toBe(true);
    expect(track.distanceM).toBeCloseTo(110, 0);
    await unmount();
  });
});
