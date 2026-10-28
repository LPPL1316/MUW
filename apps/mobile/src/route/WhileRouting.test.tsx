import type { ImageRouteRequest, RouteRequest } from "@shaperoute/shared-types";
import imageRequest from "@shaperoute/shared-types/fixtures/image-route-request.json";
import { act, render, screen } from "@testing-library/react-native";

import { SAMPLE_FEED, type SamplePost } from "../feed/sampleFeed";
import { RouteOutcome } from "./RoutePanel";
import type { RouteState } from "./useRouteRequest";
import {
  POSTS_SHOWN,
  postsWhileRouting,
  SHOWN_AFTER_MS,
  WhileRouting,
} from "./WhileRouting";

const START: [number, number] = [46.0671, 11.1214];
const HEART: RouteRequest = {
  start: START,
  shape: "heart",
  distance_m: 5000,
  activity: "running",
};
const WORD: RouteRequest = {
  start: START,
  word: "CIAO",
  distance_m: 12000,
  activity: "running",
};
const ON_WATER: RouteRequest = { ...HEART, activity: "paddling" };

function post(id: string, activity?: SamplePost["activity"]): SamplePost {
  return {
    id,
    user: "runner",
    title: id,
    city: "trento",
    shape: "heart",
    route_m: 5000,
    minutes: 30,
    score: 90,
    line: [
      [46, 11],
      [46.01, 11],
      [46.01, 11.01],
    ],
    activity,
  };
}

function outcome(view: RouteState) {
  return (
    <RouteOutcome
      view={view}
      onCancel={jest.fn()}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onTryDistance={jest.fn()}
      onPickShape={jest.fn()}
      onStart={jest.fn()}
    />
  );
}

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test("a run is shown the drawings of the runs, at most six", () => {
  const posts = postsWhileRouting(HEART);
  expect(posts).toHaveLength(Math.min(POSTS_SHOWN, posts.length));
  expect(posts.length).toBeGreaterThan(0);
  expect(posts.length).toBeLessThanOrEqual(POSTS_SHOWN);
  expect(posts.every((p) => p.activity !== "paddling")).toBe(true);
});

test("on the water only the drawings on the water", () => {
  const feed = [
    post("run-1"),
    post("water-1", "paddling"),
    post("water-2", "paddling"),
  ];
  const posts = postsWhileRouting(ON_WATER, feed);
  expect(posts.map((p) => p.id).sort()).toEqual(["water-1", "water-2"]);
  expect(postsWhileRouting(HEART, feed).map((p) => p.id)).toEqual(["run-1"]);
});

test("the same request is shown the same drawings, each once", () => {
  const first = postsWhileRouting(WORD).map((p) => p.id);
  expect(postsWhileRouting(WORD).map((p) => p.id)).toEqual(first);
  expect(new Set(first).size).toBe(first.length);
});

test("a feed with none of the sport gives none", () => {
  expect(postsWhileRouting(ON_WATER, [post("run-1")])).toEqual([]);
  expect(postsWhileRouting(HEART, [])).toEqual([]);
});

test("the drawings come after a few seconds, with their title and facts", async () => {
  jest.useFakeTimers();
  await render(<WhileRouting request={HEART} startedAt={Date.now()} />);
  expect(screen.queryByTestId("while-routing")).not.toBeOnTheScreen();

  await act(() => jest.advanceTimersByTimeAsync(SHOWN_AFTER_MS - 100));
  expect(screen.queryByTestId("while-routing")).not.toBeOnTheScreen();

  await act(() => jest.advanceTimersByTimeAsync(100));
  expect(screen.getByText("MEANWHILE, FROM THE FEED")).toBeOnTheScreen();
  const shown = postsWhileRouting(HEART);
  expect(screen.getAllByTestId("while-routing-post")).toHaveLength(shown.length);
  expect(screen.getByText(shown[0].title)).toBeOnTheScreen();
  expect(screen.getAllByText(/\d km/)).toHaveLength(shown.length);
});

