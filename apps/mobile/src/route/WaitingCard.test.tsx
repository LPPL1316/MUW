import type { RouteRequest, RouteResult } from "@shaperoute/shared-types";
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import { act, render, screen } from "@testing-library/react-native";
import { Profiler } from "react";

import { LIGHT_TICK_MS, PEN_MS, PEN_TICK_MS } from "./PenDrawing";
import { RouteOutcome } from "./RoutePanel";
import {
  CARD_AFTER_MS,
  pickKind,
  PEN_HOLD_MS,
  WAITING_POSTS,
  WaitingCard,
  WaitingLine,
} from "./WaitingCard";
import { FUN_LINES, LINE_MS } from "./waitingLines";

// The wait in «Draw» (TASK-317): the lines that take turns, and from 3 s
// the card with the pen, the drawings of «Feed» or «Guess the shape».

const START: [number, number] = [46.0671, 11.1214];
/** 5 km: the engine may draw it on the phone (TASK-214). */
const heart: RouteRequest = {
  start: START,
  shape: "heart",
  distance_m: 5000,
  activity: "running",
};
/** 15 km: drawn by the server. */
const longHeart: RouteRequest = { ...heart, distance_m: 15000 };

/** The numbers a test gives as `Math.random` would: the first picks the kind. */
function numbers(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}
const PEN = () => numbers(0, 0.999999);
const DRAWINGS = () => numbers(0.4, 0.999999);
const GAME = () => numbers(0.7, 0.999999);

async function wait(ms: number) {
  await act(() => jest.advanceTimersByTimeAsync(ms));
}

