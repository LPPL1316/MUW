/**
 * The run goes on while another app is in front, the camera for a photo
 * (TASK-304, ADR-0264: the user's choice): the run file is written as the
 * app leaves the front and at each fix behind, an absence up to
 * AWAY_AFTER_MS is run (its time counted, the line joined straight), and a
 * run iOS closed lately opens again going on.
 */
import type { LatLon } from "@shaperoute/shared-types";
import { AppState, type AppStateStatus } from "react-native";

import { metresBetween } from "../map/coordinates";
import { controlRun, runControl, setAutoPause } from "./runControl";
import { durationMs, type TrackFix } from "./trackRecorder";
import {
  AWAY_AFTER_MS,
  clearRun,
  loadRun,
  RUN_FILE,
  type SavedRun,
  saveRun,
  startRun,
} from "./trackStore";

// The phone's documents folder, in memory: what is written stays there for
// the next read, as after iOS closed the app.
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
  return { File, Paths: { document: { uri: "file:///documents/" } }, files };
});

const disk = jest.requireMock<{ files: Map<string, string> }>("expo-file-system");
const RUN_URI = `file:///documents/${RUN_FILE}`;

const START: LatLon = [46.0122, 11.2986];
const METRE = 1 / 111_195;
const NOW = Date.UTC(2026, 9, 25, 9, 0, 0);
const north = (m: number): LatLon => [START[0] + m * METRE, START[1]];
const ROUTE: LatLon[] = Array.from({ length: 21 }, (_, i) => north(100 * i));
const MINUTE = 60_000;

/** A fix `northM` metres north of START, `seconds` after NOW. */
function fix(northM: number, seconds: number): TrackFix {
  return { point: north(northM), timeMs: NOW + seconds * 1000, accuracyM: 5 };
}

/** The fixes in the file, as iOS would leave it closing the app now. */
function fixesInFile(): number {
  const text = disk.files.get(RUN_URI);
  return text === undefined ? 0 : (JSON.parse(text) as SavedRun).track.fixes.length;
}

/** What the app tells its listeners, and what it says it is. */
let listeners: ((next: AppStateStatus) => void)[] = [];
let state: AppStateStatus = "active";
function goTo(next: AppStateStatus): void {
  state = next;
  listeners.forEach((listener) => listener(next));
}