test("a wait already long shows them at once", async () => {
  jest.useFakeTimers();
  await render(<WhileRouting request={HEART} startedAt={Date.now() - 60_000} />);
  await act(() => jest.advanceTimersByTimeAsync(0));
  expect(screen.getByTestId("while-routing")).toBeOnTheScreen();
});

test("a new request waits again", async () => {
  jest.useFakeTimers();
  const first = Date.now();
  const { rerender } = await render(<WhileRouting request={HEART} startedAt={first} />);
  await act(() => jest.advanceTimersByTimeAsync(SHOWN_AFTER_MS));
  expect(screen.getByTestId("while-routing")).toBeOnTheScreen();

  await rerender(<WhileRouting request={WORD} startedAt={Date.now()} />);
  expect(screen.queryByTestId("while-routing")).not.toBeOnTheScreen();
  await act(() => jest.advanceTimersByTimeAsync(SHOWN_AFTER_MS));
  expect(screen.getByTestId("while-routing")).toBeOnTheScreen();
});

test("each card reads out who, where, what and how far", async () => {
  jest.useFakeTimers();
  await render(<WhileRouting request={HEART} startedAt={0} />);
  await act(() => jest.advanceTimersByTimeAsync(0));
  const [first] = postsWhileRouting(HEART);
  const label = screen.getAllByTestId("while-routing-post")[0].props.accessibilityLabel;
  expect(label).toContain(first.user);
  expect(label).toContain(first.title);
  expect(label).toMatch(/km/);
});

test("the row asks nothing of the network, and takes no picture of a map", async () => {
  jest.useFakeTimers();
  const fetch = jest.spyOn(global, "fetch");
  await render(<WhileRouting request={HEART} startedAt={0} />);
  await act(() => jest.advanceTimersByTimeAsync(60_000));
  expect(screen.getAllByTestId("while-routing-post").length).toBeGreaterThan(0);
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.queryByTestId("feed-map")).not.toBeOnTheScreen();
});

test("before drawing, the card warms up for the shape, the word or the picture", async () => {
  await render(
    outcome({
      status: "waiting",
      request: HEART,
      startedAt: Date.now(),
      phase: "sending",
    }),
  );
  expect(screen.getByText("Warming up: heart…")).toBeOnTheScreen();
  expect(screen.queryByText(/API/)).not.toBeOnTheScreen();

  await render(
    outcome({
      status: "waiting",
      request: WORD,
      startedAt: Date.now(),
      phase: "queued",
    }),
  );
  expect(screen.getByText("Warming up: “CIAO”…")).toBeOnTheScreen();

  await render(
    outcome({
      status: "waiting",
      request: imageRequest as ImageRouteRequest,
      startedAt: Date.now(),
      phase: "queued",
    }),
  );
  expect(screen.getByText("Warming up: the picture…")).toBeOnTheScreen();
});

test("the next phases say what they said", async () => {
  await render(
    outcome({
      status: "waiting",
      request: HEART,
      startedAt: Date.now(),
      phase: "computing",
    }),
  );
  expect(screen.getByText("Drawing a 5 km heart…")).toBeOnTheScreen();
});

test("the waiting card shows the drawings, and they leave with it", async () => {
  jest.useFakeTimers();
  const startedAt = Date.now();
  const { rerender } = await render(
    outcome({ status: "waiting", request: HEART, startedAt, phase: "computing" }),
  );
  await act(() => jest.advanceTimersByTimeAsync(SHOWN_AFTER_MS));
  expect(screen.getByTestId("while-routing")).toBeOnTheScreen();

  await rerender(
    outcome({ status: "failed", request: HEART, problem: { kind: "no_api_url" } }),
  );
  expect(screen.queryByTestId("while-routing")).not.toBeOnTheScreen();
});

test("the feed has drawings on the water for «Paddle»", () => {
  expect(SAMPLE_FEED.some((p) => p.activity === "paddling")).toBe(true);
  expect(postsWhileRouting(ON_WATER).length).toBeGreaterThan(0);
});
