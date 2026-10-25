/**
 * A run the app was closed during opens again, paused (TASK-272, ADR-0240):
 * what the run file keeps of the route for it, how the app tells such a run
 * as it opens, and how the run waits for «Resume». The app itself is in
 * __tests__/AppReopenRun.test.tsx.
 */
import type { Direction, LatLon } from "@shaperoute/shared-types";

import {
  controlRun,
  pauseRun,
  resumeRun,
  runControl,
  setAutoPause,
  skipCountdown,
} from "./runControl";
import { durationMs, holdTrack, type Track, type TrackFix } from "./trackRecorder";
import {
  clearRun,
  interruptedRun,
  loadRun,
  REOPEN_WITHIN_MS,
  RUN_FILE,
  type SavedRun,
  saveRun,
  startRun,
} from "./trackStore";

// The phone's documents folder, in memory: what is written stays there for
// the next read, as after closing the app.
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
const NOW = Date.UTC(2026, 9, 10, 7, 0, 0);
const north = (m: number): LatLon => [START[0] + m * METRE, START[1]];
const ROUTE: LatLon[] = Array.from({ length: 11 }, (_, i) => north(100 * i));

const DIRECTIONS: Direction[] = [
  {
    node: 0,
    point: north(0),
    distance_m: 0,
    turn: "depart",
    angle_deg: 0,
    street: "Via Roma",
    road_type: "residential",
    branches: 3,
    joined: false,
  },
  {
    node: 6,
    point: north(600),
    distance_m: 600,
    turn: "left",
    angle_deg: -90,
    street: "Via Verdi",
    road_type: "residential",
    branches: 3,
    joined: false,
    along: null,
  },
];

/** A fix `northM` metres north of START, `seconds` after NOW. */
function fix(northM: number, seconds: number): TrackFix {
  return { point: north(northM), timeMs: NOW + seconds * 1000, accuracyM: 5 };
}

/** A run of ROUTE left in the file with `status`, its fixes at `seconds`. */
function leftRun(status: SavedRun["status"], ...seconds: number[]): SavedRun {
  const fixes = seconds.map((s, i) => fix(20 * i, s));
  return {
    version: 1,
    route: ROUTE,
    similarity: 0.8,
    track: { fixes, distanceM: 20 * Math.max(0, fixes.length - 1) },
    status,
  };
}

