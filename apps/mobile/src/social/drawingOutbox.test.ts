import request from "@shaperoute/shared-types/fixtures/activity-request.json";
import myDrawing from "@shaperoute/shared-types/fixtures/my-drawing.json";

import { answers, apiError } from "../account/testing";
import type { ActivityRequest } from "../api/activities";
import { type DrawingChoice, NOT_CHOSEN } from "../api/drawings";
import { toDrawingOf, type Waiting } from "../activities/outbox";
import {
  DRAWING_OUTBOX_FILE,
  dropForDrawing,
  keepForDrawing,
  loadDrawingOutbox,
  MAX_DRAWINGS_WAITING,
  sendWaitingDrawings,
  waitingDrawing,
} from "./drawingOutbox";
import { keepPhoto, loadDrawingPhotos } from "./drawingPhotos";

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
const URI = `file:///documents/${DRAWING_OUTBOX_FILE}`;
const URL = "http://api";
const TOKEN = "the-token";
const options = (fetchFn: jest.Mock) => ({ fetchFn, key: null });

const ADAM = { public_id: "adam-id", username: "adam.trento" };
const HEART = {
  owner: 1,
  key: "a",
  title: "Heart",
  description: "Heavy legs.",
  activity: "running" as const,
  tags: [ADAM],
  visibility: "everyone" as const,
};
const ONLY_ME: DrawingChoice = { ...NOT_CHOSEN, title: null };

function bodyOf(fetchFn: jest.Mock, call: number): unknown {
  return JSON.parse(String(fetchFn.mock.calls[call][1]?.body));
}

beforeEach(() => {
  files.clear();
});

test("only the latest choice for a run waits, for its account", () => {
  expect(keepForDrawing(HEART)).toBe(true);
  expect(keepForDrawing({ owner: 2, key: "a", ...ONLY_ME })).toBe(true);
  expect(keepForDrawing({ ...HEART, visibility: "only_me" })).toBe(true);
  expect(loadDrawingOutbox()).toEqual([
    { owner: 2, key: "a", ...ONLY_ME },
    { ...HEART, visibility: "only_me" },
  ]);
  expect(waitingDrawing(1, "a")).toEqual({ ...HEART, visibility: "only_me" });
  expect(waitingDrawing(1, "b")).toBeNull();
});

test("a choice leaves the file only if no newer one took its place", () => {
  keepForDrawing(HEART);
  dropForDrawing({ ...HEART, visibility: "only_me" });
  expect(loadDrawingOutbox()).toEqual([HEART]);
  dropForDrawing({ ...HEART, tags: [] });
  expect(loadDrawingOutbox()).toEqual([HEART]);
  dropForDrawing(HEART);
  expect(files.has(URI)).toBe(false);
});

test("a phone a long time without a network keeps the latest choices", () => {
  for (let i = 0; i <= MAX_DRAWINGS_WAITING; i += 1) {
    keepForDrawing({ ...HEART, key: `run-${i}` });
  }
  const list = loadDrawingOutbox();
  expect(list).toHaveLength(MAX_DRAWINGS_WAITING);
  expect(list[0].key).toBe("run-1");
});

test("a file that cannot be read is no choice; a choice of before TASK-208 is made whole", () => {
  files.set(URI, "not json");
  expect(loadDrawingOutbox()).toEqual([]);
  files.set(
    URI,
    JSON.stringify([
      { owner: 1, key: "a" },
      HEART,
      { owner: 1, key: "b", title: "Old heart", public: true },
    ]),
  );
  expect(loadDrawingOutbox()).toEqual([
    HEART,
    { owner: 1, key: "b", ...NOT_CHOSEN, title: "Old heart", visibility: "everyone" },
  ]);
});

test("the choices of the account go whole, and leave the file", async () => {
  keepForDrawing(HEART);
  keepForDrawing({ owner: 2, key: "b", ...ONLY_ME });
  const fetchFn = answers({ status: 200, body: myDrawing });
  expect(await sendWaitingDrawings(URL, TOKEN, 1, options(fetchFn))).toBe("done");
  expect(fetchFn).toHaveBeenCalledTimes(1);
  const [url] = fetchFn.mock.calls[0];
  expect(url).toBe("http://api/me/activities/a/drawing");
  expect(bodyOf(fetchFn, 0)).toEqual({
    title: "Heart",
    visibility: "everyone",
    description: "Heavy legs.",
    activity: "running",
    tags: ["adam-id"],
  });
  // Another account's choice is not sent with this token.
  expect(loadDrawingOutbox()).toEqual([{ owner: 2, key: "b", ...ONLY_ME }]);
});

