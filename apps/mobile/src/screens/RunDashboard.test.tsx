import type { LatLon } from "@shaperoute/shared-types";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native";
import { useEffect, useState } from "react";
import { Linking, Text } from "react-native";

import {
  AUTO_PAUSE_AFTER_MS,
  controlRun,
  COUNTDOWN_MS,
  runControl,
  type RunSession,
  setAutoPause,
  setVoice,
  skipCountdown,
} from "../navigation/runControl";
import { emptyTrack, type Track, type TrackFix } from "../navigation/trackRecorder";
import { clearRun, startRun } from "../navigation/trackStore";
import { color, fontSize, MIN_TAP_SIZE } from "../theme/tokens";
import { countdownNumber } from "./Countdown";
import { HOLD_STOP_MS } from "./HoldButton";
import { PAGE_TAB_HEIGHT, RunCard, splitShare, swipedTo } from "./RunDashboard";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock("expo-brightness", () => ({
  getBrightnessAsync: jest.fn(() => Promise.resolve(0.6)),
  setBrightnessAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
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
  return { File, Paths: { document: { uri: "file:///documents/" } } };
});

const START: LatLon = [46.0122, 11.2986];
const METRE = 1 / 111_195;
const NOW = Date.UTC(2026, 9, 2, 7, 0, 0);

/** A fix `northM` metres north of START, `seconds` before NOW. */
function fix(northM: number, secondsAgo: number): TrackFix {
  return {
    point: [START[0] + northM * METRE, START[1]],
    timeMs: NOW - secondsAgo * 1000,
    accuracyM: 5,
  };
}

/** Straight north at 5:00 /km, a fix every 50 m, the last one now. */
function north(metres: number): TrackFix[] {
  const fixes: TrackFix[] = [];
  for (let m = 0; m <= metres; m += 50) {
    fixes.push(fix(m, ((metres - m) / 1000) * 300));
  }
  return fixes;
}

/** 2.3 km north, the first kilometre at 5:00 /km and the rest at 6:00, the
 * last fix now. */
function slowingDown(): TrackFix[] {
  const secondsAt = (m: number) => (m <= 1000 ? m * 0.3 : 300 + (m - 1000) * 0.36);
  const total = secondsAt(2300);
  const fixes: TrackFix[] = [];
  for (let m = 0; m <= 2300; m += 50) {
    fixes.push(fix(m, total - secondsAt(m)));
  }
  return fixes;
}

/** The GPS of the run on screen: a fix, when the test gives one. */
let gps: (fix: TrackFix) => void = () => {};

/**
 * A run as the recording hooks make it: a recorder under the controls,
 * and the card drawn again when the track changes. `fixes` come after the
 * countdown, unless `counting` leaves it running.
 */
function LiveRun({
  fixes = [],
  counting = false,
  onStop = () => {},
}: {
  fixes?: TrackFix[];
  counting?: boolean;
  onStop?: () => void;
}) {
  const [track, setTrack] = useState<Track>(emptyTrack);
  useEffect(() => {
    const recorder = startRun([], Date.now());
    const session: RunSession = controlRun(recorder, {
      onChange: () => setTrack(recorder.track()),
      say: () => {},
    });
    gps = (next) => {
      session.onFix(next, false);
      setTrack(recorder.track());
    };
    if (!counting) {
      skipCountdown();
    }
    fixes.forEach(gps);
    return () => session.end();
    // Once: the run of the test.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <RunCard track={track} live heading={<Text>Next turn</Text>} onStop={onStop} />
  );
}

beforeEach(() => {
  // Microtasks stay real: React draws again in one when a timer of the run
  // pauses it, and the fake clock cannot have its timers cleared mid-tick.
  jest.useFakeTimers({ now: NOW, doNotFake: ["queueMicrotask", "nextTick"] });
  clearRun();
  setAutoPause(true);
  setVoice(true);
});

afterEach(() => {
  jest.useRealTimers();
});

test("running: three numbers, Pause and Pocket, and no Stop to touch by mistake", async () => {
  await render(<LiveRun fixes={north(300)} />);
  expect(screen.getByLabelText("Distance: 0.30 km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Pace now: 5:00 /km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Time: 1:30")).toBeOnTheScreen();
  expect(screen.getByLabelText("Pause")).toBeOnTheScreen();
  expect(screen.getByLabelText("Pocket mode")).toBeOnTheScreen();
  expect(screen.queryByLabelText("Stop")).toBeNull();
  expect(screen.queryByText("Finish")).toBeNull();
  // The map page is the one on screen.
  expect(screen.getByRole("tab", { name: "Map" })).toBeSelected();
  expect(screen.queryByText("Next turn")).toBeNull();
  // The distance first and largest; each round button has its name under it.
  expect(screen.getByText("0.30")).toHaveStyle({ fontSize: fontSize.display });
  expect(screen.getByText("1:30")).toHaveStyle({ fontSize: fontSize.title });
  for (const name of ["Pocket", "Pause", "Music"]) {
    expect(screen.getByText(name)).toBeOnTheScreen();
  }
});

test("Pause stops the clock and shows every number; Resume goes on", async () => {
  await render(<LiveRun fixes={north(300)} />);
  await fireEvent.press(screen.getByLabelText("Pause"));
  expect(runControl().phase).toBe("paused");
  expect(screen.getByText("Paused")).toBeOnTheScreen();
  expect(screen.getByLabelText("Distance: 0.30 km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Avg pace: 5:00 /km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Calories: 21 kcal")).toBeOnTheScreen();
  expect(screen.getByLabelText("Elev. gain: – m")).toBeOnTheScreen();
  expect(screen.queryByLabelText("Pause")).toBeNull();
  // No pocket mode on a paused run: there is nothing to keep going.
  expect(screen.queryByLabelText("Pocket mode")).toBeNull();
  await act(async () => {
    jest.advanceTimersByTime(20_000);
  });
  expect(screen.getByLabelText("Time: 1:30")).toBeOnTheScreen();

  await fireEvent.press(screen.getByLabelText("Resume"));
  expect(runControl().phase).toBe("running");
  expect(screen.getByLabelText("Pause")).toBeOnTheScreen();
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  // Twenty seconds paused are not on the clock.
  expect(screen.getByLabelText("Time: 1:32")).toBeOnTheScreen();
});

test("Stop is held: a touch only says so, a hold ends the run", async () => {
  const onStop = jest.fn();
  await render(<LiveRun fixes={north(300)} onStop={onStop} />);
  await fireEvent.press(screen.getByLabelText("Pause"));
  const stop = screen.getByLabelText("Stop");
  await fireEvent.press(stop);
  expect(onStop).not.toHaveBeenCalled();
  expect(screen.getByText("Hold to stop")).toBeOnTheScreen();
  expect(HOLD_STOP_MS).toBeGreaterThanOrEqual(1000);
  await fireEvent(stop, "pressIn");
  await fireEvent(stop, "longPress");
  expect(onStop).toHaveBeenCalledTimes(1);
});

test("Map and Data are two buttons as wide as the card, taller than a tap", async () => {
  await render(<LiveRun fixes={north(300)} />);
  expect(PAGE_TAB_HEIGHT).toBeGreaterThan(MIN_TAP_SIZE);
  for (const name of ["Map", "Data"]) {
    expect(screen.getByRole("tab", { name })).toHaveStyle({
      flex: 1,
      minHeight: PAGE_TAB_HEIGHT,
    });
  }
  // The same two on «Data», where they slide the page back.
  await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
  expect(screen.getAllByRole("tab", { name: "Map" }).at(-1)).toHaveStyle({
    flex: 1,
    minHeight: PAGE_TAB_HEIGHT,
  });
});

test("Music, across from Pocket on both pages, opens Spotify; not on a paused run", async () => {
  const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  await render(<LiveRun fixes={north(300)} />);
  await fireEvent.press(screen.getByLabelText("Music"));
  expect(openURL.mock.calls).toEqual([["spotify:"]]);
  // The run is as it was: Sgrava plays and pauses nothing.
  expect(runControl().phase).toBe("running");

  await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
  expect(screen.getAllByLabelText("Music")).toHaveLength(2);
  await fireEvent.press(screen.getAllByLabelText("Pause").at(-1)!);
  expect(screen.queryByLabelText("Music")).toBeNull();
  openURL.mockRestore();
});

test("standing still, the card says why the run is paused, and moving resumes it", async () => {
  await render(<LiveRun fixes={north(300)} />);
  await act(async () => {
    jest.advanceTimersByTime(AUTO_PAUSE_AFTER_MS);
  });
  expect(screen.getByText("Paused: you stopped moving")).toBeOnTheScreen();
  expect(screen.getByLabelText("Resume")).toBeOnTheScreen();
  await act(async () => {
    gps({ ...fix(320, 0), timeMs: NOW + 30_000 });
  });
  expect(screen.queryByText("Paused: you stopped moving")).toBeNull();
  expect(screen.getByLabelText("Pause")).toBeOnTheScreen();
});

test("Data is the page with every number, the turn and the kilometres one by one", async () => {
  await render(<LiveRun fixes={north(2300)} />);
  await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
  // In place of the map, what the map's banner says.
  expect(screen.getByText("Next turn")).toBeOnTheScreen();
  // The kilometres in large, over the few numbers of the map's page.
  expect(screen.getAllByLabelText("Distance: 2.30 km")).toHaveLength(2);
  expect(screen.getByText("kilometres")).toBeOnTheScreen();
  expect(screen.getByLabelText("Avg pace: 5:00 /km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Last km: 5:00 /km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Calories: 161 kcal")).toBeOnTheScreen();
  expect(screen.getByLabelText("Kilometre 1: 5:00")).toBeOnTheScreen();
  expect(screen.getByLabelText("Kilometre 2: 5:00, 0:00")).toBeOnTheScreen();
  expect(screen.queryByText("Your first kilometre will show here.")).toBeNull();

  // «Map» slides the page away.
  await fireEvent.press(screen.getAllByRole("tab", { name: "Map" }).at(-1)!);
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  await waitFor(() => expect(screen.queryByText("Next turn")).toBeNull());
});

test("on Data only the numbers scroll: the turn, Pause and Map stay on screen (TASK-268)", async () => {
  await render(<LiveRun fixes={north(2300)} />);
  await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
  const page = screen.getByTestId("data-page");
  const numbers = within(page).getByTestId("data-numbers");
  // Whatever is left between the turn and the buttons, and no more.
  expect(numbers).toHaveStyle({ flex: 1 });
  // The kilometres one by one and the switches scroll, in the one scroll.
  expect(within(numbers).getByLabelText("Distance: 2.30 km")).toBeOnTheScreen();
  expect(within(numbers).getByLabelText("Kilometre 2: 5:00, 0:00")).toBeOnTheScreen();
  expect(within(numbers).getByRole("switch", { name: "Voice" })).toBeOnTheScreen();
  expect(within(numbers).getByLabelText("Listen")).toBeOnTheScreen();
  // The turn at the top, «Pause» and «Map» at the foot do not: a turn that
  // grows cannot push them off the screen.
  expect(within(numbers).queryByText("Next turn")).toBeNull();
  expect(within(numbers).queryByLabelText("Pause")).toBeNull();
  expect(within(numbers).queryByRole("tab")).toBeNull();
  expect(within(page).getByText("Next turn")).toBeOnTheScreen();
  expect(within(page).getByLabelText("Pause")).toBeOnTheScreen();
  expect(within(page).getByRole("tab", { name: "Map" })).toBeOnTheScreen();
  // A swipe back to the map is the page's: the scroll does not take it.
  expect(numbers.props.directionalLockEnabled).toBe(true);
  expect(page.props.onResponderTerminationRequest()).toBe(false);
});

test("each kilometre has a bar, longer the faster it was, the fastest light", async () => {
  await render(<LiveRun fixes={slowingDown()} />);
  await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
  expect(screen.getByLabelText("Kilometre 1: 5:00")).toBeOnTheScreen();
  expect(screen.getByLabelText("Kilometre 2: 6:00, +1:00")).toBeOnTheScreen();
  expect(screen.getByTestId("split-bar-1")).toHaveStyle({
    width: "100%",
    backgroundColor: color.text,
  });
  expect(screen.getByTestId("split-bar-2")).toHaveStyle({
    width: "35%",
    backgroundColor: color.borderStrong,
  });
});

test("a bar's length: whole for the fastest, still there for the slowest", () => {
  expect(splitShare(300, 300, 360)).toBe(1);
  expect(splitShare(360, 300, 360)).toBeCloseTo(0.35);
  expect(splitShare(330, 300, 360)).toBeCloseTo(0.675);
  // One kilometre, or all as fast: every bar whole.
  expect(splitShare(300, 300, 300)).toBe(1);
});

test("before the first kilometre, the page says where the kilometres will be", async () => {
  await render(<LiveRun fixes={north(300)} />);
  await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
  expect(screen.getByText("Your first kilometre will show here.")).toBeOnTheScreen();
});

test("the switches of the run: the pause by itself and the voice", async () => {
  await render(<LiveRun fixes={north(300)} />);
  await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
  const autoPause = screen.getByRole("switch", { name: "Auto-pause" });
  const voice = screen.getByRole("switch", { name: "Voice" });
  expect(autoPause).toBeChecked();
  expect(voice).toBeChecked();
  await fireEvent.press(autoPause);
  await fireEvent.press(voice);
  expect(runControl()).toMatchObject({ autoPause: false, voice: false });
  expect(screen.getByRole("switch", { name: "Auto-pause" })).not.toBeChecked();
  // Off: standing still pauses nothing.
  await act(async () => {
    jest.advanceTimersByTime(AUTO_PAUSE_AFTER_MS * 2);
  });
  expect(runControl().phase).toBe("running");
});

test("under the switches, the voice's language and voice, and Listen (TASK-209)", async () => {
  await render(<LiveRun fixes={north(300)} />);
  await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
  expect(
    screen.getByRole("button", { name: "Voice language and voice: English, Default" }),
  ).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Listen" })).toBeEnabled();
  // With the voice off the choice stays, and Listen says nothing.
  await fireEvent.press(screen.getByRole("switch", { name: "Voice" }));
  expect(screen.getByRole("button", { name: "Listen" })).toBeDisabled();
});

test("the countdown covers the screen until the run starts", async () => {
  await render(<LiveRun counting />);
  expect(screen.getByLabelText("Starting in 3")).toBeOnTheScreen();
  expect(screen.getByText("Get ready")).toBeOnTheScreen();
  await act(async () => {
    jest.advanceTimersByTime(1100);
  });
  expect(screen.getByLabelText("Starting in 2")).toBeOnTheScreen();
  await act(async () => {
    jest.advanceTimersByTime(COUNTDOWN_MS);
  });
  expect(screen.queryByText("Get ready")).toBeNull();
  expect(runControl().phase).toBe("running");
});

test("the countdown shows 3, 2, 1 and never 0", () => {
  expect(countdownNumber(3000)).toBe(3);
  expect(countdownNumber(2001)).toBe(3);
  expect(countdownNumber(2000)).toBe(2);
  expect(countdownNumber(1)).toBe(1);
  expect(countdownNumber(0)).toBe(1);
  expect(countdownNumber(-50)).toBe(1);
});

test("before the first fix and without the GPS, Stop is a touch, as it was", async () => {
  const onStop = jest.fn();
  const view = await render(<RunCard track={emptyTrack()} live onStop={onStop} />);
  expect(screen.getByLabelText("Pocket mode")).toBeOnTheScreen();
  expect(screen.queryByLabelText("Pause")).toBeNull();
  await fireEvent.press(screen.getByText("Stop"));
  expect(onStop).toHaveBeenCalledTimes(1);
  // No GPS: no pocket mode either.
  await view.rerender(<RunCard track={emptyTrack()} live={false} onStop={onStop} />);
  expect(screen.queryByLabelText("Pocket mode")).toBeNull();
  expect(screen.getByText("Stop")).toBeOnTheScreen();
});

test("at the end of a route only Finish is left", async () => {
  const onStop = jest.fn();
  const track = north(300).reduce<Track>(
    (run, next) => ({
      fixes: [...run.fixes, next],
      distanceM: run.fixes.length * 50,
    }),
    emptyTrack(),
  );
  await render(
    <RunCard
      track={track}
      live
      arrived
      route={{ remainingM: 0, done: 1 }}
      onStop={onStop}
    />,
  );
  expect(screen.queryByLabelText("Pause")).toBeNull();
  expect(screen.queryByLabelText("Pocket mode")).toBeNull();
  await fireEvent.press(screen.getByText("Finish"));
  expect(onStop).toHaveBeenCalledTimes(1);
});

test("a swipe is sideways and long enough: left for Data, right for Map", () => {
  expect(swipedTo(-80, 5)).toBe("data");
  expect(swipedTo(80, -5)).toBe("map");
  // Too short, or more down than across.
  expect(swipedTo(-30, 0)).toBeNull();
  expect(swipedTo(-80, 60)).toBeNull();
  expect(swipedTo(0, 0)).toBeNull();
});
