import type {
  GameCatalog,
  GameMe,
  GameShape,
  GameTeams,
} from "@shaperoute/shared-types";

import { t } from "../i18n";
import type { Language } from "../i18n/languages";
import { lastKmS, paceClock } from "../navigation/runStats";
import type { Track } from "../navigation/trackRecorder";
import { metresPer } from "../units/format";
import type { Units } from "../units/units";
import { fetchGameMe } from "./gameApi";
import { goalPaceLabel, progressText } from "./goalText";
import { shapeNameIn } from "./ShapeCard";
import { fetchTeams } from "./teamsApi";

/**
 * What the game's line of the run screen reads once, as a run on foot
 * starts (TASK-296 part E, docs/GIOCO.md §9 «Durante la corsa»): the
 * account's game (GET /game/me) and its teams (GET /game/teams, as part D
 * reads them), for the piece it holds. From them, pure choices: the next
 * shape by distance, or the pace piece in hand; and the line's words.
 */

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** A piece that asks a pace: `distance_m` in one run at `pace_s` seconds a
 * kilometre, or better. */
export type PaceGoal = { kind: "pace"; distance_m: number; pace_s: number };

/** No pace yet: before the first whole kilometre, as the run's tiles say. */
export const NO_PACE = "–";

/**
 * The pace piece the account holds in a challenge still going, or null: a
 * piece of distance, a piece done, somebody else's, or a challenge over are
 * not it. The first found, in the order of the teams.
 */
export function heldPaceGoal(
  teams: GameTeams,
  publicId: string | null,
): PaceGoal | null {
  if (publicId === null) {
    return null;
  }
  for (const { challenge } of teams.teams) {
    if (challenge === null || challenge.status !== "active") {
      continue;
    }
    for (const piece of challenge.pieces) {
      const { goal } = piece;
      if (!piece.done && piece.holder?.public_id === publicId && goal.kind === "pace") {
        // The goal alone, without the API's other fields (`total_m: null`).
        return { kind: "pace", distance_m: goal.distance_m, pace_s: goal.pace_s };
      }
    }
  }
  return null;
}

/** Whether the account has `shape`. One the API did not list, it has not. */
function unlocked(me: GameMe, shape: GameShape): boolean {
  return me.shapes.some((state) => state.id === shape.id && state.unlocked_at !== null);
}

export type NextShape = { shape: GameShape; goalM: number };

/**
 * The shape by distance to run for, with `totalM` metres counted so far
 * (the API's, plus this run's): the nearest not unlocked whose distance is
 * still above the total. One the total has reached is left behind without
 * a word: whether it is unlocked, the server says after «Save» (ADR-0255).
 * Null when none is left.
 */
export function nextDistanceShape(
  catalog: GameCatalog,
  me: GameMe,
  totalM: number,
): NextShape | null {
  let next: NextShape | null = null;
  for (const shape of catalog.shapes) {
    const { goal } = shape;
    if (goal.kind !== "distance" || goal.total_m <= totalM || unlocked(me, shape)) {
      continue;
    }
    if (next === null || goal.total_m < next.goalM) {
      next = { shape, goalM: goal.total_m };
    }
  }
  return next;
}

/** What the line has to go on: the account's game, and the pace piece it
 * holds, if any. */
export type RunStripData = { me: GameMe; pace: PaceGoal | null };

/**
 * Reads the account's game and its teams, both at once, once. Null when the
 * game cannot be read: no network, or an API that refuses the account; the
 * run goes on without the line. Teams that cannot be read (an API before
 * part C answers 404) leave the shape by distance alone. Without a
 * `publicId` no piece can be the account's, and the teams are not asked.
 * Never throws.
 */
export async function loadRunStripData(
  baseUrl: string,
  token: string,
  publicId: string | null,
  options: Options = {},
): Promise<RunStripData | null> {
  const [me, teams] = await Promise.all([
    fetchGameMe(baseUrl, token, options),
    publicId === null ? Promise.resolve(null) : fetchTeams(baseUrl, token, options),
  ]);
  if (me.kind !== "ok") {
    return null;
  }
  return {
    me: me.value,
    pace:
      teams !== null && teams.kind === "ok"
        ? heldPaceGoal(teams.value, publicId)
        : null,
  };
}

/**
 * The line, in the app's units and language. With a pace piece in hand, the
 * last whole kilometre (with miles, the last whole mile) against the
 * target: "Last km 5:12 · target 5:00 /km". Else the next shape by distance,
 * with the kilometres counted so far plus this run's: "Hexagon 14.5 / 20
 * km", as «Play» writes the way left. An estimate of the phone, which never
 * says «unlocked». Null when no shape by distance is left to run for.
 */
export function runStripText(
  data: RunStripData,
  catalog: GameCatalog,
  track: Track,
  units: Units,
  language: Language,
): string | null {
  if (data.pace !== null) {
    const seconds = lastKmS(track, metresPer(units));
    const pace = seconds === null ? NO_PACE : paceClock(seconds);
    const target = goalPaceLabel(data.pace.pace_s, units);
    return units === "mi"
      ? t("Last mi {pace} · target {target}", { pace, target })
      : t("Last km {pace} · target {target}", { pace, target });
  }
  const totalM = data.me.counted_m + track.distanceM;
  const next = nextDistanceShape(catalog, data.me, totalM);
  if (next === null) {
    return null;
  }
  const way = progressText(next.shape.goal, { ...data.me, counted_m: totalM }, units);
  return `${shapeNameIn(next.shape, language)} ${way}`;
}
