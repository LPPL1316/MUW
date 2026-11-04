import type { LatLon } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";

import type { FreeRun } from "../navigation/freeRun";
import { addFix, emptyTrack, type Track } from "../navigation/trackRecorder";
import { FreeFinishCard, FreeRunBanner, FreeRunCard } from "./FreeRunScreen";
import { TICK_MS } from "./RunPanel";

jest.mock("expo-brightness", () => ({
  getBrightnessAsync: jest.fn(() => Promise.resolve(0.6)),
  setBrightnessAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));

const START: LatLon = [46.0122, 11.2986];
const NOW = Date.UTC(2026, 9, 2, 7, 0, 0);

/** A track of `metres`, from `startMs` to `endMs`. */
function track(metres: number, startMs: number, endMs: number): Track {
  return {
    fixes: [
      { point: START, timeMs: startMs, accuracyM: 5 },
      { point: [START[0] + 0.01, START[1]], timeMs: endMs, accuracyM: 5 },
    ],
    distanceM: metres,
  };
}

const METRE = 1 / 111_195;
const METRE_EAST = METRE / Math.cos((START[0] * Math.PI) / 180);

/** A track through `steps`: metres north, metres east, seconds before NOW. */
function line(steps: [northM: number, eastM: number, secondsAgo: number][]): Track {
  return steps.reduce(
    (run, [northM, eastM, secondsAgo]) =>
      addFix(run, {
        point: [START[0] + northM * METRE, START[1] + eastM * METRE_EAST],
        timeMs: NOW - secondsAgo * 1000,
        accuracyM: 5,
      }),
    emptyTrack(),
  );
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
  jest.useRealTimers();
});

test("while running, the banner points to the start and says the heading", async () => {
  // North 300 m, then east 400 m: the start is 500 m behind, on the right.
  const run = line([
    [0, 0, 240],
    [300, 0, 150],
    [300, 380, 6],
    [300, 400, 0],
  ]);
  await render(
    <FreeRunBanner
      state={{ status: "running", track: run, position: run.fixes[3].point }}
    />,
  );
  expect(screen.getByText("500 m")).toBeOnTheScreen();
  expect(screen.getByText("Your start, in a straight line")).toBeOnTheScreen();
  expect(screen.getByText("Heading east")).toBeOnTheScreen();
  // The start is to the south-west (233°); heading east (90°), that is 143°
  // clockwise from straight ahead.
  expect(screen.getByTestId("start-arrow")).toHaveStyle({
    transform: [{ rotate: "143deg" }],
  });
  expect(
    screen.getByLabelText("Your start: 500 m in a straight line, to the south-west"),
  ).toBeOnTheScreen();
});

test("near the start, the banner says so instead of pointing", async () => {
  const run = line([
    [0, 0, 10],
    [12, 0, 5],
    [20, 0, 0],
  ]);
  await render(
    <FreeRunBanner
      state={{ status: "running", track: run, position: run.fixes[2].point }}
    />,
  );
  expect(screen.getByText("You are at your start")).toBeOnTheScreen();
  expect(screen.getByText("Heading north")).toBeOnTheScreen();
  expect(screen.queryByTestId("start-arrow")).toBeNull();
});

test("at the first fix there is no heading yet", async () => {
  const run = line([[0, 0, 0]]);
  await render(
    <FreeRunBanner state={{ status: "running", track: run, position: START }} />,
  );
  expect(screen.getByText("You are at your start")).toBeOnTheScreen();
  expect(screen.queryByText(/^Heading/)).toBeNull();
});

test("before the first fix, the banner waits for the GPS", async () => {
  await render(
    <FreeRunBanner
      state={{ status: "running", track: { fixes: [], distanceM: 0 }, position: null }}
    />,
  );
  expect(screen.getByText("Finding your position…")).toBeOnTheScreen();
});

