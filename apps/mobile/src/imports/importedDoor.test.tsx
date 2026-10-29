import { readFileSync } from "fs";
import { join } from "path";

import activities from "@shaperoute/shared-types/fixtures/activities.json";
import imported from "@shaperoute/shared-types/fixtures/activities-imported.json";
import detail from "@shaperoute/shared-types/fixtures/activity-imported.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { Session } from "@shaperoute/shared-types";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import type { Account } from "../account/useAccount";
import { useActivitiesOf } from "../activities/activitiesDoor";
import { keepWaiting, loadOutbox } from "../activities/outbox";
import { type ImportedRun, importedRun } from "./importFile";

// An activity added from a file in «My activities» (TASK-312): it goes with
// the PUT of a recorded run, `source: "file"`, and asks nothing of Play; and
// before the form, whether the account has it already, by its key alone.

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

function stravaRun(): ImportedRun {
  const bytes = readFileSync(
    join(__dirname, "../../__tests__/fixtures/imports/strava-run.gpx"),
  );
  const outcome = importedRun(new Uint8Array(bytes));
  if (outcome.kind !== "ok") {
    throw new Error(outcome.problem);
  }
  return outcome.imported;
}

type Call = { url: string; method: string; body: unknown };

/** A fetch that answers the list with `list`, a run's GET with `found`
 * (404 without), and a PUT with the imported run of the list. */
function api(list: unknown, found: unknown = null) {
  const calls: Call[] = [];
  const fetchFn = jest.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({
      url,
      method,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
    });
    if (method === "PUT") {
      return Response.json(imported.activities[0], { status: 201 });
    }
    if (/\/me\/activities\/[0-9a-f]+$/.test(url)) {
      return found === null
        ? Response.json(
            { error: { code: "http_error", message: "Not Found" } },
            { status: 404 },
          )
        : Response.json(found, { status: 200 });
    }
    return Response.json(list, { status: 200 });
  });
  return { fetchFn, calls };
}

async function door(fetchFn: jest.Mock) {
  const me = account();
  const hook = await renderHook(() =>
    useActivitiesOf(URL, me, doors, { fetchFn, key: null }),
  );
  await waitFor(() => expect(hook.result.current.status).toBe("ready"));
  return hook;
}

beforeEach(() => {
  files.clear();
});

test("«Save» sends the run with source «file», and asks Play nothing", async () => {
  const { fetchFn, calls } = api(activities);
  const { result } = await door(fetchFn);
  const run = stravaRun();
  let kept = false;
  await act(async () => {
    kept = result.current.recordImported(run);
  });
  expect(kept).toBe(true);
  await waitFor(() => expect(calls.some((call) => call.method === "PUT")).toBe(true));
  const put = calls.find((call) => call.method === "PUT")!;
  expect(put.url).toBe(`${URL}/me/activities/${run.id}`);
  expect(put.body).toEqual(run.request);
  expect((put.body as { source: string }).source).toBe("file");
  // Gone from the phone once the API has it, and nothing asked of the game.
  await waitFor(() => expect(loadOutbox()).toEqual([]));
  expect(calls.some((call) => call.url.includes("/game/"))).toBe(false);
});

test("the choices told before «Save» go with the imported run", async () => {
  const { fetchFn } = api(activities);
  // Without a network: the run waits on the phone, as a recorded one.
  fetchFn.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      throw new TypeError("Network request failed");
    }
    return Response.json(activities, { status: 200 });
  });
  const { result } = await door(fetchFn);
  const run = stravaRun();
  await act(async () => {
    result.current.toStrava(null);
    result.current.toDrawing({
      title: "Old 10k",
      description: null,
      activity: "running",
      tags: [],
      visibility: "everyone",
    });
    result.current.toPhotos([]);
    result.current.recordImported(run);
  });
  const [waiting] = loadOutbox();
  expect(waiting.id).toBe(run.id);
  expect(waiting.request.source).toBe("file");
  expect(waiting.drawing?.title).toBe("Old 10k");
  expect(waiting.strava).toBeUndefined();
});

test("a run on the API already is kept: asked by its key alone", async () => {
  const run = stravaRun();
  const { fetchFn, calls } = api(activities, { ...detail, id: run.id });
  const { result } = await door(fetchFn);
  let already = false;
  await act(async () => {
    already = await result.current.alreadyKept(run.id);
  });
  expect(already).toBe(true);
  const asked = calls.filter((call) => call.url.endsWith(run.id));
  expect(asked).toEqual([
    { url: `${URL}/me/activities/${run.id}`, method: "GET", body: null },
  ]);
});

test("a run the API does not have, or cannot say, is not kept", async () => {
  const run = stravaRun();
  const { fetchFn } = api(activities);
  const { result } = await door(fetchFn);
  let already = true;
  await act(async () => {
    already = await result.current.alreadyKept(run.id);
  });
  expect(already).toBe(false);
  fetchFn.mockRejectedValue(new TypeError("Network request failed"));
  await act(async () => {
    already = await result.current.alreadyKept(run.id);
  });
  expect(already).toBe(false);
});

test("a run in the list or waiting on the phone is kept, without asking", async () => {
  const { fetchFn, calls } = api(imported);
  const { result } = await door(fetchFn);
  let already = false;
  await act(async () => {
    already = await result.current.alreadyKept(imported.activities[0].id);
  });
  expect(already).toBe(true);
  const run = stravaRun();
  keepWaiting({ ...run, owner: signedIn.user.id });
  await act(async () => {
    already = await result.current.alreadyKept(run.id);
  });
  expect(already).toBe(true);
  expect(calls.some((call) => call.url.endsWith(run.id))).toBe(false);
});
