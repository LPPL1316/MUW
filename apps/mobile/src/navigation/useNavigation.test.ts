import type { Direction, LatLon } from "@shaperoute/shared-types";
import { act, render, renderHook, screen } from "@testing-library/react-native";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { createElement } from "react";
import { Vibration } from "react-native";

import { NavigationBanner } from "../screens/NavigateScreen";
import { DEFAULT_VOICE_CHOICE, saveVoiceChoice } from "../voice/voiceChoice";
import { setVoice, skipCountdown } from "./runControl";
import { clearRun, loadRun } from "./trackStore";
import { play, useNavigation, VIBRATE_MS } from "./useNavigation";

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

test("with the voice off, a turn still vibrates but nothing is said", () => {
  const vibrate = jest.spyOn(Vibration, "vibrate").mockImplementation(() => {});
  vibrate.mockClear();
  jest.mocked(Speech.speak).mockClear();
  setVoice(false);
  play([{ say: "In 50 metres, turn left onto Via Verdi", vibrate: true }]);
  setVoice(true);
  expect(Speech.speak).not.toHaveBeenCalled();
  expect(vibrate).toHaveBeenCalledWith(VIBRATE_MS);
  jest.mocked(Speech.speak).mockClear();
  vibrate.mockClear();
});

test("each cue is said in English, and a turn also vibrates", () => {
  const vibrate = jest.spyOn(Vibration, "vibrate").mockImplementation(() => {});
  play([
    { say: "Head out on Via Roma", vibrate: false },
    { say: "In 50 metres, turn left onto Via Verdi", vibrate: true },
  ]);
  expect(Speech.speak).toHaveBeenNthCalledWith(1, "Head out on Via Roma", {
    language: "en-US",
  });
  expect(Speech.speak).toHaveBeenNthCalledWith(
    2,
    "In 50 metres, turn left onto Via Verdi",
    { language: "en-US" },
  );
  expect(vibrate).toHaveBeenCalledTimes(1);
  expect(vibrate).toHaveBeenCalledWith(VIBRATE_MS);
});

test("the fixes of a navigation are the track of the run, kept on the phone", async () => {
  const start: LatLon = [46.0122, 11.2986];
  const metre = 1 / 111_195;
  const route: LatLon[] = [start, [start[0] + 1000 * metre, start[1]]];
  // The same array at every render: a new one would start navigation again.
  const NO_DIRECTIONS: Direction[] = [];
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
  const position = (northM: number, seconds: number, accuracy: number) =>
    ({
      coords: { latitude: start[0] + northM * metre, longitude: start[1], accuracy },
      timestamp: seconds * 1000,
    }) as Location.LocationObject;

  const { result, unmount } = await renderHook(() =>
    useNavigation(route, NO_DIRECTIONS, true),
  );
  await act(async () => {
    // The countdown is over (TASK-169): every fix is of the run.
    skipCountdown();
    onPosition(position(0, 0, 5));
    onPosition(position(10, 4, 5));
    onPosition(position(20, 8, 90));
    onPosition(position(30, 12, 5));
  });
  // The screen has the same track, for the numbers of the run (TASK-164).
  const state = result.current;
  expect(state.status).toBe("following");
  if (state.status === "following") {
    expect(state.track.fixes.map((fix) => fix.timeMs)).toEqual([0, 4000, 12_000]);
    expect(state.track.distanceM).toBeCloseTo(30, 0);
  }
  await unmount();

  const run = loadRun();
  expect(run?.status).toBe("stopped");
  expect(run?.route).toEqual(route);
  expect(run?.track.fixes.map((fix) => fix.timeMs)).toEqual([0, 4000, 12_000]);
  expect(run?.track.distanceM).toBeCloseTo(30, 0);
});

