import activities from "@shaperoute/shared-types/fixtures/activities.json";
import request from "@shaperoute/shared-types/fixtures/activity-request.json";
import run from "@shaperoute/shared-types/fixtures/game-run.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { LatLon, Session } from "@shaperoute/shared-types";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import type { Account } from "../account/useAccount";
import type { ActivityRequest } from "../api/activities";
import { onUnlocked, type Unlocked } from "../game/unlocks";
import type { SavedRun } from "../navigation/trackStore";
import { useActivitiesOf } from "./activitiesDoor";
import { activityKey } from "./activityKey";
import { keepWaiting, type Waiting } from "./outbox";

// The shape game (TASK-296 part B): once the API has taken a run, the door
// asks what it unlocked, and the card is told; for a run «Save» just kept,
// with when, so the card waits for the logo.

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
  return { File, files, Paths: { document: { uri: "file:///documents/" } } };
});

const { files } = jest.requireMock<{ files: Map<string, string> }>("expo-file-system");
const URL = "http://api";
const signedIn = session as Session;
const OWNER = signedIn.user.id;
const doors = { onList: jest.fn(), onAccount: jest.fn(), onOpened: jest.fn() };

function account(): Account {
  return {
    state: { status: "signedIn", session: signedIn },
    busy: null,
    problem: null,
    signUp: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    deleteAccount: jest.fn(),
    editProfile: jest.fn(),
    changeEmail: jest.fn(),
    changePhone: jest.fn(),
    changeNotifications: jest.fn(),
    clearProblem: jest.fn(),
    sessionEnded: jest.fn(),
  };
}

/** A fetch that takes every run, lists the fixture, and says what each
 * run was worth to the game as `worth` says by key; the calls, in order. */
function api(worth: Record<string, unknown>) {
  const calls: string[] = [];
  const fetchFn = jest.fn(async (url: string, init?: RequestInit) => {
    const path = url.replace(URL, "");
    calls.push(`${init?.method ?? "GET"} ${path}`);
    if (init?.method === "PUT") {
      return Response.json(activities.activities[0], { status: 200 });
    }
    if (path.startsWith("/game/runs/")) {
      const key = path.slice("/game/runs/".length);
      return key in worth
        ? Response.json(worth[key])
        : Response.json(
            { error: { code: "http_error", message: path } },
            { status: 404 },
          );
    }
    return Response.json(activities, { status: 200 });
  });
  return { fetchFn, calls };
}

async function door(fetchFn: jest.Mock) {
  const account_ = account();
  return renderHook(() =>
    useActivitiesOf(URL, account_, doors, { fetchFn, key: null }),
  );
}

const FIXES = request.track.map((fix) => ({
  point: fix.point as LatLon,
  timeMs: fix.time_ms,
  accuracyM: fix.accuracy_m,
}));
const RUN: SavedRun = {
  version: 1,
  route: request.points as LatLon[],
  similarity: request.similarity,
  track: {
    fixes: FIXES,
    distanceM: 4007,
    pauses: [{ fromMs: 1790000300000, toMs: 1790000360000, auto: true }],
  },
  status: "arrived",
};
const STAR = { shape: "star", word: null, style: null, title: null };
const KEY = activityKey(FIXES[0]);

let told: jest.Mock<void, [Unlocked]>;
let stop: () => void;

beforeEach(() => {
  files.clear();
  told = jest.fn();
  stop = onUnlocked(told);
});

afterEach(() => stop());

test("a run that waited is told of its shapes at once", async () => {
  keepWaiting({
    id: "a",
    owner: OWNER,
    request: request as ActivityRequest,
  } as Waiting);
  const { fetchFn, calls } = api({ a: run });
  await door(fetchFn);
  await waitFor(() => expect(told).toHaveBeenCalledTimes(1));
  expect(told).toHaveBeenCalledWith({ shapeIds: ["triangle"], keptAt: null });
  expect(calls).toContain("PUT /me/activities/a");
  expect(calls).toContain("GET /game/runs/a");
});

test("a run «Save» just kept is told with when it was kept", async () => {
  const before = Date.now();
  const { fetchFn } = api({ [KEY]: run });
  const { result } = await door(fetchFn);
  await act(async () => {
    expect(result.current.record(RUN, STAR)).toBe(true);
  });
  await waitFor(() => expect(told).toHaveBeenCalledTimes(1));
  const [{ shapeIds, keptAt }] = told.mock.calls[0];
  expect(shapeIds).toEqual(["triangle"]);
  expect(keptAt).toBeGreaterThanOrEqual(before);
  expect(keptAt).toBeLessThanOrEqual(Date.now());
});

test("a run that unlocked nothing, or an API before the game, tells nothing", async () => {
  keepWaiting({
    id: "a",
    owner: OWNER,
    request: request as ActivityRequest,
  } as Waiting);
  keepWaiting({
    id: "b",
    owner: OWNER,
    request: request as ActivityRequest,
  } as Waiting);
  const { fetchFn, calls } = api({ a: { ...run, unlocked: [] } });
  await door(fetchFn);
  await waitFor(() => expect(calls).toContain("GET /game/runs/b"));
  await waitFor(() => expect(calls.filter((c) => c.startsWith("PUT"))).toHaveLength(2));
  expect(told).not.toHaveBeenCalled();
});
