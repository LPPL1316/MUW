import { act, fireEvent, render, screen } from "@testing-library/react-native";

import type { SamplePost } from "../feed/sampleFeed";
import { saveLanguageChoice } from "../i18n/language";
import { GAME_PEN_MS, GuessShape, NEXT_MS } from "./GuessShape";
import { forgetBest } from "./guessRounds";

// «Guess the shape» while «Draw» waits (TASK-317): the pen traces a
// drawing, three shapes to pick from, the sooner the more points.

function post(shape: string, title: string): SamplePost {
  return {
    id: `trento-${shape}`,
    user: "marta_b",
    title,
    city: "trento",
    shape,
    route_m: 5000,
    minutes: 30,
    score: 90,
    line: [
      [46.07, 11.12],
      [46.08, 11.13],
      [46.07, 11.14],
      [46.06, 11.13],
      [46.07, 11.12],
    ],
  };
}

const POSTS = [
  post("heart", "A heart"),
  post("star", "A star"),
  post("moon", "A moon"),
  post("cat", "A cat"),
];

/**
 * Always the largest number below 1: every shuffle keeps its order. The
 * drawings come heart, star, moon, cat; the first round offers Heart, Star
 * and Moon, the second Star, Heart and Moon.
 */
const KEEP = () => 0.999999;

beforeEach(() => {
  jest.useFakeTimers();
  forgetBest();
});

afterEach(async () => {
  jest.useRealTimers();
  await act(async () => saveLanguageChoice("phone"));
});

async function wait(ms: number) {
  await act(() => jest.advanceTimersByTimeAsync(ms));
}

test("three shapes to pick from, the drawing's among them", async () => {
  await render(<GuessShape posts={POSTS} random={KEEP} />);
  expect(screen.getByText("Guess the shape")).toBeOnTheScreen();
  expect(screen.getByText("Score 0 · Best 0")).toBeOnTheScreen();
  expect(screen.getAllByRole("button")).toHaveLength(3);
  for (const name of ["Heart", "Star", "Moon"]) {
    expect(screen.getByRole("button", { name })).toBeOnTheScreen();
  }
  expect(screen.getByTestId("pen-drawing")).toBeOnTheScreen();
});

test("the right shape at once gives the most points", async () => {
  await render(<GuessShape posts={POSTS} random={KEEP} />);
  await fireEvent.press(screen.getByText("Heart"));
  expect(screen.getByText("Right! +100")).toBeOnTheScreen();
  await wait(NEXT_MS);
  expect(screen.getByText("Score 100 · Best 100")).toBeOnTheScreen();
  // The next drawing is the star's.
  await fireEvent.press(screen.getByText("Star"));
  expect(screen.getByText("Right! +100")).toBeOnTheScreen();
  await wait(NEXT_MS);
  expect(screen.getByText("Score 200 · Best 200")).toBeOnTheScreen();
});

test("later, fewer points", async () => {
  await render(<GuessShape posts={POSTS} random={KEEP} />);
  await wait(GAME_PEN_MS / 2);
  await fireEvent.press(screen.getByText("Heart"));
  expect(screen.getByText("Right! +50")).toBeOnTheScreen();
});

test("a wrong shape gives nothing and says which it was", async () => {
  await render(<GuessShape posts={POSTS} random={KEEP} />);
  await fireEvent.press(screen.getByText("Star"));
  expect(screen.getByText("It was: Heart")).toBeOnTheScreen();
  // A second press does not count.
  await fireEvent.press(screen.getByText("Heart"));
  expect(screen.queryByText(/Right!/)).not.toBeOnTheScreen();
  await wait(NEXT_MS);
  expect(screen.getByText("Score 0 · Best 0")).toBeOnTheScreen();
});

test("the best score is the best of the waits", async () => {
  const first = await render(<GuessShape posts={POSTS} random={KEEP} />);
  await fireEvent.press(screen.getByText("Heart"));
  await wait(NEXT_MS);
  await first.unmount();
  await render(<GuessShape posts={POSTS} random={KEEP} />);
  expect(screen.getByText("Score 0 · Best 100")).toBeOnTheScreen();
});

test("in Italian", async () => {
  await act(async () => saveLanguageChoice("it"));
  await render(<GuessShape posts={POSTS} random={KEEP} />);
  expect(screen.getByText("Indovina la forma")).toBeOnTheScreen();
  expect(screen.getByText("Punti 0 · Record 0")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("Cuore"));
  expect(screen.getByText("Giusto! +100")).toBeOnTheScreen();
});

test("no drawing of a catalogue shape, no game", async () => {
  await render(<GuessShape posts={[post("word", "A word")]} random={KEEP} />);
  expect(screen.queryByTestId("guess-shape")).not.toBeOnTheScreen();
});
