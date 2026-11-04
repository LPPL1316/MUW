import type {
  Contest,
  ContestEntriesPage,
  ContestEntry,
  ContestGalleryOrder,
  ContestMine,
  ContestTheme,
  ContestThemeText,
  ContestWinner,
  PastContest,
  PastContestsPage,
  ThemedContest,
} from "@shaperoute/shared-types";

import { accountProblem } from "../account/messages";
import { type AccountOutcome, ask } from "../api/accounts";
import { isFeedPost } from "../api/feed";
import { t } from "../i18n";
import type { Language } from "../i18n/languages";

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

// --- The monthly challenges (TASK-343 part B, ADR-0296; CONCORSI.md §15) ---

function isThemeText(value: unknown): value is ContestThemeText {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    value.title !== "" &&
    typeof value.description === "string"
  );
}

function isTheme(value: unknown): value is ContestTheme {
  return isRecord(value) && isThemeText(value.en);
}

/**
 * The contest as a monthly challenge, recognised by its `theme`; null for a
 * contest without one, or whose theme does not read: that one is a contest
 * as before, and nothing of the challenge shows.
 */
export function themedOf(contest: Contest): ThemedContest | null {
  const { theme, entrants, entered } = contest as Contest & Record<string, unknown>;
  if (!isTheme(theme)) {
    return null;
  }
  return {
    ...contest,
    theme,
    entrants: typeof entrants === "number" ? entrants : 0,
    entered: Array.isArray(entered)
      ? entered.filter((id): id is string => typeof id === "string")
      : [],
  };
}

/** The theme in the app's language; English when it is missing. */
export function themeText(theme: ContestTheme, language: Language): ContestThemeText {
  const text: unknown = language === "en" ? theme.en : theme[language];
  return isThemeText(text) ? text : theme.en;
}

/**
 * PUT or DELETE /contests/{id}/entries/{drawing_id}: enters the account's
 * drawing, or withdraws it. Both are 204 and change nothing the second time.
 */
export function setContestEntry(
  baseUrl: string,
  token: string,
  contestId: string,
  drawingId: string,
  entered: boolean,
  options: Options = {},
): Promise<AccountOutcome<null>> {
  return ask(
    baseUrl,
    `/contests/${encodeURIComponent(contestId)}/entries/${encodeURIComponent(drawingId)}`,
    { method: entered ? "PUT" : "DELETE", token },
    (body): body is null => body === null,
    options,
  );
}

/** Words for an entry the API did not take; null when it did. */
export function entryProblem(outcome: AccountOutcome<unknown>): string | null {
  if (outcome.kind === "ok") {
    return null;
  }
  if (outcome.kind === "api_error") {
    if (outcome.code === "not_entrant") {
      return t(
        "This run cannot take part: it must be for everyone, recorded with MuW and published during the challenge.",
      );
    }
    // Over, closed, or an API that has no such contest.
    if (noContest(outcome) || outcome.code === "contest_closed") {
      return t("This challenge takes no entries now.");
    }
  }
  return accountProblem(outcome);
}

function isEntriesPage(value: unknown): value is ContestEntriesPage {
  return (
    isRecord(value) &&
    Array.isArray(value.entries) &&
    value.entries.every(isEntry) &&
    (value.next === null || typeof value.next === "string")
  );
}

/** GET /contests/{id}/entries: a page of the gallery, without an account too. */
export function fetchContestEntries(
  baseUrl: string,
  token: string | null,
  contestId: string,
  order: ContestGalleryOrder,
  cursor: string | null,
  options: Options = {},
): Promise<AccountOutcome<ContestEntriesPage>> {
  const after = cursor === null ? "" : `&cursor=${encodeURIComponent(cursor)}`;
  return ask(
    baseUrl,
    `/contests/${encodeURIComponent(contestId)}/entries?order=${order}${after}`,
    token === null ? { method: "GET" } : { method: "GET", token },
    isEntriesPage,
    options,
  );
}

function isPastContest(value: unknown): value is PastContest {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isMoment(value.starts_at) &&
    isMoment(value.ends_at) &&
    isMoment(value.closed_at) &&
    (value.theme === null || isTheme(value.theme)) &&
    typeof value.entrants === "number" &&
    Array.isArray(value.top) &&
    value.top.every(isEntry) &&
    (value.winner === null || isWinner(value.winner))
  );
}

function isPastPage(value: unknown): value is PastContestsPage {
  return (
    isRecord(value) &&
    Array.isArray(value.contests) &&
    value.contests.every(isPastContest) &&
    (value.next === null || typeof value.next === "string")
  );
}

/** GET /contests?state=closed: a page of the archive, the latest closed first. */
export function fetchPastContests(
  baseUrl: string,
  token: string | null,
  cursor: string | null,
  options: Options = {},
): Promise<AccountOutcome<PastContestsPage>> {
  const after = cursor === null ? "" : `&cursor=${encodeURIComponent(cursor)}`;
  return ask(
    baseUrl,
    `/contests?state=closed${after}`,
    token === null ? { method: "GET" } : { method: "GET", token },
    isPastPage,
    options,
  );
}
