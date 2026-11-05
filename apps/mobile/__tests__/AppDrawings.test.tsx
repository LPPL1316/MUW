/**
 * Publishing a run (TASK-117, ADR-0159): «Public» and «Title» at the end
 * of a run and on a run of «My activities», a public run marked in the
 * list, the drawings in the profile and one opened on the map. The calls
 * alone are in src/api/drawings.test.ts, the choices waiting for a network
 * in src/social/drawingOutbox.test.ts.
 */
import activities from "@shaperoute/shared-types/fixtures/activities.json";
import activity from "@shaperoute/shared-types/fixtures/activity.json";
import activityRequest from "@shaperoute/shared-types/fixtures/activity-request.json";
import drawing from "@shaperoute/shared-types/fixtures/drawing.json";
import drawings from "@shaperoute/shared-types/fixtures/drawings.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import stravaActivity from "@shaperoute/shared-types/fixtures/strava-activity.json";
import stravaStatus from "@shaperoute/shared-types/fixtures/strava-status.json";
import trackScore from "@shaperoute/shared-types/fixtures/track-score.json";
import type { LatLon } from "@shaperoute/shared-types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { injectJavaScript } from "../__mocks__/react-native-webview";
import { apiError, type MemorySecureStore } from "../src/account/testing";
import { activityKey } from "../src/activities/activityKey";
import { dayLabel, startedLabel } from "../src/activities/activityText";
import { loadOutbox, saveOutbox, type Waiting } from "../src/activities/outbox";
import { clearRun, type SavedRun, saveRun } from "../src/navigation/trackStore";
import { loadDrawingOutbox } from "../src/social/drawingOutbox";
import { saveVisibility } from "../src/social/visibilityChoice";
import { loadStravaOutbox } from "../src/strava/stravaOutbox";

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
const STAR_ROW = `${STAR_WHEN}, Trento · Star, 4.01 km · 19:00 · 4:45 /km`;

let fetchSpy: jest.SpiedFunction<typeof fetch>;

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

/** What the map was told of `type`, in order. */
function scripts(type: string): string[] {
  return injectJavaScript.mock.calls
    .map(([script]) => String(script))
    .filter((script) => script.includes(`"type":"${type}"`));
}

/** The body of the `index`th call of `method` to `path`. */
function bodyOf(method: string, path: string, index = 0): unknown {
  return JSON.parse(String(calls(method, path)[index][1]?.body));
}

function signedIn() {
  store.kept.set(SESSION_KEY, JSON.stringify(session));
}

/** The API's answer to a choice: the choice itself, as it keeps it. */
function kept(key: string) {
  return (init?: RequestInit) => {
    const { title, visibility, description, activity } = JSON.parse(
      String(init?.body),
    ) as {
      title: string | null;
      visibility: "everyone" | "followers" | "only_me";
      description: string | null;
      activity: string;
    };
    const on = visibility !== "only_me";
    return Response.json({
      key,
      id: drawing.id,
      title,
      public: visibility === "everyone",
      published_at: on ? "2026-10-03T09:00:00Z" : null,
      visibility,
      description,
      activity,
      tags: [],
      photos: [],
    });
  };
}

/** The body of a choice: every field, as the app sends it. */
function choice(over: Record<string, unknown>) {
  return {
    title: null,
    visibility: "only_me",
    description: null,
    activity: "running",
    tags: [],
    ...over,
  };
}

const NO_RUNS = { activities: [], next: null, total: 0 };
const ACCOUNT: Answers = {
  "GET /me": () => Response.json(session.user),
  "GET /me/favorites": () => Response.json({ favorites: [] }),
  "GET /me/activities": () => Response.json(NO_RUNS),
  "POST /track-scores": () => Response.json(trackScore),
};
const MINE = `/users/${session.user.public_id}/drawings`;

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
    pauses: [],
  },
  status: "arrived",
};
const KEY = activityKey(ENDED.track.fixes[0]);
const SAVED = { ...STAR, id: KEY };
const RUN_DRAWING = `/me/activities/${KEY}/drawing`;
const STAR_DRAWING = `/me/activities/${STAR.id}/drawing`;

async function openOnRun(run: SavedRun) {
  saveRun(run);
  await render(<App />);
  await screen.findByText("Your run");
}

