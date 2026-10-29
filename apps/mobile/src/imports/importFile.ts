import type { Activity, LatLon } from "@shaperoute/shared-types";

import { activityKey } from "../activities/activityKey";
import type { RecordedRun } from "../activities/recordedRun";
import type { ActivityPause } from "../api/activities";
import { t, tLater } from "../i18n";
import { type FileTrack } from "./fileTrack";
import { isFit, readFit } from "./fit";
import { isGpx, readGpx } from "./gpx";
import { isTcx, readTcx } from "./tcx";

/**
 * A file of another app made into a run of «My activities» (TASK-312,
 * ADR-0272; docs/IMPORTAZIONI.md §3): read on the phone, never sent. Only
 * its points with a position and a time are kept, with the file's own
 * times; the run goes with the PUT of a recorded run, plus `source: "file"`,
 * and the API counts and cleans it as any other (`clean_track`).
 */

/** A bigger file is refused before it is read: «over 25 MB». */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** The most points PUT /me/activities/{key} takes; a longer track keeps
 * one point every so many, evenly. */
export const MAX_POINTS = 20_000;

/** The points of the drawing over the form: each is a View (RunDrawing). */
export const PREVIEW_POINTS = 200;

/** The most pauses the PUT takes. */
export const MAX_PAUSES = 1_000;

/** A gap longer than this between two points is a pause the app made by
 * itself (`auto`): its time does not count, its metres do. */
export const GAP_MS = 60_000;

/** The API takes no run before 2020: the app says so before sending. */
export const EARLIEST_MS = Date.UTC(2020, 0, 1);

/** Why a file does not become a run. */
export type ImportProblem =
  | "not_activity_file"
  | "no_times"
  | "no_positions"
  | "too_big"
  | "too_old"
  | "already_saved";

/** What the app says of each, in the app's language (TASK-210). */
const PROBLEMS: Record<ImportProblem, string> = {
  not_activity_file: tLater("This file is not GPX, TCX or FIT."),
  no_times: tLater("This file has no times: it is a route, not an activity."),
  no_positions: tLater("This file has no positions."),
  too_big: tLater("This file is too big (over 25 MB)."),
  too_old: tLater("Activities before 2020 cannot be added."),
  already_saved: tLater("Already in My activities."),
};

export function importProblemText(problem: ImportProblem): string {
  return t(PROBLEMS[problem]);
}

/** A file made into a run, ready for «Save». */
export type ImportedRun = RecordedRun & {
  /** What the file says it was; null: the sport of «Settings». */
  sport: Activity | null;
  /** The kept track, lighter (PREVIEW_POINTS), for the drawing over the
   * form. */
  line: LatLon[];
};

export type ImportOutcome =
  { kind: "ok"; imported: ImportedRun } | { kind: "problem"; problem: ImportProblem };

/** The file's bytes as text: only the ASCII of tags, numbers and times is
 * read, so each byte is one character, whatever the encoding. */
function textOf(bytes: Uint8Array): string {
  const parts: string[] = [];
  const CHUNK = 0x2000;
  for (let at = 0; at < bytes.length; at += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(at, at + CHUNK)));
  }
  return parts.join("");
}

/** The file read by its content, not its name: GPX, TCX or FIT. */
export function readActivityFile(bytes: Uint8Array): FileTrack | null {
  if (isFit(bytes)) {
    return readFit(bytes);
  }
  const text = textOf(bytes);
  if (isGpx(text)) {
    return readGpx(text);
  }
  if (isTcx(text)) {
    return readTcx(text);
  }
  return null;
}

type Kept = { point: LatLon; timeMs: number };

/** At most `most` of `points`, evenly, the first and the last always. */
function evenly<T>(points: T[], most: number): T[] {
  if (points.length <= most) {
    return points;
  }
  const step = (points.length - 1) / (most - 1);
  return Array.from({ length: most }, (_, i) => points[Math.round(i * step)]);
}

/** The gaps over GAP_MS, as pauses the app made; at most MAX_PAUSES, the
 * longest kept. */
function pausesOf(points: Kept[]): ActivityPause[] {
  const gaps: ActivityPause[] = [];
  for (let i = 1; i < points.length; i += 1) {
    if (points[i].timeMs - points[i - 1].timeMs > GAP_MS) {
      gaps.push({ from_ms: points[i - 1].timeMs, to_ms: points[i].timeMs, auto: true });
    }
  }
  if (gaps.length <= MAX_PAUSES) {
    return gaps;
  }
  return [...gaps]
    .sort(
      (a, b) => b.to_ms - b.from_ms - (a.to_ms - a.from_ms) || a.from_ms - b.from_ms,
    )
    .slice(0, MAX_PAUSES)
    .sort((a, b) => a.from_ms - b.from_ms);
}

/**
 * The file in `bytes` as a run to save, or why not (§3): not one of the
 * three formats; no point with a position; positions without times (a
 * route); a start before 2020. Points out of order in time, or at the same
 * time as the one before, are left out.
 */
export function importedRun(bytes: Uint8Array): ImportOutcome {
  if (bytes.length > MAX_FILE_BYTES) {
    return { kind: "problem", problem: "too_big" };
  }
  const track = readActivityFile(bytes);
  if (track === null) {
    return { kind: "problem", problem: "not_activity_file" };
  }
  const placed = track.points.filter((p) => p.point !== null);
  if (placed.length === 0) {
    return { kind: "problem", problem: "no_positions" };
  }
  const kept: Kept[] = [];
  for (const { point, timeMs } of placed) {
    if (point === null || timeMs === null) {
      continue;
    }
    const last = kept[kept.length - 1];
    if (last === undefined || timeMs > last.timeMs) {
      kept.push({ point, timeMs });
    }
  }
  if (kept.length === 0) {
    return { kind: "problem", problem: "no_times" };
  }
  if (kept.length < 2) {
    return { kind: "problem", problem: "no_positions" };
  }
  if (kept[0].timeMs < EARLIEST_MS) {
    return { kind: "problem", problem: "too_old" };
  }
  const pauses = pausesOf(kept);
  const points = evenly(kept, MAX_POINTS);
  return {
    kind: "ok",
    imported: {
      id: activityKey(points[0]),
      request: {
        track: points.map(({ point, timeMs }) => ({
          point,
          time_ms: timeMs,
          accuracy_m: null,
        })),
        pauses,
        points: null,
        similarity: null,
        shape: null,
        word: null,
        style: null,
        title: null,
        source: "file",
      },
      sport: track.sport,
      line: evenly(points, PREVIEW_POINTS).map(({ point }) => point),
    },
  };
}
