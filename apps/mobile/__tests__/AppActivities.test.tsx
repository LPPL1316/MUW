/**
 * «My activities» (TASK-172): the runs of the account in «Profile», a page
 * at a time, one opened on the map, and deleted with a yes; and a run that
 * ends, which «Save» keeps, now or when there is a network, and «Discard»
 * throws away. The hook alone is in src/activities/useActivities.test.ts.
 */
import activities from "@shaperoute/shared-types/fixtures/activities.json";
import activity from "@shaperoute/shared-types/fixtures/activity.json";
import activityRequest from "@shaperoute/shared-types/fixtures/activity-request.json";
import explored from "@shaperoute/shared-types/fixtures/recommended-route.json";
import exploreList from "@shaperoute/shared-types/fixtures/recommended-routes.json";
import directions from "@shaperoute/shared-types/fixtures/route-directions.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import signUpRequest from "@shaperoute/shared-types/fixtures/sign-up-request.json";
import trackScore from "@shaperoute/shared-types/fixtures/track-score.json";
import type { LatLon } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { apiError, type MemorySecureStore } from "../src/account/testing";
import { activityKey } from "../src/activities/activityKey";
import { SIGN_IN_TO_KEEP_RUNS } from "../src/activities/activitiesDoor";
import { startedLabel } from "../src/activities/activityText";
import {
  loadOutbox,
  MAX_WAITING,
  saveOutbox,
  type Waiting,
} from "../src/activities/outbox";
import { skipCountdown } from "../src/navigation/runControl";
import {
  clearRun,
  loadRun,
  type SavedRun,
  saveRun,
} from "../src/navigation/trackStore";

// Every test renders the whole app, and the first one loads it cold: on a
// busy machine that alone can take the five seconds a test has.
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
const [STAR, FREE] = activities.activities;
/** On the clock of whoever runs the test, as the phone reads it. */
const STAR_WHEN = startedLabel(STAR.started_at);
const FREE_WHEN = startedLabel(FREE.started_at);
const CURSOR = "1789796402000000-3";

let fetchSpy: jest.SpiedFunction<typeof fetch>;

type Answers = Record<string, () => Response>;

/** The fake API, by method and path with its query. */
function api(answers: Answers) {
  fetchSpy.mockImplementation(async (input, init) => {
    const path = String(input).replace(API, "");
    const answer = answers[`${init?.method ?? "GET"} ${path}`];
    return answer !== undefined
      ? answer()
      : Response.json(apiError("http_error", path), { status: 404 });
  });
}

function calls(method: string, path: string) {
  return fetchSpy.mock.calls.filter(
    ([input, init]) =>
      String(input) === `${API}${path}` && (init?.method ?? "GET") === method,
  );
}

function scripts(type: string): string[] {
  return injectJavaScript.mock.calls
    .map(([script]) => String(script))
    .filter((script) => script.includes(`"type":"${type}"`));
}

function signedIn() {
  store.kept.set(SESSION_KEY, JSON.stringify(session));
}

const ACCOUNT: Answers = {
  "GET /me": () => Response.json(session.user),
  "GET /me/favorites": () => Response.json({ favorites: [] }),
};

async function open() {
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
}

async function openActivities() {
  await fireEvent.press(screen.getByRole("button", { name: /^Profile/ }));
  await fireEvent.press(await screen.findByRole("button", { name: /^My activities/ }));
}

beforeEach(() => {
  store.kept.clear();
  clearRun();
  saveOutbox([]);
  injectJavaScript.mockClear();
  jest
    .mocked(Location.watchPositionAsync)
    .mockResolvedValue({ remove: jest.fn() } as Location.LocationSubscription);
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 46.067, longitude: 11.1215 },
  } as Location.LocationObject);
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  fetchSpy.mockRestore();
});

