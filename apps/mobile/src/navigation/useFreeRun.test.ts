import type { LatLon } from "@shaperoute/shared-types";
import { act, renderHook } from "@testing-library/react-native";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { AppState, type AppStateStatus } from "react-native";

import { DEFAULT_VOICE_CHOICE, saveVoiceChoice } from "../voice/voiceChoice";
import { FREE_ROUTE } from "./freeRun";
import { pauseRun, resumeRun, runControl, setVoice, skipCountdown } from "./runControl";
import { clearRun, loadRun, saveRun } from "./trackStore";
import { useFreeRun } from "./useFreeRun";

jest.mock("expo-speech", () => ({ speak: jest.fn(), stop: jest.fn() }));
jest.mock("expo-location", () => ({
  Accuracy: { BestForNavigation: 6 },
  requestForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
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

function position(northM: number, seconds: number, accuracy: number) {
  return {
    coords: { latitude: START[0] + northM * METRE, longitude: START[1], accuracy },
    timestamp: seconds * 1000,
  } as Location.LocationObject;
}

function permission(granted: boolean) {
  return { granted } as Location.LocationPermissionResponse;
}

test("the fixes of a free run are its track, kept on the phone with no route", async () => {
  let onPosition: (position: Location.LocationObject) => void = () => {};
  const remove = jest.fn();
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue(permission(true));
  jest
    .mocked(Location.watchPositionAsync)
    .mockImplementation(async (_options, callback) => {
      onPosition = callback;
      return { remove };
    });

  const { result, unmount } = await renderHook(() => useFreeRun(true));
  expect(result.current).toEqual({
    status: "running",
    track: { fixes: [], distanceM: 0 },
    position: null,
  });
  // A new run begins with the countdown (TASK-169).
  expect(runControl().phase).toBe("countdown");
  await act(async () => {
    skipCountdown();
    onPosition(position(0, 0, 5));
    onPosition(position(10, 4, 5));
    onPosition(position(20, 8, 90));
    onPosition(position(30, 12, 5));
  });
  const state = result.current;
  expect(state.status).toBe("running");
  if (state.status === "running") {
    // The fix 90 m wrong is left out of the line; the map follows the last.
    expect(state.track.fixes.map((fix) => fix.timeMs)).toEqual([0, 4000, 12_000]);
    expect(state.track.distanceM).toBeCloseTo(30, 0);
    expect(state.position).toEqual([START[0] + 30 * METRE, START[1]]);
  }
  await unmount();

  expect(remove).toHaveBeenCalled();
  const run = loadRun();
  expect(run?.route).toEqual([]);
  expect(run?.status).toBe("stopped");
  expect(run?.similarity).toBeUndefined();
  expect(run?.track.fixes).toHaveLength(3);
});

test("without the permission nothing is recorded", async () => {
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue(permission(false));
  jest.mocked(Location.watchPositionAsync).mockClear();
  const { result } = await renderHook(() => useFreeRun(true));
  expect(result.current).toEqual({ status: "denied" });
  expect(Location.watchPositionAsync).not.toHaveBeenCalled();
});

test("not active, it does not ask for the GPS", async () => {
  jest.mocked(Location.requestForegroundPermissionsAsync).mockClear();
  const { result } = await renderHook(() => useFreeRun(false));
  expect(result.current).toEqual({ status: "starting" });
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
});

/** Positions as the GPS gives them, to the hook running in the test. */
async function runningHook() {
  let onPosition: (position: Location.LocationObject) => void = () => {};
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue(permission(true));
  jest
    .mocked(Location.watchPositionAsync)
    .mockImplementation(async (_options, callback) => {
      onPosition = callback;
      return { remove: jest.fn() };
    });
  const hook = await renderHook(() => useFreeRun(true));
  // The countdown is over: every fix is of the run.
  await act(async () => skipCountdown());
  return { ...hook, at: (position: Location.LocationObject) => onPosition(position) };
}

test("the voice says each kilometre once, as it is passed", async () => {
  clearRun();
  jest.mocked(Speech.speak).mockClear();
  const { at, unmount } = await runningHook();
  await act(async () => {
    at(position(0, 0, 5));
    at(position(600, 180, 5));
    at(position(990, 297, 5));
  });
  expect(Speech.speak).not.toHaveBeenCalled();
  await act(async () => {
    at(position(1005, 300, 5));
    at(position(1400, 420, 5));
  });
  expect(Speech.speak).toHaveBeenCalledTimes(1);
  expect(Speech.speak).toHaveBeenCalledWith(
    "1 kilometre. Time: 5 minutes. Average pace: 4 minutes 59 seconds per kilometre.",
    { language: "en-US" },
  );
  await act(async () => {
    at(position(2001, 600, 5));
  });
  // The second kilometre, and how it went against the first (TASK-217).
  expect(Speech.speak).toHaveBeenCalledTimes(3);
  expect(jest.mocked(Speech.speak).mock.calls[1][0]).toMatch(/^2 kilometres\. /);
  expect(jest.mocked(Speech.speak).mock.calls[2][0]).toBe(
    "Same pace as the last kilometre.",
  );
  await unmount();
  expect(Speech.stop).toHaveBeenCalled();
});

test("from the second kilometre the voice says how it went against the one before (TASK-217)", async () => {
  clearRun();
  jest.mocked(Speech.speak).mockClear();
  const { at, unmount } = await runningHook();
  const said = () => jest.mocked(Speech.speak).mock.calls.map(([text]) => text);
  // The first kilometre in 5:00: nothing to compare it with.
  await act(async () => {
    for (let m = 0; m <= 1050; m += 50) {
      at(position(m, m * 0.3, 5));
    }
  });
  expect(said()).toEqual([expect.stringMatching(/^1 kilometre\. /)]);
  // The second in 4:48, the third in 4:56.
  await act(async () => {
    for (let m = 1100; m <= 2000; m += 50) {
      at(position(m, 300 + (m - 1000) * 0.288, 5));
    }
    for (let m = 2050; m <= 3050; m += 50) {
      at(position(m, 588 + (m - 2000) * 0.296, 5));
    }
  });
  expect(said().slice(1)).toEqual([
    expect.stringMatching(/^2 kilometres\. /),
    "12 seconds faster than the last kilometre.",
    expect.stringMatching(/^3 kilometres\. /),
    "8 seconds slower than the last kilometre.",
  ]);
  await unmount();
});

test("the comparison is said in the voice's language (TASK-217)", async () => {
  clearRun();
  saveVoiceChoice({ language: "it", voices: {} });
  jest.mocked(Speech.speak).mockClear();
  const { at, unmount } = await runningHook();
  await act(async () => {
    for (let m = 0; m <= 1000; m += 50) {
      at(position(m, m * 0.3, 5));
    }
    for (let m = 1050; m <= 2050; m += 50) {
      at(position(m, 300 + (m - 1000) * 0.288, 5));
    }
  });
  expect(jest.mocked(Speech.speak).mock.calls.at(-1)).toEqual([
    "Questo chilometro: 12 secondi meglio del precedente.",
    { language: "it-IT" },
  ]);
  await unmount();
  saveVoiceChoice(DEFAULT_VOICE_CHOICE);
});

test("a run that goes on does not say again the kilometres it has said", async () => {
  const now = Date.now();
  const fixAt = (northM: number, ago: number) => ({
    point: [START[0] + northM * METRE, START[1]] as LatLon,
    timeMs: now - ago,
    accuracyM: 5,
  });
  saveRun({
    version: 1,
    route: FREE_ROUTE,
    track: { fixes: [fixAt(0, 600_000), fixAt(1500, 60_000)], distanceM: 1500 },
    status: "stopped",
  });
  jest.mocked(Speech.speak).mockClear();
  const { at, unmount } = await runningHook();
  await act(async () => {
    at(position(1600, (now + 20_000) / 1000, 5));
  });
  expect(Speech.speak).not.toHaveBeenCalled();
  await act(async () => {
    // The first fix after the run was left is not joined to the line.
    at(position(2110, (now + 160_000) / 1000, 5));
  });
  // The second kilometre once, with its comparison (TASK-217): the first is
  // not said again.
  expect(Speech.speak).toHaveBeenCalledTimes(2);
  expect(jest.mocked(Speech.speak).mock.calls[0][0]).toMatch(/^2 kilometres\. /);
  expect(jest.mocked(Speech.speak).mock.calls[1][0]).toMatch(
    /(faster|slower) than the last kilometre\.$/,
  );
  await unmount();
});

test("Pause and Resume reach the screen at once, between two fixes", async () => {
  clearRun();
  const { result, at, unmount } = await runningHook();
  const now = Date.now();
  await act(async () => {
    at(position(0, (now - 30_000) / 1000, 5));
    at(position(100, now / 1000, 5));
  });
  await act(async () => pauseRun());
  const paused = result.current;
  expect(paused.status === "running" && paused.track.pauses).toHaveLength(1);
  await act(async () => {
    at(position(160, (now + 20_000) / 1000, 5));
  });
  // Paused: the map still follows the runner, the line does not grow.
  const still = result.current;
  expect(still.status === "running" && still.track.fixes).toHaveLength(2);
  expect(still.status === "running" && still.position).toEqual([
    START[0] + 160 * METRE,
    START[1],
  ]);
  await act(async () => resumeRun());
  const resumed = result.current;
  expect(resumed.status === "running" && resumed.track.pauses?.[0].toMs).not.toBeNull();
  await unmount();
  expect(runControl().phase).toBe("idle");
});

test("the height the phone gives is kept with each fix", async () => {
  clearRun();
  const { result, at, unmount } = await runningHook();
  await act(async () => {
    at({
      coords: { latitude: START[0], longitude: START[1], accuracy: 5, altitude: 512.5 },
      timestamp: 1000,
    } as Location.LocationObject);
  });
  const state = result.current;
  expect(state.status === "running" && state.track.fixes[0].altitudeM).toBe(512.5);
  await unmount();
});

test("with the voice off, a kilometre is not said", async () => {
  clearRun();
  jest.mocked(Speech.speak).mockClear();
  setVoice(false);
  const { at, unmount } = await runningHook();
  await act(async () => {
    at(position(0, 0, 5));
    at(position(1005, 300, 5));
  });
  expect(Speech.speak).not.toHaveBeenCalled();
  setVoice(true);
  await unmount();
});

test("during the countdown the map follows the runner and the track waits", async () => {
  clearRun();
  let onPosition: (position: Location.LocationObject) => void = () => {};
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue(permission(true));
  jest
    .mocked(Location.watchPositionAsync)
    .mockImplementation(async (_options, callback) => {
      onPosition = callback;
      return { remove: jest.fn() };
    });
  const { result, unmount } = await renderHook(() => useFreeRun(true));
  const before = Date.now();
  await act(async () => {
    onPosition(position(20, 1, 5));
  });
  expect(result.current).toMatchObject({
    track: { fixes: [] },
    position: [START[0] + 20 * METRE, START[1]],
  });
  // At its end the run starts there, then: the screen has its first fix.
  await act(async () => skipCountdown());
  const state = result.current;
  expect(state.status === "running" && state.track.fixes).toHaveLength(1);
  if (state.status === "running") {
    expect(state.track.fixes[0].point).toEqual([START[0] + 20 * METRE, START[1]]);
    expect(state.track.fixes[0].timeMs).toBeGreaterThanOrEqual(before);
  }
  await unmount();
});

test("the app behind another, or the phone locked, pauses the run until the next fix (TASK-255)", async () => {
  let appState: (next: AppStateStatus) => void = () => {};
  const removeAppState = jest.fn();
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    appState = listener;
    return { remove: removeAppState };
  });
  const start: LatLon = [46.0122, 11.2986];
  const metre = 1 / 111_195;
  let onPosition: (position: Location.LocationObject) => void = () => {};
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest
    .mocked(Location.watchPositionAsync)
    .mockImplementation(async (_options, callback) => {
      onPosition = callback;
      return { remove: jest.fn() };
    });
  const began = Date.now();
  const position = (northM: number, seconds: number) =>
    ({
      coords: { latitude: start[0] + northM * metre, longitude: start[1], accuracy: 5 },
      timestamp: began + seconds * 1000,
    }) as Location.LocationObject;
  jest.spyOn(Date, "now").mockImplementation(() => began + 40_000);

  const { result, unmount } = await renderHook(() => useFreeRun(true));
  await act(async () => {
    skipCountdown();
    onPosition(position(0, 0));
    onPosition(position(100, 30));
    // A change of song: back within AWAY_AFTER_MS, the line goes on as before.
    appState("background");
    appState("active");
    onPosition(position(200, 50));
    // The phone locks; a quarter of an hour later the app is back, 300 m
    // on: longer than AWAY_AFTER_MS (ADR-0264).
    appState("background");
    appState("active");
    onPosition(position(500, 950));
    onPosition(position(600, 980));
  });
  const state = result.current;
  expect(state.status).toBe("running");
  if (state.status === "running") {
    expect(state.track.fixes.map((fix) => fix.gap ?? false)).toEqual([
      false,
      false,
      false,
      true,
      false,
    ]);
    expect(state.track.distanceM).toBeCloseTo(300, 0);
    expect(state.track.pauses).toEqual([
      // Never before the last fix (50 s in).
      { fromMs: began + 50_000, toMs: began + 950_000, away: true },
    ]);
  }
  await unmount();
  expect(removeAppState).toHaveBeenCalled();
  jest.restoreAllMocks();
});
