/**
 * The run screen of a swim (TASK-323 D, the user's choice): the paddle's
 * with a swimmer's pace, the time of 100 m, in the tiles and in the splits;
 * no voice to switch; the pause by standing still after 30 s. The paddle's
 * is in RunPaddle.test.tsx.
 */
import type { LatLon } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useEffect, useState } from "react";
import { Text } from "react-native";

import { appLanguage } from "../i18n/language";
import {
  controlRun,
  runControl,
  type RunSession,
  setAutoPause,
  setVoice,
  skipCountdown,
} from "../navigation/runControl";
import { SWIM_AUTO_PAUSE_AFTER_MS } from "../navigation/swim";
import {
  addFix,
  emptyTrack,
  type Track,
  type TrackFix,
} from "../navigation/trackRecorder";
import { clearRun, startRun } from "../navigation/trackStore";
import { RunCard } from "./RunDashboard";
import { RunGrid, RunStrip, useRunNumbers } from "./RunPanel";

jest.mock("../share/SharePost", () => ({ SharePostButton: jest.fn(() => null) }));
jest.mock("../i18n/language", () => ({
  ...jest.requireActual<typeof import("../i18n/language")>("../i18n/language"),
  appLanguage: jest.fn(() => "en"),
}));
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

// Along the beach of Riccione, in the band.
const START: LatLon = [44.0, 12.65];
/** A metre north in degrees, a little over: 100 m are a whole 100. */
const METRE = 1 / 111_194;
const NOW = Date.UTC(2027, 6, 14, 8, 0, 0);

/** 600 m swum north, the first 300 m at 2:00 every 100 m (3 km/h) and the
 * rest at 2:30 (2.4 km/h), a fix every 10 m, the last one now. */
function easing(): TrackFix[] {
  const secondsAt = (m: number) => (m <= 300 ? m * 1.2 : 360 + (m - 300) * 1.5);
  const total = secondsAt(600);
  const fixes: TrackFix[] = [];
  for (let m = 0; m <= 600; m += 10) {
    fixes.push({
      point: [START[0] + m * METRE, START[1]],
      timeMs: NOW - (total - secondsAt(m)) * 1000,
      accuracyM: 6,
    });
  }
  return fixes;
}

/** A swim as the recording hooks make it, along a route. */
function LiveSwim({ fixes }: { fixes: TrackFix[] }) {
  const [track, setTrack] = useState<Track>(emptyTrack);
  useEffect(() => {
    const recorder = startRun([], Date.now());
    const session: RunSession = controlRun(recorder, {
      onChange: () => setTrack(recorder.track()),
      say: () => {},
      stillMs: SWIM_AUTO_PAUSE_AFTER_MS,
    });
    const gps = (fix: TrackFix) => {
      session.onFix(fix, false);
      setTrack(recorder.track());
    };
    skipCountdown();
    fixes.forEach(gps);
    return () => session.end();
  }, [fixes]);
  return (
    <RunCard
      track={track}
      live
      heading={<Text>Next turn</Text>}
      onStop={() => {}}
      activity="swimming"
    />
  );
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ["queueMicrotask", "nextTick"] });
  clearRun();
  setAutoPause(true);
  setVoice(true);
});

afterEach(() => {
  jest.useRealTimers();
});