test("«My activities» in «Profile» lists the runs, with how many they are", async () => {
  signedIn();
  api({ ...ACCOUNT, "GET /me/activities": () => Response.json(activities) });
  await open();
  await fireEvent.press(screen.getByRole("button", { name: /^Profile/ }));
  // Under «Favorites», with its number.
  expect(screen.getByRole("button", { name: "Favorites, 0" })).toBeOnTheScreen();
  await fireEvent.press(
    await screen.findByRole("button", { name: "My activities, 2" }),
  );
  expect(screen.getByRole("header", { name: "My activities" })).toBeOnTheScreen();
  const [auth] = calls("GET", "/me/activities");
  expect(auth[1]?.headers).toMatchObject({ Authorization: `Bearer ${session.token}` });

  // The latest first: the day and the time it began, where, what it drew,
  // how far and how fast. Never its score.
  expect(screen.getAllByTestId("activity-row")).toHaveLength(2);
  expect(screen.getByText(STAR_WHEN)).toBeOnTheScreen();
  expect(screen.getByText("Trento · Star")).toBeOnTheScreen();
  expect(screen.getByText("4.01 km · 19:00 · 4:45 /km")).toBeOnTheScreen();
  // A run without a route, from a place nobody found: no name.
  expect(screen.getByText(FREE_WHEN)).toBeOnTheScreen();
  expect(screen.getByText("Run")).toBeOnTheScreen();
  expect(screen.getByText("2.31 km · 13:35 · 5:53 /km")).toBeOnTheScreen();
  expect(screen.queryByText(/^Score/)).toBeNull();
  expect(screen.queryByLabelText(/^Score/)).toBeNull();
  // The drawing: the route and, over it, what was run; a run alone.
  expect(screen.getAllByTestId("run-drawing-route")).toHaveLength(4);
  expect(screen.getAllByTestId("run-drawing-track")).toHaveLength(4 + 2);

  // Back to the page of the profile (TASK-278), then to «Draw».
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.queryByRole("header", { name: "My activities" })).toBeNull();
  expect(
    screen.getByRole("button", { name: /^Profile/, selected: true }),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("tab", { name: "Draw" }));
  expect(screen.getByRole("tab", { name: "Draw", selected: true })).toBeOnTheScreen();
});

test("a run opens on the map, its route under what was run, and goes back to the list", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    "GET /me/activities": () => Response.json(activities),
    [`GET /me/activities/${STAR.id}`]: () => Response.json(activity),
  });
  await open();
  await openActivities();
  await fireEvent.press(
    screen.getByRole("button", {
      name: `${STAR_WHEN}, Trento · Star, 4.01 km · 19:00 · 4:45 /km, open on the map`,
    }),
  );
  // «Profile» gets out of the way: the map, with the run's card under it.
  expect(await screen.findByText("Back to the list")).toBeOnTheScreen();
  expect(screen.queryByRole("header", { name: "My activities" })).toBeNull();
  expect(screen.queryByRole("tab")).toBeNull();
  expect(screen.getByText(STAR_WHEN)).toBeOnTheScreen();
  expect(screen.getByText("Trento · Star")).toBeOnTheScreen();
  expect(screen.getByText("4.01 km · 19:00 · 4:45 /km")).toBeOnTheScreen();
  // The run has a score (91): its card does not show it.
  expect(screen.queryByText(/out of 100/)).toBeNull();
  expect(screen.queryByLabelText(/^Score/)).toBeNull();
  expect(screen.queryByText("91")).toBeNull();
  expect(screen.getByText("Yellow: the route. White: what you ran.")).toBeOnTheScreen();
  // Neither a route to keep nor one to start.
  expect(screen.queryByRole("button", { name: /favorites/ })).toBeNull();
  expect(screen.queryByText("Start")).toBeNull();
  // On the map as at the end of a run: the route and the track, whole.
  const [lat, lon] = activity.points[1];
  expect(scripts("showRoute").at(-1)).toContain(`[${lon},${lat}]`);
  expect(scripts("showTrack").at(-1)).toContain(`[${lon},${lat}]`);

  // Back: the list it came from, over the page left under it.
  await fireEvent.press(screen.getByText("Back to the list"));
  expect(screen.getByRole("header", { name: "My activities" })).toBeOnTheScreen();
  expect(screen.getAllByTestId("activity-row")).toHaveLength(2);
  // Then the page of the profile (TASK-278), and «Draw».
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await fireEvent.press(screen.getByRole("tab", { name: "Draw" }));
  expect(screen.getByRole("tab", { name: "Draw", selected: true })).toBeOnTheScreen();
  // The map lets the run go.
  expect(screen.queryByText("Back to the list")).toBeNull();
});

