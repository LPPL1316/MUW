import { readFileSync } from "fs";
import { join } from "path";

import { isoTimeMs, positionOf, sportOfWord } from "./fileTrack";
import { isFit, readFit } from "./fit";
import { isGpx, readGpx } from "./gpx";
import { isTcx, readTcx } from "./tcx";

const FOLDER = join(__dirname, "../../__tests__/fixtures/imports");

function bytesOf(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FOLDER, name)));
}

function textOf(name: string): string {
  return readFileSync(join(FOLDER, name), "utf8");
}

describe("the times of GPX and TCX", () => {
  it("reads UTC, fractions and offsets", () => {
    const utc = Date.UTC(2025, 3, 12, 6, 31, 5);
    expect(isoTimeMs("2025-04-12T06:31:05Z")).toBe(utc);
    expect(isoTimeMs("2025-04-12T06:31:05.250Z")).toBe(utc + 250);
    expect(isoTimeMs("2025-04-12T08:31:05+02:00")).toBe(utc);
    expect(isoTimeMs("2025-04-12T01:31:05-0500")).toBe(utc);
    // Without a zone a GPX time is UTC.
    expect(isoTimeMs(" 2025-04-12T06:31:05 ")).toBe(utc);
  });

  it("is null for what is not a time", () => {
    expect(isoTimeMs("")).toBeNull();
    expect(isoTimeMs("yesterday")).toBeNull();
    expect(isoTimeMs("2025-04-12")).toBeNull();
  });
});

describe("a position", () => {
  it("is kept on the Earth, not at 0, 0", () => {
    expect(positionOf(46.07, 11.12)).toEqual([46.07, 11.12]);
    expect(positionOf(0, 0)).toBeNull();
    expect(positionOf(91, 11)).toBeNull();
    expect(positionOf(46, 181)).toBeNull();
    expect(positionOf(Number.NaN, 11)).toBeNull();
  });
});

describe("the sport a file names", () => {
  it("is one of MuW's, or null", () => {
    expect(sportOfWord("running")).toBe("running");
    expect(sportOfWord("Running")).toBe("running");
    expect(sportOfWord("trail_running")).toBe("running");
    expect(sportOfWord("9")).toBe("running");
    expect(sportOfWord("1")).toBe("cycling");
    expect(sportOfWord("Biking")).toBe("cycling");
    expect(sportOfWord("road_biking")).toBe("cycling");
    expect(sportOfWord("cycling")).toBe("cycling");
    expect(sportOfWord("VirtualRide")).toBe("cycling");
    expect(sportOfWord("kayaking")).toBe("paddling");
    expect(sportOfWord("stand_up_paddleboarding")).toBe("paddling");
    expect(sportOfWord("hiking")).toBeNull();
    expect(sportOfWord("Other")).toBeNull();
  });
});

describe("a GPX file", () => {
  it("is told by its root", () => {
    expect(isGpx(textOf("strava-run.gpx"))).toBe(true);
    expect(isGpx(textOf("garmin-ride.tcx"))).toBe(false);
  });

  it("from Strava gives every track point with its time, and the sport", () => {
    const track = readGpx(textOf("strava-run.gpx"));
    expect(track.sport).toBe("running");
    expect(track.points).toHaveLength(40);
    expect(track.points[0]).toEqual({
      point: [46.067, 11.1241484],
      timeMs: Date.UTC(2025, 3, 12, 6, 31, 5),
    });
    // The stop of 95 s after the 20th point, 10 s apart otherwise.
    expect(track.points[20].timeMs! - track.points[19].timeMs!).toBe(105_000);
    // The time of the metadata is not a point.
    expect(track.points.every((p) => p.point !== null && p.timeMs !== null)).toBe(true);
  });

  it("from Komoot, a route, gives its points without times", () => {
    const track = readGpx(textOf("komoot-route.gpx"));
    expect(track.points).toHaveLength(12);
    expect(track.points.every((p) => p.point !== null && p.timeMs === null)).toBe(true);
    expect(track.sport).toBeNull();
  });

  it("takes points closed at once, with a prefix and single quotes", () => {
    const track = readGpx(
      "<gpx:gpx><gpx:trk><gpx:type>9</gpx:type><gpx:trkseg>" +
        "<gpx:trkpt lon='11.1' lat='46.1'/>" +
        "<gpx:trkpt lat='46.2' lon='11.2'><gpx:time>2025-01-02T03:04:05Z</gpx:time></gpx:trkpt>" +
        "</gpx:trkseg></gpx:trk></gpx:gpx>",
    );
    expect(track.sport).toBe("running");
    expect(track.points).toEqual([
      { point: [46.1, 11.1], timeMs: null },
      { point: [46.2, 11.2], timeMs: Date.UTC(2025, 0, 2, 3, 4, 5) },
    ]);
  });
});

