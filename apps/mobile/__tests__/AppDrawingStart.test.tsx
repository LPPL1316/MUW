/**
 * «Start» on a member's drawing (TASK-307): opened from «Feed», its track
 * is the route, followed at once without asking for directions; the run
 * saved says what the drawing draws, and the end of the run goes back to
 * the drawing, then «←» to «Feed». The card alone is in
 * src/social/DrawingCardStart.test.tsx; the track as a route and as GPX in
 * src/social/drawingRoute.test.ts.
 */
import drawing from "@shaperoute/shared-types/fixtures/drawing-details.json";
import feed from "@shaperoute/shared-types/fixtures/feed.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Location from "expo-location";
import { Vibration } from "react-native";

import App from "../App";
import { apiError, type MemorySecureStore } from "../src/account/testing";
import { saveOutbox } from "../src/activities/outbox";
import { forgetFeed } from "../src/feed/useFeed";
import { skipCountdown } from "../src/navigation/runControl";
import { clearRun } from "../src/navigation/trackStore";

// Every test renders the whole app, and the first one loads it cold.
jest.setTimeout(20_000);

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
const BEGAN = Date.UTC(2026, 9, 26, 7, 0, 0);
// Asked from where «Draw» starts: the position of the phone.
const FEED = "/feed?lat=46.07&lon=11.12";
const [[START_LAT, START_LON]] = drawing.track;
/** A metre to the east, in degrees, at the drawing's latitude. */
const METRE_EAST = 1 / (111_320 * Math.cos((START_LAT * Math.PI) / 180));

let fetchSpy: jest.SpiedFunction<typeof fetch>;
let onPosition: (position: Location.LocationObject) => void = () => {};

type Answers = Record<string, () => Response>;

/** The fake API, by method and path; anything else is a 404. */
function api(answers: Answers) {
  fetchSpy.mockImplementation(async (input, init) => {
    const path = String(input).replace(API, "");
    const method = init?.method ?? "GET";
    const answer = answers[`${method} ${path}`];
    if (answer !== undefined) {
      return answer();
    }
    if (method === "PUT" && path.startsWith("/me/activities/")) {
      return Response.json(apiError("http_error", path), { status: 500 });
    }
    return Response.json(apiError("http_error", path), { status: 404 });
  });
}

function calls(method: string, prefix: string) {
  return fetchSpy.mock.calls.filter(
    ([input, init]) =>
      String(input).startsWith(`${API}${prefix}`) && (init?.method ?? "GET") === method,
  );
}

function lastShown(): string {
  return (
    injectJavaScript.mock.calls
      .map(([script]) => String(script))
      .findLast((script) => script.includes('"type":"showRoute"')) ?? ""
  );
}

/** Runs east along the track's first side, a fix every 20 m. */
function runTo(toM: number) {
  for (let m = 0; m <= toM; m += 20) {
    onPosition({
      coords: {
        latitude: START_LAT,
        longitude: START_LON + m * METRE_EAST,
        accuracy: 5,
        altitude: null,
      },
      timestamp: BEGAN + m * 300,
    } as Location.LocationObject);
  }
}

const ACCOUNT: Answers = {
  "GET /me": () => Response.json(session.user),
  "GET /me/favorites": () => Response.json({ favorites: [] }),
  "GET /me/activities": () => Response.json({ activities: [], next: null, total: 0 }),
  [`GET ${FEED}`]: () => Response.json(feed),
  [`GET /drawings/${drawing.id}`]: () => Response.json(drawing),
};

/** Signed in, «Feed», the drawing opened on the map. */
async function drawingOpened() {
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
  await fireEvent.press(screen.getByRole("tab", { name: "Feed" }));
  await fireEvent.press(await screen.findByText(String(feed.posts[0].title)));
  expect(await screen.findByText(String(drawing.description))).toBeOnTheScreen();
}

jest.spyOn(Vibration, "vibrate").mockImplementation(() => {});

beforeEach(() => {
  store.kept.clear();
  store.kept.set(SESSION_KEY, JSON.stringify(session));
  forgetFeed();
  clearRun();
  saveOutbox([]);
  injectJavaScript.mockClear();
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 46.067, longitude: 11.1215 },
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
  jest.restoreAllMocks();
});

test("«Start» follows the drawing's track at once, and Stop goes back to the drawing, then to «Feed»", async () => {
  api(ACCOUNT);
  await drawingOpened();
  expect(
    screen.getByText("This route has no turn directions: follow the line on the map."),
  ).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole("button", { name: "Start" }));
  expect(await screen.findByText("Stop")).toBeOnTheScreen();
  // No directions asked: a GPS line is not on the graph's roads.
  expect(calls("POST", "/route-directions")).toHaveLength(0);
  // The route on the map is the drawing's track, from its first point.
  expect(lastShown()).toContain(`"coordinates":[[${START_LON},${START_LAT}]`);

  // Stopped before a fix: the drawing again, as it was left.
  await fireEvent.press(screen.getByText("Stop"));
  expect(
    await screen.findByRole("button", { name: "Back to the profile" }),
  ).toBeOnTheScreen();
  expect(screen.getByText(String(drawing.description))).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole("button", { name: "Back to the profile" }));
  expect(
    await screen.findByRole("tab", { name: "Feed", selected: true }),
  ).toBeOnTheScreen();
});

test("the run along a drawing is saved with what it draws, and ends on the drawing", async () => {
  jest.useFakeTimers({ now: BEGAN });
  try {
    api(ACCOUNT);
    await drawingOpened();
    await fireEvent.press(screen.getByRole("button", { name: "Start" }));
    await screen.findByText("Stop");
    await act(async () => {
      skipCountdown();
      runTo(300);
    });
    await fireEvent.press(screen.getByLabelText("Pause"));
    await fireEvent(screen.getByLabelText("Stop"), "longPress");
    await screen.findByText("Your run");

    await fireEvent.press(
      screen.getByRole("button", { name: "Save to My activities" }),
    );
    await waitFor(() => expect(calls("PUT", "/me/activities/")).toHaveLength(1));
    const [, init] = calls("PUT", "/me/activities/")[0];
    const saved = JSON.parse(String(init?.body)) as {
      points: number[][];
      shape: string | null;
      word: string | null;
      similarity: number;
    };
    // The drawing's star, along the drawing's track, as like it as it ran.
    expect(saved.shape).toBe("star");
    expect(saved.word).toBeNull();
    expect(saved.points).toEqual(drawing.track);
    expect(saved.similarity).toBe(0.87);
    // Back on the drawing it was started from.
    expect(
      await screen.findByRole("button", { name: "Back to the profile" }),
    ).toBeOnTheScreen();
  } finally {
    jest.useRealTimers();
  }
});