test("the way back on the map goes to the list too; a run without a route has no yellow", async () => {
  signedIn();
  const whole = {
    ...activity,
    id: FREE.id,
    started_at: FREE.started_at,
    place: null,
    shape: null,
    score: null,
    fidelity: null,
    similarity: null,
    points: null,
    distance_m: FREE.distance_m,
    duration_s: FREE.duration_s,
  };
  api({
    ...ACCOUNT,
    "GET /me/activities": () => Response.json(activities),
    [`GET /me/activities/${FREE.id}`]: () => Response.json(whole),
  });
  await open();
  await openActivities();
  const routesBefore = scripts("showRoute").length;
  await fireEvent.press(
    screen.getByRole("button", { name: new RegExp(`^${FREE_WHEN}, Run, `) }),
  );
  expect(await screen.findByText("White: what you ran.")).toBeOnTheScreen();
  expect(screen.queryByText(/out of 100/)).toBeNull();
  expect(scripts("showTrack").length).toBeGreaterThan(0);
  expect(
    scripts("showRoute")
      .slice(routesBefore)
      .every((s) => !s.includes("11.1344")),
  ).toBe(true);
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("header", { name: "My activities" })).toBeOnTheScreen();
});

test("a run is deleted from the list only after a yes", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    "GET /me/activities": () => Response.json(activities),
    [`DELETE /me/activities/${STAR.id}`]: () => new Response(null, { status: 204 }),
  });
  await open();
  await openActivities();
  await fireEvent.press(
    screen.getByRole("button", { name: `Delete the run of ${STAR_WHEN}` }),
  );
  expect(screen.getByText("Delete this run? It cannot be undone.")).toBeOnTheScreen();
  // No: the run stays, and nothing is asked.
  await fireEvent.press(screen.getByRole("button", { name: "Keep it" }));
  expect(screen.queryByText("Delete this run? It cannot be undone.")).toBeNull();
  expect(screen.getByText("Trento · Star")).toBeOnTheScreen();
  expect(calls("DELETE", `/me/activities/${STAR.id}`)).toHaveLength(0);
  // Yes: gone at once.
  await fireEvent.press(
    screen.getByRole("button", { name: `Delete the run of ${STAR_WHEN}` }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Delete run" }));
  expect(screen.queryByText("Trento · Star")).toBeNull();
  expect(screen.getAllByTestId("activity-row")).toHaveLength(1);
  await waitFor(() =>
    expect(calls("DELETE", `/me/activities/${STAR.id}`)).toHaveLength(1),
  );
  // And «Profile» counts one fewer.
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("button", { name: "My activities, 1" })).toBeOnTheScreen();
});

test("a run the API does not delete comes back, and says why", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    "GET /me/activities": () => Response.json(activities),
    [`DELETE /me/activities/${FREE.id}`]: () =>
      Response.json(apiError("engine_error", "…"), { status: 500 }),
  });
  await open();
  await openActivities();
  await fireEvent.press(
    screen.getByRole("button", { name: `Delete the run of ${FREE_WHEN}` }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Delete run" }));
  expect(await screen.findByRole("alert")).toBeOnTheScreen();
  expect(screen.getAllByTestId("activity-row")).toHaveLength(2);
});

test("a run is deleted from the map too, and the list is back without it", async () => {
  signedIn();
  let deleted = false;
  api({
    ...ACCOUNT,
    "GET /me/activities": () =>
      Response.json(
        deleted ? { activities: [FREE], next: null, total: 1 } : activities,
      ),
    [`GET /me/activities/${STAR.id}`]: () => Response.json(activity),
    [`DELETE /me/activities/${STAR.id}`]: () => {
      deleted = true;
      return new Response(null, { status: 204 });
    },
  });
  await open();
  await openActivities();
  await fireEvent.press(
    screen.getByRole("button", { name: new RegExp(`^${STAR_WHEN}, `) }),
  );
  await fireEvent.press(await screen.findByRole("button", { name: "Delete" }));
  expect(screen.getByText("Delete this run? It cannot be undone.")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Keep it" }));
  expect(screen.getByText("Back to the list")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Delete" }));
  await fireEvent.press(screen.getByRole("button", { name: "Delete run" }));
  expect(screen.getByRole("header", { name: "My activities" })).toBeOnTheScreen();
  expect(screen.queryByText("Trento · Star")).toBeNull();
  await waitFor(() =>
    expect(calls("DELETE", `/me/activities/${STAR.id}`)).toHaveLength(1),
  );
  expect(screen.getAllByTestId("activity-row")).toHaveLength(1);
});

test("«Show more» brings the next page", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    "GET /me/activities": () =>
      Response.json({ activities: [STAR], next: CURSOR, total: 2 }),
    [`GET /me/activities?cursor=${CURSOR}`]: () =>
      Response.json({ activities: [FREE], next: null, total: 2 }),
  });
  await open();
  await fireEvent.press(screen.getByRole("button", { name: /^Profile/ }));
  // All of them are counted, not the page.
  await fireEvent.press(
    await screen.findByRole("button", { name: "My activities, 2" }),
  );
  expect(screen.getAllByTestId("activity-row")).toHaveLength(1);
  await fireEvent.press(screen.getByRole("button", { name: "Show more" }));
  await waitFor(() => expect(screen.getAllByTestId("activity-row")).toHaveLength(2));
  expect(screen.getByText(FREE_WHEN)).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
});

