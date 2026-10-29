import { readFileSync } from "fs";
import { join } from "path";

import { activityKey } from "../activities/activityKey";
import {
  GAP_MS,
  type ImportOutcome,
  type ImportedRun,
  importedRun,
  importProblemText,
  MAX_FILE_BYTES,
  MAX_PAUSES,
  MAX_POINTS,
  PREVIEW_POINTS,
} from "./importFile";

const FOLDER = join(__dirname, "../../__tests__/fixtures/imports");

function fileOf(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FOLDER, name)));
}

function bytesOf(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, "utf8"));
}

function ok(outcome: ImportOutcome): ImportedRun {
  if (outcome.kind !== "ok") {
    throw new Error(`refused: ${outcome.problem}`);
  }
  return outcome.imported;
}

/** A GPX of `count` points one second apart from `startMs`, with `gaps`
 * of the given lengths after the points named. */
function gpx(count: number, startMs: number, gaps: Map<number, number> = new Map()) {
  let ms = startMs;
  const points: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const lat = (46 + i * 1e-5).toFixed(6);
    points.push(
      `<trkpt lat="${lat}" lon="11.1"><time>${new Date(ms).toISOString()}</time></trkpt>`,
    );
    ms += 1000 + (gaps.get(i) ?? 0);
  }
  return bytesOf(`<gpx><trk><trkseg>${points.join("")}</trkseg></trk></gpx>`);
}

const MAY_2025 = Date.UTC(2025, 4, 1, 6, 0, 0);

describe("a file of another app made into a run", () => {
  it("keeps the file's own times, no accuracy, and says it is a file's", () => {
    const run = ok(importedRun(fileOf("strava-run.gpx")));
    const { track } = run.request;
    expect(track).toHaveLength(40);
    expect(track[0]).toEqual({
      point: [46.067, 11.1241484],
      time_ms: Date.UTC(2025, 3, 12, 6, 31, 5),
      accuracy_m: null,
    });
    expect(run.request.source).toBe("file");
    expect(run.request.points).toBeNull();
    expect(run.request.similarity).toBeNull();
    expect(run.request.shape).toBeNull();
    expect(run.request.word).toBeNull();
    expect(run.request.title).toBeNull();
    expect(run.sport).toBe("running");
    expect(run.line).toEqual(track.map((fix) => fix.point));
    const long = ok(importedRun(gpx(1000, MAY_2025)));
    expect(long.line).toHaveLength(PREVIEW_POINTS);
    expect(long.line[0]).toEqual(long.request.track[0].point);
    expect(long.line[PREVIEW_POINTS - 1]).toEqual(long.request.track[999].point);
  });

  it("is named as a recorded run is: the same file twice is the same run", () => {
    const first = ok(importedRun(fileOf("strava-run.gpx")));
    const again = ok(importedRun(fileOf("strava-run.gpx")));
    expect(first.id).toBe(again.id);
    expect(first.id).toBe(
      activityKey({
        point: first.request.track[0].point,
        timeMs: first.request.track[0].time_ms,
      }),
    );
  });

  it("makes a gap over a minute a pause of the app's", () => {
    const run = ok(importedRun(fileOf("strava-run.gpx")));
    // The stop of 95 s after the 20th point (10 s apart otherwise).
    expect(run.request.pauses).toEqual([
      {
        from_ms: run.request.track[19].time_ms,
        to_ms: run.request.track[20].time_ms,
        auto: true,
      },
    ]);
    const exactly = ok(importedRun(gpx(5, MAY_2025, new Map([[1, GAP_MS - 1000]]))));
    expect(exactly.request.pauses).toEqual([]);
  });

  it("reads a TCX from Garmin, leaving out the point without a position", () => {
    const run = ok(importedRun(fileOf("garmin-ride.tcx")));
    expect(run.request.track).toHaveLength(36);
    expect(run.request.track[0].time_ms).toBe(Date.UTC(2025, 4, 3, 7, 2, 11));
    expect(run.sport).toBe("cycling");
    expect(run.request.pauses).toEqual([]);
  });

  it("reads a FIT from a Garmin watch, with its stop as a pause", () => {
    const run = ok(importedRun(fileOf("garmin-run.fit")));
    expect(run.request.track).toHaveLength(30);
    expect(run.request.track[0].time_ms).toBe(Date.UTC(2025, 5, 7, 5, 48, 21));
    expect(run.sport).toBe("running");
    expect(run.request.pauses).toHaveLength(1);
    expect(run.request.pauses[0].to_ms - run.request.pauses[0].from_ms).toBe(70_000);
  });

  it("leaves out points at the same time as the one before, or earlier", () => {
    const text =
      "<gpx><trk><trkseg>" +
      '<trkpt lat="46.0" lon="11.0"><time>2025-05-01T06:00:00Z</time></trkpt>' +
      '<trkpt lat="46.1" lon="11.0"><time>2025-05-01T06:00:00Z</time></trkpt>' +
      '<trkpt lat="46.2" lon="11.0"><time>2025-05-01T05:59:00Z</time></trkpt>' +
      '<trkpt lat="46.3" lon="11.0"><time>2025-05-01T06:00:05Z</time></trkpt>' +
      "</trkseg></trk></gpx>";
    const run = ok(importedRun(bytesOf(text)));
    expect(run.request.track.map((fix) => fix.point[0])).toEqual([46.0, 46.3]);
  });

  it("keeps at most 20 000 points, evenly, the first and the last", () => {
    const run = ok(importedRun(gpx(MAX_POINTS * 2 + 1, MAY_2025)));
    const { track } = run.request;
    expect(track).toHaveLength(MAX_POINTS);
    expect(track[0].time_ms).toBe(MAY_2025);
    expect(track[MAX_POINTS - 1].time_ms).toBe(MAY_2025 + MAX_POINTS * 2 * 1000);
    // One point in two, as near as rounding allows.
    expect(track[1].time_ms - track[0].time_ms).toBe(2000);
  });

  it("keeps the longest 1 000 pauses, in order", () => {
    const gaps = new Map<number, number>();
    for (let i = 0; i < MAX_PAUSES + 10; i += 1) {
      // The first ten are the shortest.
      gaps.set(i * 2, GAP_MS + (i < 10 ? 1000 : 5000));
    }
    const run = ok(importedRun(gpx((MAX_PAUSES + 10) * 2 + 2, MAY_2025, gaps)));
    const { pauses } = run.request;
    expect(pauses).toHaveLength(MAX_PAUSES);
    expect(pauses.every((p) => p.to_ms - p.from_ms === GAP_MS + 6000)).toBe(true);
    expect(pauses.every((p, i) => i === 0 || p.from_ms > pauses[i - 1].from_ms)).toBe(
      true,
    );
  });
});

