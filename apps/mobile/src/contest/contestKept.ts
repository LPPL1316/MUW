import type { Contest, ThemedContest } from "@shaperoute/shared-types";
import { File, Paths } from "expo-file-system";
import { useSyncExternalStore } from "react";

import { fetchContest, isContest, noContest, themedOf } from "./contestApi";

/**
 * The contest on this phone (TASK-299 part B, ADR-0260; docs/CONCORSI.md
 * §7). The card of «Feed» is shown only while the API has a contest: the
 * answer kept here says so. The app asks when «Feed» opens and on a pull,
 * and keeps the last answer: a contest, or nothing when the API says it
 * has none (404). Without a network the last answer stands, and a phone
 * that never heard from the API shows no card. Who shows the card reads it
 * with `useContestKept`; the drawing's card, the winner with
 * `useWinnerDrawingId`.
 */

export const CONTEST_FILE = "contest.json";

/**
 * The answer and whom it was asked for: the `public_id` of the account
 * whose token went with it, null without one. Its `mine` is that
 * account's best post, never another's.
 */
export type KeptContest = { account: string | null; contest: Contest };

type Options = { fetchFn?: typeof fetch; key?: string | null };

function isKept(value: unknown): value is KeptContest {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { account, contest } = value as Record<string, unknown>;
  return (account === null || typeof account === "string") && isContest(contest);
}

/** The contest kept on this phone; null when none, or it does not read. */
export function loadContest(): KeptContest | null {
  try {
    const file = new File(Paths.document, CONTEST_FILE);
    if (!file.exists) {
      return null;
    }
    const data: unknown = JSON.parse(file.textSync());
    return isKept(data) ? data : null;
  } catch {
    return null;
  }
}

/** Keeps the contest for the next opening, or forgets it with null. False
 * when the phone refused. */
export function keepContest(kept: KeptContest | null): boolean {
  try {
    const file = new File(Paths.document, CONTEST_FILE);
    if (kept === null) {
      if (file.exists) {
        file.delete();
      }
      return true;
    }
    file.create({ overwrite: true });
    file.write(JSON.stringify(kept));
    return true;
  } catch {
    return false;
  }
}

// What the app shows: read from the phone once, then what the API said.
let loaded = false;
let current: KeptContest | null = null;
const listeners = new Set<() => void>();

/** The contest as the app knows it now. */
export function keptContest(): KeptContest | null {
  if (!loaded) {
    current = loadContest();
    loaded = true;
  }
  return current;
}

/** A contest the API answered, or null when it has none: shown at once,
 * and kept for the next opening. */
export function setContest(kept: KeptContest | null): void {
  loaded = true;
  current = kept;
  keepContest(kept);
  listeners.forEach((listener) => listener());
}

export function subscribeContest(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The contest, and a new render when the API answers. */
export function useContestKept(): KeptContest | null {
  return useSyncExternalStore(subscribeContest, keptContest);
}

/** The id of the drawing that won the contest kept on this phone; null while
 * it is open, without a winner, or without a contest. */
export function winnerDrawingId(kept: KeptContest | null): string | null {
  if (kept === null || kept.contest.closed_at === null) {
    return null;
  }
  return kept.contest.winner?.drawing?.id ?? null;
}

/** The winning drawing's id, and a new render when the contest changes. */
export function useWinnerDrawingId(): string | null {
  return useSyncExternalStore(subscribeContest, () => winnerDrawingId(keptContest()));
}

/**
 * The account's drawings entered in the monthly challenge kept on the phone
 * (TASK-343 part B): empty for anyone else, or without a challenge. Like
 * `mine`, they are of the account the answer was asked for.
 */
export function enteredIn(kept: KeptContest | null, account: string | null): string[] {
  if (kept === null || account === null || kept.account !== account) {
    return [];
  }
  return themedOf(kept.contest)?.entered ?? [];
}

/** The API took an entry or a withdrawal: shown at once, before it is asked
 * again. Anything but the challenge kept is left as it is. */
export function markEntered(
  contestId: string,
  drawingId: string,
  entered: boolean,
): void {
  const kept = keptContest();
  const themed = kept === null ? null : themedOf(kept.contest);
  if (kept === null || themed === null || themed.id !== contestId) {
    return;
  }
  const others = (themed.entered ?? []).filter((id) => id !== drawingId);
  const contest: ThemedContest = {
    ...themed,
    entered: entered ? [...others, drawingId] : others,
  };
  setContest({ account: kept.account, contest });
}

// The request on its way: its answer is the only one kept.
let asking = 0;
// The token the contest was asked with since the app opened ("" for none).
let askedWith: string | null = null;

/**
 * Asks the API for the contest, with `token` when someone is signed in
 * (`account` is its `public_id`), and keeps what it says: a contest, or
 * none. An API that cannot be reached, or answers something else, changes
 * nothing; nor does an answer that came after a newer request. Never
 * throws.
 */
export async function refreshContest(
  baseUrl: string | null,
  token: string | null,
  account: string | null,
  options: Options = {},
): Promise<void> {
  if (baseUrl === null) {
    return;
  }
  const request = ++asking;
  askedWith = token ?? "";
  const outcome = await fetchContest(baseUrl, token, options);
  if (request !== asking) {
    return;
  }
  if (outcome.kind === "ok") {
    setContest({ account: token === null ? null : account, contest: outcome.value });
  } else if (noContest(outcome)) {
    setContest(null);
  }
}

/**
 * The API took an entry or a withdrawal (TASK-343 part B): shown at once, and
 * the challenge asked for again, because the first three, `mine` and how many
 * take part change with it. Nothing is asked for a challenge not kept here.
 */
export function tellEntered(
  baseUrl: string,
  token: string,
  contestId: string,
  drawingId: string,
  entered: boolean,
  options: Options = {},
): void {
  markEntered(contestId, drawingId, entered);
  const kept = keptContest();
  if (kept !== null && kept.contest.id === contestId) {
    void refreshContest(baseUrl, token, kept.account, options);
  }
}

/** As `refreshContest`, once per account while the app is open: «Feed» is
 * built again after a drawing on the map, and asks nothing new. */
export function askContestOnce(
  baseUrl: string | null,
  token: string | null,
  account: string | null,
  options: Options = {},
): Promise<void> {
  if (askedWith === (token ?? "")) {
    return Promise.resolve();
  }
  return refreshContest(baseUrl, token, account, options);
}

/** For the tests: as a phone that never heard from the API. */
export function forgetContest(): void {
  keepContest(null);
  loaded = false;
  current = null;
  asking += 1;
  askedWith = null;
  listeners.forEach((listener) => listener());
}