test("no activities yet, and a list that does not come", async () => {
  signedIn();
  let down = true;
  api({
    ...ACCOUNT,
    "GET /me/activities": () =>
      down
        ? Response.json(apiError("engine_error", "…"), { status: 500 })
        : Response.json({ activities: [], next: null, total: 0 }),
  });
  await open();
  await openActivities();
  expect(await screen.findByText("Your activities could not load.")).toBeOnTheScreen();
  down = false;
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText(/^No activities yet/)).toBeOnTheScreen();
});

test("a run deleted elsewhere does not open, and says so", async () => {
  signedIn();
  api({ ...ACCOUNT, "GET /me/activities": () => Response.json(activities) });
  await open();
  await openActivities();
  await fireEvent.press(
    screen.getByRole("button", { name: new RegExp(`^${STAR_WHEN}, `) }),
  );
  expect(
    await screen.findByText("This run is no longer in your activities."),
  ).toBeOnTheScreen();
  expect(screen.getByRole("header", { name: "My activities" })).toBeOnTheScreen();
});

test("a session that ended while listing signs the app out", async () => {
  signedIn();
  let ended = false;
  api({
    ...ACCOUNT,
    "GET /me/activities": () =>
      ended
        ? Response.json(apiError("session_expired"), { status: 401 })
        : Response.json(activities),
  });
  await open();
  await fireEvent.press(screen.getByRole("button", { name: /^Profile/ }));
  await screen.findByRole("button", { name: "My activities, 2" });
  ended = true;
  await fireEvent.press(screen.getByRole("button", { name: "My activities, 2" }));
  await waitFor(() => expect(store.kept.has(SESSION_KEY)).toBe(false));
  expect(screen.getByText("Your session has ended. Log in again.")).toBeOnTheScreen();
  expect(screen.queryByTestId("activity-row")).toBeNull();
});

test("without an account there are no activities, and nothing is asked", async () => {
  api({});
  await open();
  await fireEvent.press(screen.getByRole("button", { name: /^Profile/ }));
  expect(screen.queryByRole("button", { name: /^My activities/ })).toBeNull();
  expect(calls("GET", "/me/activities")).toHaveLength(0);
});

// --- A run that ends ---

/** The run of the API's example, as the phone has it in its file: ended,
 * and left there when the app closed. */
const ENDED: SavedRun = {
  version: 1,
  route: activityRequest.points as LatLon[],
  similarity: activityRequest.similarity,
  track: {
    fixes: activityRequest.track.map((fix) => ({
      point: fix.point as LatLon,
      timeMs: fix.time_ms,
      accuracyM: fix.accuracy_m,
    })),
    distanceM: 4007,
    pauses: [{ fromMs: 1790000300000, toMs: 1790000360000, auto: true }],
  },
  status: "arrived",
};
const FREE_ENDED: SavedRun = { ...ENDED, route: [], similarity: undefined };
const KEY = activityKey(ENDED.track.fixes[0]);
const SAVED = { ...STAR, id: KEY };

/** The app opened on the end of the run left in the file. */
async function openOnRun(run: SavedRun) {
  saveRun(run);
  await render(<App />);
  await screen.findByText("Your run");
}