async function open() {
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
}

async function openProfile() {
  await fireEvent.press(screen.getByRole("tab", { name: /^Profile/ }));
}

/** The star of «My activities», opened on the map. */
async function openStar(answers: Answers) {
  signedIn();
  api({
    ...ACCOUNT,
    ...answers,
    "GET /me/activities": () => Response.json(activities),
    [`GET /me/activities/${STAR.id}`]: () => Response.json(activity),
  });
  await open();
  await openProfile();
  await fireEvent.press(await screen.findByRole("button", { name: /^My activities/ }));
  await fireEvent.press(
    await screen.findByRole("button", { name: `${STAR_ROW}, open on the map` }),
  );
  await screen.findByText("Back to the list");
}

beforeEach(() => {
  store.kept.clear();
  files.clear();
  injectJavaScript.mockClear();
  clearRun();
  saveOutbox([]);
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

test("«Who can see it» starts at «Only me»; «Everyone», and «Save» publishes the run with its title", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    [`PUT /me/activities/${KEY}`]: () => Response.json(SAVED, { status: 201 }),
    [`PUT ${RUN_DRAWING}`]: kept(KEY),
  });
  await openOnRun(ENDED);
  expect(
    await screen.findByRole("radio", { name: "Only me", checked: true }),
  ).toBeOnTheScreen();
  expect(screen.queryByText("Every member sees it in your profile.")).toBeNull();
  await fireEvent.press(screen.getByRole("radio", { name: "Everyone" }));
  expect(screen.getByText("Every member sees it in your profile.")).toBeOnTheScreen();
  expect(screen.getByLabelText("Title").props.placeholder).toBe("Give it a name");
  await fireEvent.changeText(screen.getByLabelText("Title"), " Sunday heart ");

  await fireEvent.press(screen.getByRole("button", { name: "Save to My activities" }));
  // The run first, then its drawing, once.
  await waitFor(() => expect(calls("PUT", RUN_DRAWING)).toHaveLength(1));
  const putRun = fetchSpy.mock.calls.findIndex(
    ([input, init]) =>
      String(input).endsWith(`/me/activities/${KEY}`) && init?.method === "PUT",
  );
  const putDrawing = fetchSpy.mock.calls.findIndex(
    ([input, init]) => String(input).endsWith(RUN_DRAWING) && init?.method === "PUT",
  );
  expect(putDrawing).toBeGreaterThan(putRun);
  expect(bodyOf("PUT", RUN_DRAWING)).toEqual(
    choice({ title: "Sunday heart", visibility: "everyone" }),
  );
  await waitFor(() => expect(loadDrawingOutbox()).toEqual([]));
  expect(loadOutbox()).toEqual([]);
});

test("a remembered «Everyone» publishes nothing without «Save»: the app closed and opened again", async () => {
  signedIn();
  saveVisibility(session.user.id, "everyone");
  api(ACCOUNT);
  saveRun(ENDED);
  const first = await render(<App />);
  await screen.findByText("Your run");
  expect(
    await screen.findByRole("radio", { name: "Everyone", checked: true }),
  ).toBeOnTheScreen();
  await first.unmount();
  // Killed on the form: the run is still only on the phone.
  await render(<App />);
  await screen.findByText("Your run");
  await screen.findByRole("radio", { name: "Everyone", checked: true });
  expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(0);
  expect(calls("PUT", RUN_DRAWING)).toHaveLength(0);
  expect(loadOutbox()).toEqual([]);
});

test("off and without a title, «Save» says nothing of a drawing", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    [`PUT /me/activities/${KEY}`]: () => Response.json(SAVED, { status: 201 }),
  });
  await openOnRun(ENDED);
  await fireEvent.press(
    await screen.findByRole("button", { name: "Save to My activities" }),
  );
  await waitFor(() => expect(calls("PUT", `/me/activities/${KEY}`)).toHaveLength(1));
  await waitFor(() => expect(loadOutbox()).toEqual([]));
  expect(calls("PUT", RUN_DRAWING)).toHaveLength(0);
});