describe("a TCX file", () => {
  it("is told by its root", () => {
    expect(isTcx(textOf("garmin-ride.tcx"))).toBe(true);
    expect(isTcx(textOf("strava-run.gpx"))).toBe(false);
  });

  it("from Garmin gives every trackpoint, the first without a position", () => {
    const track = readTcx(textOf("garmin-ride.tcx"));
    expect(track.sport).toBe("cycling");
    expect(track.points).toHaveLength(37);
    expect(track.points[0]).toEqual({
      point: null,
      timeMs: Date.UTC(2025, 4, 3, 7, 2, 8),
    });
    expect(track.points[1].point).toEqual([46.0108, 11.3151408]);
    expect(track.points[1].timeMs).toBe(Date.UTC(2025, 4, 3, 7, 2, 11));
  });

  it("of a treadmill run has times and no positions", () => {
    const track = readTcx(textOf("treadmill.tcx"));
    expect(track.sport).toBe("running");
    expect(track.points).toHaveLength(6);
    expect(track.points.every((p) => p.point === null && p.timeMs !== null)).toBe(true);
  });
});

describe("a FIT file", () => {
  const FIT = bytesOf("garmin-run.fit");
  const START = Date.UTC(2025, 5, 7, 5, 48, 20);

  it("is told by «.FIT» in its header", () => {
    expect(isFit(FIT)).toBe(true);
    expect(isFit(bytesOf("strava-run.gpx"))).toBe(false);
    expect(isFit(new Uint8Array(4))).toBe(false);
  });

  it("from a Garmin watch gives its records, compressed times too, and the sport", () => {
    const track = readFit(FIT);
    expect(track.sport).toBe("running");
    // The first record, before the fix, and the 30 of the loop.
    expect(track.points).toHaveLength(31);
    expect(track.points[0]).toEqual({ point: null, timeMs: START });
    expect(track.points[1].timeMs).toBe(START + 1000);
    expect(track.points[1].point![0]).toBeCloseTo(45.8906, 6);
    expect(track.points[1].point![1]).toBeCloseTo(11.0420654, 6);
    // Compressed headers, 10 s apart, across wraps of the 5 bits.
    const seconds = track.points.map((p) => (p.timeMs! - START) / 1000);
    expect(seconds.slice(0, 6)).toEqual([0, 1, 11, 21, 31, 41]);
    // The stop of 70 s, written with a full timestamp.
    expect(seconds[21] - seconds[20]).toBe(70);
    expect(seconds[30]).toBe(1 + 10 * 28 + 70);
    // The big-endian definition reads the same positions.
    for (const { point } of track.points.slice(1)) {
      expect(point![0]).toBeGreaterThan(45.88);
      expect(point![0]).toBeLessThan(45.9);
      expect(point![1]).toBeGreaterThan(11.03);
      expect(point![1]).toBeLessThan(11.05);
    }
  });

  it("cut short gives what came before the cut", () => {
    const whole = readFit(FIT).points;
    const cut = readFit(FIT.slice(0, 400)).points;
    expect(cut.length).toBeGreaterThan(5);
    expect(cut.length).toBeLessThan(whole.length);
    expect(cut).toEqual(whole.slice(0, cut.length));
    expect(readFit(FIT.slice(0, 400)).sport).toBeNull();
  });

  it("chained to another gives the records of both", () => {
    const twice = new Uint8Array(FIT.length * 2);
    twice.set(FIT, 0);
    twice.set(FIT, FIT.length);
    expect(readFit(twice).points).toHaveLength(62);
  });
});
