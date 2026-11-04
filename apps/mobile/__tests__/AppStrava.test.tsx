/**
 * Send to Strava (TASK-187): at the end of a run, over «Save» and «Discard»;
 * on a run of «My activities»; in «Settings». Nothing of Strava shows when
 * the API has none. The calls alone are in src/api/strava.test.ts, the
 * runs waiting for Strava in src/strava/stravaOutbox.test.ts.
 */
import activities from "@shaperoute/shared-types/fixtures/activities.json";
import activity from "@shaperoute/shared-types/fixtures/activity.json";
import activityRequest from "@shaperoute/shared-types/fixtures/activity-request.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import stravaActivity from "@shaperoute/shared-types/fixtures/strava-activity.json";
import connect from "@shaperoute/shared-types/fixtures/strava-connect.json";
import stravaStatus from "@shaperoute/shared-types/fixtures/strava-status.json";
import trackScore from "@shaperoute/shared-types/fixtures/track-score.json";
import type { LatLon } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Location from "expo-location";
import { AppState, type AppStateStatus, Linking } from "react-native";

import App from "../App";
import { apiError, type MemorySecureStore } from "../src/account/testing";
import { activityKey } from "../src/activities/activityKey";
import { startedLabel } from "../src/activities/activityText";
import { loadOutbox, saveOutbox, type Waiting } from "../src/activities/outbox";
import { clearRun, type SavedRun, saveRun } from "../src/navigation/trackStore";
import { loadSendToStrava, saveSendToStrava } from "../src/strava/stravaChoice";
import { keepForStrava, loadStravaOutbox } from "../src/strava/stravaOutbox";

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
    files,
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

const { files } = jest.requireMock<{ files: Map<string, string> }>("expo-file-system");
const store = jest.requireMock<MemorySecureStore>("expo-secure-store");
const API = "http://192.168.1.23:8000";
const SESSION_KEY = "shaperoute.session";
const [STAR] = activities.activities;
const STAR_WHEN = startedLabel(STAR.started_at);

let fetchSpy: jest.SpiedFunction<typeof fetch>;
let openURL: jest.SpiedFunction<typeof Linking.openURL>;
// The app's listeners of the foreground: Strava's page closes, the app is back.
let appStates: ((next: AppStateStatus) => void)[] = [];

type Answers = Record<string, (init?: RequestInit) => Response>;

/** The fake API, by method and path; anything else is a 404. */
function api(answers: Answers) {
  fetchSpy.mockImplementation(async (input, init) => {
    const path = String(input).replace(API, "");
    const answer = answers[`${init?.method ?? "GET"} ${path}`];
    return answer !== undefined
      ? answer(init)
      : Response.json(apiError("http_error", path), { status: 404 });
  });
}

function calls(method: string, path: string) {
  return fetchSpy.mock.calls.filter(
    ([input, init]) =>
      String(input) === `${API}${path}` && (init?.method ?? "GET") === method,
  );
}

function signedIn() {
  store.kept.set(SESSION_KEY, JSON.stringify(session));
}

const NO_RUNS = { activities: [], next: null, total: 0 };
const ACCOUNT: Answers = {
  "GET /me": () => Response.json(session.user),
  "GET /me/favorites": () => Response.json({ favorites: [] }),
  "GET /me/activities": () => Response.json(NO_RUNS),
  "POST /track-scores": () => Response.json(trackScore),
};
const CONNECTED: Answers = {
  ...ACCOUNT,
  "GET /me/strava": () => Response.json(stravaStatus),
};
const NOT_CONNECTED: Answers = {
  ...ACCOUNT,
  "GET /me/strava": () =>
    Response.json({ available: true, connected: false, athlete: null }),
};

/** The run of the API's example, ended and left in the file of the run. */
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
const STRAVA_PATH = `/me/activities/${KEY}/strava`;
const DRAWING_PATH = `/me/activities/${KEY}/drawing`;