test("along a route too, the voice says each kilometre (TASK-169)", async () => {
  clearRun();
  const start: LatLon = [46.0122, 11.2986];
  const metre = 1 / 111_195;
  const route: LatLon[] = [start, [start[0] + 3000 * metre, start[1]]];
  const NO_DIRECTIONS: Direction[] = [];
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
  const position = (northM: number, seconds: number) =>
    ({
      coords: { latitude: start[0] + northM * metre, longitude: start[1], accuracy: 5 },
      timestamp: seconds * 1000,
    }) as Location.LocationObject;

  const { unmount } = await renderHook(() => useNavigation(route, NO_DIRECTIONS, true));
  await act(async () => {
    skipCountdown();
    onPosition(position(0, 0));
    onPosition(position(600, 180));
  });
  const said = () => jest.mocked(Speech.speak).mock.calls.map(([text]) => text);
  expect(said().filter((text) => text.includes("kilometre."))).toHaveLength(0);
  await act(async () => {
    onPosition(position(1005, 300));
  });
  expect(said()).toContain(
    "1 kilometre. Time: 5 minutes. Average pace: 4 minutes 59 seconds per kilometre.",
  );
  await unmount();
});

test("along a route too, each kilometre is compared with the one before (TASK-217)", async () => {
  clearRun();
  jest.mocked(Speech.speak).mockClear();
  const start: LatLon = [46.0122, 11.2986];
  const metre = 1 / 111_195;
  const route: LatLon[] = [start, [start[0] + 4000 * metre, start[1]]];
  const NO_DIRECTIONS: Direction[] = [];
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
  const position = (northM: number, seconds: number) =>
    ({
      coords: { latitude: start[0] + northM * metre, longitude: start[1], accuracy: 5 },
      timestamp: seconds * 1000,
    }) as Location.LocationObject;

  const { unmount } = await renderHook(() => useNavigation(route, NO_DIRECTIONS, true));
  // 5:00, then 5:08, then 5:07: slower, then the same pace.
  await act(async () => {
    skipCountdown();
    for (let m = 0; m <= 1000; m += 50) {
      onPosition(position(m, m * 0.3));
    }
    for (let m = 1050; m <= 2000; m += 50) {
      onPosition(position(m, 300 + (m - 1000) * 0.308));
    }
    for (let m = 2050; m <= 3050; m += 50) {
      onPosition(position(m, 608 + (m - 2000) * 0.307));
    }
  });
  const said = jest.mocked(Speech.speak).mock.calls.map(([text]) => text);
  expect(said.filter((text) => /kilometre/.test(text))).toEqual([
    expect.stringMatching(/^1 kilometre\. /),
    expect.stringMatching(/^2 kilometres\. /),
    "8 seconds slower than the last kilometre.",
    expect.stringMatching(/^3 kilometres\. /),
    "Same pace as the last kilometre.",
  ]);
  await unmount();
});

test("the voice speaks the language chosen for it; the banner stays the app's (TASK-209)", async () => {
  clearRun();
  saveVoiceChoice({ language: "it", voices: {} });
  jest.mocked(Speech.speak).mockClear();
  const start: LatLon = [46.0122, 11.2986];
  const metre = 1 / 111_195;
  const route: LatLon[] = [start, [start[0] + 1000 * metre, start[1]]];
  const turn = (distance_m: number, change: Partial<Direction>): Direction => ({
    node: distance_m,
    point: [start[0] + distance_m * metre, start[1]],
    distance_m,
    turn: "left",
    angle_deg: -90,
    street: null,
    road_type: null,
    branches: 3,
    joined: false,
    along: null,
    ...change,
  });
  const directions = [
    turn(0, { turn: "depart", street: "Via Roma" }),
    turn(300, { street: "Via Verdi" }),
    turn(600, { turn: "right", road_type: "path" }),
  ];
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
  const position = (northM: number, seconds: number) =>
    ({
      coords: { latitude: start[0] + northM * metre, longitude: start[1], accuracy: 5 },
      timestamp: seconds * 1000,
    }) as Location.LocationObject;

  const { result, unmount } = await renderHook(() =>
    useNavigation(route, directions, true),
  );
  await act(async () => {
    skipCountdown();
    onPosition(position(0, 0));
    onPosition(position(255, 80));
  });
  expect(jest.mocked(Speech.speak).mock.calls).toEqual([
    ["Parti lungo Via Roma", { language: "it-IT" }],
    ["Tra 50 metri, svolta a sinistra su Via Verdi", { language: "it-IT" }],
  ]);
  // The banner is the screen's, in the app's language: English.
  await render(createElement(NavigationBanner, { state: result.current }));
  expect(screen.getByText("Turn left onto Via Verdi")).toBeOnTheScreen();

  // A change on «Data» is heard from the next words on.
  saveVoiceChoice({ language: "de", voices: {} });
  await act(async () => {
    onPosition(position(560, 170));
  });
  expect(jest.mocked(Speech.speak).mock.calls.at(-1)).toEqual([
    "In 40 Metern rechts abbiegen auf den Pfad",
    { language: "de-DE" },
  ]);
  await unmount();
  saveVoiceChoice(DEFAULT_VOICE_CHOICE);
});

