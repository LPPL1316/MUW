import type { GameMe } from "@shaperoute/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";

import { accountProblem, sessionEnded } from "../account/messages";
import { useFollowsDoor } from "../social/followsDoor";
import { fetchGameMe } from "./gameApi";

/**
 * The game of who is signed in (TASK-296 part B): the totals and the
 * shapes of the account, asked of the API while «Play» is on screen and
 * kept while the app is open. "off" without an account.
 */
export type GameMeShown =
  | { status: "off" }
  | { status: "loading" }
  | { status: "ready"; me: GameMe }
  | { status: "failed"; problem: string };

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** What the API said to one account; another account's is nobody's. */
type Held = {
  token: string;
  state: Extract<GameMeShown, { status: "loading" | "ready" | "failed" }>;
};

// The last answer, for the page to come back to without a wait (as
// `useFeed` keeps the feed); whose it is, so another account starts over.
let kept: { token: string; me: GameMe } | null = null;

const LOADING: GameMeShown = { status: "loading" };
const OFF: GameMeShown = { status: "off" };

export function useGameMe(
  active: boolean,
  options: Options = {},
): { shown: GameMeShown; refresh: () => void } {
  const { apiUrl, account } = useFollowsDoor();
  const token =
    account.state.status === "signedIn" ? account.state.session.token : null;
  const endSession = account.sessionEnded;
  const { fetchFn, key } = options;
  const [held, setHeld] = useState<Held | null>(() =>
    kept === null
      ? null
      : { token: kept.token, state: { status: "ready", me: kept.me } },
  );
  // Which request's answer still counts: an older one's is dropped.
  const asking = useRef(0);

  const ask = useCallback(() => {
    if (apiUrl === null || token === null) {
      return;
    }
    const request = ++asking.current;
    void fetchGameMe(apiUrl, token, { fetchFn, key }).then((outcome) => {
      if (request !== asking.current) {
        return;
      }
      if (outcome.kind === "ok") {
        kept = { token, me: outcome.value };
        setHeld({ token, state: { status: "ready", me: outcome.value } });
        return;
      }
      if (sessionEnded(outcome)) {
        endSession(token);
      }
      setHeld({
        token,
        state: { status: "failed", problem: accountProblem(outcome) },
      });
    });
  }, [apiUrl, endSession, fetchFn, key, token]);

  // On screen with an account: asked, and asked again each time the page
  // comes back; the last answer stays in view meanwhile.
  useEffect(() => {
    if (active && token !== null) {
      ask();
    }
  }, [active, ask, token]);

  const refresh = useCallback(() => {
    if (token !== null) {
      setHeld({ token, state: { status: "loading" } });
      ask();
    }
  }, [ask, token]);

  const shown: GameMeShown =
    token === null ? OFF : held !== null && held.token === token ? held.state : LOADING;
  return { shown, refresh };
}

/** For the tests: as an app just opened. */
export function forgetGameMe(): void {
  kept = null;
}