async function openOnRun(run: SavedRun) {
  saveRun(run);
  await render(<App />);
  await screen.findByText("Your run");
}

async function open() {
  await render(<App />);
  await screen.findByText("Starting from your position.");
}

beforeEach(() => {
  store.kept.clear();
  files.clear();
  clearRun();
  saveOutbox([]);
  appStates = [];
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    appStates.push(listener as (next: AppStateStatus) => void);
    return { remove: jest.fn() } as unknown as ReturnType<
      typeof AppState.addEventListener
    >;
  });
  openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
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
  jest.restoreAllMocks();
});

// --- The end of a run ---

test("an API without Strava shows nothing of it, and saves as before", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    [`PUT /me/activities/${KEY}`]: () => Response.json(SAVED, { status: 201 }),
  });
  await openOnRun(ENDED);
  await waitFor(() => expect(calls("GET", "/me/strava")).toHaveLength(1));
  expect(screen.queryByText(/Strava/)).toBeNull();

  await fireEvent.press(screen.getByRole("button", { name: "Save to My activities" }));
  await waitFor(() => expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(1));
  await waitFor(() => expect(loadOutbox()).toEqual([]));
  expect(calls("POST", STRAVA_PATH)).toHaveLength(0);
  expect(loadStravaOutbox()).toEqual([]);
});

test("connected, «Save» sends the run to Strava with the title typed", async () => {
  signedIn();
  api({
    ...CONNECTED,
    [`PUT /me/activities/${KEY}`]: () => Response.json(SAVED, { status: 201 }),
    [`POST ${STRAVA_PATH}`]: () => Response.json(stravaActivity),
    [`PUT ${DRAWING_PATH}`]: (init) =>
      Response.json({
        key: KEY,
        id: "3f9d2c71-8a4b-4e06-b5d1-c27e9a40f815",
        published_at: null,
        ...JSON.parse(String(init?.body)),
      }),
  });
  await openOnRun(ENDED);
  // On the first time, with the athlete it goes to.
  expect(
    await screen.findByRole("switch", { name: "Send to Strava", checked: true }),
  ).toBeOnTheScreen();
  expect(screen.getByText("To Ada Lovelace's Strava, with Save.")).toBeOnTheScreen();
  // The orange button is for connecting only.
  expect(screen.queryByText("Connect with Strava")).toBeNull();
  // One field names the run: the drawing, and Strava (TASK-117).
  await fireEvent.changeText(screen.getByLabelText("Title"), "  Sunday heart  ");

  await fireEvent.press(screen.getByRole("button", { name: "Save to My activities" }));
  // To the API first, then to Strava, once.
  await waitFor(() => expect(calls("POST", STRAVA_PATH)).toHaveLength(1));
  expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(1);
  const putAt = fetchSpy.mock.calls.findIndex(([, init]) => init?.method === "PUT");
  const postAt = fetchSpy.mock.calls.findIndex(
    ([input, init]) => String(input).endsWith(STRAVA_PATH) && init?.method === "POST",
  );
  expect(postAt).toBeGreaterThan(putAt);
  const [, init] = calls("POST", STRAVA_PATH)[0];
  expect(init?.headers).toMatchObject({ Authorization: `Bearer ${session.token}` });
  expect(JSON.parse(String(init?.body))).toEqual({ name: "Sunday heart" });
  // The same title for the run's drawing, which stays private.
  await waitFor(() => expect(calls("PUT", DRAWING_PATH)).toHaveLength(1));
  const [, drawn] = calls("PUT", DRAWING_PATH)[0];
  expect(JSON.parse(String(drawn?.body))).toEqual({
    title: "Sunday heart",
    visibility: "only_me",
    description: null,
    activity: "running",
    tags: [],
  });
  // Nothing left waiting, for the API nor for Strava.
  await waitFor(() => expect(loadStravaOutbox()).toEqual([]));
  expect(loadOutbox()).toEqual([]);
});

