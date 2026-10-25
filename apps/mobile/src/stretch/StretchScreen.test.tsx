import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import type { Exercise } from "./exercises";
import { nearest } from "./Figure";
import { QUAD, STAND } from "./poses";
import { clockLabel, STAND_MS, StretchScreen, TICK_MS } from "./StretchScreen";

jest.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));

const mockPlay = jest.fn();
const mockSeekTo = jest.fn(() => Promise.resolve());
jest.mock("expo-audio", () => ({
  createAudioPlayer: jest.fn(() => ({ play: mockPlay, seekTo: mockSeekTo })),
}));

beforeEach(() => {
  jest.useFakeTimers();
  mockPlay.mockClear();
  jest
    .spyOn(AccessibilityInfo, "announceForAccessibility")
    .mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function wait(ms: number) {
  return act(() => jest.advanceTimersByTimeAsync(ms));
}

/** A tap, and React's work after it. */
function press(name: string) {
  return act(async () => {
    fireEvent.press(screen.getByRole("button", { name }));
  });
}

/** Two short exercises: one on each side, one on both at once. */
const TWO: readonly Exercise[] = [
  {
    key: "a",
    name: "Quad stretch",
    howTo: "Pull the heel.",
    sides: true,
    seconds: 3,
    pose: QUAD,
  },
  {
    key: "b",
    name: "Calf stretch",
    howTo: "Step back.",
    sides: false,
    seconds: 2,
    pose: STAND,
  },
];

describe("the stretching after a run", () => {
  it("writes the seconds left as a clock", () => {
    expect(clockLabel(20)).toBe("0:20");
    expect(clockLabel(65)).toBe("1:05");
    expect(clockLabel(0)).toBe("0:00");
    expect(clockLabel(-3)).toBe("0:00");
  });

  it("turns a joint the short way round", () => {
    expect(nearest(0, 350)).toBe(-10);
    expect(nearest(170, -170)).toBe(190);
    expect(nearest(10, 40)).toBe(40);
  });

  it("starts with the first exercise, its line, the right side and the time", async () => {
    await render(<StretchScreen onLeave={jest.fn()} exercises={TWO} />);
    expect(screen.getByText("1 of 2")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Quad stretch" })).toBeTruthy();
    expect(screen.getByText("Pull the heel.")).toBeTruthy();
    expect(screen.getByText("Right side")).toBeTruthy();
    expect(screen.getByText("0:03")).toBeTruthy();
    expect(screen.getByText("Stop if it hurts.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Skip" })).toBeTruthy();
    // Drawn for the eyes only: the name and the line say what it does.
    expect(screen.queryByTestId("stretch-figure")).toBeNull();
    expect(
      screen.getByTestId("stretch-figure", { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it("counts down, rings, switches sides, goes on to the next and then leaves", async () => {
    const onLeave = jest.fn();
    await render(<StretchScreen onLeave={onLeave} exercises={TWO} />);
    await wait(TICK_MS);
    expect(screen.getByText("0:02")).toBeTruthy();
    await wait(TICK_MS * 2);
    // The right side is over: the bell, the other side, the time again.
    expect(mockPlay).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Left side")).toBeTruthy();
    expect(screen.getByText("0:03")).toBeTruthy();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      "Switch sides",
    );
    await wait(STAND_MS + TICK_MS * 3);
    // The second exercise, on both sides at once: no side to name.
    expect(mockPlay).toHaveBeenCalledTimes(2);
    expect(screen.getByText("2 of 2")).toBeTruthy();
    expect(screen.queryByText("Left side")).toBeNull();
    expect(screen.queryByText("Right side")).toBeNull();
    expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      "Calf stretch",
    );
    expect(onLeave).not.toHaveBeenCalled();
    await wait(TICK_MS * 2);
    expect(mockPlay).toHaveBeenCalledTimes(3);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("holds the time on «Pause» and goes on with «Resume»", async () => {
    await render(<StretchScreen onLeave={jest.fn()} exercises={TWO} />);
    await press("Pause");
    await wait(TICK_MS * 5);
    expect(screen.getByText("0:03")).toBeTruthy();
    expect(screen.getByText("Right side")).toBeTruthy();
    await press("Resume");
    await wait(TICK_MS);
    expect(screen.getByText("0:02")).toBeTruthy();
  });

  it("leaves at once on «Skip», from any exercise", async () => {
    const onLeave = jest.fn();
    await render(<StretchScreen onLeave={onLeave} exercises={TWO} />);
    await wait(TICK_MS);
    await press("Skip");
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("does not come back once taken away", async () => {
    const onLeave = jest.fn();
    const { unmount } = await render(
      <StretchScreen onLeave={onLeave} exercises={TWO} />,
    );
    await wait(TICK_MS);
    await unmount();
    await wait(TICK_MS * 20);
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("says the time left to a screen reader every ten seconds", async () => {
    const long: readonly Exercise[] = [{ ...TWO[1], seconds: 25 }];
    await render(<StretchScreen onLeave={jest.fn()} exercises={long} />);
    await wait(TICK_MS * 5);
    expect(screen.getByRole("timer", { name: "20 seconds left" })).toBeTruthy();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      "20 seconds left",
    );
    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalledWith(
      "25 seconds left",
    );
  });
});
