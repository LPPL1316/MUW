import type { GameCatalog, GameMe, RunGame } from "@shaperoute/shared-types";

import { type AccountOutcome, ask } from "../api/accounts";

/**
 * The shape game on the API (TASK-296 part B, ADR-0255; docs/API.md,
 * «Shape game»): the catalog, which asks no account and says whether the
 * API has the game at all; the account's game; what one run was worth.
 * Each never throws: the outcomes of the account's requests.
 */

type Options = { fetchFn?: typeof fetch; key?: string | null };

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

function isNumbersByText(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every((v) => typeof v === "number");
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

function isShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isRecord(value.names) &&
    typeof value.names.en === "string" &&
    isGoal(value.goal) &&
    Array.isArray(value.outline) &&
    value.outline.length >= 2 &&
    value.outline.every(isPoint)
  );
}

export function isGameCatalog(value: unknown): value is GameCatalog {
  return (
    isRecord(value) &&
    typeof value.rules_version === "number" &&
    Array.isArray(value.shapes) &&
    value.shapes.every(isShape)
  );
}

export function isGameMe(value: unknown): value is GameMe {
  return (
    isRecord(value) &&
    typeof value.counted_m === "number" &&
    typeof value.longest_m === "number" &&
    isNumbersByText(value.best_s) &&
    Array.isArray(value.shapes) &&
    value.shapes.every(
      (shape) =>
        isRecord(shape) &&
        typeof shape.id === "string" &&
        (shape.unlocked_at === null || typeof shape.unlocked_at === "string") &&
        typeof shape.progress === "number",
    )
  );
}

export function isRunGame(value: unknown): value is RunGame {
  return (
    isRecord(value) &&
    typeof value.counted === "boolean" &&
    (value.reason === null || typeof value.reason === "string") &&
    typeof value.counted_m === "number" &&
    isNumbersByText(value.best_s) &&
    Array.isArray(value.unlocked) &&
    value.unlocked.every((id) => typeof id === "string")
  );
}

/** GET /game/catalog: no account. An API before the game: `api_error`
 * with the code `http_error` (its 404). */
export function fetchGameCatalog(
  baseUrl: string,
  options: Options = {},
): Promise<AccountOutcome<GameCatalog>> {
  return ask(baseUrl, "/game/catalog", { method: "GET" }, isGameCatalog, options);
}

/** GET /game/me: the totals and the shapes of the account. */
export function fetchGameMe(
  baseUrl: string,
  token: string,
  options: Options = {},
): Promise<AccountOutcome<GameMe>> {
  return ask(baseUrl, "/game/me", { method: "GET", token }, isGameMe, options);
}

/** GET /game/runs/{key}: what the run `key` was worth, once the API has
 * it; 404 (`http_error`) before. */
export function fetchRunGame(
  baseUrl: string,
  token: string,
  key: string,
  options: Options = {},
): Promise<AccountOutcome<RunGame>> {
  return ask(
    baseUrl,
    `/game/runs/${encodeURIComponent(key)}`,
    { method: "GET", token },
    isRunGame,
    options,
  );
}

/** Whether the outcome is the API saying it has no game: no «Play». */
export function noGame(outcome: AccountOutcome<unknown>): boolean {
  return outcome.kind === "api_error" && outcome.code === "http_error";
}
