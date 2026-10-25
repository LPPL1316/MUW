import type { LatLon } from "@shaperoute/shared-types";
import { Platform } from "react-native";

import {
  AUTO_PAUSE_AFTER_MS,
  controlRun,
  COUNTDOWN_MS,
  pauseRun,
  resumeRun,
  runControl,
  setAutoPause,
  setVoice,
  skipCountdown,
  subscribeRunControl,
} from "./runControl";
import { durationMs, openPause, type TrackFix } from "./trackRecorder";
import { clearRun, startRun } from "./trackStore";

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
const ROUTE: LatLon[] = [];

/** A fix `northM` metres north of START, `seconds` after NOW. */
function fix(northM: number, seconds: number): TrackFix {
  return {
    point: [START[0] + northM * METRE, START[1]],
    timeMs: NOW + seconds * 1000,
    accuracyM: 5,
  };
}

/** A new run under the controls, and what they told the recording. */
function begin() {
  const recorder = startRun(ROUTE, Date.now());
  const onChange = jest.fn();
  const say = jest.fn();
  const session = controlRun(recorder, { onChange, say });
  return { recorder, session, onChange, say };
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  clearRun();
  setAutoPause(true);
  setVoice(true);
});

afterEach(() => {
  jest.useRealTimers();
});

test("a new run begins with a countdown, and nothing is recorded until it ends", () => {
  const { recorder, session } = begin();
  expect(runControl().phase).toBe("countdown");
  expect(runControl().startsAtMs).toBe(NOW + COUNTDOWN_MS);
  session.onFix(fix(0, 1), false);
  expect(recorder.track().fixes).toHaveLength(0);

  jest.advanceTimersByTime(COUNTDOWN_MS);
  expect(runControl().phase).toBe("running");
  expect(runControl().startsAtMs).toBeNull();
  // The one fix of the countdown is where the run starts; the next is its line.
  expect(recorder.track().fixes).toHaveLength(1);
  session.onFix(fix(10, 5), false);
  expect(recorder.track().fixes).toHaveLength(2);
  session.end();
  expect(runControl().phase).toBe("idle");
});

test("the run starts where the countdown left the runner, at the moment it ends", () => {
  const { recorder, session, onChange } = begin();
  session.onFix(fix(0, 0.5), false);
  session.onFix(fix(3, 2), false);
  jest.advanceTimersByTime(COUNTDOWN_MS);
  // Standing still, the GPS gives nothing more: the clock runs all the same.
  expect(recorder.track().fixes).toEqual([
    { ...fix(3, 2), timeMs: NOW + COUNTDOWN_MS },
  ]);
  expect(onChange).toHaveBeenCalledTimes(1);
  session.onFix(fix(13, 6), false);
  expect(recorder.track().distanceM).toBeCloseTo(10, 0);
  expect(durationMs(recorder.track())).toBe(3000);
  session.end();
});

test("a run taken up again goes on at once, without a countdown", () => {
  const first = begin();
  skipCountdown();
  first.session.onFix(fix(0, 0), false);
  first.session.onFix(fix(50, 15), false);
  first.session.end();
  first.recorder.stop();

  jest.setSystemTime(NOW + 60_000);
  const again = begin();
  expect(again.recorder.track().fixes).toHaveLength(2);
  expect(runControl().phase).toBe("running");
  again.session.end();
});

test("Pause stops the clock and the line; Resume starts them again", () => {
  const { recorder, session, onChange } = begin();
  skipCountdown();
  session.onFix(fix(0, 0), false);
  session.onFix(fix(100, 30), false);

  jest.setSystemTime(NOW + 40_000);
  pauseRun();
  expect(runControl()).toMatchObject({ phase: "paused", auto: false });
  expect(openPause(recorder.track())?.fromMs).toBe(NOW + 40_000);
  // The screen is told: the track changed between two fixes.
  expect(onChange).toHaveBeenCalledTimes(1);
  session.onFix(fix(150, 60), false);
  expect(recorder.track().fixes).toHaveLength(2);

  jest.setSystemTime(NOW + 100_000);
  resumeRun();
  expect(runControl().phase).toBe("running");
  expect(onChange).toHaveBeenCalledTimes(2);
  session.onFix(fix(160, 105), false);
  session.onFix(fix(260, 135), false);
  expect(recorder.track().distanceM).toBeCloseTo(200, 0);
  expect(durationMs(recorder.track())).toBe(75_000);
  session.end();
});