test("a swim has speeds in km/h and a swimmer's pace, of 100 m", async () => {
  const track = easing().reduce(addFix, emptyTrack());
  function Both() {
    const swim = useRunNumbers(track, false, undefined, "swimming");
    const run = useRunNumbers(track, false, undefined, "running");
    return (
      <>
        <RunStrip numbers={swim} />
        <RunGrid numbers={swim} />
        <RunStrip numbers={run} />
      </>
    );
  }
  await render(<Both />);
  // The last 200 m at 2.4 km/h: slower than a walk, still a swim.
  expect(screen.getAllByLabelText("Speed now: 2.4 km/h")).toHaveLength(2);
  // 600 m in 13 min 30 s.
  expect(screen.getByLabelText("Avg speed: 2.7 km/h")).toBeOnTheScreen();
  expect(screen.getByLabelText("Avg /100 m: 2:15")).toBeOnTheScreen();
  expect(screen.getByLabelText("Last 100 m: 2:30")).toBeOnTheScreen();
  expect(screen.getAllByLabelText("Distance: 0.60 km")).toHaveLength(2);
  expect(screen.queryByText("Avg /500 m")).toBeNull();
  expect(screen.queryByText("Elev. gain")).toBeNull();
  expect(screen.queryByLabelText(/^Calories: /)).toBeNull();
  // The same line run is a walk too slow to have a pace now.
  expect(screen.getByLabelText("Pace now: – /km")).toBeOnTheScreen();
});

test("«Data» says each 100 m and how it changed, with no voice to switch", async () => {
  await render(<LiveSwim fixes={easing()} />);
  expect(screen.getByLabelText("Speed now: 2.4 km/h")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
  expect(screen.getByLabelText("Avg /100 m: 2:15")).toBeOnTheScreen();
  expect(screen.getByText("/100 m")).toBeOnTheScreen();
  expect(screen.getByLabelText("100 metres: 2:00")).toBeOnTheScreen();
  expect(screen.getByLabelText("400 metres: 2:30, +0:30")).toBeOnTheScreen();
  expect(screen.getByLabelText("600 metres: 2:30, 0:00")).toBeOnTheScreen();
  expect(screen.queryByLabelText(/^Kilometre 1/)).toBeNull();
  // The voice is not heard in the water: no switch, no voice to choose.
  expect(screen.getByRole("switch", { name: "Auto-pause" })).toBeOnTheScreen();
  expect(screen.queryByRole("switch", { name: "Voice" })).toBeNull();
});

test("before the first 100 m the splits say so", async () => {
  await render(<LiveSwim fixes={easing().slice(0, 5)} />);
  await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
  expect(screen.getByText("Your first 100 metres will show here.")).toBeOnTheScreen();
  expect(screen.getByLabelText("Last 100 m: –")).toBeOnTheScreen();
});

test("standing still pauses a swim after 30 s, a run after 10 s", async () => {
  const swim = startRun([], Date.now());
  const swimming = controlRun(swim, {
    onChange: () => {},
    say: () => {},
    stillMs: SWIM_AUTO_PAUSE_AFTER_MS,
  });
  skipCountdown();
  swimming.onFix({ point: START, timeMs: Date.now(), accuracyM: 6 }, false);
  await act(() => jest.advanceTimersByTimeAsync(12_000));
  // A moment to sight the shore: still swimming.
  expect(runControl().phase).toBe("running");
  await act(() => jest.advanceTimersByTimeAsync(20_000));
  expect(runControl()).toMatchObject({ phase: "paused", auto: true });
  swimming.end();

  clearRun();
  const run = startRun([], Date.now());
  const running = controlRun(run, { onChange: () => {}, say: () => {} });
  skipCountdown();
  running.onFix({ point: START, timeMs: Date.now(), accuracyM: 6 }, false);
  await act(() => jest.advanceTimersByTimeAsync(12_000));
  expect(runControl()).toMatchObject({ phase: "paused", auto: true });
  running.end();
});

test("in Italian, the names of the swimmer's tiles", async () => {
  jest.mocked(appLanguage).mockReturnValue("it");
  try {
    await render(<LiveSwim fixes={easing()} />);
    await fireEvent.press(screen.getByRole("tab", { name: "Dati" }));
    expect(screen.getByLabelText("Med. /100 m: 2:15")).toBeOnTheScreen();
    expect(screen.getByLabelText("Ultimi 100 m: 2:30")).toBeOnTheScreen();
    expect(screen.getByLabelText("400 metri: 2:30, +0:30")).toBeOnTheScreen();
  } finally {
    jest.mocked(appLanguage).mockReturnValue("en");
  }
});