test("«Save» keeps the run: the fixes and the route, never the app's numbers", async () => {
  signedIn();
  let saved = false;
  api({
    ...ACCOUNT,
    "GET /me/activities": () =>
      Response.json(
        saved
          ? { activities: [SAVED], next: null, total: 1 }
          : { activities: [], next: null, total: 0 },
      ),
    "POST /track-scores": () => Response.json(trackScore),
    [`PUT /me/activities/${KEY}`]: () => {
      saved = true;
      return Response.json(SAVED, { status: 201 });
    },
  });
  await openOnRun(ENDED);
  // With an account the way out is «Save» or «Discard», not «Done».
  expect(screen.queryByText("Done")).toBeNull();
  expect(screen.getByRole("button", { name: "Discard" })).toBeOnTheScreen();
  // Nothing is saved by itself: only «Save» sends the run.
  await screen.findByText("Your run");
  expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(0);
  expect(loadOutbox()).toEqual([]);

  await fireEvent.press(screen.getByRole("button", { name: "Save to My activities" }));
  await waitFor(() => expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(1));
  const [, init] = calls("PUT", `/me/activities/${KEY}`)[0];
  expect(init?.headers).toMatchObject({ Authorization: `Bearer ${session.token}` });
  // What its route draws went with the app that drew it: the line alone.
  expect(JSON.parse(String(init?.body))).toEqual({ ...activityRequest, shape: null });
  // Saved: nothing waits on the phone, and «Profile» counts it.
  await waitFor(() => expect(loadOutbox()).toEqual([]));
  expect(loadRun()).toBeNull();
  await fireEvent.press(await screen.findByRole("button", { name: /^Profile/ }));
  expect(
    await screen.findByRole("button", { name: "My activities, 1" }),
  ).toBeOnTheScreen();
});

test("a run without a route is saved too, with no route in it", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    "GET /me/activities": () => Response.json({ activities: [], next: null, total: 0 }),
    [`PUT /me/activities/${KEY}`]: () =>
      Response.json({ ...FREE, id: KEY }, { status: 201 }),
  });
  await openOnRun(FREE_ENDED);
  await fireEvent.press(screen.getByRole("button", { name: "Save to My activities" }));
  // Back to the first screen, as «Done» was.
  expect(await screen.findByText("Starting from your position.")).toBeOnTheScreen();
  await waitFor(() => expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(1));
  const [, init] = calls("PUT", `/me/activities/${KEY}`)[0];
  expect(JSON.parse(String(init?.body))).toEqual({
    ...activityRequest,
    points: null,
    similarity: null,
    shape: null,
  });
  expect(calls("POST", "/track-scores")).toHaveLength(0);
  await waitFor(() => expect(loadOutbox()).toEqual([]));
});

test("«Discard» asks first, and then the run is gone and nothing is saved", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    "GET /me/activities": () => Response.json({ activities: [], next: null, total: 0 }),
    "POST /track-scores": () => Response.json(trackScore),
  });
  await openOnRun(ENDED);
  await fireEvent.press(screen.getByRole("button", { name: "Discard" }));
  expect(screen.getByText("Discard this run? It will not be saved.")).toBeOnTheScreen();
  // No: the run is still there, to save.
  await fireEvent.press(screen.getByRole("button", { name: "Keep it" }));
  expect(
    screen.getByRole("button", { name: "Save to My activities" }),
  ).toBeOnTheScreen();
  expect(loadRun()).not.toBeNull();
  // Yes: it leaves the phone, and never reaches the API.
  await fireEvent.press(screen.getByRole("button", { name: "Discard" }));
  await fireEvent.press(screen.getByRole("button", { name: "Discard run" }));
  expect(await screen.findByText("Starting from your position.")).toBeOnTheScreen();
  expect(loadRun()).toBeNull();
  expect(loadOutbox()).toEqual([]);
  expect(fetchSpy.mock.calls.filter(([, init]) => init?.method === "PUT")).toEqual([]);
});

test("the end of a run asks for no score, and the saved run does not come back", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    "GET /me/activities": () => Response.json({ activities: [], next: null, total: 0 }),
    [`PUT /me/activities/${KEY}`]: () => Response.json(SAVED, { status: 201 }),
  });
  await openOnRun(ENDED);
  expect(await screen.findByText("Your run")).toBeOnTheScreen();
  expect(screen.queryByText(/score/i)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Save to My activities" }));
  await waitFor(() => expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(1));
  // The API scores it by itself, unseen: the phone never asks, and has no
  // reason to keep the run for the next opening.
  expect(calls("POST", "/track-scores")).toHaveLength(0);
  expect(loadRun()).toBeNull();
});