test("the phone refusing the position altogether is a denial, not a crash (TASK-253)", async () => {
  const start: LatLon = [46.0122, 11.2986];
  const route: LatLon[] = [start, [start[0] + 0.01, start[1]]];
  const NO_DIRECTIONS: Direction[] = [];
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest
    .mocked(Location.watchPositionAsync)
    .mockRejectedValue(new Error("Location services are disabled"));
  const { result, unmount } = await renderHook(() =>
    useNavigation(route, NO_DIRECTIONS, true),
  );
  await act(async () => {});
  expect(result.current).toEqual({ status: "denied" });
  await unmount();
});

/** A direction to build others from. */
const DEPART: Direction = {
  node: 0,
  point: [46.0122, 11.2986],
  distance_m: 0,
  turn: "depart",
  angle_deg: 0,
  street: "Via Roma",
  road_type: "residential",
  branches: 3,
  joined: false,
};

test("a run that goes on does not head out again, and says the turn ahead (TASK-253)", async () => {
  const start: LatLon = [46.0122, 11.2986];
  const metre = 1 / 111_195;
  const north = (m: number): LatLon => [start[0] + m * metre, start[1]];
  const route: LatLon[] = Array.from({ length: 21 }, (_, i) => north(100 * i));
  const directions: Direction[] = [
    { ...DEPART, point: north(0) },
    {
      ...DEPART,
      point: north(600),
      distance_m: 600,
      node: 6,
      turn: "left",
      street: "Via Verdi",
    },
    {
      ...DEPART,
      point: north(1400),
      distance_m: 1400,
      node: 14,
      turn: "right",
      street: "Via Bianchi",
    },
  ];
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
  // Now, as the phone has it: a run goes on only when stopped lately.
  const began = Date.now();
  const position = (m: number, seconds: number) =>
    ({
      coords: { latitude: start[0] + m * metre, longitude: start[1], accuracy: 5 },
      timestamp: began + seconds * 1000,
    }) as Location.LocationObject;
  jest.mocked(Speech.speak).mockClear();
  clearRun();

  // To 1 km, then «Stop».
  const first = await renderHook(() => useNavigation(route, directions, true));
  await act(async () => {
    skipCountdown();
    for (let m = 0; m <= 1000; m += 20) {
      onPosition(position(m, m / 3));
    }
  });
  await first.unmount();
  expect(loadRun()?.status).toBe("stopped");
  const saidBefore = jest.mocked(Speech.speak).mock.calls.map(([words]) => words);
  expect(saidBefore[0]).toBe("Head out on Via Roma");
  expect(saidBefore).toContainEqual(expect.stringMatching(/turn left onto Via Verdi/));

  // «Keep running», a minute later: on with the track, and the navigation.
  jest.mocked(Speech.speak).mockClear();
  const again = await renderHook(() => useNavigation(route, directions, true));
  await act(async () => {
    skipCountdown();
    for (let m = 1020; m <= 1400; m += 20) {
      onPosition(position(m, 60 + m / 3));
    }
  });
  const state = again.result.current;
  expect(state.status).toBe("following");
  if (state.status === "following") {
    expect(state.navigation.offRoute).toBe(false);
    expect(state.navigation.alongM).toBeCloseTo(1400, -1);
    expect(state.track.fixes.length).toBeGreaterThan(51);
  }
  const saidAfter = jest.mocked(Speech.speak).mock.calls.map(([words]) => words);
  expect(saidAfter).not.toContainEqual("Head out on Via Roma");
  expect(saidAfter).not.toContainEqual(expect.stringMatching(/Via Verdi/));
  expect(saidAfter).toContainEqual(
    expect.stringMatching(/turn right onto Via Bianchi/),
  );
  expect(saidAfter).not.toContainEqual("You are off the route. Head back to it.");
  await again.unmount();
});

