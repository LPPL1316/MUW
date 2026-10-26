import type { LatLon } from "@shaperoute/shared-types";

import { durationMs, type TrackFix } from "./trackRecorder";
import {
  AWAY_AFTER_MS,
  clearRun,
  endRun,
  pendingRun,
  loadRun,
  RESUME_WITHIN_MS,
  RUN_FILE,
  SAVE_EVERY_MS,
  saveRun,
  startRun,
} from "./trackStore";

// The phone's documents folder, in memory: what is written stays there for
// the next read, as after closing the app.
jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  const state = { failing: false };
  class File {
    uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
    }
    get exists(): boolean {
      return files.has(this.uri);
    }
    create(): void {
      if (state.failing) {
        throw new Error("No space left on device");
      }
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
  return { File, Paths: { document: { uri: "file:///documents/" } }, files, state };
});

const disk = jest.requireMock<{
  files: Map<string, string>;
  state: { failing: boolean };
}>("expo-file-system");
const RUN_URI = `file:///documents/${RUN_FILE}`;

const START: LatLon = [46.0122, 11.2986];
const METRE = 1 / 111_195;
const ROUTE: LatLon[] = [START, [START[0] + 500 * METRE, START[1]], START];
const OTHER_ROUTE: LatLon[] = [START, [START[0], START[1] + 0.01], START];

function fix(northM: number, seconds: number): TrackFix {
  return {
    point: [START[0] + northM * METRE, START[1]],
    timeMs: seconds * 1000,
    accuracyM: 5,
  };
}

beforeEach(() => {
  disk.files.clear();
  disk.state.failing = false;
});

test("a saved run is read back as it was, from the documents folder", () => {
  const run = startRun(ROUTE, 0);
  run.onFix(fix(0, 0), false);
  run.onFix(fix(10, 4), false);
  run.stop();
  expect(disk.files.has(RUN_URI)).toBe(true);
  expect(loadRun()).toEqual({
    version: 1,
    route: ROUTE,
    track: run.track(),
    status: "stopped",
  });
  expect(loadRun()?.track.fixes).toHaveLength(2);
});

test("the file is written at the first fix, then at most every 15 seconds", () => {
  const run = startRun(ROUTE, 0);
  run.onFix(fix(0, 0), false);
  expect(loadRun()?.track.fixes).toHaveLength(1);
  run.onFix(fix(10, 4), false);
  run.onFix(fix(20, 8), false);
  expect(loadRun()?.track.fixes).toHaveLength(1);
  run.onFix(fix(40, SAVE_EVERY_MS / 1000), false);
  expect(loadRun()?.track.fixes).toHaveLength(4);
});

test("the app closed during a run leaves the run in the file, still running", () => {
  const run = startRun(ROUTE, 0);
  run.onFix(fix(0, 0), false);
  run.onFix(fix(60, SAVE_EVERY_MS / 1000), false);
  // No stop(): the app was closed.
  const left = loadRun();
  expect(left?.status).toBe("running");
  expect(left?.track.distanceM).toBeCloseTo(60, 0);
});

test("arriving ends the run: later fixes and stop change nothing", () => {
  const run = startRun(ROUTE, 0);
  run.onFix(fix(0, 0), false);
  run.onFix(fix(10, 4), true);
  run.onFix(fix(200, 60), false);
  run.stop();
  const saved = loadRun();
  expect(saved?.status).toBe("arrived");
  expect(saved?.track.fixes).toHaveLength(2);
});

test("the same route started again soon goes on with the track", () => {
  const first = startRun(ROUTE, 0);
  first.onFix(fix(0, 0), false);
  first.onFix(fix(50, 20), false);
  first.stop();

  const again = startRun(ROUTE, 60_000);
  expect(again.track().fixes).toHaveLength(2);
  // The time it was left is a pause (TASK-169): the clock does not count
  // it, and the line is not joined across it.
  expect(again.track().pauses).toEqual([{ fromMs: 20_000, toMs: 60_000 }]);
  again.onFix(fix(100, 80), false);
  again.onFix(fix(150, 100), false);
  expect(again.track().distanceM).toBeCloseTo(100, 0);
  expect(durationMs(again.track())).toBe(60_000);
  expect(loadRun()?.status).toBe("running");
});

