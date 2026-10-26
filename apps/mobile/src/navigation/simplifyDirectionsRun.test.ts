import type { Direction, LatLon } from "@shaperoute/shared-types";
import { act, renderHook } from "@testing-library/react-native";
import * as Location from "expo-location";
import * as Speech from "expo-speech";

import { skipCountdown } from "./runControl";
import { clearRun, loadRun } from "./trackStore";
import { useNavigation } from "./useNavigation";

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

const START: LatLon = [46.0535, 11.1238];
const METRE = 1 / 111_195;
/** Metres east and north of the start, as a position. */
function at(eastM: number, northM: number): LatLon {
  return [
    START[0] + northM * METRE,
    START[1] + (eastM * METRE) / Math.cos((START[0] * Math.PI) / 180),
  ];
}

// North along Via Roma, onto the zebra crossing to the right, the pavement
// to the left, then left along Via Verdi: one turn left on the spot.
const CORNERS: [number, number][] = [
  [0, 0],
  [0, 200],
  [10, 200],
  [10, 210],
  [-290, 210],
];
const ROUTE = CORNERS.map((corner) => at(...corner));

function turn(
  kind: Direction["turn"],
  angleDeg: number,
  distanceM: number,
  corner: number,
  street: string | null,
  joined: boolean,
): Direction {
  return {
    node: corner,
    point: ROUTE[corner],
    distance_m: distanceM,
    turn: kind,
    angle_deg: angleDeg,
    street,
    road_type: street === null ? "footway" : "residential",
    branches: 3,
    joined,
  };
}

const DIRECTIONS: Direction[] = [
  turn("depart", 0, 0, 0, "Via Roma", false),
  turn("right", 90, 200, 1, null, false),
  turn("left", -90, 210, 2, null, true),
  turn("left", -90, 220, 3, "Via Verdi", true),
];

/** Where the runner is `m` metres along the route. */
function along(m: number): [number, number] {
  let left = m;
  for (let i = 1; i < CORNERS.length; i += 1) {
    const [ax, ay] = CORNERS[i - 1];
    const [bx, by] = CORNERS[i];
    const length = Math.hypot(bx - ax, by - ay);
    if (left <= length) {
      return [ax + ((bx - ax) * left) / length, ay + ((by - ay) * left) / length];
    }
    left -= length;
  }
  return CORNERS[CORNERS.length - 1];
}

test("a junction crossed on foot is one turn, said once (TASK-302)", async () => {
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
  const position = (m: number) => {
    const [latitude, longitude] = at(...along(m));
    return {
      coords: { latitude, longitude, accuracy: 5 },
      timestamp: began + (m / 3) * 1000,
    } as Location.LocationObject;
  };
  jest.mocked(Speech.speak).mockClear();
  clearRun();

  const { result, unmount } = await renderHook(() =>
    useNavigation(ROUTE, DIRECTIONS, true),
  );
  await act(async () => {
    skipCountdown();
    for (let m = 0; m <= 400; m += 5) {
      onPosition(position(m));
    }
  });

  const said = jest.mocked(Speech.speak).mock.calls.map(([words]) => words);
  expect(said[0]).toBe("Head out on Via Roma");
  const turns = said.filter((words) => /turn|straight/i.test(words));
  expect(turns).toEqual(["In 50 metres, turn left onto Via Verdi"]);
  const state = result.current;
  expect(state.status).toBe("following");
  if (state.status === "following") {
    // The banner shows what the voice says.
    expect(state.navigation.directions.map((d) => d.turn)).toEqual(["depart", "left"]);
    expect(state.navigation.offRoute).toBe(false);
  }
  await unmount();

  // The run file keeps the engine's directions, to follow them again.
  expect(loadRun()?.directions).toEqual(DIRECTIONS);
});