beforeEach(() => {
  disk.files.clear();
  jest.useFakeTimers({ now: NOW });
  setAutoPause(true);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("the track held, after the app closed", () => {
  const fixes = [fix(0, 0), fix(20, 6)];

  test("the time since the last fix is a pause of the runner's, still open", () => {
    expect(holdTrack({ fixes, distanceM: 20 }).pauses).toEqual([
      { fromMs: NOW + 6000, toMs: null },
    ]);
  });

  test("the pauses before are kept", () => {
    const track: Track = {
      fixes,
      distanceM: 20,
      pauses: [{ fromMs: NOW + 1000, toMs: NOW + 2000 }],
    };
    expect(holdTrack(track).pauses).toEqual([
      { fromMs: NOW + 1000, toMs: NOW + 2000 },
      { fromMs: NOW + 6000, toMs: null },
    ]);
  });

  test.each([
    ["the runner's", { fromMs: NOW + 7000, toMs: null }],
    ["the pen's", { fromMs: NOW + 7000, toMs: null, pen: true as const }],
  ])("a pause of %s goes on as it was", (_name, pause) => {
    const track: Track = { fixes, distanceM: 20, pauses: [pause] };
    expect(holdTrack(track)).toBe(track);
  });

  test.each([
    ["by standing still", { fromMs: NOW + 9000, toMs: null, auto: true as const }],
    ["of the app away", { fromMs: NOW + 9000, toMs: null, away: true as const }],
  ])("a pause %s becomes the runner's, from where it began", (_name, pause) => {
    const track: Track = { fixes, distanceM: 20, pauses: [pause] };
    expect(holdTrack(track).pauses).toEqual([{ fromMs: NOW + 9000, toMs: null }]);
  });

  test("a track with no fix is a new one", () => {
    expect(holdTrack({ fixes: [], distanceM: 0 })).toEqual({ fixes: [], distanceM: 0 });
  });
});

describe("the run file keeps what the voice needs of the route", () => {
  test("directions, word and stretches on foot are written and read back", () => {
    const run = startRun(ROUTE, NOW, 0.8, [[2, 3]], "cycling", undefined, {
      directions: DIRECTIONS,
      word: "AB",
      onFoot: [[4, 6]],
    });
    run.onFix(fix(0, 0), false);
    run.onFix(fix(20, 6), false);
    const saved = loadRun();
    expect(saved?.directions).toEqual(DIRECTIONS);
    expect(saved?.word).toBe("AB");
    expect(saved?.on_foot).toEqual([[4, 6]]);
    expect(saved?.walks).toEqual([[2, 3]]);
  });

  test("a route without them writes the file as before", () => {
    const run = startRun(ROUTE, NOW, 0.8, [], undefined, undefined, {
      directions: [],
      word: null,
      onFoot: [],
    });
    run.onFix(fix(0, 0), false);
    const written = JSON.parse(disk.files.get(RUN_URI) ?? "{}") as object;
    expect(Object.keys(written).sort()).toEqual(
      ["route", "similarity", "status", "track", "version"].sort(),
    );
  });

  test("a file from before TASK-272 is still a run", () => {
    disk.files.set(RUN_URI, JSON.stringify(leftRun("running", 0, 6)));
    expect(loadRun()?.track.fixes).toHaveLength(2);
    expect(loadRun()?.directions).toBeUndefined();
  });

  test.each([
    ["directions that are not directions", { directions: [{ turn: "left" }] }],
    ["a word that is not a word", { word: 7 }],
    ["stretches that are not stretches", { on_foot: [[1.5, 2]] }],
  ])("%s make the file no run", (_name, field) => {
    disk.files.set(RUN_URI, JSON.stringify({ ...leftRun("running", 0, 6), ...field }));
    expect(loadRun()).toBeNull();
  });
});

describe("the app, as it opens, finds a run it was closed during", () => {
  const minutes = (m: number) => NOW + m * 60_000;

  test("a run left running, its last fix lately, opens again", () => {
    const run = leftRun("running", 0, 6, 12);
    expect(interruptedRun(run, minutes(5))).toBe(run);
    expect(interruptedRun(run, NOW + 12_000 + REOPEN_WITHIN_MS)).toBe(run);
  });

  test("older than REOPEN_WITHIN_MS it does not: its end screen shows it", () => {
    expect(
      interruptedRun(leftRun("running", 0, 6, 12), NOW + 12_000 + REOPEN_WITHIN_MS + 1),
    ).toBeNull();
  });

  test.each([
    ["stopped by the runner", leftRun("stopped", 0, 6)],
    ["arrived", leftRun("arrived", 0, 6)],
    ["with one fix only", leftRun("running", 0)],
    [
      "of a route without its similarity",
      { ...leftRun("running", 0, 6), similarity: undefined },
    ],
  ])("a run %s does not", (_name, run) => {
    expect(interruptedRun(run, minutes(5))).toBeNull();
  });

  test("a run without a route does, with no similarity to have", () => {
    const free: SavedRun = {
      ...leftRun("running", 0, 6),
      route: [],
      similarity: undefined,
    };
    expect(interruptedRun(free, minutes(5))).toBe(free);
  });

  test("no run, nothing to open", () => {
    expect(interruptedRun(null, NOW)).toBeNull();
  });
});

describe("the run opened again waits for «Resume»", () => {
  /** A run of ROUTE to 40 m, then the app closed: no stop. */
  function closedDuringRun(): void {
    clearRun();
    const run = startRun(ROUTE, NOW);
    run.onFix(fix(0, 0), false);
    run.onFix(fix(20, 6), false);
    run.onFix(fix(40, 15), false);
    expect(loadRun()?.status).toBe("running");
  }

  test("its track goes on paused from the last fix, however long ago", () => {
    closedDuringRun();
    // How long ago is the app's to judge as it opens, not the recorder's.
    const later = NOW + REOPEN_WITHIN_MS * 2;
    const run = startRun(ROUTE, later);
    expect(run.track().fixes).toHaveLength(3);
    expect(run.track().pauses).toEqual([{ fromMs: NOW + 15_000, toMs: null }]);
    // Paused, the GPS adds nothing to the line.
    run.onFix(fix(500, later / 1000 - NOW / 1000 + 5), false);
    expect(run.track().fixes).toHaveLength(3);
  });

  test("«Resume» ends the pause: the time closed does not count, nor is the line joined", () => {
    closedDuringRun();
    jest.setSystemTime(NOW + 10 * 60_000);
    const recorder = startRun(ROUTE, Date.now());
    const session = controlRun(recorder, { onChange: jest.fn(), say: jest.fn() });
    // No countdown: paused, by the runner's hand as it were.
    expect(runControl()).toMatchObject({ phase: "paused", auto: false, pen: false });
    expect(runControl().startsAtMs).toBeNull();

    jest.setSystemTime(NOW + 12 * 60_000);
    resumeRun();
    expect(runControl().phase).toBe("running");
    session.onFix(fix(300, 12 * 60 + 1), false);
    session.onFix(fix(320, 12 * 60 + 7), false);
    const track = recorder.track();
    expect(track.pauses).toEqual([{ fromMs: NOW + 15_000, toMs: NOW + 12 * 60_000 }]);
    // Where the runner is now is not joined to where the app closed.
    expect(track.fixes[3].gap).toBe(true);
    expect(track.distanceM).toBeCloseTo(60, 0);
    // 15 s before the app closed, 7 s after «Resume».
    expect(durationMs(track)).toBe(22_000);
    // It pauses and stops as any run.
    pauseRun();
    expect(runControl().phase).toBe("paused");
    session.end();
    recorder.stop();
    expect(loadRun()?.status).toBe("stopped");
  });

  test("standing still while paused does not pause it again, nor end the pause", () => {
    closedDuringRun();
    const recorder = startRun(ROUTE, Date.now());
    const session = controlRun(recorder, { onChange: jest.fn(), say: jest.fn() });
    jest.advanceTimersByTime(60_000);
    session.onFix(fix(40, 80), false);
    expect(runControl()).toMatchObject({ phase: "paused", auto: false });
    expect(recorder.track().pauses).toEqual([{ fromMs: NOW + 15_000, toMs: null }]);
    session.end();
  });

  test("closed on a walk between two letters, the next letter goes on by itself", () => {
    clearRun();
    const first = startRun(ROUTE, NOW, 0.8, [[1, 2]]);
    first.onFix(fix(0, 0), false);
    first.onFix(fix(100, 30), false);
    first.liftPen(NOW + 30_000);
    expect(loadRun()?.track.pauses).toEqual([
      { fromMs: NOW + 30_000, toMs: null, pen: true },
    ]);

    const recorder = startRun(ROUTE, NOW + 5 * 60_000, 0.8, [[1, 2]]);
    const session = controlRun(recorder, { onChange: jest.fn(), say: jest.fn() });
    expect(runControl()).toMatchObject({ phase: "paused", pen: true });
    session.lowerPen(NOW + 6 * 60_000);
    expect(runControl()).toMatchObject({ phase: "running", pen: false });
    expect(recorder.track().pauses).toEqual([
      { fromMs: NOW + 30_000, toMs: NOW + 6 * 60_000, pen: true },
    ]);
    session.end();
  });

  test("a run stopped by the runner still goes on at once, «Keep running»", () => {
    closedDuringRun();
    startRun(ROUTE, NOW + 20_000).stop();
    const recorder = startRun(ROUTE, NOW + 60_000);
    const session = controlRun(recorder, { onChange: jest.fn(), say: jest.fn() });
    expect(runControl().phase).toBe("running");
    expect(recorder.track().pauses).toEqual([
      { fromMs: NOW + 15_000, toMs: NOW + 60_000 },
    ]);
    session.end();
  });

  test("a new run on its route still begins with the countdown", () => {
    clearRun();
    saveRun(leftRun("running", 0));
    const recorder = startRun(ROUTE, NOW + 60_000);
    const session = controlRun(recorder, { onChange: jest.fn(), say: jest.fn() });
    expect(recorder.track().fixes).toHaveLength(0);
    expect(runControl().phase).toBe("countdown");
    skipCountdown();
    session.end();
  });
});