test("a pause is written at once, and read back with the run (TASK-169)", () => {
  const run = startRun(ROUTE, 0);
  run.onFix(fix(0, 0), false);
  run.onFix(fix(10, 4), false);
  run.pause(5000);
  expect(loadRun()?.track.pauses).toEqual([{ fromMs: 5000, toMs: null }]);
  // Paused, nothing is added to the line.
  run.onFix(fix(60, 20), false);
  expect(run.track().fixes).toHaveLength(2);
  run.resume(30_000);
  run.onFix(fix(70, 31), false);
  run.onFix(fix(80, 35), false);
  run.stop();
  const saved = loadRun();
  expect(saved?.track.pauses).toEqual([{ fromMs: 5000, toMs: 30_000 }]);
  expect(saved?.track.fixes[2].gap).toBe(true);
  expect(saved?.track.distanceM).toBeCloseTo(20, 0);
});

test("a pause by standing still is kept as one", () => {
  const run = startRun(ROUTE, 0);
  run.onFix(fix(0, 0), false);
  run.pause(12_000, true);
  expect(loadRun()?.track.pauses).toEqual([{ fromMs: 12_000, toMs: null, auto: true }]);
});

test("a file from before the pauses is still a run", () => {
  disk.files.set(
    RUN_URI,
    JSON.stringify({
      version: 1,
      route: ROUTE,
      track: { fixes: [fix(0, 0), fix(10, 4)], distanceM: 10 },
      status: "stopped",
    }),
  );
  expect(loadRun()?.track.fixes).toHaveLength(2);
  // Pauses that are not pauses: not a run.
  disk.files.set(
    RUN_URI,
    JSON.stringify({
      version: 1,
      route: ROUTE,
      track: { fixes: [fix(0, 0)], distanceM: 0, pauses: [{ fromMs: "now" }] },
      status: "stopped",
    }),
  );
  expect(loadRun()).toBeNull();
});

test.each([
  ["another route", OTHER_ROUTE, 60_000],
  ["the same route much later", ROUTE, 20_000 + RESUME_WITHIN_MS + 1],
])("%s starts a new track and replaces the old run", (_name, route, nowMs) => {
  const first = startRun(ROUTE, 0);
  first.onFix(fix(0, 0), false);
  first.onFix(fix(50, 20), false);
  first.stop();

  const next = startRun(route, nowMs);
  expect(next.track().fixes).toHaveLength(0);
  // Until the new run has a fix, the old one is still in the file.
  expect(loadRun()?.route).toEqual(ROUTE);
  next.onFix(fix(0, nowMs / 1000 + 1), false);
  expect(loadRun()?.route).toEqual(route);
  expect(loadRun()?.track.fixes).toHaveLength(1);
});

test("a run that arrived is not taken up again", () => {
  const first = startRun(ROUTE, 0);
  first.onFix(fix(0, 0), false);
  first.onFix(fix(10, 4), true);
  expect(startRun(ROUTE, 10_000).track().fixes).toHaveLength(0);
});

test("stopping before any fix writes nothing", () => {
  startRun(ROUTE, 0).stop();
  expect(loadRun()).toBeNull();
});

test("a file that is not a run reads as no run", () => {
  expect(loadRun()).toBeNull();
  for (const text of [
    "not json",
    "{}",
    '{"version":2}',
    '{"version":1,"route":[[1]]}',
  ]) {
    disk.files.set(RUN_URI, text);
    expect(loadRun()).toBeNull();
  }
});

test("a phone that refuses the file does not stop the recording", () => {
  disk.state.failing = true;
  expect(
    saveRun({
      version: 1,
      route: ROUTE,
      track: { fixes: [], distanceM: 0 },
      status: "running",
    }),
  ).toBe(false);
  const run = startRun(ROUTE, 0);
  run.onFix(fix(0, 0), false);
  run.onFix(fix(10, 4), false);
  run.stop();
  expect(run.track().fixes).toHaveLength(2);
  expect(loadRun()).toBeNull();
});

test("clearing removes the run", () => {
  const run = startRun(ROUTE, 0);
  run.onFix(fix(0, 0), false);
  clearRun();
  expect(loadRun()).toBeNull();
  clearRun();
});

test("a run with a line and its route's similarity waits for its score", () => {
  expect(pendingRun()).toBeNull();
  const run = startRun(ROUTE, 0, 0.88);
  run.onFix(fix(0, 0), false);
  // One fix is not a line yet.
  expect(pendingRun()).toBeNull();
  run.onFix(fix(60, SAVE_EVERY_MS / 1000), false);
  expect(pendingRun()).toMatchObject({ similarity: 0.88, status: "running" });
});

test("a run without the route's similarity cannot be scored", () => {
  const run = startRun(ROUTE, 0);
  run.onFix(fix(0, 0), false);
  run.onFix(fix(60, 20), false);
  run.stop();
  expect(loadRun()?.track.fixes).toHaveLength(2);
  expect(pendingRun()).toBeNull();
});