beforeEach(() => {
  disk.files.clear();
  jest.useFakeTimers({ now: NOW });
  setAutoPause(true);
  listeners = [];
  state = "active";
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    listeners.push(listener as (next: AppStateStatus) => void);
    return {
      remove: () => {
        listeners = listeners.filter((other) => other !== listener);
      },
    } as ReturnType<typeof AppState.addEventListener>;
  });
  Object.defineProperty(AppState, "currentState", {
    configurable: true,
    get: () => state,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("the file, as the app leaves the front", () => {
  test("is written at once, with what was not written yet", () => {
    const run = startRun(ROUTE, NOW);
    run.onFix(fix(0, 0), false);
    run.onFix(fix(20, 5), false);
    run.onFix(fix(40, 10), false);
    // In front, at most every 15 s: the first fix only.
    expect(fixesInFile()).toBe(1);
    goTo("background");
    expect(fixesInFile()).toBe(3);
    run.stop();
  });

  test("«inactive», the step before, writes it too; back in front nothing more", () => {
    const run = startRun(ROUTE, NOW);
    run.onFix(fix(0, 0), false);
    run.onFix(fix(20, 5), false);
    goTo("inactive");
    expect(fixesInFile()).toBe(2);
    goTo("active");
    run.onFix(fix(40, 10), false);
    expect(fixesInFile()).toBe(2);
    run.stop();
  });

  test("behind, each fix kept is written; in front again, every 15 s as before", () => {
    const run = startRun(ROUTE, NOW);
    run.onFix(fix(0, 0), false);
    goTo("background");
    run.onFix(fix(20, 3), false);
    expect(fixesInFile()).toBe(2);
    run.onFix(fix(40, 6), false);
    expect(fixesInFile()).toBe(3);
    // A fix the line does not keep (2 m on) writes nothing new.
    run.onFix(fix(42, 7), false);
    expect(fixesInFile()).toBe(3);
    goTo("active");
    run.onFix(fix(60, 9), false);
    expect(fixesInFile()).toBe(3);
    run.stop();
  });

  test("a run stopped, or arrived, is not written again", () => {
    const run = startRun(ROUTE, NOW);
    run.onFix(fix(0, 0), false);
    run.stop();
    const written = disk.files.get(RUN_URI);
    goTo("background");
    expect(disk.files.get(RUN_URI)).toBe(written);
    // Nor does the stopped recorder listen any more.
    expect(listeners).toHaveLength(0);
  });

  test("closed by iOS right after, the file has the same track as memory", () => {
    const run = startRun(ROUTE, NOW);
    for (let s = 0; s <= 40; s += 4) {
      run.onFix(fix(5 * s, s), false);
    }
    goTo("background");
    // iOS ends the app here: no «Stop», only the file is left.
    expect(loadRun()?.track).toEqual(run.track());
    expect(loadRun()?.status).toBe("running");
    // Opened again, it is the same track.
    const again = startRun(ROUTE, NOW + 2 * MINUTE);
    expect(again.track()).toEqual(run.track());
  });

  test("one recorder listens at a time: a new run leaves the old one's", () => {
    startRun(ROUTE, NOW);
    expect(listeners).toHaveLength(1);
    clearRun();
    startRun(ROUTE, NOW);
    expect(listeners).toHaveLength(1);
  });
});

describe("an absence up to AWAY_AFTER_MS is run (the user's choice)", () => {
  test("ten minutes, in place of ADR-0219's 60 seconds", () => {
    expect(AWAY_AFTER_MS).toBe(10 * MINUTE);
  });

  test("back after nine minutes: joined straight, its time counted", () => {
    const run = startRun(ROUTE, NOW);
    run.onFix(fix(0, 0), false);
    run.onFix(fix(100, 30), false);
    run.leave(NOW + 31_000);
    run.onFix(fix(1500, 30 + 9 * 60), false);
    const track = run.track();
    expect(track.pauses).toBeUndefined();
    expect(track.fixes.some((kept) => kept.gap)).toBe(false);
    expect(track.distanceM).toBeCloseTo(1500, 0);
    expect(durationMs(track)).toBe(30_000 + 9 * MINUTE);
  });

  test("the line joined is the straight one: never longer than the way run", () => {
    const run = startRun(ROUTE, NOW);
    run.onFix(fix(0, 0), false);
    run.onFix(fix(100, 30), false);
    run.leave(NOW + 31_000);
    // Round a block meanwhile: 400 m east, 400 m north, back west.
    const back: TrackFix = {
      point: [START[0] + 500 * METRE, START[1]],
      timeMs: NOW + 6 * MINUTE,
      accuracyM: 5,
    };
    run.onFix(back, false);
    const straight = metresBetween(north(100), back.point);
    expect(run.track().distanceM).toBeCloseTo(
      metresBetween(north(0), north(100)) + straight,
      6,
    );
    expect(straight).toBeLessThan(400 + 400 + 400);
  });

  test("back after eleven minutes: a pause from leaving, and a new stretch", () => {
    const run = startRun(ROUTE, NOW);
    run.onFix(fix(0, 0), false);
    run.onFix(fix(100, 30), false);
    run.leave(NOW + 31_000);
    run.onFix(fix(1500, 30 + 11 * 60), false);
    const track = run.track();
    expect(track.pauses).toEqual([
      { fromMs: NOW + 31_000, toMs: NOW + 30_000 + 11 * MINUTE, away: true },
    ]);
    expect(track.fixes[2].gap).toBe(true);
    expect(track.distanceM).toBeCloseTo(100, 0);
  });
});

describe("a run iOS closed lately opens again going on", () => {
  /** A run of ROUTE to 100 m, its last fix 30 s after NOW, then closed. */
  function closedDuringRun(): void {
    clearRun();
    const run = startRun(ROUTE, NOW);
    run.onFix(fix(0, 0), false);
    run.onFix(fix(50, 15), false);
    run.onFix(fix(100, 30), false);
    goTo("background");
    expect(loadRun()?.status).toBe("running");
    state = "active";
  }

  test("within AWAY_AFTER_MS: running, the next fix joined and the time counted", () => {
    closedDuringRun();
    jest.setSystemTime(NOW + 6 * MINUTE);
    const recorder = startRun(ROUTE, Date.now());
    const session = controlRun(recorder, { onChange: jest.fn(), say: jest.fn() });
    expect(runControl()).toMatchObject({ phase: "running", auto: false, pen: false });
    expect(recorder.track().pauses).toBeUndefined();
    session.onFix(fix(1300, 6 * 60 + 2), false);
    const track = recorder.track();
    expect(track.fixes[3].gap).toBeUndefined();
    expect(track.distanceM).toBeCloseTo(1300, 0);
    expect(durationMs(track)).toBe(6 * MINUTE + 2000);
    session.end();
  });

  test("standing still counts from the reopening, not from the last fix", () => {
    closedDuringRun();
    jest.setSystemTime(NOW + 9 * MINUTE);
    const say = jest.fn();
    const recorder = startRun(ROUTE, Date.now());
    const session = controlRun(recorder, { onChange: jest.fn(), say });
    jest.advanceTimersByTime(9000);
    expect(runControl().phase).toBe("running");
    expect(say).not.toHaveBeenCalled();
    jest.advanceTimersByTime(2000);
    expect(runControl()).toMatchObject({ phase: "paused", auto: true });
    // The minutes closed are run; standing still after the reopening is not.
    expect(recorder.track().pauses).toEqual([
      { fromMs: NOW + 9 * MINUTE + 10_000, toMs: null, auto: true },
    ]);
    session.end();
  });

  test("its next fix later than AWAY_AFTER_MS after the last starts a new stretch", () => {
    closedDuringRun();
    jest.setSystemTime(NOW + 9 * MINUTE);
    const recorder = startRun(ROUTE, Date.now());
    // The GPS slow to come back: its first fix 11 minutes after the last.
    recorder.onFix(fix(1300, 30 + 11 * 60), false);
    const track = recorder.track();
    expect(track.fixes[3].gap).toBe(true);
    expect(track.pauses).toEqual([
      { fromMs: NOW + 30_000, toMs: NOW + 30_000 + 11 * MINUTE, away: true },
    ]);
    expect(track.distanceM).toBeCloseTo(100, 0);
  });

  test("older than AWAY_AFTER_MS: paused until «Resume», as before (ADR-0240)", () => {
    closedDuringRun();
    jest.setSystemTime(NOW + 30_000 + AWAY_AFTER_MS + 1000);
    const recorder = startRun(ROUTE, Date.now());
    const session = controlRun(recorder, { onChange: jest.fn(), say: jest.fn() });
    expect(runControl()).toMatchObject({ phase: "paused", auto: false });
    expect(recorder.track().pauses).toEqual([{ fromMs: NOW + 30_000, toMs: null }]);
    session.end();
  });

  test("closed standing still: still standing still, the first step goes on", () => {
    clearRun();
    const first = startRun(ROUTE, NOW);
    first.onFix(fix(0, 0), false);
    first.onFix(fix(100, 30), false);
    // The runner stopped for the photo: paused by standing still.
    first.pause(NOW + 40_000, true);
    jest.setSystemTime(NOW + 4 * MINUTE);
    const say = jest.fn();
    const recorder = startRun(ROUTE, Date.now());
    const session = controlRun(recorder, { onChange: jest.fn(), say });
    expect(runControl()).toMatchObject({ phase: "paused", auto: true });
    session.onFix(fix(130, 4 * 60 + 5), false);
    expect(runControl().phase).toBe("running");
    expect(say).toHaveBeenCalledWith("Resumed.");
    const track = recorder.track();
    // Joined: the steps after the photo count, the minutes standing do not.
    expect(track.fixes[2].gap).toBeUndefined();
    expect(track.distanceM).toBeCloseTo(130, 0);
    expect(track.pauses).toEqual([
      { fromMs: NOW + 40_000, toMs: NOW + 4 * MINUTE + 5000, auto: true },
    ]);
    session.end();
  });

  test("closed paused by the runner: paused still, until «Resume»", () => {
    clearRun();
    const first = startRun(ROUTE, NOW);
    first.onFix(fix(0, 0), false);
    first.onFix(fix(100, 30), false);
    first.pause(NOW + 40_000);
    const recorder = startRun(ROUTE, NOW + 2 * MINUTE);
    const session = controlRun(recorder, { onChange: jest.fn(), say: jest.fn() });
    expect(runControl()).toMatchObject({ phase: "paused", auto: false });
    session.onFix(fix(300, 2 * 60 + 5), false);
    expect(recorder.track().fixes).toHaveLength(2);
    session.end();
  });

  test("a run stopped with «Stop» is not one iOS closed: it does not go on by itself", () => {
    clearRun();
    const first = startRun(ROUTE, NOW);
    first.onFix(fix(0, 0), false);
    first.onFix(fix(100, 30), false);
    first.stop();
    saveRun({ ...(loadRun() as SavedRun), status: "stopped" });
    // Started again on its route, it is «Keep running»: a pause to now.
    const recorder = startRun(ROUTE, NOW + 2 * MINUTE);
    expect(recorder.track().pauses).toEqual([
      { fromMs: NOW + 30_000, toMs: NOW + 2 * MINUTE },
    ]);
  });
});