test("with nothing typed the run goes without a name, the API's own", async () => {
  signedIn();
  api({
    ...CONNECTED,
    [`PUT /me/activities/${KEY}`]: () => Response.json(SAVED, { status: 201 }),
    [`POST ${STRAVA_PATH}`]: () => Response.json(stravaActivity),
  });
  await openOnRun(FREE_ENDED);
  await screen.findByRole("switch", { name: "Send to Strava" });
  expect(screen.getByLabelText("Title").props.placeholder).toBe("Give it a name");
  await fireEvent.press(screen.getByRole("button", { name: "Save to My activities" }));
  await waitFor(() => expect(calls("POST", STRAVA_PATH)).toHaveLength(1));
  expect(calls("POST", STRAVA_PATH)[0][1]?.body).toBeUndefined();
  // No title, not public: nothing for a drawing.
  expect(calls("PUT", DRAWING_PATH)).toHaveLength(0);
});

test("the switch off saves only, and stays off for the next run", async () => {
  signedIn();
  api({
    ...CONNECTED,
    [`PUT /me/activities/${KEY}`]: () => Response.json(SAVED, { status: 201 }),
  });
  await openOnRun(ENDED);
  await fireEvent.press(await screen.findByRole("switch", { name: "Send to Strava" }));
  expect(
    screen.getByRole("switch", { name: "Send to Strava", checked: false }),
  ).toBeOnTheScreen();
  // Strava has no name field of its own: the run's «Title» is it (TASK-117).
  expect(screen.queryByLabelText("Name on Strava")).toBeNull();
  expect(loadSendToStrava()).toBe(false);

  await fireEvent.press(screen.getByRole("button", { name: "Save to My activities" }));
  await waitFor(() => expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(1));
  await waitFor(() => expect(loadOutbox()).toEqual([]));
  expect(calls("POST", STRAVA_PATH)).toHaveLength(0);
});

test("a switch left off is off at the end of the next run", async () => {
  signedIn();
  saveSendToStrava(false);
  api(CONNECTED);
  await openOnRun(ENDED);
  expect(
    await screen.findByRole("switch", { name: "Send to Strava", checked: false }),
  ).toBeOnTheScreen();
});

test("«Discard» sends nothing to Strava", async () => {
  signedIn();
  api(CONNECTED);
  await openOnRun(ENDED);
  await screen.findByRole("switch", { name: "Send to Strava" });
  await fireEvent.press(screen.getByRole("button", { name: "Discard" }));
  await fireEvent.press(screen.getByRole("button", { name: "Discard run" }));
  expect(await screen.findByText("Starting from your position.")).toBeOnTheScreen();
  expect(calls("POST", STRAVA_PATH)).toHaveLength(0);
  expect(loadStravaOutbox()).toEqual([]);
});

test("not connected, «Connect with Strava» opens Strava, and back in the app the switch is there", async () => {
  signedIn();
  let connected = false;
  api({
    ...ACCOUNT,
    "GET /me/strava": () =>
      Response.json(
        connected ? stravaStatus : { available: true, connected: false, athlete: null },
      ),
    "POST /me/strava/connect": () => Response.json(connect),
  });
  await openOnRun(ENDED);
  await fireEvent.press(
    await screen.findByRole("button", { name: "Connect with Strava" }),
  );
  await waitFor(() => expect(openURL).toHaveBeenCalledWith(connect.url));
  expect(calls("POST", "/me/strava/connect")[0][1]?.headers).toMatchObject({
    Authorization: `Bearer ${session.token}`,
  });
  // Strava's page, then back: the API is asked again.
  connected = true;
  await act(async () => {
    appStates.forEach((listener) => listener("background"));
    appStates.forEach((listener) => listener("active"));
  });
  expect(
    await screen.findByRole("switch", { name: "Send to Strava" }),
  ).toBeOnTheScreen();
  expect(calls("GET", "/me/strava")).toHaveLength(2);
});