test("a phone that cannot keep the run says so, and the run stays", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    "GET /me/activities": () => Response.json({ activities: [], next: null, total: 0 }),
  });
  await openOnRun(FREE_ENDED);
  const { File } = jest.requireMock<{ File: { prototype: { write: () => void } } }>(
    "expo-file-system",
  );
  const write = jest.spyOn(File.prototype, "write").mockImplementation(() => {
    throw new Error("disk full");
  });
  await fireEvent.press(screen.getByRole("button", { name: "Save to My activities" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "This run could not be kept on the phone. Try again.",
  );
  write.mockRestore();
  expect(loadRun()).not.toBeNull();
  expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(0);
  // Again, with a phone that takes the file: saved.
  await fireEvent.press(screen.getByRole("button", { name: "Save to My activities" }));
  expect(await screen.findByText("Starting from your position.")).toBeOnTheScreen();
  expect(loadRun()).toBeNull();
});

test("without a network the run waits on the phone", async () => {
  signedIn();
  fetchSpy.mockImplementation(async () => {
    throw new Error("no network");
  });
  await openOnRun(FREE_ENDED);
  await fireEvent.press(screen.getByRole("button", { name: "Save to My activities" }));
  await waitFor(() => expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(1));
  // The run left the finish screen, not the phone: it waits for its account.
  expect(loadRun()).toBeNull();
  await waitFor(() => expect(loadOutbox().map((run) => run.id)).toEqual([KEY]));
  expect(loadOutbox()[0].owner).toBe(session.user.id);
  expect(loadOutbox()[0].request.track).toHaveLength(5);
  await fireEvent.press(await screen.findByRole("button", { name: /^Profile/ }));
  await fireEvent.press(await screen.findByRole("button", { name: /^My activities/ }));
  expect(
    await screen.findByText("1 run is on this phone, waiting for a connection."),
  ).toBeOnTheScreen();
  // Asked again with the page, and still there.
  expect(loadOutbox()).toHaveLength(1);
});

test("what waited goes at the next opening with a network, once", async () => {
  signedIn();
  // The phone as the opening before left it: a run in the outbox.
  saveOutbox([
    {
      id: KEY,
      owner: session.user.id,
      request: { ...activityRequest, points: null, similarity: null, shape: null },
    } as Waiting,
  ]);
  let saved = false;
  api({
    ...ACCOUNT,
    "GET /me/activities": () =>
      Response.json(
        saved
          ? { activities: [{ ...FREE, id: KEY }], next: null, total: 1 }
          : { activities: [], next: null, total: 0 },
      ),
    [`PUT /me/activities/${KEY}`]: () => {
      saved = true;
      return Response.json({ ...FREE, id: KEY }, { status: 201 });
    },
  });
  await open();
  // Nobody touched anything: it went with the opening.
  await waitFor(() => expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(1));
  await waitFor(() => expect(loadOutbox()).toEqual([]));
  await fireEvent.press(screen.getByRole("button", { name: /^Profile/ }));
  await fireEvent.press(
    await screen.findByRole("button", { name: "My activities, 1" }),
  );
  expect(screen.getAllByTestId("activity-row")).toHaveLength(1);
  expect(screen.queryByText(/waiting for a connection/)).toBeNull();
  // The page asks its list again; the run is not sent again.
  await waitFor(() => expect(calls("GET", "/me/activities").length).toBeGreaterThan(2));
  expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(1);
});

test("with nothing waiting, an opening sends nothing", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    "GET /me/activities": () => Response.json(activities),
  });
  await open();
  await fireEvent.press(screen.getByRole("button", { name: /^Profile/ }));
  await screen.findByRole("button", { name: "My activities, 2" });
  expect(fetchSpy.mock.calls.filter(([, init]) => init?.method === "PUT")).toEqual([]);
});