/** The strokes the pen has drawn so far: the box's children but the pen. */
function strokes(): number {
  const box = screen.getByTestId("pen-drawing");
  return box.children.length - (screen.queryByTestId("pen") === null ? 0 : 1);
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test("each kind comes from the number drawn", () => {
  expect(pickKind(() => 0)).toBe("pen");
  expect(pickKind(() => 0.4)).toBe("drawings");
  expect(pickKind(() => 0.7)).toBe("game");
  expect(pickKind(() => 1)).toBe("game");
});

test("the drawings are those of «Feed» a thumbnail draws: north up, in one piece", () => {
  expect(WAITING_POSTS.length).toBeGreaterThanOrEqual(10);
  for (const post of WAITING_POSTS) {
    expect(post.rotation_deg ?? 0).toBe(0);
    expect(post.gaps ?? []).toEqual([]);
  }
});

test("the card comes only after 3 s of waiting", async () => {
  await render(
    <WaitingCard request={heart} startedAt={Date.now()} random={numbers(0)} />,
  );
  expect(screen.queryByTestId("waiting-pen")).not.toBeOnTheScreen();
  await wait(CARD_AFTER_MS - 100);
  expect(screen.queryByTestId("waiting-pen")).not.toBeOnTheScreen();
  await wait(100);
  expect(screen.getByTestId("waiting-pen")).toBeOnTheScreen();
  expect(screen.getByText("MEANWHILE, FROM THE FEED")).toBeOnTheScreen();
});

test("a wait already long shows the card at once", async () => {
  await render(
    <WaitingCard request={heart} startedAt={Date.now() - 60_000} random={numbers(0)} />,
  );
  expect(screen.getByTestId("waiting-pen")).toBeOnTheScreen();
});

test("the pen traces a drawing, holds it, then traces the next", async () => {
  await render(
    <WaitingCard request={longHeart} startedAt={Date.now() - 60_000} random={PEN()} />,
  );
  const first = WAITING_POSTS.map((post) => post.title).find((title) =>
    screen.queryByText(title),
  );
  expect(first).toBeDefined();
  expect(strokes()).toBe(0);
  await wait(PEN_MS / 4);
  const quarter = strokes();
  expect(quarter).toBeGreaterThan(0);
  expect(screen.getByTestId("pen")).toBeOnTheScreen();
  await wait(PEN_MS / 4);
  expect(strokes()).toBeGreaterThan(quarter);
  // Traced to the end: the pen is lifted, the drawing stays a moment.
  await wait(PEN_MS / 2);
  expect(screen.queryByTestId("pen")).not.toBeOnTheScreen();
  expect(screen.getByText(first ?? "")).toBeOnTheScreen();
  await wait(PEN_HOLD_MS);
  expect(screen.queryByText(first ?? "")).not.toBeOnTheScreen();
  expect(strokes()).toBe(0);
});

test("the caption says who drew it, where, and how long it was", async () => {
  await render(
    <WaitingCard request={longHeart} startedAt={Date.now() - 60_000} random={PEN()} />,
  );
  expect(screen.getByText(/^[\w.]+ · [A-Z][\w ]+ · \d+(\.\d)? km$/)).toBeOnTheScreen();
});

test("the drawings of «Feed» in a row", async () => {
  await render(
    <WaitingCard request={heart} startedAt={Date.now() - 60_000} random={DRAWINGS()} />,
  );
  expect(screen.getByTestId("waiting-drawings")).toBeOnTheScreen();
  for (const post of WAITING_POSTS) {
    expect(screen.getAllByText(post.title).length).toBeGreaterThan(0);
  }
  // It moves on by itself without breaking.
  await wait(30_000);
  expect(screen.getByTestId("waiting-drawings")).toBeOnTheScreen();
});

test("or «Guess the shape»", async () => {
  await render(
    <WaitingCard request={heart} startedAt={Date.now() - 60_000} random={GAME()} />,
  );
  expect(screen.getByTestId("guess-shape")).toBeOnTheScreen();
  expect(screen.getAllByRole("button")).toHaveLength(3);
});

/**
 * The card's renders a second, over 10 s once it is there. Time goes on in
 * steps of 50 ms: inside one `act` React would make a single render of all
 * the updates.
 */
async function commitsPerSecond(request: RouteRequest, random: () => number) {
  let commits = 0;
  await render(
    <Profiler id="card" onRender={() => (commits += 1)}>
      <WaitingCard request={request} startedAt={Date.now() - 60_000} random={random} />
    </Profiler>,
  );
  commits = 0;
  for (let step = 0; step < 200; step += 1) {
    await wait(50);
  }
  return commits / 10;
}

test("while the engine may draw on the phone, the card moves on as seldom as the bar", async () => {
  // The engine runs in its WebView (TASK-214); the card, in the app's
  // JavaScript, gives it only a few light updates a second.
  const light = 1000 / LIGHT_TICK_MS;
  const pen = await commitsPerSecond(heart, numbers(0));
  expect(pen).toBeLessThanOrEqual(light);
  expect(pen).toBeGreaterThanOrEqual(light - 1);
  expect(await commitsPerSecond(heart, GAME())).toBeLessThanOrEqual(light);
  // The row of drawings scrolls natively, and draws nothing again.
  expect(await commitsPerSecond(heart, DRAWINGS())).toBe(0);
  // On the server's routes the pen is smoother.
  const smooth = await commitsPerSecond(longHeart, numbers(0));
  expect(smooth).toBeLessThanOrEqual(1000 / PEN_TICK_MS);
  expect(smooth).toBeGreaterThan(light);
});

test("the card asks nothing of the network", async () => {
  const fetchSpy = jest.fn();
  const saved = global.fetch;
  global.fetch = fetchSpy as unknown as typeof fetch;
  try {
    for (const random of [numbers(0), DRAWINGS(), GAME()]) {
      const { unmount } = await render(
        <WaitingCard request={heart} startedAt={Date.now()} random={random} />,
      );
      await wait(60_000);
      await unmount();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    global.fetch = saved;
  }
});

test("the line of a phase with its own comes first and back at every third", async () => {
  const own = "Drawing a 5 km heart…";
  const funLines: readonly string[] = FUN_LINES;
  await render(
    <WaitingLine own={own} word={null} phase="computing" random={numbers(0)} />,
  );
  const line = () => String(screen.getByTestId("waiting-line").props.children);
  expect(line()).toBe(own);
  await wait(LINE_MS);
  expect(funLines).toContain(line());
  await wait(LINE_MS);
  expect(line()).not.toBe(own);
  await wait(LINE_MS);
  expect(line()).toBe(own);
});

test("a new phase starts with its own line at once", async () => {
  const funLines: readonly string[] = FUN_LINES;
  const view = (phase: "queued" | "downloading_map", own: string | null) => (
    <WaitingLine own={own} word={null} phase={phase} random={numbers(0.5)} />
  );
  const { rerender } = await render(view("queued", null));
  const line = () => String(screen.getByTestId("waiting-line").props.children);
  expect(funLines).toContain(line());
  await wait(2 * LINE_MS);
  await rerender(view("downloading_map", "First time here: studying the map…"));
  expect(line()).toBe("First time here: studying the map…");
});

test("in «Draw» the card goes when the route comes", async () => {
  const outcome = (view: Parameters<typeof RouteOutcome>[0]["view"]) => (
    <RouteOutcome
      view={view}
      onCancel={jest.fn()}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onTryDistance={jest.fn()}
      onPickShape={jest.fn()}
      onStart={jest.fn()}
      onSignal={jest.fn()}
    />
  );
  const startedAt = Date.now();
  const { rerender } = await render(
    outcome({ status: "waiting", request: heart, startedAt, phase: "sending" }),
  );
  expect(screen.getByTestId("waiting-line")).toBeOnTheScreen();
  expect(screen.queryByText(/API/)).not.toBeOnTheScreen();
  await wait(CARD_AFTER_MS);
  expect(
    screen.queryByTestId("waiting-pen") ??
      screen.queryByTestId("waiting-drawings") ??
      screen.queryByTestId("guess-shape"),
  ).toBeOnTheScreen();
  const result = (jobDone as unknown as { result: RouteResult }).result;
  await rerender(outcome({ status: "done", request: heart, result }));
  expect(screen.queryByTestId("waiting-line")).not.toBeOnTheScreen();
  expect(screen.queryByTestId("waiting-pen")).not.toBeOnTheScreen();
  expect(screen.queryByTestId("waiting-drawings")).not.toBeOnTheScreen();
  expect(screen.queryByTestId("guess-shape")).not.toBeOnTheScreen();
});
