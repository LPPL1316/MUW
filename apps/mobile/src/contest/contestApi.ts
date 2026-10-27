import type {
  Contest,
  ContestEntry,
  ContestMine,
  ContestWinner,
} from "@shaperoute/shared-types";

import { type AccountOutcome, ask } from "../api/accounts";
import { isFeedPost } from "../api/feed";

/**
 * The contest on the API (TASK-299 part B, ADR-0260; docs/API.md,
 * «Contest»): the contest open, or closed less than a week ago. It asks
 * no account; a token adds the best post of who asks (`mine`). The answer
 * is read without trusting it: one that is not a contest is no answer.
 */

type Options = { fetchFn?: typeof fetch; key?: string | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** An ISO 8601 moment the phone can read. */
function isMoment(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isEntry(value: unknown): value is ContestEntry {
  return (
    isRecord(value) &&
    typeof value.rank === "number" &&
    typeof value.reactions === "number" &&
    isFeedPost(value.drawing)
  );
}

function isMine(value: unknown): value is ContestMine {
  return (
    isRecord(value) &&
    typeof value.drawing_id === "string" &&
    typeof value.rank === "number" &&
    typeof value.reactions === "number"
  );
}

function isWinner(value: unknown): value is ContestWinner {
  return (
    isRecord(value) &&
    typeof value.reactions === "number" &&
    (value.drawing === null || isFeedPost(value.drawing))
  );
}

export function isContest(value: unknown): value is Contest {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isMoment(value.starts_at) &&
    isMoment(value.ends_at) &&
    (value.closed_at === null || isMoment(value.closed_at)) &&
    Array.isArray(value.top) &&
    value.top.every(isEntry) &&
    (value.mine === undefined || value.mine === null || isMine(value.mine)) &&
    (value.winner === null || isWinner(value.winner))
  );
}

/** GET /contests/current: with `token`, `mine` too. No contest: `api_error`
 * with the code `no_contest` (its 404). */
export function fetchContest(
  baseUrl: string,
  token: string | null,
  options: Options = {},
): Promise<AccountOutcome<Contest>> {
  return ask(
    baseUrl,
    "/contests/current",
    token === null ? { method: "GET" } : { method: "GET", token },
    isContest,
    options,
  );
}

/**
 * Whether the outcome is the API saying there is no contest: its 404
 * `no_contest`, or the 404 of an API from before the contest (`http_error`).
 * Then the Feed shows no card.
 */
export function noContest(outcome: AccountOutcome<unknown>): boolean {
  return (
    outcome.kind === "api_error" &&
    (outcome.code === "no_contest" || outcome.code === "http_error")
  );
}