test("standing still pauses the run by itself, and moving resumes it", () => {
  const { recorder, session, say, onChange } = begin();
  skipCountdown();
  session.onFix(fix(0, 0), false);
  session.onFix(fix(100, 30), false);

  jest.setSystemTime(NOW + 30_000);
  jest.advanceTimersByTime(AUTO_PAUSE_AFTER_MS - 1000);
  expect(runControl().phase).toBe("running");
  jest.advanceTimersByTime(1000);
  expect(runControl()).toMatchObject({ phase: "paused", auto: true });
  expect(openPause(recorder.track())?.auto).toBe(true);
  expect(say).toHaveBeenLastCalledWith("Paused.");
  expect(onChange).toHaveBeenCalledTimes(1);

  // The GPS wandering is not moving; ten metres are.
  session.onFix(fix(101, 60), false);
  expect(runControl().phase).toBe("paused");
  session.onFix(fix(110, 90), false);
  expect(runControl()).toMatchObject({ phase: "running", auto: false });
  expect(say).toHaveBeenLastCalledWith("Resumed.");
  expect(recorder.track().distanceM).toBeCloseTo(110, 0);
  // Thirty seconds running, ten standing before the pause.
  expect(durationMs(recorder.track())).toBe(40_000);
  session.end();
});

test("with Auto-pause off, standing still pauses nothing", () => {
  setAutoPause(false);
  const { session } = begin();
  skipCountdown();
  session.onFix(fix(0, 0), false);
  jest.advanceTimersByTime(AUTO_PAUSE_AFTER_MS * 3);
  expect(runControl().phase).toBe("running");
  session.end();
});

test("after Resume the runner has ten seconds again before the pause by itself", () => {
  const { session } = begin();
  skipCountdown();
  session.onFix(fix(0, 0), false);
  session.onFix(fix(100, 30), false);
  jest.setSystemTime(NOW + 31_000);
  pauseRun();
  jest.advanceTimersByTime(120_000);
  resumeRun();
  jest.advanceTimersByTime(AUTO_PAUSE_AFTER_MS - 1000);
  expect(runControl().phase).toBe("running");
  jest.advanceTimersByTime(1000);
  expect(runControl()).toMatchObject({ phase: "paused", auto: true });
  // Resume by hand ends a pause by standing still too.
  resumeRun();
  expect(runControl().phase).toBe("running");
  session.end();
});

test("a run that has arrived is not paused, by hand or by itself", () => {
  const { session } = begin();
  skipCountdown();
  session.onFix(fix(0, 0), false);
  session.onFix(fix(100, 30), true);
  pauseRun();
  expect(runControl().phase).toBe("running");
  jest.advanceTimersByTime(AUTO_PAUSE_AFTER_MS * 3);
  expect(runControl().phase).toBe("running");
  session.end();
});

test("with no run, the controls do nothing; the switches are kept for the next one", () => {
  pauseRun();
  resumeRun();
  skipCountdown();
  expect(runControl().phase).toBe("idle");
  const heard = jest.fn();
  const unsubscribe = subscribeRunControl(heard);
  setVoice(false);
  setAutoPause(false);
  expect(heard).toHaveBeenCalledTimes(2);
  expect(runControl()).toMatchObject({ voice: false, autoPause: false });
  unsubscribe();
  setVoice(true);
  expect(heard).toHaveBeenCalledTimes(2);
  const { session } = begin();
  expect(runControl()).toMatchObject({ voice: true, autoPause: false });
  session.end();
  expect(runControl().autoPause).toBe(false);
});