test("a Strava page that does not open says so", async () => {
  signedIn();
  api({
    ...NOT_CONNECTED,
    "POST /me/strava/connect": () => Response.json(connect),
  });
  openURL.mockRejectedValue(new Error("no browser"));
  await openOnRun(ENDED);
  await fireEvent.press(
    await screen.findByRole("button", { name: "Connect with Strava" }),
  );
  expect(
    await screen.findByText("Could not open Strava. Try again."),
  ).toBeOnTheScreen();
});

// --- Without a network ---

test("saved without a network, the run goes to the API and then to Strava at the next opening, once", async () => {
  signedIn();
  // The phone as the opening before left it: a run waiting, «Send to Strava» on.
  saveOutbox([
    {
      id: KEY,
      owner: session.user.id,
      request: { ...activityRequest, shape: null },
      strava: { name: "Lunch heart" },
    } as Waiting,
  ]);
  api({
    ...CONNECTED,
    [`PUT /me/activities/${KEY}`]: () => Response.json(SAVED, { status: 201 }),
    [`POST ${STRAVA_PATH}`]: () => Response.json(stravaActivity),
  });
  await open();
  await waitFor(() => expect(calls("POST", STRAVA_PATH)).toHaveLength(1));
  expect(JSON.parse(String(calls("POST", STRAVA_PATH)[0][1]?.body))).toEqual({
    name: "Lunch heart",
  });
  await waitFor(() => expect(loadStravaOutbox()).toEqual([]));
  expect(loadOutbox()).toEqual([]);
  // Asked again with the list: nothing goes twice.
  await fireEvent.press(screen.getByRole("tab", { name: /^Profile/ }));
  await fireEvent.press(await screen.findByRole("button", { name: /^My activities/ }));
  await waitFor(() => expect(calls("GET", "/me/activities").length).toBeGreaterThan(1));
  expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(1);
  expect(calls("POST", STRAVA_PATH)).toHaveLength(1);
});

test("Strava still reading the run, or silent, keeps it for the next opening", async () => {
  signedIn();
  keepForStrava({ owner: session.user.id, key: KEY, name: null });
  api({
    ...CONNECTED,
    [`POST ${STRAVA_PATH}`]: () =>
      Response.json({ status: "processing", url: null }, { status: 202 }),
  });
  await open();
  await waitFor(() => expect(calls("POST", STRAVA_PATH)).toHaveLength(1));
  expect(loadStravaOutbox()).toEqual([
    { owner: session.user.id, key: KEY, name: null },
  ]);
});

// --- A run of «My activities» ---

async function openStar(answers: Answers) {
  signedIn();
  api({
    ...answers,
    "GET /me/activities": () => Response.json(activities),
    [`GET /me/activities/${STAR.id}`]: () => Response.json(activity),
  });
  await open();
  await fireEvent.press(screen.getByRole("tab", { name: /^Profile/ }));
  await fireEvent.press(await screen.findByRole("button", { name: /^My activities/ }));
  await fireEvent.press(
    await screen.findByRole("button", {
      name: `${STAR_WHEN}, Trento · Star, 4.01 km · 19:00 · 4:45 /km, open on the map`,
    }),
  );
  await screen.findByText("Back to the list");
}

const STAR_STRAVA = `/me/activities/${STAR.id}/strava`;

test("a run already on Strava has «View on Strava»", async () => {
  await openStar({
    ...CONNECTED,
    [`GET ${STAR_STRAVA}`]: () => Response.json(stravaActivity),
  });
  await fireEvent.press(await screen.findByRole("button", { name: "View on Strava" }));
  expect(openURL).toHaveBeenCalledWith(stravaActivity.url);
  expect(calls("POST", STAR_STRAVA)).toHaveLength(0);
});