describe("a file that does not become a run", () => {
  it("is refused when too big, before it is read", () => {
    expect(importedRun(new Uint8Array(MAX_FILE_BYTES + 1))).toEqual({
      kind: "problem",
      problem: "too_big",
    });
  });

  it("is refused when it is not GPX, TCX or FIT", () => {
    for (const text of ["", "hello", '{"type":"FeatureCollection"}', "<kml></kml>"]) {
      expect(importedRun(bytesOf(text))).toEqual({
        kind: "problem",
        problem: "not_activity_file",
      });
    }
  });

  it("is a route when its positions have no times", () => {
    expect(importedRun(fileOf("komoot-route.gpx"))).toEqual({
      kind: "problem",
      problem: "no_times",
    });
  });

  it("has no positions on a treadmill", () => {
    expect(importedRun(fileOf("treadmill.tcx"))).toEqual({
      kind: "problem",
      problem: "no_positions",
    });
    expect(importedRun(bytesOf("<gpx><trk></trk></gpx>"))).toEqual({
      kind: "problem",
      problem: "no_positions",
    });
  });

  it("is refused before 2020", () => {
    expect(importedRun(gpx(10, Date.UTC(2019, 11, 31, 23, 59, 0)))).toEqual({
      kind: "problem",
      problem: "too_old",
    });
    expect(importedRun(gpx(10, Date.UTC(2020, 0, 1))).kind).toBe("ok");
  });

  it("says why in words", () => {
    expect(importProblemText("no_times")).toBe(
      "This file has no times: it is a route, not an activity.",
    );
    expect(importProblemText("no_positions")).toBe("This file has no positions.");
    expect(importProblemText("not_activity_file")).toBe(
      "This file is not GPX, TCX or FIT.",
    );
    expect(importProblemText("too_big")).toBe("This file is too big (over 25 MB).");
    expect(importProblemText("too_old")).toBe(
      "Activities before 2020 cannot be added.",
    );
    expect(importProblemText("already_saved")).toBe("Already in My activities.");
  });
});
