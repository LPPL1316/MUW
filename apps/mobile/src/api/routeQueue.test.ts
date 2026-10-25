import { BACKGROUND_SHARE, MINUTE_MS, RouteQueue } from "./routeQueue";
import type { RouteOutcome } from "./routes";

const lost: RouteOutcome = { kind: "lost" };
const tooMany: RouteOutcome = {
  kind: "api_error",
  code: "too_many_requests",
  message: "Too many requests in a minute.",
};

beforeEach(() => {
  jest.useFakeTimers({ now: 1_000_000 });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

/** A request that answers when told to. */
function pending() {
  let answer: (outcome: RouteOutcome) => void = () => undefined;
  const promise = new Promise<RouteOutcome>((resolve) => {
    answer = resolve;
  });
  return { run: () => promise, answer };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
}

/** `n` requests in the background, each answered at once. */
async function fill(queue: RouteQueue, n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    await queue.background("visible", () => Promise.resolve(lost));
  }
}

test("a request in the background goes at once when its turn is now, before a tick", () => {
  const queue = new RouteQueue();
  const told: string[] = [];
  void queue.background(
    "visible",
    () => {
      told.push("run");
      return Promise.resolve(lost);
    },
    { onTurn: () => told.push("turn") },
  );
  expect(told).toEqual(["turn", "run"]);
});

test("nothing in the background starts while a request of the user runs", async () => {
  const queue = new RouteQueue();
  const user = pending();
  const asked = queue.user(user.run);
  const run = jest.fn(() => Promise.resolve(lost));
  const background = queue.background("visible", run);
  await settle();
  expect(run).not.toHaveBeenCalled();
  user.answer(lost);
  await expect(asked).resolves.toEqual(lost);
  await expect(background).resolves.toEqual(lost);
  expect(run).toHaveBeenCalledTimes(1);
});

test("the examples on the page go before what is drawn ahead", async () => {
  const queue = new RouteQueue();
  const user = pending();
  void queue.user(user.run);
  const order: string[] = [];
  const ask = (priority: "visible" | "prefetch", name: string) =>
    queue.background(priority, () => {
      order.push(name);
      return Promise.resolve(lost);
    });
  void ask("prefetch", "water");
  void ask("visible", "heart");
  void ask("prefetch", "moon");
  void ask("visible", "circle");
  user.answer(lost);
  await settle();
  expect(order).toEqual(["heart", "circle", "water", "moon"]);
});

test("what is drawn ahead stops at its share of the minute, the page's examples at theirs", async () => {
  const queue = new RouteQueue();
  await fill(queue, BACKGROUND_SHARE.prefetch);
  const ahead = jest.fn(() => Promise.resolve(lost));
  void queue.background("prefetch", ahead);
  await settle();
  expect(ahead).not.toHaveBeenCalled();
  // Half a minute later the page still has room, ahead of what waits.
  jest.advanceTimersByTime(MINUTE_MS / 2);
  await fill(queue, BACKGROUND_SHARE.visible - BACKGROUND_SHARE.prefetch);
  const shown = jest.fn(() => Promise.resolve(lost));
  void queue.background("visible", shown);
  await settle();
  expect(shown).not.toHaveBeenCalled();
  // The user's are never held: the rest of the minute is theirs.
  const user = jest.fn(() => Promise.resolve(lost));
  await queue.user(user);
  expect(user).toHaveBeenCalledTimes(1);
  // A minute after the first ten, room for the page, not yet for ahead.
  jest.advanceTimersByTime(MINUTE_MS / 2);
  await settle();
  expect(shown).toHaveBeenCalledTimes(1);
  expect(ahead).not.toHaveBeenCalled();
  jest.advanceTimersByTime(MINUTE_MS / 2);
  await settle();
  expect(ahead).toHaveBeenCalledTimes(1);
});

test("in any minute the background leaves the user eight of the API's thirty", async () => {
  expect(30 - BACKGROUND_SHARE.visible).toBe(8);
  const queue = new RouteQueue();
  const runs = jest.fn(() => Promise.resolve(lost));
  const all = Array.from({ length: 40 }, (_, i) =>
    queue.background(i % 2 === 0 ? "visible" : "prefetch", runs),
  );
  await settle();
  // Five of each up to ten, then the page's alone up to 22.
  expect(runs).toHaveBeenCalledTimes(22);
  // A minute later the page's last three, then ahead up to ten.
  jest.advanceTimersByTime(MINUTE_MS);
  await settle();
  expect(runs).toHaveBeenCalledTimes(32);
  jest.advanceTimersByTime(MINUTE_MS);
  await settle();
  expect(runs).toHaveBeenCalledTimes(40);
  await Promise.all(all);
});

test("after a 429 nothing goes in the background for a minute", async () => {
  const queue = new RouteQueue();
  await queue.user(() => Promise.resolve(tooMany));
  const run = jest.fn(() => Promise.resolve(lost));
  void queue.background("visible", run);
  jest.advanceTimersByTime(MINUTE_MS - 1);
  await settle();
  expect(run).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  await settle();
  expect(run).toHaveBeenCalledTimes(1);
});

test("a request no longer wanted while it waits never starts", async () => {
  const queue = new RouteQueue();
  const user = pending();
  void queue.user(user.run);
  const controller = new AbortController();
  const run = jest.fn(() => Promise.resolve(lost));
  const turn = jest.fn();
  const background = queue.background("visible", run, {
    signal: controller.signal,
    onTurn: turn,
  });
  controller.abort();
  await expect(background).resolves.toEqual({ kind: "cancelled" });
  user.answer(lost);
  await settle();
  expect(run).not.toHaveBeenCalled();
  expect(turn).not.toHaveBeenCalled();
});

test("forget lets go of what waits, and a user's request from before ends quietly", async () => {
  const queue = new RouteQueue();
  const user = pending();
  void queue.user(user.run);
  const waiting = queue.background("prefetch", () => Promise.resolve(lost));
  queue.forget();
  await expect(waiting).resolves.toEqual({ kind: "cancelled" });
  user.answer(lost);
  await settle();
  // The user's request of before does not count as ended twice: a new one
  // still holds the background.
  const now = pending();
  void queue.user(now.run);
  const run = jest.fn(() => Promise.resolve(lost));
  void queue.background("visible", run);
  await settle();
  expect(run).not.toHaveBeenCalled();
  now.answer(lost);
  await settle();
  expect(run).toHaveBeenCalledTimes(1);
});
