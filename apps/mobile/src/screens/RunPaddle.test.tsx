/**
 * The run screen along a route on the water (TASK-251): the speed in km/h
 * where a run shows its pace now and its average pace, and a paddler's
 * pace, the time of 500 m, in the tiles and in the splits. A run's screen
 * is in RunPanel.test.tsx and RunDashboard.test.tsx, a ride's in
 * RunBike.test.tsx, as before.
 */
import type { LatLon } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useEffect, useState } from "react";
import { Text } from "react-native";

import { appLanguage } from "../i18n/language";
import {
  controlRun,
  type RunSession,
  setAutoPause,
  setVoice,
  skipCountdown,
} from "../navigation/runControl";
import {
  addFix,
  emptyTrack,
  type Track,
  type TrackFix,
} from "../navigation/trackRecorder";
import { clearRun, loadRun, pendingRun, startRun } from "../navigation/trackStore";
import { resultValue } from "../share/postRun";
import { SharePostButton } from "../share/SharePost";
import { saveSport } from "../settings/sport";
import { saveUnitsChoice } from "../units/units";
import { FinishCard } from "./FinishScreen";
import { FreeFinishCard, FreeRunCard } from "./FreeRunScreen";
import { RunCard } from "./RunDashboard";
import { RunGrid, RunStrip, useRunNumbers } from "./RunPanel";

// The post's button, for the run it is given: the post is SharePost's.
jest.mock("../share/SharePost", () => ({ SharePostButton: jest.fn(() => null) }));
// The app's language, English unless a test says otherwise.
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

const START: LatLon = [46.0122, 11.2986];
/** A metre north in degrees, a little over: 500 m are a whole 500. */
const METRE = 1 / 111_194;
const NOW = Date.UTC(2026, 9, 6, 7, 0, 0);

/** 1.3 km north on the water, the first 500 m at 6 km/h (5:00) and the
 * rest at 5 km/h (6:00 each 500 m), a fix every 25 m, the last one now. */
function slowingDown(): TrackFix[] {
  const secondsAt = (m: number) => (m <= 500 ? m * 0.6 : 300 + (m - 500) * 0.72);
  const total = secondsAt(1300);
  const fixes: TrackFix[] = [];
  for (let m = 0; m <= 1300; m += 25) {
    fixes.push({
      point: [START[0] + m * METRE, START[1]],
      timeMs: NOW - (total - secondsAt(m)) * 1000,
      accuracyM: 5,
    });
  }
  return fixes;
}