test("without the location, the banner says how to turn it on and opens the Settings", async () => {
  const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue();
  await render(<FreeRunBanner state={{ status: "denied" }} />);
  expect(screen.getByText("Location is off")).toBeOnTheScreen();
  expect(
    screen.getByText("Allow it for MuW in Settings to record your track."),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Open Settings" }));
  expect(openSettings).toHaveBeenCalledTimes(1);
  openSettings.mockRestore();
});

test("Stop ends the run; Pocket only once the GPS is on", async () => {
  const onStop = jest.fn();
  const { rerender } = await render(<FreeRunCard running={false} onStop={onStop} />);
  expect(screen.queryByText("Pocket")).toBeNull();
  await rerender(<FreeRunCard running onStop={onStop} />);
  expect(screen.getByText("Pocket")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("Stop"));
  expect(onStop).toHaveBeenCalledTimes(1);
});

test("under the map, a few numbers of the run: distance, pace now, clock", async () => {
  // 300 m in a minute and a half: 5:00 /km.
  const run = line([
    [0, 0, 90],
    [150, 0, 45],
    [300, 0, 0],
  ]);
  await render(<FreeRunCard running track={run} onStop={jest.fn()} />);
  expect(screen.getByLabelText("Distance: 0.30 km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Pace now: 5:00 /km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Time: 1:30")).toBeOnTheScreen();
  // The clock goes on between fixes.
  await act(async () => {
    jest.advanceTimersByTime(TICK_MS);
  });
  expect(screen.getByLabelText("Time: 1:31")).toBeOnTheScreen();
  // A run with a line is paused, not stopped by a touch (TASK-169).
  expect(screen.getByLabelText("Pause")).toBeOnTheScreen();
  expect(screen.queryByText("Stop")).toBeNull();
});

test("on the page of the data, the way to the start is there in place of the map", async () => {
  const run = line([
    [0, 0, 240],
    [300, 0, 150],
    [300, 380, 6],
    [300, 400, 0],
  ]);
  await render(<FreeRunCard running track={run} onStop={jest.fn()} />);
  expect(screen.queryByText("Your start, in a straight line")).toBeNull();
  await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
  expect(screen.getByText("500 m")).toBeOnTheScreen();
  expect(screen.getByText("Your start, in a straight line")).toBeOnTheScreen();
  expect(screen.getByText("Heading east")).toBeOnTheScreen();
  // 700 m of line in four minutes.
  expect(screen.getByLabelText("Avg pace: 5:43 /km")).toBeOnTheScreen();
});

test("the end of a free run has its numbers, Keep running and Done", async () => {
  const run: FreeRun = {
    version: 1,
    route: [],
    track: track(4210, 0, 1_500_000),
    status: "stopped",
  };
  const onResume = jest.fn();
  const onDone = jest.fn();
  await render(<FreeFinishCard run={run} onResume={onResume} onDone={onDone} />);
  expect(screen.getByText("4.21 km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Time: 25:00")).toBeOnTheScreen();
  expect(screen.getByLabelText("Avg pace: 5:56 /km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Calories: 295 kcal")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("Keep running"));
  expect(onResume).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByText("Done"));
  expect(onDone).toHaveBeenCalledTimes(1);
});

test("without a way out of its own the end has no Done: Save and Discard are under it", async () => {
  const run: FreeRun = {
    version: 1,
    route: [],
    track: track(4210, 0, 1_500_000),
    status: "stopped",
  };
  await render(<FreeFinishCard run={run} onResume={jest.fn()} />);
  expect(screen.getByText("4.21 km")).toBeOnTheScreen();
  expect(screen.getByText("Keep running")).toBeOnTheScreen();
  expect(screen.queryByText("Done")).toBeNull();
});

test("a run that can no longer go on has Done only", async () => {
  const run: FreeRun = {
    version: 1,
    route: [],
    track: track(50, 0, 30_000),
    status: "running",
  };
  await render(<FreeFinishCard run={run} onDone={jest.fn()} />);
  expect(screen.getByText("0.05 km")).toBeOnTheScreen();
  // Too short for a pace.
  expect(screen.getByLabelText("Time: 0:30")).toBeOnTheScreen();
  expect(screen.getByLabelText("Avg pace: – /km")).toBeOnTheScreen();
  expect(screen.queryByText("Keep running")).toBeNull();
});