test("without an account, the line says runs are kept and shared", async () => {
  api(ACCOUNT);
  await openOnRun(ENDED);
  expect(
    await screen.findByText(
      "Sign up or log in to keep your runs and share them as drawings.",
    ),
  ).toBeOnTheScreen();
  expect(screen.queryByRole("radio", { name: "Everyone" })).toBeNull();
});

// --- Without a network ---

test("saved without a network, the run goes public at the next opening, with its title on Strava too", async () => {
  signedIn();
  // The phone as the opening before left it: a run waiting, «Public» and
  // «Send to Strava» on, one title for both.
  saveOutbox([
    {
      id: KEY,
      owner: session.user.id,
      request: { ...activityRequest, shape: null },
      strava: { name: "Lunch heart" },
      drawing: { title: "Lunch heart", public: true },
    } as unknown as Waiting,
  ]);
  api({
    ...ACCOUNT,
    "GET /me/strava": () => Response.json(stravaStatus),
    [`PUT /me/activities/${KEY}`]: () => Response.json(SAVED, { status: 201 }),
    [`POST /me/activities/${KEY}/strava`]: () => Response.json(stravaActivity),
    [`PUT ${RUN_DRAWING}`]: kept(KEY),
  });
  await open();
  await waitFor(() => expect(calls("PUT", RUN_DRAWING)).toHaveLength(1));
  expect(bodyOf("PUT", RUN_DRAWING)).toEqual(
    choice({ title: "Lunch heart", visibility: "everyone" }),
  );
  expect(bodyOf("POST", `/me/activities/${KEY}/strava`)).toEqual({
    name: "Lunch heart",
  });
  await waitFor(() => expect(loadDrawingOutbox()).toEqual([]));
  expect(loadStravaOutbox()).toEqual([]);
  expect(loadOutbox()).toEqual([]);
});

test("a run waiting to go public says so in «My activities»", async () => {
  signedIn();
  saveOutbox([
    {
      id: KEY,
      owner: session.user.id,
      request: { ...activityRequest, shape: null },
      drawing: { title: null, public: true },
    } as unknown as Waiting,
  ]);
  api({
    ...ACCOUNT,
    // No network for the run.
    [`PUT /me/activities/${KEY}`]: () => {
      throw new TypeError("Network request failed");
    },
  });
  await open();
  await openProfile();
  await fireEvent.press(await screen.findByRole("button", { name: /^My activities/ }));
  expect(
    await screen.findByText("1 run is on this phone, waiting for a connection."),
  ).toBeOnTheScreen();
  expect(
    screen.getByText("Saved on the phone. Others see it when you are back online."),
  ).toBeOnTheScreen();
});

// --- A run of «My activities» ---

test("on a run of «My activities», «Public» publishes it and the title changes it", async () => {
  await openStar({
    [`GET ${STAR_DRAWING}`]: () =>
      Response.json({
        key: STAR.id,
        id: null,
        title: null,
        public: false,
        published_at: null,
      }),
    [`PUT ${STAR_DRAWING}`]: kept(STAR.id),
  });
  await fireEvent.press(await screen.findByRole("radio", { name: "Everyone" }));
  expect(
    await screen.findByRole("radio", { name: "Everyone", checked: true }),
  ).toBeOnTheScreen();
  expect(bodyOf("PUT", STAR_DRAWING)).toEqual(choice({ visibility: "everyone" }));
  expect(screen.getByText("Every member sees it in your profile.")).toBeOnTheScreen();

  const title = screen.getByLabelText("Title");
  await fireEvent.changeText(title, "Star of Trento");
  await fireEvent(title, "endEditing");
  await waitFor(() => expect(calls("PUT", STAR_DRAWING)).toHaveLength(2));
  expect(bodyOf("PUT", STAR_DRAWING, 1)).toEqual(
    choice({ title: "Star of Trento", visibility: "everyone" }),
  );
  // Typing over, nothing new: no call.
  await fireEvent(screen.getByLabelText("Title"), "endEditing");
  expect(calls("PUT", STAR_DRAWING)).toHaveLength(2);
});