/** An outing as the recording hooks make it, along a route on the water. */
function LivePaddle({ fixes }: { fixes: TrackFix[] }) {
  const [track, setTrack] = useState<Track>(emptyTrack);
  useEffect(() => {
    const recorder = startRun([], Date.now());
    const session: RunSession = controlRun(recorder, {
      onChange: () => setTrack(recorder.track()),
      say: () => {},
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
      activity="paddling"
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

test("on the water the speed is in km/h and the pace is of 500 m", async () => {
  const track = slowingDown().reduce(addFix, emptyTrack());
  function Both() {
    const paddle = useRunNumbers(track, false, undefined, "paddling");
    const run = useRunNumbers(track, false, undefined, "running");
    return (
      <>
        <RunStrip numbers={paddle} />
        <RunGrid numbers={paddle} />
        <RunStrip numbers={run} />
      </>
    );
  }
  await render(<Both />);
  // The last 200 m at 5 km/h; 1.3 km in 14 min 36 s.
  expect(screen.getAllByLabelText("Speed now: 5.0 km/h")).toHaveLength(2);
  expect(screen.getByLabelText("Avg speed: 5.3 km/h")).toBeOnTheScreen();
  expect(screen.getByLabelText("Avg /500 m: 5:37")).toBeOnTheScreen();
  expect(screen.getByLabelText("Last 500 m: 6:00")).toBeOnTheScreen();
  expect(screen.getAllByLabelText("Distance: 1.30 km")).toHaveLength(2);
  // A lake does not climb: the pace has the place of the metres climbed.
  expect(screen.queryByText("Elev. gain")).toBeNull();
  expect(screen.queryByText("Last km")).toBeNull();
  // On the water its own energy (ADR-0318): 5.3 km/h is 2.8 MET for 14.6
  // minutes at 70 kg, 50 kcal, less 18 at rest.
  expect(screen.getByLabelText("Calories: 32 kcal")).toBeOnTheScreen();
  // A run along the same line: its pace for a kilometre, as before.
  expect(screen.getByLabelText("Pace now: 12:00 /km")).toBeOnTheScreen();
});

test("on the water «Data» says each 500 m and how it changed", async () => {
  await render(<LivePaddle fixes={slowingDown()} />);
  // Under the map: the speed now.
  expect(screen.getByLabelText("Speed now: 5.0 km/h")).toBeOnTheScreen();
  expect(screen.queryByText("Pace now")).toBeNull();
  await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
  expect(screen.getByLabelText("Avg /500 m: 5:37")).toBeOnTheScreen();
  expect(screen.getByText("m")).toBeOnTheScreen();
  expect(screen.queryByText("Km")).toBeNull();
  expect(screen.getByLabelText("500 metres: 5:00")).toBeOnTheScreen();
  expect(screen.getByLabelText("1000 metres: 6:00, +1:00")).toBeOnTheScreen();
  expect(screen.queryByLabelText(/^Kilometre 1/)).toBeNull();
  // The faster 500 m has the longer bar, as a run's kilometre.
  expect(screen.getByTestId("split-bar-1")).toHaveStyle({ width: "100%" });
});

test("before the first 500 m the splits say so", async () => {
  await render(<LivePaddle fixes={slowingDown().slice(0, 10)} />);
  await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
  expect(screen.getByText("Your first 500 metres will show here.")).toBeOnTheScreen();
  expect(screen.getByLabelText("Last 500 m: –")).toBeOnTheScreen();
});

test("with miles the speed is in mph, the pace still of 500 m", async () => {
  await act(async () => {
    saveUnitsChoice("mi");
  });
  try {
    await render(<LivePaddle fixes={slowingDown()} />);
    // 5 km/h are 3.1 mph; 1.3 km are 0.81 miles.
    expect(screen.getByLabelText("Speed now: 3.1 mph")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
    expect(screen.getByLabelText("Avg speed: 3.3 mph")).toBeOnTheScreen();
    expect(screen.getByLabelText("Avg /500 m: 5:37")).toBeOnTheScreen();
    expect(screen.getByLabelText("Last 500 m: 6:00")).toBeOnTheScreen();
    expect(screen.getByLabelText("1000 metres: 6:00, +1:00")).toBeOnTheScreen();
    expect(screen.queryByText("Mi")).toBeNull();
  } finally {
    await act(async () => {
      saveUnitsChoice("phone");
    });
  }
});

test("in Italian, the names of the paddler's tiles", async () => {
  jest.mocked(appLanguage).mockReturnValue("it");
  try {
    await render(<LivePaddle fixes={slowingDown()} />);
    expect(screen.getByLabelText("Vel. ora: 5.0 km/h")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("tab", { name: "Dati" }));
    expect(screen.getByLabelText("Vel. media: 5.3 km/h")).toBeOnTheScreen();
    expect(screen.getByLabelText("Med. /500 m: 5:37")).toBeOnTheScreen();
    expect(screen.getByLabelText("Ultimi 500 m: 6:00")).toBeOnTheScreen();
    expect(screen.getByLabelText("1000 metri: 6:00, +1:00")).toBeOnTheScreen();
  } finally {
    jest.mocked(appLanguage).mockReturnValue("en");
  }
});

test("the run file keeps a route on the water as such, a run's is as before", () => {
  const route: LatLon[] = [START, [START[0] + 500 * METRE, START[1]], START];
  const fixes = slowingDown();
  const paddled = startRun(route, NOW, 0.9, [], "paddling");
  fixes.forEach((fix) => paddled.onFix(fix, false));
  paddled.stop();
  expect(loadRun()?.activity).toBe("paddling");
  clearRun();
  const run = startRun(route, NOW, 0.9, [], "running");
  fixes.forEach((fix) => run.onFix(fix, false));
  run.stop();
  expect(loadRun()).not.toBeNull();
  expect(loadRun()).not.toHaveProperty("activity");
});

test("the post of an outing just ended has the pace of 500 m", async () => {
  const route: LatLon[] = [START, [START[0] + 500 * METRE, START[1]], START];
  const recorder = startRun(route, NOW, 0.9, [], "paddling");
  slowingDown().forEach((fix) => recorder.onFix(fix, false));
  recorder.stop();
  const run = pendingRun();
  if (run === null) {
    throw new Error("the run was not kept");
  }
  await render(<FinishCard run={run} onDone={() => {}} />);
  const post = jest.mocked(SharePostButton).mock.calls[0][0].makeRun();
  expect(resultValue(post, "pace")).toBe("5:37 /500 m");
  expect(resultValue(post, "distance")).toBe("1.30 km");
});

test("without a route, «Paddle» in «Settings» makes the numbers a paddler's", async () => {
  const track = slowingDown().reduce(addFix, emptyTrack());
  await act(async () => {
    saveSport("paddle");
  });
  try {
    await render(<FreeRunCard running={false} track={track} onStop={() => {}} />);
    expect(screen.getByLabelText("Speed now: 5.0 km/h")).toBeOnTheScreen();
    expect(screen.queryByText("Pace now")).toBeNull();
  } finally {
    await act(async () => {
      saveSport("run");
    });
  }
});

// A ride without a route shows speeds since TASK-251 part C: RunFreeRide.test.tsx.
test("without a route, a run shows a kilometre's pace, as before", async () => {
  const track = slowingDown().reduce(addFix, emptyTrack());
  await act(async () => {
    saveSport("run");
  });
  await render(<FreeRunCard running={false} track={track} onStop={() => {}} />);
  expect(screen.getByLabelText("Pace now: 12:00 /km")).toBeOnTheScreen();
});

test("the end of an outing without a route: a paddler's numbers and post", async () => {
  jest.mocked(SharePostButton).mockClear();
  const recorder = startRun([], NOW, undefined, [], "paddling");
  slowingDown().forEach((fix) => recorder.onFix(fix, false));
  recorder.stop();
  const run = loadRun();
  if (run === null) {
    throw new Error("the run was not kept");
  }
  await render(<FreeFinishCard run={run} onDone={() => {}} />);
  expect(screen.getByLabelText("Avg speed: 5.3 km/h")).toBeOnTheScreen();
  expect(screen.getByLabelText("Avg /500 m: 5:37")).toBeOnTheScreen();
  expect(screen.getByLabelText("Last 500 m: 6:00")).toBeOnTheScreen();
  const post = jest.mocked(SharePostButton).mock.calls[0][0].makeRun();
  expect(resultValue(post, "pace")).toBe("5:37 /500 m");
});