test("ending the run writes what there is and gives it back", () => {
  const run = startRun(ROUTE, 0, 0.88);
  run.onFix(fix(0, 0), false);
  run.onFix(fix(10, 4), false);
  run.onFix(fix(20, 8), false);
  // The file is behind: only the first fix was written.
  expect(loadRun()?.track.fixes).toHaveLength(1);
  const ended = endRun();
  expect(ended?.status).toBe("stopped");
  expect(ended?.track.fixes).toHaveLength(3);
  // Navigation stopping after it changes nothing.
  run.stop();
  expect(loadRun()).toEqual(ended);
});

test("ending with no run in progress gives what the file has", () => {
  expect(endRun()).toBeNull();
  const run = startRun(ROUTE, 0, 0.88);
  run.onFix(fix(0, 0), false);
  run.onFix(fix(10, 4), true);
  expect(endRun()?.status).toBe("arrived");
});

test("a run stopped with one fix is not the start of the next (TASK-252)", () => {
  const first = startRun(ROUTE, 0);
  first.onFix(fix(0, 0), false);
  first.stop();
  expect(loadRun()?.track.fixes).toHaveLength(1);

  // The same route, a minute later, from somewhere else.
  const next = startRun(ROUTE, 60_000);
  expect(next.track().fixes).toHaveLength(0);
  next.onFix(fix(400, 61), false);
  expect(loadRun()?.track.fixes).toEqual([fix(400, 61)]);
});

test("ending a run the phone could not write gives it back from memory (TASK-252)", () => {
  const run = startRun(ROUTE, 0, 0.88);
  run.onFix(fix(0, 0), false);
  disk.state.failing = true;
  run.onFix(fix(10, 4), false);
  run.onFix(fix(20, 8), false);
  const ended = endRun();
  expect(ended?.status).toBe("stopped");
  expect(ended?.similarity).toBe(0.88);
  expect(ended?.track.fixes).toHaveLength(3);
  // The file is the old one, a fix long: not what was run.
  expect(loadRun()?.track.fixes).toHaveLength(1);
  // Once given back, it is not given again for a run that never started.
  disk.files.clear();
  expect(endRun()).toBeNull();
});

test("a run written again after a refusal is read from the file", () => {
  const run = startRun(ROUTE, 0, 0.88);
  disk.state.failing = true;
  run.onFix(fix(0, 0), false);
  disk.state.failing = false;
  run.onFix(fix(10, 4), false);
  run.onFix(fix(20, 8), false);
  const ended = endRun();
  expect(ended?.track.fixes).toHaveLength(3);
  expect(loadRun()).toEqual(ended);
});

test("the app leaving for more than AWAY_AFTER_MS is a pause, read back with the run (TASK-255)", () => {
  const run = startRun(ROUTE, 0);
  run.onFix(fix(0, 0), false);
  run.onFix(fix(10, 4), false);
  run.leave(10_000);
  // Nothing yet: the next fix decides.
  expect(loadRun()?.track.pauses).toBeUndefined();
  run.onFix(fix(300, 4 + AWAY_AFTER_MS / 1000 + 1), false);
  expect(loadRun()?.track.pauses).toEqual([
    { fromMs: 10_000, toMs: 4000 + AWAY_AFTER_MS + 1000, away: true },
  ]);
  expect(run.track().fixes[2].gap).toBe(true);
  expect(run.track().distanceM).toBeCloseTo(10, 0);
});

test("the app back within AWAY_AFTER_MS joins the line as before (the user's choice, ADR-0264)", () => {
  const run = startRun(ROUTE, 0);
  run.onFix(fix(0, 0), false);
  run.onFix(fix(10, 4), false);
  run.leave(10_000);
  run.onFix(fix(100, 30), false);
  expect(run.track().pauses).toBeUndefined();
  expect(run.track().fixes[2].gap).toBeUndefined();
  expect(run.track().distanceM).toBeCloseTo(100, 0);
  // Left again, and back late this time: the pause is from the second leaving.
  run.leave(40_000);
  run.onFix(fix(400, 40 + AWAY_AFTER_MS / 1000), false);
  expect(run.track().pauses).toEqual([
    { fromMs: 40_000, toMs: 40_000 + AWAY_AFTER_MS, away: true },
  ]);
});

test("paused by hand already, the app leaving changes nothing", () => {
  const run = startRun(ROUTE, 0);
  run.onFix(fix(0, 0), false);
  run.pause(1000);
  run.leave(2000);
  run.resume(90_000);
  run.onFix(fix(300, 100), false);
  expect(run.track().pauses).toEqual([{ fromMs: 1000, toMs: 90_000 }]);
});