test("a closed shape starts where it is reached, and goes on from there (TASK-273)", async () => {
  // A block 400 m a side, clockwise from its south-west corner: north on
  // Via Roma, east on Via Verdi, south on Via Bianchi, west on Via Neri.
  const corner: LatLon = [46.0122, 11.2986];
  const metreLat = 1 / 111_195;
  const metreLon = metreLat / Math.cos((corner[0] * Math.PI) / 180);
  const at = (x: number, y: number): LatLon => [
    corner[0] + y * metreLat,
    corner[1] + x * metreLon,
  ];
  const onBlock = (m: number): LatLon => {
    const s = ((m % 1600) + 1600) % 1600;
    if (s <= 400) return at(0, s);
    if (s <= 800) return at(s - 400, 400);
    if (s <= 1200) return at(400, 1200 - s);
    return at(1600 - s, 0);
  };
  const route: LatLon[] = Array.from({ length: 17 }, (_, i) => onBlock(100 * i));
  route[16] = route[0];
  const turn = (distance_m: number, street: string): Direction => ({
    ...DEPART,
    point: onBlock(distance_m),
    distance_m,
    node: distance_m,
    turn: "right",
    angle_deg: 90,
    street,
  });
  const directions: Direction[] = [
    { ...DEPART, point: corner },
    turn(400, "Via Verdi"),
    turn(800, "Via Bianchi"),
    turn(1200, "Via Neri"),
  ];
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
  const position = (m: number, seconds: number) => {
    const [latitude, longitude] = onBlock(m);
    return {
      coords: { latitude, longitude, accuracy: 5 },
      timestamp: began + seconds * 1000,
    } as Location.LocationObject;
  };
  jest.mocked(Speech.speak).mockClear();
  clearRun();

  // «Start» half-way down Via Bianchi, at 1000 m; on to 1300 m, then «Stop».
  const first = await renderHook(() => useNavigation(route, directions, true));
  await act(async () => {
    skipCountdown();
  });
  expect(Speech.speak).not.toHaveBeenCalled();
  await act(async () => {
    for (let m = 1000; m <= 1300; m += 20) {
      onPosition(position(m, m / 3));
    }
  });
  const running = first.result.current;
  expect(running.status).toBe("following");
  if (running.status === "following") {
    expect(running.navigation.joinedAtM).toBeCloseTo(1000, -1);
    expect(running.navigation.alongM).toBeCloseTo(300, -1);
  }
  await first.unmount();
  const saidBefore = jest.mocked(Speech.speak).mock.calls.map(([words]) => words);
  expect(saidBefore[0]).toBe("Head out on Via Bianchi");
  expect(saidBefore).toContainEqual(expect.stringMatching(/turn right onto Via Neri/));

  // «Keep running»: from where it joined, past the route's start.
  jest.mocked(Speech.speak).mockClear();
  const again = await renderHook(() => useNavigation(route, directions, true));
  await act(async () => {
    skipCountdown();
    for (let m = 1320; m <= 1700; m += 20) {
      onPosition(position(m, 60 + m / 3));
    }
  });
  const state = again.result.current;
  expect(state.status).toBe("following");
  if (state.status === "following") {
    expect(state.navigation.joinedAtM).toBeCloseTo(1000, -1);
    expect(state.navigation.alongM).toBeCloseTo(700, -1);
    expect(state.navigation.arrived).toBe(false);
  }
  const saidAfter = jest.mocked(Speech.speak).mock.calls.map(([words]) => words);
  expect(saidAfter).not.toContainEqual(expect.stringMatching(/Head out/));
  expect(saidAfter).not.toContainEqual(expect.stringMatching(/Via Neri/));
  // The turn at the route's own start, of which the engine says nothing.
  expect(saidAfter).toContainEqual(expect.stringMatching(/turn right onto Via Roma/));
  expect(saidAfter).not.toContainEqual("You are off the route. Head back to it.");
  await again.unmount();
});