test("a run not sent has «Send to Strava», with the name it would take as the hint", async () => {
  let sent = false;
  await openStar({
    ...CONNECTED,
    [`GET ${STAR_STRAVA}`]: () => Response.json({ status: "not_sent", url: null }),
    [`POST ${STAR_STRAVA}`]: () => {
      sent = true;
      return Response.json(stravaActivity);
    },
  });
  const field = await screen.findByLabelText("Name on Strava");
  expect(field.props.placeholder).toBe("Star in Trento");
  await fireEvent.press(screen.getByRole("button", { name: "Send to Strava" }));
  expect(
    await screen.findByRole("button", { name: "View on Strava" }),
  ).toBeOnTheScreen();
  expect(sent).toBe(true);
  expect(calls("POST", STAR_STRAVA)[0][1]?.body).toBeUndefined();
});

test("a run Strava cannot read says so, and may be sent again", async () => {
  await openStar({
    ...CONNECTED,
    [`GET ${STAR_STRAVA}`]: () => Response.json({ status: "not_sent", url: null }),
    [`POST ${STAR_STRAVA}`]: () =>
      Response.json(apiError("invalid_request"), { status: 422 }),
  });
  await fireEvent.press(await screen.findByRole("button", { name: "Send to Strava" }));
  expect(await screen.findByText("Strava could not read this run.")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Send to Strava" })).toBeOnTheScreen();
});

test("an access taken back on Strava brings «Connect with Strava» back", async () => {
  await openStar({
    ...CONNECTED,
    [`GET ${STAR_STRAVA}`]: () => Response.json({ status: "not_sent", url: null }),
    [`POST ${STAR_STRAVA}`]: () =>
      Response.json(apiError("http_error", "Strava is not connected"), { status: 409 }),
  });
  await fireEvent.press(await screen.findByRole("button", { name: "Send to Strava" }));
  expect(
    await screen.findByRole("button", { name: "Connect with Strava" }),
  ).toBeOnTheScreen();
});

// --- «Settings» ---

async function openSettings() {
  await open();
  await fireEvent.press(screen.getByRole("tab", { name: /^Profile/ }));
  await fireEvent.press(await screen.findByRole("button", { name: "Settings" }));
}

test("«Settings» says who is connected, and «Disconnect» asks first", async () => {
  signedIn();
  api({
    ...CONNECTED,
    "DELETE /me/strava": () => new Response(null, { status: 204 }),
  });
  await openSettings();
  expect(await screen.findByText("Connected as Ada Lovelace")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Disconnect Strava" }));
  expect(
    screen.getByText("Disconnect Strava? Runs already sent stay on Strava."),
  ).toBeOnTheScreen();
  // No: still connected, and nothing asked.
  await fireEvent.press(screen.getByRole("button", { name: "Keep it" }));
  expect(calls("DELETE", "/me/strava")).toHaveLength(0);
  // Yes: gone, and «Connect with Strava» instead.
  await fireEvent.press(screen.getByRole("button", { name: "Disconnect Strava" }));
  await fireEvent.press(screen.getByRole("button", { name: "Disconnect" }));
  expect(
    await screen.findByRole("button", { name: "Connect with Strava" }),
  ).toBeOnTheScreen();
  expect(calls("DELETE", "/me/strava")).toHaveLength(1);
});

test("«Settings» has no Strava on an API without it", async () => {
  signedIn();
  api(ACCOUNT);
  await openSettings();
  await waitFor(() => expect(calls("GET", "/me/strava")).toHaveLength(1));
  expect(screen.queryByText("STRAVA")).toBeNull();
  expect(screen.queryByText(/Strava/)).toBeNull();
});

test("without an account nothing of Strava is asked", async () => {
  api({});
  await openOnRun(ENDED);
  expect(calls("GET", "/me/strava")).toHaveLength(0);
  expect(screen.queryByText(/Strava/)).toBeNull();
});