test("after the choice go the run's photos, while others see it", async () => {
  keepForDrawing(HEART);
  keepPhoto(1, "a", 1, "AAAA");
  keepPhoto(1, "a", 3, "CCCC");
  const fetchFn = answers(
    { status: 200, body: myDrawing },
    { status: 200, body: myDrawing },
    { status: 200, body: myDrawing },
  );
  expect(await sendWaitingDrawings(URL, TOKEN, 1, options(fetchFn))).toBe("done");
  expect(fetchFn.mock.calls.map(([url]) => url)).toEqual([
    "http://api/me/activities/a/drawing",
    "http://api/me/activities/a/drawing/photos/1",
    "http://api/me/activities/a/drawing/photos/3",
  ]);
  expect(bodyOf(fetchFn, 1)).toEqual({ image: "AAAA" });
  expect(loadDrawingOutbox()).toEqual([]);
  expect(loadDrawingPhotos().map((item) => item.sent)).toEqual([true, true]);
});

describe("an entry in a monthly challenge (TASK-343 part B)", () => {
  const ENTRY = { contest: "the-contest", entered: true };
  const NOTHING = { status: 204 };
  const ENTRY_URL = `http://api/contests/the-contest/entries/${myDrawing.id}`;

  test("it waits in the file with its choice, and a choice without one has none", () => {
    keepForDrawing({ ...HEART, entry: ENTRY });
    expect(waitingDrawing(1, "a")?.entry).toEqual(ENTRY);
    keepForDrawing({ ...HEART, key: "b" });
    expect(waitingDrawing(1, "b")).not.toHaveProperty("entry");
  });

  test("it goes after the drawing, and is not part of the drawing", async () => {
    keepForDrawing({ ...HEART, entry: ENTRY });
    const fetchFn = answers({ status: 200, body: myDrawing }, NOTHING);
    expect(await sendWaitingDrawings(URL, TOKEN, 1, options(fetchFn))).toBe("done");
    expect(fetchFn.mock.calls.map(([url]) => url)).toEqual([
      "http://api/me/activities/a/drawing",
      ENTRY_URL,
    ]);
    expect(bodyOf(fetchFn, 0)).not.toHaveProperty("entry");
    expect(fetchFn.mock.calls[1][1]?.method).toBe("PUT");
    expect(loadDrawingOutbox()).toEqual([]);
  });

  test("a withdrawal is a DELETE", async () => {
    keepForDrawing({ ...HEART, entry: { ...ENTRY, entered: false } });
    const fetchFn = answers({ status: 200, body: myDrawing }, NOTHING);
    expect(await sendWaitingDrawings(URL, TOKEN, 1, options(fetchFn))).toBe("done");
    expect(fetchFn.mock.calls[1][1]?.method).toBe("DELETE");
    expect(loadDrawingOutbox()).toEqual([]);
  });

  test("a drawing no longer for everyone sends no entry", async () => {
    keepForDrawing({ ...HEART, visibility: "followers", entry: ENTRY });
    const fetchFn = answers({ status: 200, body: myDrawing });
    expect(await sendWaitingDrawings(URL, TOKEN, 1, options(fetchFn))).toBe("done");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("without a network it stays, to go again", async () => {
    keepForDrawing({ ...HEART, entry: ENTRY });
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(Response.json(myDrawing))
      .mockRejectedValueOnce(new Error("offline"));
    expect(await sendWaitingDrawings(URL, TOKEN, 1, options(fetchFn))).toBe("done");
    expect(waitingDrawing(1, "a")?.entry).toEqual(ENTRY);
  });

  test("refused, or an API that has no such endpoint: it leaves, the drawing stays", async () => {
    for (const refusal of [
      { status: 409, body: apiError("not_entrant", "No.") },
      { status: 404, body: apiError("http_error", "Not Found") },
    ]) {
      keepForDrawing({ ...HEART, entry: ENTRY });
      const fetchFn = answers({ status: 200, body: myDrawing }, refusal);
      expect(await sendWaitingDrawings(URL, TOKEN, 1, options(fetchFn))).toBe("done");
      expect(fetchFn).toHaveBeenCalledTimes(2);
      expect(loadDrawingOutbox()).toEqual([]);
    }
  });

  test("an ended session stops and says so", async () => {
    keepForDrawing({ ...HEART, entry: ENTRY });
    const fetchFn = answers(
      { status: 200, body: myDrawing },
      { status: 401, body: apiError("session_expired", "Log in again.") },
    );
    expect(await sendWaitingDrawings(URL, TOKEN, 1, options(fetchFn))).toBe(
      "session_ended",
    );
    expect(waitingDrawing(1, "a")?.entry).toEqual(ENTRY);
  });
});

test("with «Only me» the photos stay on the phone, and nothing more is sent", async () => {
  keepForDrawing({ ...HEART, visibility: "only_me" });
  keepPhoto(1, "a", 1, "AAAA");
  const fetchFn = answers({ status: 200, body: myDrawing });
  expect(await sendWaitingDrawings(URL, TOKEN, 1, options(fetchFn))).toBe("done");
  expect(fetchFn).toHaveBeenCalledTimes(1);
  expect(loadDrawingOutbox()).toEqual([]);
  expect(loadDrawingPhotos()).toEqual([{ owner: 1, key: "a", n: 1, sent: false }]);
});

test("a photo the API will not take yet keeps its choice waiting, to go again before it", async () => {
  keepForDrawing(HEART);
  keepPhoto(1, "a", 1, "AAAA");
  const fetchFn = answers(
    { status: 200, body: myDrawing },
    { status: 409, body: apiError("http_error", "Photos stay on the phone…") },
  );
  expect(await sendWaitingDrawings(URL, TOKEN, 1, options(fetchFn))).toBe("done");
  expect(loadDrawingOutbox()).toEqual([HEART]);
  expect(loadDrawingPhotos()).toEqual([{ owner: 1, key: "a", n: 1, sent: false }]);
});

test("without a network the choices wait on", async () => {
  keepForDrawing(HEART);
  keepForDrawing({ ...HEART, key: "b" });
  const fetchFn = answers(new TypeError("Network request failed"));
  expect(await sendWaitingDrawings(URL, TOKEN, 1, options(fetchFn))).toBe("done");
  expect(fetchFn).toHaveBeenCalledTimes(1);
  expect(loadDrawingOutbox()).toHaveLength(2);
});

test("a run too short to publish keeps the rest of its choice, for its owner only", async () => {
  keepForDrawing(HEART);
  const fetchFn = answers(
    {
      status: 422,
      body: apiError("invalid_request", "This run is too short to publish."),
    },
    { status: 200, body: { ...myDrawing, public: false } },
  );
  await sendWaitingDrawings(URL, TOKEN, 1, options(fetchFn));
  expect(bodyOf(fetchFn, 1)).toEqual({
    title: "Heart",
    visibility: "only_me",
    description: "Heavy legs.",
    activity: "running",
    tags: ["adam-id"],
  });
  expect(loadDrawingOutbox()).toEqual([]);
});

test("a run too short to publish with nothing else chosen is let go", async () => {
  keepForDrawing({ owner: 1, key: "a", ...NOT_CHOSEN, visibility: "everyone" });
  const fetchFn = answers({
    status: 422,
    body: apiError("invalid_request", "This run is too short to publish."),
  });
  await sendWaitingDrawings(URL, TOKEN, 1, options(fetchFn));
  expect(fetchFn).toHaveBeenCalledTimes(1);
  expect(loadDrawingOutbox()).toEqual([]);
});

test("a run the API no longer has is let go", async () => {
  keepForDrawing(HEART);
  const fetchFn = answers({ status: 404, body: apiError("http_error") });
  await sendWaitingDrawings(URL, TOKEN, 1, options(fetchFn));
  expect(loadDrawingOutbox()).toEqual([]);
});

test("an ended session stops and says so", async () => {
  keepForDrawing(HEART);
  const fetchFn = answers({ status: 401, body: apiError("session_expired") });
  expect(await sendWaitingDrawings(URL, TOKEN, 1, options(fetchFn))).toBe(
    "session_ended",
  );
  expect(loadDrawingOutbox()).toEqual([HEART]);
});

test("a run waiting for the API keeps what was chosen for after", () => {
  const run: Waiting = { id: "a", owner: 1, request: request as ActivityRequest };
  expect(toDrawingOf(run)).toBeNull();
  const { owner: _owner, key: _key, ...choice } = HEART;
  expect(toDrawingOf({ ...run, drawing: choice })).toEqual(choice);
  // A run saved by the app of before TASK-208.
  expect(
    toDrawingOf({
      ...run,
      drawing: { title: "Heart", public: true },
    } as unknown as Waiting),
  ).toEqual({ ...NOT_CHOSEN, title: "Heart", visibility: "everyone" });
  expect(
    toDrawingOf({
      ...run,
      drawing: { title: "", public: false },
    } as unknown as Waiting),
  ).toEqual(NOT_CHOSEN);
  expect(
    toDrawingOf({ ...run, drawing: { title: "Heart" } } as unknown as Waiting),
  ).toBeNull();
});
