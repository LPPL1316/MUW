import type {
  ChallengeRequest,
  GameChallenge,
  GameTeam,
  GameTeams,
  JoinTeamRequest,
  TeamRequest,
} from "@shaperoute/shared-types";

import { accountProblem } from "../account/messages";
import { type AccountOutcome, ask } from "../api/accounts";
import { isPerson } from "../api/people";
import { t, tLater } from "../i18n";

/**
 * The teams and the challenges of the shape game on the API (TASK-296 part
 * D, ADR-0255; docs/API.md, «Shape game», part C): the eight requests, each
 * with the account's token, never throwing; and the API's refusals in the
 * app's words. An API before part C answers 404 (`http_error`) to all of
 * them: `noTeams` says so, and the tab shows no error.
 */

type Options = { fetchFn?: typeof fetch; key?: string | null };
type Failed = Exclude<AccountOutcome<unknown>, { kind: "ok" }>;

const STATUSES: readonly string[] = ["active", "completed", "expired"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPoint(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  );
}

function isGoal(value: unknown): boolean {
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

function isHolder(value: unknown): boolean {
  return (
    value === null ||
    (isRecord(value) &&
      typeof value.public_id === "string" &&
      typeof value.username === "string")
  );
}

function isPiece(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.idx === "number" &&
    isGoal(value.goal) &&
    isHolder(value.holder) &&
    typeof value.done_m === "number" &&
    typeof value.done === "boolean" &&
    Array.isArray(value.outline) &&
    value.outline.every(isPoint)
  );
}

function isContribution(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.public_id === "string" &&
    typeof value.username === "string" &&
    typeof value.idx === "number" &&
    typeof value.metres === "number"
  );
}

export function isChallenge(value: unknown): value is GameChallenge {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.team_id === "string" &&
    typeof value.shape_id === "string" &&
    typeof value.status === "string" &&
    STATUSES.includes(value.status) &&
    typeof value.starts_at === "string" &&
    typeof value.ends_at === "string" &&
    (value.completed_at === null || typeof value.completed_at === "string") &&
    typeof value.seconds_left === "number" &&
    Array.isArray(value.pieces) &&
    value.pieces.every(isPiece) &&
    Array.isArray(value.contributions) &&
    value.contributions.every(isContribution)
  );
}

export function isTeam(value: unknown): value is GameTeam {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.code === "string" &&
    (value.owner === null || typeof value.owner === "string") &&
    Array.isArray(value.members) &&
    value.members.every(isPerson) &&
    (value.challenge === null || isChallenge(value.challenge))
  );
}

export function isTeams(value: unknown): value is GameTeams {
  return isRecord(value) && Array.isArray(value.teams) && value.teams.every(isTeam);
}

function isNoBody(body: unknown, status: number): body is null {
  return status === 204 && body === null;
}

/** POST /game/teams: a new team, with the one who asks as its owner. */
export function createTeam(
  baseUrl: string,
  token: string,
  request: TeamRequest,
  options: Options = {},
): Promise<AccountOutcome<GameTeam>> {
  return ask(
    baseUrl,
    "/game/teams",
    { method: "POST", token, body: request },
    isTeam,
    options,
  );
}

/** POST /game/teams/join: into the team with the code; a member already
 * gets the team as it is. */
export function joinTeam(
  baseUrl: string,
  token: string,
  request: JoinTeamRequest,
  options: Options = {},
): Promise<AccountOutcome<GameTeam>> {
  return ask(
    baseUrl,
    "/game/teams/join",
    { method: "POST", token, body: request },
    isTeam,
    options,
  );
}

/** GET /game/teams: the account's teams, each with its newest challenge. */
export function fetchTeams(
  baseUrl: string,
  token: string,
  options: Options = {},
): Promise<AccountOutcome<GameTeams>> {
  return ask(baseUrl, "/game/teams", { method: "GET", token }, isTeams, options);
}

/** DELETE /game/teams/{id}/members/{public_id}: out of the team (the
 * account's own public_id), or, for the owner, a member out. */