test("a run the API will never take stays on the phone, with the reason and «Discard»", async () => {
  // TASK-257: it was dropped without a word, after the logo said «saved».
  const REASON =
    "This run cannot be saved: the track has 1 usable positions, 2 are needed.";
  signedIn();
  api({
    ...ACCOUNT,
    "GET /me/activities": () => Response.json({ activities: [], next: null, total: 0 }),
    [`PUT /me/activities/${KEY}`]: () =>
      Response.json(apiError("invalid_request", REASON), { status: 422 }),
  });
  await openOnRun(FREE_ENDED);
  await fireEvent.press(screen.getByRole("button", { name: "Save to My activities" }));
  await waitFor(() => expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(1));
  await waitFor(() => expect(loadOutbox()[0]?.refused?.message).toBe(REASON));

  await screen.findByText("Starting from your position.");
  await openActivities();
  expect(
    await screen.findByText(`The server could not take this run: ${REASON}`),
  ).toBeOnTheScreen();
  // Not waiting for a connection: it has its own row.
  expect(screen.queryByText(/waiting for a connection/)).toBeNull();
  // The page asks its list again; the run is not sent again.
  await waitFor(() => expect(calls("GET", "/me/activities").length).toBeGreaterThan(1));
  expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(1);

  await fireEvent.press(screen.getByRole("button", { name: /^Discard the run of / }));
  await fireEvent.press(screen.getByRole("button", { name: "Keep it" }));
  expect(screen.getByTestId("refused-run")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: /^Discard the run of / }));
  await fireEvent.press(screen.getByRole("button", { name: "Discard run" }));
  expect(screen.queryByTestId("refused-run")).toBeNull();
  expect(loadOutbox()).toEqual([]);
});

test("a phone full of runs not sent keeps the run that ended, and says so", async () => {
  // TASK-257: the oldest run was let go to make room.
  signedIn();
  const held = Array.from({ length: MAX_WAITING }, (_, n) => ({
    id: `held${String(n).padStart(4, "0")}`,
    owner: session.user.id,
    request: activityRequest,
    refused: { code: "invalid_request", message: "…" },
  })) as Waiting[];
  saveOutbox(held);
  api({
    ...ACCOUNT,
    "GET /me/activities": () => Response.json({ activities: [], next: null, total: 0 }),
  });
  await openOnRun(FREE_ENDED);
  await fireEvent.press(screen.getByRole("button", { name: "Save to My activities" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    `The phone holds ${MAX_WAITING} runs not sent yet. Discard one in My activities first.`,
  );
  // Nothing went: neither the run that ended nor one of those held.
  expect(loadRun()).not.toBeNull();
  expect(loadOutbox()).toEqual(held);
  expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(0);
});

test("an API that is away keeps the run waiting", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    "GET /me/activities": () => Response.json({ activities: [], next: null, total: 0 }),
    [`PUT /me/activities/${KEY}`]: () =>
      Response.json(apiError("engine_error", "…"), { status: 500 }),
  });
  await openOnRun(FREE_ENDED);
  await fireEvent.press(screen.getByRole("button", { name: "Save to My activities" }));
  await waitFor(() => expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(1));
  expect(loadOutbox().map((run) => run.id)).toEqual([KEY]);
});

test("a run that waits belongs to its account: another one does not send it", async () => {
  signedIn();
  saveOutbox([
    { id: KEY, owner: session.user.id + 1, request: activityRequest } as Waiting,
  ]);
  api({
    ...ACCOUNT,
    "GET /me/activities": () => Response.json({ activities: [], next: null, total: 0 }),
  });
  await open();
  await openActivities();
  await screen.findByText(/^No activities yet/);
  expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(0);
  expect(screen.queryByText(/waiting for a connection/)).toBeNull();
  expect(loadOutbox()).toHaveLength(1);
});