test("without a network the choice waits on the phone, and says so", async () => {
  await openStar({
    [`GET ${STAR_DRAWING}`]: () =>
      Response.json({
        key: STAR.id,
        id: drawing.id,
        title: "Star",
        public: false,
        published_at: null,
      }),
    [`PUT ${STAR_DRAWING}`]: () => {
      throw new TypeError("Network request failed");
    },
  });
  await fireEvent.press(await screen.findByRole("radio", { name: "Everyone" }));
  expect(
    await screen.findByText(
      "Saved on the phone. Others see it when you are back online.",
    ),
  ).toBeOnTheScreen();
  expect(loadDrawingOutbox()).toEqual([
    {
      owner: session.user.id,
      key: STAR.id,
      ...choice({ title: "Star", visibility: "everyone" }),
    },
  ]);
});

test("a run too short to publish says why", async () => {
  await openStar({
    [`GET ${STAR_DRAWING}`]: () =>
      Response.json({
        key: STAR.id,
        id: null,
        title: null,
        public: false,
        published_at: null,
      }),
    [`PUT ${STAR_DRAWING}`]: () =>
      Response.json(apiError("invalid_request", "This run is too short to publish."), {
        status: 422,
      }),
  });
  await fireEvent.press(await screen.findByRole("radio", { name: "Everyone" }));
  expect(
    await screen.findByText("This run is too short to publish."),
  ).toBeOnTheScreen();
  expect(
    await screen.findByRole("radio", { name: "Only me", checked: true }),
  ).toBeOnTheScreen();
  expect(loadDrawingOutbox()).toEqual([]);
});

test("an API without drawings shows no «Public» on a run", async () => {
  await openStar({});
  await waitFor(() => expect(calls("GET", STAR_DRAWING)).toHaveLength(1));
  expect(screen.queryByRole("radio", { name: "Everyone" })).toBeNull();
});

test("a public run is marked in «My activities»", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    "GET /me/activities": () => Response.json(activities),
    "GET /me/drawings": () =>
      Response.json({
        drawings: [
          {
            key: STAR.id,
            id: drawing.id,
            title: null,
            public: true,
            published_at: "2026-10-03T09:00:00Z",
          },
        ],
      }),
  });
  await open();
  await openProfile();
  await fireEvent.press(await screen.findByRole("button", { name: /^My activities/ }));
  expect(
    await screen.findByRole("button", { name: `${STAR_ROW}, public, open on the map` }),
  ).toBeOnTheScreen();
  expect(screen.getAllByTestId("activity-public")).toHaveLength(1);
});

// --- The profile ---

test("the profile shows its drawings, and one opens on the map", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    [`GET ${MINE}`]: () => Response.json(drawings),
    [`GET /drawings/${drawing.id}`]: () => Response.json(drawing),
  });
  await open();
  await openProfile();
  expect(await screen.findByText("Drawings")).toBeOnTheScreen();
  await fireEvent.press(
    await screen.findByRole("button", {
      name: "Sunday heart by the river, open on the map",
    }),
  );
  // On the map, with its card under it; «Profile» out of the way.
  expect(await screen.findByText("Sunday heart by the river")).toBeOnTheScreen();
  expect(screen.getByText(dayLabel(drawing.started_at))).toBeOnTheScreen();
  expect(screen.getByText("4.00 km")).toBeOnTheScreen();
  // Its score (87) is not on the card.
  expect(screen.queryByLabelText(/^Score/)).toBeNull();
  expect(screen.queryByText(/out of 100/)).toBeNull();
  expect(screen.queryByText("Drawings")).toBeNull();
  // The cut run, as the line the map frames: yellow as in «Feed», no
  // white line over it, no time of day.
  const [lat, lon] = drawing.track[2];
  expect(scripts("showRoute").at(-1)).toContain(`[${lon},${lat}]`);
  expect(scripts("showTrack")).toHaveLength(0);
  expect(screen.queryByText(/\d\d:\d\d/)).toBeNull();

  await fireEvent.press(screen.getByRole("button", { name: "Back to the profile" }));
  expect(await screen.findByText("Drawings")).toBeOnTheScreen();
  expect(screen.queryByText("Back to the profile")).toBeNull();
});

test("an empty profile says how to fill it", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    [`GET ${MINE}`]: () => Response.json({ drawings: [], next: null, total: 0 }),
  });
  await open();
  await openProfile();
  expect(
    await screen.findByText(
      "No public drawings yet. Make a run public in My activities.",
    ),
  ).toBeOnTheScreen();
});
