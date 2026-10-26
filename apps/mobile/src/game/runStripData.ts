import type { GameCatalog, GameMe, GameShape } from "@shaperoute/shared-types";

import { type AccountOutcome, ask } from "../api/accounts";
import { t } from "../i18n";
import type { Language } from "../i18n/languages";
import { lastKmS, paceClock } from "../navigation/runStats";
import type { Track } from "../navigation/trackRecorder";
import { metresPer } from "../units/format";
import type { Units } from "../units/units";
import { fetchGameMe } from "./gameApi";
import { goalPaceLabel, progressText } from "./goalText";
import { shapeNameIn } from "./ShapeCard";

/**
 * What the game's line of the run screen reads once, as a run on foot
 * starts (TASK-296 part E, docs/GIOCO.md §9 «Durante la corsa»): the
 * account's game (GET /game/me) and its teams (GET /game/teams), for the
 * piece it holds. From them, pure choices: the next shape by distance, or
 * the pace piece in hand; and the line's words. The teams are read with
 * types of their own, the few fields the line needs (docs/API.md, «Shape
 * game», part C): part D brings the whole `GameTeams` to shared-types, and
 * this file will use those.
 */

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** A piece that asks a pace: `distance_m` in one run at `pace_s` seconds a
 * kilometre, or better. */
export type PaceGoal = { kind: "pace"; distance_m: number; pace_s: number };

type StripGoal = { kind: "distance"; total_m: number } | PaceGoal;

export type StripPiece = {
  idx: number;
  goal: StripGoal;
  /** Who holds it; null while it is free. */
  holder: { public_id: string } | null;
  done: boolean;
};

export type StripChallenge = {
  shape_id: string;
  /** Going, done, or past its deadline by three hours. */
  status: "active" | "completed" | "expired";
  pieces: StripPiece[];
};

/** GET /game/teams, as far as the line reads it: each team's newest
 * challenge, or null without one. */
export type StripTeams = { teams: { challenge: StripChallenge | null }[] };

/** No pace yet: before the first whole kilometre, as the run's tiles say. */
export const NO_PACE = "–";

const STATUSES: readonly string[] = ["active", "completed", "expired"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGoal(value: unknown): value is StripGoal {
  if (!isRecord(value)) {
    return false;
  }
  if (value.kind === "distance") {
    return typeof value.total_m === "number";
  }
  return (
    value.kind === "pace" &&
    typeof value.distance_m === "number" &&
    typeof value.pace_s === "number"
  );
}

function isPiece(value: unknown): value is StripPiece {
  return (
    isRecord(value) &&
    typeof value.idx === "number" &&
    isGoal(value.goal) &&
    (value.holder === null ||
      (isRecord(value.holder) && typeof value.holder.public_id === "string")) &&
    typeof value.done === "boolean"
  );
}

function isChallenge(value: unknown): value is StripChallenge {
  return (
    isRecord(value) &&
    typeof value.shape_id === "string" &&
    typeof value.status === "string" &&
    STATUSES.includes(value.status) &&
    Array.isArray(value.pieces) &&
    value.pieces.every(isPiece)
  );
}

export function isStripTeams(value: unknown): value is StripTeams {
  return (
    isRecord(value) &&
    Array.isArray(value.teams) &&
    value.teams.every(
      (team) =>
        isRecord(team) && (team.challenge === null || isChallenge(team.challenge)),
    )
  );
}

/** GET /game/teams: the account's teams, each with its newest challenge.
 * An API before part C answers 404 (`http_error`). */
export function fetchStripTeams(
  baseUrl: string,
  token: string,
  options: Options = {},
): Promise<AccountOutcome<StripTeams>> {
  return ask(baseUrl, "/game/teams", { method: "GET", token }, isStripTeams, options);
}

/**
 * The pace piece the account holds in a challenge still going, or null: a
 * piece of distance, a piece done, somebody else's, or a challenge over are
 * not it. The first found, in the order of the teams.
 */
export function heldPaceGoal(
  teams: StripTeams,
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
    publicId === null
      ? Promise.resolve(null)
      : fetchStripTeams(baseUrl, token, options),
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