// On Android the app's clock stops with the screen off while the GPS goes
// on in its service (TASK-294): the time jumps, no timer runs, and the
// fixes keep coming.
describe("on Android with the screen off", () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, "OS", "android");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("the countdown ends with the first fix after it was due", () => {
    const { recorder, session } = begin();
    session.onFix(fix(0, 1), false);
    // The screen went off before 3, 2, 1 were over.
    jest.setSystemTime(NOW + COUNTDOWN_MS + 2000);
    session.onFix(fix(10, 5), false);
    expect(runControl().phase).toBe("running");
    expect(recorder.track().fixes).toHaveLength(2);
    expect(recorder.track().distanceM).toBeCloseTo(10, 0);
    session.end();
  });

  test("a fix before the countdown is over still waits for it", () => {
    const { recorder, session } = begin();
    jest.setSystemTime(NOW + COUNTDOWN_MS - 1000);
    session.onFix(fix(0, 2), false);
    expect(runControl().phase).toBe("countdown");
    expect(recorder.track().fixes).toHaveLength(0);
    session.end();
  });

  test("standing still is paused from when it was due, and moving on ends it in silence", () => {
    const { recorder, session, say } = begin();
    skipCountdown();
    session.onFix(fix(0, 0), false);
    session.onFix(fix(100, 30), false);
    // Thirty seconds at a light with the screen off: no tick, no fix.
    jest.setSystemTime(NOW + 60_000);
    session.onFix(fix(110, 60), false);
    expect(runControl()).toMatchObject({ phase: "running", auto: false });
    expect(recorder.track().pauses).toEqual([
      { fromMs: NOW + 40_000, toMs: NOW + 60_000, auto: true },
    ]);
    // Nothing was said of it: «Paused.» was never heard.
    expect(say).not.toHaveBeenCalled();
    // Thirty seconds running, ten standing before the pause, as in front.
    expect(durationMs(recorder.track())).toBe(40_000);
    session.end();
  });

  test("still standing at the fix, the run stays paused and says so", () => {
    const { recorder, session, say, onChange } = begin();
    skipCountdown();
    session.onFix(fix(0, 0), false);
    session.onFix(fix(100, 30), false);
    jest.setSystemTime(NOW + 60_000);
    // The GPS wandering is not moving.
    session.onFix(fix(101, 60), false);
    expect(runControl()).toMatchObject({ phase: "paused", auto: true });
    expect(openPause(recorder.track())?.fromMs).toBe(NOW + 40_000);
    expect(say).toHaveBeenLastCalledWith("Paused.");
    expect(onChange).toHaveBeenCalledTimes(1);
    jest.setSystemTime(NOW + 90_000);
    session.onFix(fix(110, 90), false);
    expect(runControl()).toMatchObject({ phase: "running", auto: false });
    expect(say).toHaveBeenLastCalledWith("Resumed.");
    expect(durationMs(recorder.track())).toBe(40_000);
    session.end();
  });

  test("with Auto-pause off, standing still is caught up as nothing", () => {
    setAutoPause(false);
    const { recorder, session } = begin();
    skipCountdown();
    session.onFix(fix(0, 0), false);
    jest.setSystemTime(NOW + 60_000);
    session.onFix(fix(100, 60), false);
    expect(recorder.track().pauses ?? []).toEqual([]);
    session.end();
  });
});

test("on iOS the clock is the timer's: a fix after a jump of time catches nothing up", () => {
  const { recorder, session, say } = begin();
  skipCountdown();
  session.onFix(fix(0, 0), false);
  session.onFix(fix(100, 30), false);
  jest.setSystemTime(NOW + 60_000);
  session.onFix(fix(110, 60), false);
  expect(recorder.track().pauses ?? []).toEqual([]);
  expect(say).not.toHaveBeenCalled();
  session.end();
});