export function removeMember(
  baseUrl: string,
  token: string,
  teamId: string,
  publicId: string,
  options: Options = {},
): Promise<AccountOutcome<null>> {
  return ask(
    baseUrl,
    `/game/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(publicId)}`,
    { method: "DELETE", token },
    isNoBody,
    options,
  );
}

/** POST /game/teams/{id}/challenges: a new challenge, when none is going. */
export function createChallenge(
  baseUrl: string,
  token: string,
  teamId: string,
  request: ChallengeRequest,
  options: Options = {},
): Promise<AccountOutcome<GameChallenge>> {
  return ask(
    baseUrl,
    `/game/teams/${encodeURIComponent(teamId)}/challenges`,
    { method: "POST", token, body: request },
    isChallenge,
    options,
  );
}

/** GET /game/challenges/{id}: the challenge as its team sees it now. */
export function fetchChallenge(
  baseUrl: string,
  token: string,
  id: string,
  options: Options = {},
): Promise<AccountOutcome<GameChallenge>> {
  return ask(
    baseUrl,
    `/game/challenges/${encodeURIComponent(id)}`,
    { method: "GET", token },
    isChallenge,
    options,
  );
}

/** POST /game/challenges/{id}/pieces/{idx}/hold: the free piece is mine. */
export function holdPiece(
  baseUrl: string,
  token: string,
  id: string,
  idx: number,
  options: Options = {},
): Promise<AccountOutcome<GameChallenge>> {
  return ask(
    baseUrl,
    `/game/challenges/${encodeURIComponent(id)}/pieces/${idx}/hold`,
    { method: "POST", token },
    isChallenge,
    options,
  );
}

/** DELETE /game/challenges/{id}/pieces/{idx}/hold: the piece goes back
 * free, its metres kept. */
export function releasePiece(
  baseUrl: string,
  token: string,
  id: string,
  idx: number,
  options: Options = {},
): Promise<AccountOutcome<GameChallenge>> {
  return ask(
    baseUrl,
    `/game/challenges/${encodeURIComponent(id)}/pieces/${idx}/hold`,
    { method: "DELETE", token },
    isChallenge,
    options,
  );
}

/** Whether the outcome is an API without the teams (before part C): the
 * 404 of a path it does not have. */
export function noTeams(outcome: AccountOutcome<unknown>): boolean {
  return outcome.kind === "api_error" && outcome.code === "http_error";
}

/**
 * The API's refusals of the teams and the challenges, by its own words
 * (game_teams.py, game_challenges.py), said in the app's language. The
 * API's errors carry no HTTP status, so the words tell them apart: a code
 * nobody has (404) from a team that cannot be joined (403).
 */
const KNOWN: Readonly<Record<string, string>> = {
  "No team with this code.": tLater("No team with this code."),
  "You can't join this team.": tLater("You can't join this team."),
  "You are in 10 teams already: leave one first.": tLater(
    "You are in 10 teams already: leave one first.",
  ),
  "No team with this id.": tLater("This team is not available any more."),
  "No challenge with this id.": tLater("This challenge is not available any more."),
  "The team has a challenge going already: wait for it to end.": tLater(
    "The team has a challenge going already: wait for it to end.",
  ),
  "This challenge is over.": tLater("This challenge is over."),
  "No piece with this number.": tLater("This piece is not there any more."),
  "This piece is done already.": tLater("This piece is done already."),
  "Someone holds this piece already.": tLater("Someone holds this piece already."),
  "You hold a piece of this challenge already: leave it first.": tLater(
    "You hold a piece of this challenge already: leave it first.",
  ),
  "You don't hold this piece.": tLater("You don't hold this piece."),
};

/** A request of the teams that failed, in words: the API's refusal when the
 * app knows it, the API's own words for a name it refuses as written, else
 * the account's words (no connection, session over). */
export function teamProblem(failed: Failed): string {
  if (failed.kind === "api_error") {
    const known = KNOWN[failed.message];
    if (known !== undefined) {
      return t(known);
    }
    // A negative name, as a comment (ADR-0176).
    if (failed.code === "comment_rejected") {
      return t("This name is not allowed. Choose another one.");
    }
    if (failed.code === "invalid_request" || failed.code === "http_error") {
      return failed.message;
    }
  }
  return accountProblem(failed);
}
