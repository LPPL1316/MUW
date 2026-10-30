/**
 * A swim (TASK-323 D, the user's choice): positions simulated along a route
 * and without one, through the navigation as the run screen uses it. With
 * the head in the water nobody hears the phone: nothing is said, no
 * kilometre, no pause; standing still pauses after 30 s, not 10. The
 * paddle's is in paddleRun.test.ts.
 */
import type { Activity, Direction, LatLon, Walk } from "@shaperoute/shared-types";
import { act, renderHook } from "@testing-library/react-native";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { Vibration } from "react-native";

import { runControl, skipCountdown } from "./runControl";
import { loadSport } from "../settings/sport";
import { clearRun, loadRun } from "./trackStore";
import { useFreeRun } from "./useFreeRun";
import { useNavigation } from "./useNavigation";

jest.mock("expo-speech", () => ({ speak: jest.fn(), stop: jest.fn() }));
// «Open water swim» chosen, though no phone can choose it yet («Soon»).
jest.mock("../settings/sport", () => ({
  ...jest.requireActual<typeof import("../settings/sport")>("../settings/sport"),
  loadSport: jest.fn(),
}));
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

// Along the beach of Riccione, in the band.
const START: LatLon = [44.0, 12.65];
/** A metre north in degrees, a little over (the app's Earth is 6,371 km):
 * a fix at 1,000 m has swum 1 km. */
const METRE = 1 / 111_194;
/** When each test begins, on the clock the tests move by hand. */
const BEGAN = Date.UTC(2027, 6, 14, 8, 0, 0);

/** North in a line, a point every 100 m to `metres`. */
function line(metres: number): LatLon[] {
  return Array.from({ length: metres / 100 + 1 }, (_, i) => [
    START[0] + i * 100 * METRE,
    START[1],
  ]);
}

function direction(turn: Direction["turn"], distance_m: number, street: string) {
  return {
    node: distance_m,
    point: [START[0] + distance_m * METRE, START[1]] as LatLon,
    distance_m,
    turn,
    angle_deg: 0,
    street,
    road_type: "residential",
    branches: 3,
    joined: false,
  };
}

const DIRECTIONS: Direction[] = [
  direction("depart", 0, "Via Roma"),
  direction("left", 400, "Via Verdi"),
];

let onPosition: (position: Location.LocationObject) => void = () => {};

/** Moves along at `metresPerSecond`, a fix every `everyM`, from `fromM` to
 * `toM`. */
function go(fromM: number, toM: number, metresPerSecond: number, everyM = 10) {
  for (let m = fromM; m <= toM; m += everyM) {
    onPosition({
      coords: {
        latitude: START[0] + m * METRE,
        longitude: START[1],
        accuracy: 5,
        altitude: null,
      },
      timestamp: BEGAN + Math.round((m / metresPerSecond) * 1000),
    } as Location.LocationObject);
  }
}

function said(): string[] {
  return jest.mocked(Speech.speak).mock.calls.map(([text]) => text);
}

// The cues vibrate (useNavigation.play): not in a test.
jest.spyOn(Vibration, "vibrate").mockImplementation(() => {});

beforeEach(() => {
  jest.useFakeTimers({ now: BEGAN });
  jest.mocked(loadSport).mockReturnValue("swim");
  clearRun();
  jest.mocked(Speech.speak).mockClear();
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest
    .mocked(Location.watchPositionAsync)
    .mockImplementation(async (_options, callback) => {
      onPosition = callback;
      return { remove: jest.fn() };
    });
});

afterEach(() => {
  jest.useRealTimers();
});

/** Navigation along `route`, past its countdown. */
async function follow(
  route: LatLon[],
  options: { activity?: Activity; walks?: Walk[]; word?: string },
) {
  const hook = await renderHook(() =>
    useNavigation(route, DIRECTIONS, true, 0.9, options),
  );
  // The permission and the GPS are asked for first.
  await act(async () => {});
  expect(runControl().phase).toBe("countdown");
  await act(async () => {
    skipCountdown();
  });
  return hook;
}

/** 2:00 every 100 m, in metres a second. */
const SWIMMING = 100 / 120;

test("along a route a swim says nothing: no kilometre, no pace", async () => {
  const { unmount } = await follow(line(2100), { activity: "swimming" });
  await act(async () => {
    go(0, 2100, SWIMMING);
  });
  expect(said()).toEqual([]);
  expect(loadRun()?.activity).toBe("swimming");
  await unmount();
});

test("a swim stopped to sight the shore goes on; after 30 s it pauses, silently", async () => {
  const { unmount } = await follow(line(600), { activity: "swimming" });
  await act(async () => {
    go(0, 300, SWIMMING);
  });
  // The clock at the last fix, 300 m at 2:00 every 100 m.
  jest.setSystemTime(BEGAN + 360_000);
  // 15 s treading water: a run would have paused after 10.
  await act(() => jest.advanceTimersByTimeAsync(15_000));
  expect(runControl().phase).toBe("running");
  await act(() => jest.advanceTimersByTimeAsync(20_000));
  expect(runControl()).toMatchObject({ phase: "paused", auto: true });
  // «Paused» is not said.
  expect(said()).toEqual([]);
  await unmount();
});

test("without a route, «Open water swim» says nothing either", async () => {
  const { unmount } = await renderHook(() => useFreeRun(true));
  await act(async () => {});
  await act(async () => {
    skipCountdown();
  });
  await act(async () => {
    go(0, 1200, SWIMMING);
  });
  expect(said()).toEqual([]);
  expect(loadRun()?.activity).toBe("swimming");
  await unmount();
});
