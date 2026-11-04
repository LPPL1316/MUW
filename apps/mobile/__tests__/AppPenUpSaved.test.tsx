/**
 * A word with the pen up kept in «My activities» and in «Favorites»
 * (TASK-199): a saved run opens with its walks dashed, as at the end of the
 * run; a favorite opens, starts and pauses at the end of each letter as a
 * word just drawn does (TASK-198), and the run along it is saved with its
 * walks and the pen of its pauses. The pieces alone are in
 * src/activities/recordedRun.test.ts, src/favorites/favoriteRoute.test.ts
 * and src/favorites/favoritePenUpRun.test.ts.
 */
import activities from "@shaperoute/shared-types/fixtures/activities.json";
import walkedActivity from "@shaperoute/shared-types/fixtures/activity-walks.json";
import activity from "@shaperoute/shared-types/fixtures/activity.json";
import directions from "@shaperoute/shared-types/fixtures/route-directions.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import trackScore from "@shaperoute/shared-types/fixtures/track-score.json";
import type { LatLon } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { Vibration } from "react-native";

import App from "../App";
import { apiError, type MemorySecureStore } from "../src/account/testing";
import { saveOutbox } from "../src/activities/outbox";
import type { FavoriteDetail } from "../src/api/favorites";
import { skipCountdown } from "../src/navigation/runControl";
import { clearRun } from "../src/navigation/trackStore";

jest.mock("react-native-webview");
jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: "192.168.1.23:8081" } },
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
jest.mock("expo-secure-store", () =>
  jest
    .requireActual<typeof import("../src/account/testing")>("../src/account/testing")
    .memorySecureStore(),
);

const { injectJavaScript } =
  jest.requireMock<typeof import("../__mocks__/react-native-webview")>(
    "react-native-webview",
  );
const store = jest.requireMock<MemorySecureStore>("expo-secure-store");
const API = "http://192.168.1.23:8000";
const SESSION_KEY = "shaperoute.session";

/** «SUN», north in a line from where the phone is: S from 0 to 300 m, a
 * walk to 500 m, U to 800 m, a walk to 1000 m, N to 1300 m. */
const START: LatLon = [46.067, 11.1215];
const METRE = 1 / 111_195;
const POINTS: LatLon[] = [
  0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300,
].map((m) => [START[0] + m * METRE, START[1]]);
const WALKS = [
  [3, 5],
  [8, 10],
];
const SUN: FavoriteDetail = {
  id: "5a0b1c2d3e4f5061",
  city: "",
  shape: null,
  word: "SUN",
  style: "round",
  title: null,
  distance_m: 1000,
  route_m: 1300,
  similarity: 0.9,
  points: POINTS,
  created_at: "2026-10-02T06:00:00Z",
  walks: [
    [3, 5],
    [8, 10],
  ],
};
const { points: _points, walks: _walks, ...sunFields } = SUN;
const SUN_LISTED = { ...sunFields, start: START, preview: POINTS };
/** Where the route begins: Start asks for its directions. */
const DIRECTIONS = {
  directions: [{ ...directions.directions[0], node: 0, point: START }],
};

/** The run of «II» with the pen up, and a star of before TASK-199. */
const [STAR_LISTED] = activities.activities;
const II_LISTED = {
  ...STAR_LISTED,
  id: walkedActivity.id,
  shape: null,
  word: "II",
  style: "block",
};
const STAR = { ...activity, id: "0f1e2d3c4b5a6978" };

/** When the run begins, on the clock the test moves by hand. */
const BEGAN = Date.UTC(2026, 9, 2, 7, 0, 0);

let fetchSpy: jest.SpiedFunction<typeof fetch>;
let onPosition: (position: Location.LocationObject) => void = () => {};

type Answers = Record<string, () => Response>;

/** The fake API, by method and path; any run is saved as «II» is listed. */
function api(answers: Answers) {
  fetchSpy.mockImplementation(async (input, init) => {
    const path = String(input).replace(API, "");
    const method = init?.method ?? "GET";
    const answer = answers[`${method} ${path}`];
    if (answer !== undefined) {
      return answer();
    }
    if (method === "PUT" && path.startsWith("/me/activities/")) {
      return Response.json(
        { ...II_LISTED, id: path.split("/").at(-1) },
        { status: 201 },
      );
    }
    return Response.json(apiError("http_error", path), { status: 404 });
  });
}

function bodies(method: string, prefix: string): unknown[] {
  return fetchSpy.mock.calls
    .filter(
      ([input, init]) =>
        String(input).startsWith(`${API}${prefix}`) &&
        (init?.method ?? "GET") === method,
    )
    .map(([, init]) => JSON.parse(String(init?.body)));
}

function lastShown(): string {
  return (
    injectJavaScript.mock.calls
      .map(([script]) => String(script))
      .findLast((script) => script.includes('"type":"showRoute"')) ?? ""
  );
}

/** Runs from `fromM` to `toM` along the route, a fix every 20 m, at 3.3 m a
 * second from BEGAN. */
