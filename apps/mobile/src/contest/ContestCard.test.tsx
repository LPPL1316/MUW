import open from "@shaperoute/shared-types/fixtures/contest.json";
import type { Contest } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";

import { forgetBlocked, markBlocked } from "../social/blockedNow";
import { ContestCard } from "./ContestCard";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

/**
 * The contest's card while it runs (TASK-299 part B). Its days are built on
 * the phone's clock, and the clock is a fake one, so the tests hold in any
 * time zone and on any day.
 */
const CONTEST: Contest = {
  ...(open as Contest),
  starts_at: new Date(2026, 10, 2, 0, 0).toISOString(),
  ends_at: new Date(2026, 10, 15, 23, 59, 59).toISOString(),
};
const [ADA, BEA, CARLO] = CONTEST.top;

/** `day` November 2026 at noon, on the phone's clock. */
function on(day: number): Date {
  return new Date(2026, 10, day, 12);
}

afterEach(() => {
  jest.useRealTimers();
  forgetBlocked();
});

test("while it runs: what wins, the days left, the first three and the best post", async () => {
  jest.useFakeTimers({ now: on(12) });
  await render(
    <ContestCard contest={CONTEST} mine={CONTEST.mine} onOpen={jest.fn()} />,
  );
  expect(screen.getByRole("header", { name: "MuW contest" })).toBeOnTheScreen();
  expect(screen.getByText("3 days left")).toBeOnTheScreen();
  expect(screen.getByText("The post with the most reactions wins.")).toBeOnTheScreen();
  expect(
    screen.getByRole("button", { name: "1. Ada_runs, 14 reactions" }),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole("button", { name: "2. bea.k, 11 reactions" }),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole("button", { name: "3. carlo_runs, 9 reactions" }),
  ).toBeOnTheScreen();
  expect(screen.getByText("Your best post: #5, 4 reactions")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "How it works" })).toBeOnTheScreen();
});

test("one reaction is one", async () => {
  jest.useFakeTimers({ now: on(12) });
  await render(
    <ContestCard
      contest={{ ...CONTEST, top: [{ ...ADA, reactions: 1 }] }}
      mine={{ drawing_id: ADA.drawing.id, rank: 1, reactions: 1 }}
      onOpen={jest.fn()}
    />,
  );
  expect(
    screen.getByRole("button", { name: "1. Ada_runs, 1 reaction" }),
  ).toBeOnTheScreen();
  expect(screen.getByText("Your best post: #1, 1 reaction")).toBeOnTheScreen();
});

test("the day before the last, «1 day left»; on the last, «Ends today»", async () => {
  jest.useFakeTimers({ now: on(14) });
  await render(<ContestCard contest={CONTEST} mine={undefined} />);
  expect(screen.getByText("1 day left")).toBeOnTheScreen();
  // The card stays on the screen past midnight: the clock is read again.
  await act(async () => jest.advanceTimersByTime(24 * 60 * 60 * 1000));
  expect(screen.getByText("Ends today")).toBeOnTheScreen();
});

test("after the end, until the winner is proclaimed, it says so and asks no one to take part", async () => {
  jest.useFakeTimers({ now: on(16) });
  await render(<ContestCard contest={CONTEST} mine={null} />);
  expect(screen.getByText("Ended · the winner is coming")).toBeOnTheScreen();
  expect(screen.queryByText("Publish a run to take part.")).toBeNull();
  // The first three are still there.
  expect(screen.getByLabelText("1. Ada_runs, 14 reactions")).toBeOnTheScreen();
});

test("without a post in the contest: how to take part; without an account: no line", async () => {
  jest.useFakeTimers({ now: on(12) });
  await render(<ContestCard contest={CONTEST} mine={null} />);
  expect(screen.getByText("Publish a run to take part.")).toBeOnTheScreen();
  await render(<ContestCard contest={CONTEST} mine={undefined} />);
  expect(screen.queryByText("Publish a run to take part.")).toBeNull();
  expect(screen.queryByText(/Your best post/)).toBeNull();
});

test("a tap on one of the three opens its drawing; without an account they are no buttons", async () => {
  jest.useFakeTimers({ now: on(12) });
  const onOpen = jest.fn();
  await render(<ContestCard contest={CONTEST} mine={CONTEST.mine} onOpen={onOpen} />);
  await fireEvent.press(screen.getByRole("button", { name: "2. bea.k, 11 reactions" }));
  expect(onOpen).toHaveBeenCalledWith(BEA.drawing);

  await render(<ContestCard contest={CONTEST} mine={undefined} />);
  expect(screen.queryByRole("button", { name: /Ada_runs/ })).toBeNull();
  expect(screen.getByLabelText("1. Ada_runs, 14 reactions")).toBeOnTheScreen();
});

test("a post across a block is left out by the API: two of the first, with their places", async () => {
  jest.useFakeTimers({ now: on(12) });
  await render(
    <ContestCard contest={{ ...CONTEST, top: [ADA, CARLO] }} mine={undefined} />,
  );
  expect(screen.getByLabelText("1. Ada_runs, 14 reactions")).toBeOnTheScreen();
  expect(screen.getByLabelText("3. carlo_runs, 9 reactions")).toBeOnTheScreen();
  expect(screen.queryByLabelText(/bea\.k/)).toBeNull();
});

test("an author blocked while the app is open is gone at once", async () => {
  jest.useFakeTimers({ now: on(12) });
  await render(<ContestCard contest={CONTEST} mine={undefined} />);
  await act(async () => markBlocked(BEA.drawing.author.public_id));
  expect(screen.queryByLabelText(/bea\.k/)).toBeNull();
  expect(screen.getByLabelText("1. Ada_runs, 14 reactions")).toBeOnTheScreen();
});

test("no post yet: the card without the three", async () => {
  jest.useFakeTimers({ now: on(3) });
  await render(<ContestCard contest={{ ...CONTEST, top: [] }} mine={null} />);
  expect(screen.getByText("12 days left")).toBeOnTheScreen();
  expect(screen.getByText("Publish a run to take part.")).toBeOnTheScreen();
});

test("«How it works» opens the official rules, with the contest's days", async () => {
  jest.useFakeTimers({ now: on(12) });
  await render(<ContestCard contest={CONTEST} mine={undefined} />);
  await fireEvent.press(screen.getByRole("button", { name: "How it works" }));
  const rules = screen.getByRole("header", { name: "Official rules" });
  expect(rules).toBeOnTheScreen();
  expect(
    screen.getByText(
      "Organised by MuW (Luca Pallaoro). Runs from Mon 2 Nov 2026 to Sun 15 Nov 2026.",
    ),
  ).toBeOnTheScreen();
  expect(
    screen.getByText(
      "Apple and Google are not sponsors of this contest and are not involved in it in any way.",
    ),
  ).toBeOnTheScreen();
  expect(screen.getByText(/The prize has no money value/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("header", { name: "Official rules" })).toBeNull();
  expect(
    within(screen.getByTestId("contest-card")).getByText("3 days left"),
  ).toBeOnTheScreen();
});