test("without an account the run ends with «Done», as before, and a line invites to sign in", async () => {
  api({});
  await openOnRun(FREE_ENDED);
  expect(screen.queryByRole("button", { name: "Save to My activities" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  // The line goes to the page of the profile (TASK-278 part B), which says
  // why, with «←» back to the run.
  await fireEvent.press(screen.getByRole("button", { name: SIGN_IN_TO_KEEP_RUNS }));
  expect(screen.getByTestId("profile-page-mark")).toBeOnTheScreen();
  expect(screen.getByRole("header", { name: "Profile" })).toBeOnTheScreen();
  expect(screen.getByText(SIGN_IN_TO_KEEP_RUNS)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  // «Done»: the run leaves the phone, and nothing goes anywhere.
  await fireEvent.press(screen.getByText("Done"));
  expect(await screen.findByText("Starting from your position.")).toBeOnTheScreen();
  expect(loadRun()).toBeNull();
  expect(loadOutbox()).toEqual([]);
  expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(0);
});

test("signed up from that line, the end of the run comes back with «Save» and «Discard»", async () => {
  api({
    "POST /accounts": () => Response.json(session, { status: 201 }),
    "GET /me/favorites": () => Response.json({ favorites: [] }),
  });
  await openOnRun(FREE_ENDED);
  await fireEvent.press(screen.getByRole("button", { name: SIGN_IN_TO_KEEP_RUNS }));
  // The page of the profile (TASK-278 part B); the run waits under it.
  expect(screen.getByTestId("profile-page-mark")).toBeOnTheScreen();
  expect(screen.queryByText("Your run")).toBeNull();

  await fireEvent.changeText(screen.getByLabelText("email"), signUpRequest.email);
  await fireEvent.changeText(screen.getByLabelText("username"), signUpRequest.username);
  await fireEvent.changeText(screen.getByLabelText("password"), signUpRequest.password);
  await fireEvent.press(screen.getByRole("checkbox", { name: "I am at least 16" }));
  await fireEvent.press(screen.getByTestId("account-submit"));
  // Back by itself, with the run to save.
  expect(
    await screen.findByRole("button", { name: "Save to My activities" }),
  ).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Discard" })).toBeOnTheScreen();
  expect(screen.getByText("Your run")).toBeOnTheScreen();
  expect(screen.queryByTestId("profile-page-mark")).toBeNull();
  expect(loadRun()).not.toBeNull();
  expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(0);
});

test("a run along a route still on the map is saved with what the route draws", async () => {
  signedIn();
  let onPosition: (position: Location.LocationObject) => void = () => {};
  jest
    .mocked(Location.watchPositionAsync)
    .mockImplementation(async (_options, callback) => {
      onPosition = callback;
      return { remove: jest.fn() };
    });
  const answers: Answers = {
    ...ACCOUNT,
    "GET /me/activities": () => Response.json({ activities: [], next: null, total: 0 }),
    "POST /route-directions": () => Response.json(directions),
    "POST /track-scores": () => Response.json(trackScore),
  };
  fetchSpy.mockImplementation(async (input, init) => {
    const path = String(input).replace(API, "");
    const method = init?.method ?? "GET";
    const answer = answers[`${method} ${path}`];
    if (answer !== undefined) {
      return answer();
    }
    if (method === "PUT" && path.startsWith("/me/activities/")) {
      return Response.json({ ...STAR, id: path.split("/").at(-1) }, { status: 201 });
    }
    if (path.startsWith("/recommended-routes/")) {
      return Response.json(explored);
    }
    if (path.startsWith("/recommended-routes")) {
      return Response.json(exploreList);
    }
    return Response.json(apiError("http_error", path), { status: 404 });
  });
  await open();
  // The star of «Explore» in Trento, started and run for its first stretch.
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  await fireEvent.press(await screen.findByText("Star · 5.1 km"));
  await fireEvent.press(await screen.findByText("Start"));
  await screen.findByText("Stop");
  const now = Date.now();
  const [first, second] = explored.points as LatLon[];
  await act(async () => {
    skipCountdown();
    onPosition({
      coords: { latitude: first[0], longitude: first[1], accuracy: 5 },
      timestamp: now - 120_000,
    } as Location.LocationObject);
    onPosition({
      coords: { latitude: second[0], longitude: second[1], accuracy: 5 },
      timestamp: now,
    } as Location.LocationObject);
  });
  await fireEvent.press(screen.getByLabelText("Pause"));
  await fireEvent(screen.getByLabelText("Stop"), "longPress");
  await screen.findByText("Your run");
  await fireEvent.press(screen.getByRole("button", { name: "Save to My activities" }));

  const puts = () =>
    fetchSpy.mock.calls.filter(
      ([input, init]) =>
        init?.method === "PUT" && String(input).startsWith(`${API}/me/activities/`),
    );
  await waitFor(() => expect(puts()).toHaveLength(1));
  const [url, init] = puts()[0];
  const body = JSON.parse(String(init?.body));
  expect(body).toMatchObject({
    points: explored.points,
    similarity: explored.similarity,
    shape: "star",
    word: null,
    style: null,
    title: null,
  });
  // The run began where and when its first fix says: that is its key.
  expect(body.track[0]).toMatchObject({ point: first, time_ms: now - 120_000 });
  expect(String(url)).toBe(
    `${API}/me/activities/${activityKey({ point: first, timeMs: now - 120_000 })}`,
  );
  // The whole run, from the first screen to the last: slow on a busy machine.
}, 20_000);
