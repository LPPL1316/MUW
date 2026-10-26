import type { LatLon, Walk } from "@shaperoute/shared-types";

import type { ActivityPause, ActivityRequest } from "../api/activities";
import { turnOf } from "../explore/recommendedRoutes";
import type { SavedRun } from "../navigation/trackStore";
import { walksOf } from "../route/walks";
import { activityKey } from "./activityKey";

/**
 * A run that ended, as «My activities» keeps it (TASK-172): its key, and
 * what PUT /me/activities/{key} takes. The fixes and the pauses go as they
 * were recorded: metres, seconds and score are the API's to count. A run
 * along a word with the pen up also sends its route's walks and the pen of
 * its pauses (TASK-199), and a run along a route whose shape is turned sends
 * the turn (TASK-232), and a fix with the phone's height sends it (TASK-305);
 * any other run sends what it sent before, field for field, because an
 * older API refuses what it does not know.
 */
export type RecordedRun = { id: string; request: ActivityRequest };

/** What the route of a run draws, when the app still knows. */
export type Drawn = {
  shape: string | null;
  word: string | null;
  style: "round" | "block" | null;
  title: string | null;
};

/** The API's limits (activities.py): longer texts are cut, not refused. */
const MAX_NAME = 40;
const MAX_TITLE = 60;

function cut(text: string | null, length: number): string | null {
  return text === null ? null : text.slice(0, length);
}

/** Whether two lines are the same points in the same order. */
export function sameLine(a: LatLon[], b: LatLon[]): boolean {
  return (
    a.length === b.length &&
    a.every(([lat, lon], i) => lat === b[i][0] && lon === b[i][1])
  );
}

/**
 * The run in `run`, to send; null when it has no line. `drawn` is what its
 * route draws: left out for a run without a route.
 */
export function recordedRun(run: SavedRun, drawn: Drawn | null): RecordedRun | null {
  const { fixes, pauses = [] } = run.track;
  if (fixes.length < 2) {
    return null;
  }
  // A route is sent whole or not at all: its line and its similarity.
  const withRoute = run.route.length >= 2 && run.similarity !== undefined;
  const what = withRoute ? drawn : null;
  // Only walks that fit the route: the API would refuse the run for others.
  const walks = withRoute ? walksOf(run.route, run.walks) : [];
  const penUp = walks.length > 0;
  return {
    id: activityKey(fixes[0]),
    request: {
      track: fixes.map((fix) => ({
        point: fix.point,
        time_ms: fix.timeMs,
        accuracy_m: fix.accuracyM,
        // The height only when the phone gave one (TASK-305).
        ...(typeof fix.altitudeM === "number" && Number.isFinite(fix.altitudeM)
          ? { altitude_m: fix.altitudeM }
          : {}),
      })),
      // A pause still open has nothing of the run after it.
      pauses: pauses.flatMap((pause): ActivityPause[] =>
        pause.toMs === null || pause.toMs < pause.fromMs
          ? []
          : [
              {
                from_ms: pause.fromMs,
                to_ms: pause.toMs,
                auto: pause.auto === true,
                ...(penUp && pause.pen === true ? { pen: true } : {}),
              },
            ],
      ),
      points: withRoute ? run.route : null,
      similarity:
        withRoute && run.similarity !== undefined
          ? Math.min(1, Math.max(0, run.similarity))
          : null,
      shape: cut(what?.shape ?? null, MAX_NAME),
      word: cut(what?.word ?? null, MAX_NAME),
      style: what?.style ?? null,
      title: cut(what?.title ?? null, MAX_TITLE),
      // Last, and only for a word with the pen up.
      ...(penUp ? { walks: walks.map(([from, to]): Walk => [from, to]) } : {}),
      // And only for a route whose shape is turned (TASK-232).
      ...(withRoute ? turnOf(run) : {}),
    },
  };
}
