import myDrawing from "@shaperoute/shared-types/fixtures/my-drawing.json";

import { answers, apiError } from "../account/testing";
import {
  DRAWING_ORDERS_FILE,
  forgetAllOrdersOf,
  forgetOrderOf,
  keepOrder,
  loadDrawingOrders,
  orderOnPhone,
  syncOrder,
} from "./drawingOrder";

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
const TOKEN = "the-token";
const options = (fetchFn: jest.Mock) => ({ fetchFn, key: null });
const ORDER = ["photo:2", "drawing", "photo:1"];

beforeEach(() => {
  files.clear();
});

test("an order is kept per run, in place of the one before, as not sent", () => {
  expect(keepOrder(1, "a", ["drawing", "photo:1"])).toBe(true);
  expect(keepOrder(1, "a", ORDER)).toBe(true);
  expect(keepOrder(1, "b", ["photo:1", "drawing"])).toBe(true);
  expect(orderOnPhone(1, "a")).toEqual(ORDER);
  expect(orderOnPhone(2, "a")).toBeNull();
  expect(loadDrawingOrders()).toEqual([
    { owner: 1, key: "a", order: ORDER, sent: false },
    { owner: 1, key: "b", order: ["photo:1", "drawing"], sent: false },
  ]);
  expect(files.has(`file:///documents/${DRAWING_ORDERS_FILE}`)).toBe(true);
});

test("a run or an account gone takes its orders with it", () => {
  keepOrder(1, "a", ORDER);
  keepOrder(1, "b", ORDER);
  keepOrder(2, "a", ORDER);
  forgetOrderOf(1, "a");
  expect(orderOnPhone(1, "a")).toBeNull();
  forgetAllOrdersOf(1);
  expect(loadDrawingOrders()).toEqual([
    { owner: 2, key: "a", order: ORDER, sent: false },
  ]);
});

test("the order goes once while others see the drawing, then is sent", async () => {
  keepOrder(1, "a", ORDER);
  const fetchFn = answers({ status: 200, body: { ...myDrawing, order: ORDER } });
  await expect(
    syncOrder(URL, TOKEN, 1, "a", "followers", options(fetchFn)),
  ).resolves.toBe("done");
  const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
  expect(url).toBe(`${URL}/me/activities/a/drawing/order`);
  expect(init.method).toBe("PUT");
  expect(JSON.parse(String(init.body))).toEqual({ order: ORDER });
  expect(loadDrawingOrders()).toEqual([
    { owner: 1, key: "a", order: ORDER, sent: true },
  ]);
  // Sent: nothing more to do.
  const again = answers();
  await expect(syncOrder(URL, TOKEN, 1, "a", "everyone", options(again))).resolves.toBe(
    "done",
  );
  expect(again).not.toHaveBeenCalled();
});

test("made «Only me», the order stays here, to go again when it opens", async () => {
  keepOrder(1, "a", ORDER);
  await syncOrder(
    URL,
    TOKEN,
    1,
    "a",
    "everyone",
    options(answers({ status: 200, body: myDrawing })),
  );
  const none = answers();
  await expect(syncOrder(URL, TOKEN, 1, "a", "only_me", options(none))).resolves.toBe(
    "done",
  );
  expect(none).not.toHaveBeenCalled();
  expect(loadDrawingOrders()).toEqual([
    { owner: 1, key: "a", order: ORDER, sent: false },
  ]);
});

test("no network or a 409 leaves it waiting; a 422 lets it go", async () => {
  keepOrder(1, "a", ORDER);
  await expect(
    syncOrder(URL, TOKEN, 1, "a", "everyone", options(answers(new Error("offline")))),
  ).resolves.toBe("waits");
  await expect(
    syncOrder(
      URL,
      TOKEN,
      1,
      "a",
      "everyone",
      options(answers({ status: 409, body: apiError("http_error") })),
    ),
  ).resolves.toBe("waits");
  expect(orderOnPhone(1, "a")).toEqual(ORDER);
  await expect(
    syncOrder(
      URL,
      TOKEN,
      1,
      "a",
      "everyone",
      options(answers({ status: 422, body: apiError("invalid_request") })),
    ),
  ).resolves.toBe("done");
  expect(orderOnPhone(1, "a")).toBeNull();
});

test("a run with no order chosen here asks nothing", async () => {
  const fetchFn = answers();
  await expect(
    syncOrder(URL, TOKEN, 1, "a", "everyone", options(fetchFn)),
  ).resolves.toBe("done");
  expect(fetchFn).not.toHaveBeenCalled();
});