function runTo(fromM: number, toM: number) {
  for (let m = fromM; m <= toM; m += 20) {
    onPosition({
      coords: {
        latitude: START[0] + m * METRE,
        longitude: START[1],
        accuracy: 5,
        altitude: null,
      },
      timestamp: BEGAN + m * 300,
    } as Location.LocationObject);
  }
}

async function open() {
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
}

jest.spyOn(Vibration, "vibrate").mockImplementation(() => {});

beforeEach(() => {
  store.kept.clear();
  store.kept.set(SESSION_KEY, JSON.stringify(session));
  clearRun();
  saveOutbox([]);
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
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  fetchSpy.mockRestore();
});

test("a saved run with walks opens with them dashed; one of before as one line", async () => {
  api({
    "GET /me": () => Response.json(session.user),
    "GET /me/favorites": () => Response.json({ favorites: [] }),
    "GET /me/activities": () =>
      Response.json({
        activities: [II_LISTED, { ...STAR_LISTED, id: STAR.id }],
        next: null,
        total: 2,
      }),
    [`GET /me/activities/${walkedActivity.id}`]: () => Response.json(walkedActivity),
    // From an API older than TASK-199: no walks at all.
    [`GET /me/activities/${STAR.id}`]: () => Response.json(STAR),
  });
  await open();
  await fireEvent.press(screen.getByRole("tab", { name: /^Profile/ }));
  await fireEvent.press(await screen.findByRole("button", { name: /^My activities/ }));

  await fireEvent.press(
    screen.getByRole("button", { name: /· II, .*open on the map$/ }),
  );
  expect(await screen.findByText("Back to the list")).toBeOnTheScreen();
  // As at the end of the run: the letters, and the walk between them apart.
  expect(lastShown()).toContain('"letters":[[');
  expect(lastShown()).toContain('"walks":[[');

  await fireEvent.press(screen.getByText("Back to the list"));
  await fireEvent.press(
    screen.getByRole("button", { name: /· Star, .*open on the map$/ }),
  );
  expect(await screen.findByText("Back to the list")).toBeOnTheScreen();
  await waitFor(() =>
    expect(lastShown()).toContain('"coordinates":[[11.1214,46.0671]'),
  );
  expect(lastShown()).not.toContain('"walks"');
});

test("a favorite with the pen up starts with its walks, pauses at a letter's end, and is saved with them", async () => {
  jest.useFakeTimers({ now: BEGAN });
  try {
    api({
      "GET /me": () => Response.json(session.user),
      "GET /me/favorites": () => Response.json({ favorites: [SUN_LISTED] }),
      [`GET /me/favorites/${SUN.id}`]: () => Response.json(SUN),
      "GET /me/activities": () =>
        Response.json({ activities: [], next: null, total: 0 }),
      "POST /route-directions": () => Response.json(DIRECTIONS),
      "POST /track-scores": () => Response.json(trackScore),
    });
    await open();
    await fireEvent.press(screen.getByRole("tab", { name: /^Profile/ }));
    await fireEvent.press(await screen.findByRole("button", { name: "Favorites, 1" }));
    await fireEvent.press(
      screen.getByRole("button", { name: "SUN · 1.3 km, open on the map" }),
    );
    expect(await screen.findByText("Back to the list")).toBeOnTheScreen();
    // On the map as the word just drawn: its walks dashed.
    expect(lastShown()).toContain('"walks":[[');

    await fireEvent.press(screen.getByText("Start"));
    await screen.findByText("Stop");
    await act(async () => {
      skipCountdown();
      runTo(0, 360);
    });
    // The end of the S: paused by the pen, and said.
    expect(Speech.speak).toHaveBeenCalledWith(
      "Letter done. Walk to the U: the drawing is paused.",
      expect.anything(),
    );
    await act(async () => {
      runTo(380, 600);
    });
    expect(Speech.speak).toHaveBeenCalledWith(
      "Pen down: draw the U.",
      expect.anything(),
    );

    await fireEvent.press(screen.getByLabelText("Pause"));
    await fireEvent(screen.getByLabelText("Stop"), "longPress");
    await screen.findByText("Your run");
    // The end of a run asks for no score (TASK-241): the walks go with
    // «Save», and the API scores the letters alone by itself.
    expect(bodies("POST", "/track-scores")).toHaveLength(0);

    await fireEvent.press(
      screen.getByRole("button", { name: "Save to My activities" }),
    );
    await waitFor(() => expect(bodies("PUT", "/me/activities/")).toHaveLength(1));
    const saved = bodies("PUT", "/me/activities/")[0] as {
      walks?: unknown;
      word: string;
      pauses: { pen?: boolean; auto: boolean; from_ms: number; to_ms: number }[];
    };
    expect(saved.walks).toEqual(WALKS);
    expect(saved.word).toBe("SUN");
    // The walk after the S, a pause of the pen's.
    expect(saved.pauses[0]).toEqual({
      from_ms: BEGAN + 300 * 300,
      to_ms: BEGAN + 480 * 300,
      auto: false,
      pen: true,
    });
  } finally {
    jest.useRealTimers();
  }
});
