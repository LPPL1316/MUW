import type { GameChallenge } from "@shaperoute/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { NO_API, sessionEnded } from "../account/messages";
import { t } from "../i18n";
import { useFollowsDoor } from "../social/followsDoor";
import { fetchChallenge, holdPiece, releasePiece, teamProblem } from "./teamsApi";

/**
 * One challenge as the team sees it now (TASK-296 part D, ADR-0255, point
 * 7): read when it opens, again every CHALLENGE_EVERY_MS while it is on
 * screen and going, and when the app comes back to the front; «real time»
 * is this and the push notifications. The last answer is kept while the
 * app is open, so a challenge opens on what was seen last, or on what the
 * team's list said of it (`keepChallenge`), while the API answers. The
 * ways to take a piece and to leave it read the challenge again when the
 * API refuses: what it has now is what the screen should show.
 */
export type ChallengeShown =
  | { status: "off" }
  | { status: "loading" }
  | { status: "ready"; challenge: GameChallenge }
  | { status: "failed"; problem: string };

export const CHALLENGE_EVERY_MS = 15_000;

type Options = {
  fetchFn?: typeof fetch;
  key?: string | null;
  /** The time between two readings; the tests give their own. */
  everyMs?: number;
};

type Held = {
  id: string;
  token: string;
  state: Extract<ChallengeShown, { status: "loading" | "ready" | "failed" }>;
};

// The last answer of each challenge, for the next opening.
const kept = new Map<string, GameChallenge>();

const OFF: ChallengeShown = { status: "off" };
const LOADING: ChallengeShown = { status: "loading" };

/** A challenge read with the teams: shown at once when it opens. */
export function keepChallenge(challenge: GameChallenge): void {
  kept.set(challenge.id, challenge);
}

/** The read of the challenge goes on while it is going; once complete or
 * expired nothing changes any more. */
function over(challenge: GameChallenge): boolean {
  return challenge.status !== "active";
}

export function useChallenge(
  id: string | null,
  options: Options = {},
): {
  shown: ChallengeShown;
  refresh: () => void;
  /** «Take this piece»: null when it is mine now, else why not. */
  hold: (idx: number) => Promise<string | null>;
  /** «Leave»: null when it is free now, else why not. */
  release: (idx: number) => Promise<string | null>;
} {
  const { apiUrl, account } = useFollowsDoor();
  const token =
    account.state.status === "signedIn" ? account.state.session.token : null;
  const endSession = account.sessionEnded;
  const { fetchFn, key, everyMs = CHALLENGE_EVERY_MS } = options;
  const [held, setHeld] = useState<Held | null>(null);
  // Which request's answer still counts: an older one's is dropped.
  const asking = useRef(0);
  // The last answer said the challenge is over: no more readings.
  const done = useRef(false);

  const take = useCallback(
    (challenge: GameChallenge) => {
      if (token === null) {
        return;
      }
      kept.set(challenge.id, challenge);
      done.current = over(challenge);
      setHeld({ id: challenge.id, token, state: { status: "ready", challenge } });
    },
    [token],
  );

  const ask = useCallback(() => {
    if (id === null || apiUrl === null || token === null) {
      return;
    }
    const request = ++asking.current;
    void fetchChallenge(apiUrl, token, id, { fetchFn, key }).then((outcome) => {
      if (request !== asking.current) {
        return;
      }
      if (outcome.kind === "ok") {
        take(outcome.value);
        return;
      }
      if (sessionEnded(outcome)) {
        endSession(token);
      }
      // No network: what was seen last stays; an error only without.
      setHeld((last) =>
        (last !== null &&
          last.id === id &&
          last.token === token &&
          last.state.status === "ready") ||
        kept.has(id)
          ? last
          : { id, token, state: { status: "failed", problem: teamProblem(outcome) } },
      );
    });
  }, [apiUrl, endSession, fetchFn, id, key, take, token]);

  // Read as it opens, every while on screen, and when the app comes back.
  useEffect(() => {
    if (id === null || token === null) {
      return;
    }
    done.current = false;
    let onScreen = true;
    ask();
    const timer = setInterval(() => {
      if (onScreen && !done.current) {
        ask();
      }
    }, everyMs);
    const subscription = AppState.addEventListener("change", (next) => {
      const was = onScreen;
      onScreen = next === "active";
      if (onScreen && !was && !done.current) {
        ask();
      }
    });
    return () => {
      // An answer on its way is nobody's.
      asking.current += 1;
      clearInterval(timer);
      subscription.remove();
    };
  }, [ask, everyMs, id, token]);

  const refresh = useCallback(() => {
    if (id !== null && token !== null) {
      setHeld({ id, token, state: { status: "loading" } });
      ask();
    }
  }, [ask, id, token]);

  const act = useCallback(
    async (call: typeof holdPiece, idx: number): Promise<string | null> => {
      if (id === null || apiUrl === null || token === null) {
        return t(NO_API);
      }
      const outcome = await call(apiUrl, token, id, idx, { fetchFn, key });
      if (outcome.kind === "ok") {
        asking.current += 1;
        take(outcome.value);
        return null;
      }
      if (sessionEnded(outcome)) {
        endSession(token);
      } else if (outcome.kind === "api_error") {
        // Refused: someone was first, or the challenge ended. What the API
        // has now goes on screen.
        ask();
      }
      return teamProblem(outcome);
    },
    [apiUrl, ask, endSession, fetchFn, id, key, take, token],
  );

  const hold = useCallback((idx: number) => act(holdPiece, idx), [act]);
  const release = useCallback((idx: number) => act(releasePiece, idx), [act]);

  let shown: ChallengeShown;
  if (id === null || token === null) {
    shown = OFF;
  } else if (held !== null && held.id === id && held.token === token) {
    shown = held.state;
  } else {
    const last = kept.get(id);
    shown = last === undefined ? LOADING : { status: "ready", challenge: last };
  }
  return { shown, refresh, hold, release };
}

/** For the tests: as an app just opened. */
export function forgetChallenges(): void {
  kept.clear();
}
