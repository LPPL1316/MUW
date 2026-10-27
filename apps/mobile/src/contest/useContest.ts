import type { Contest, ContestMine } from "@shaperoute/shared-types";
import { useCallback, useEffect, useMemo } from "react";

import { useFollowsDoor } from "../social/followsDoor";
import { askContestOnce, refreshContest, useContestKept } from "./contestKept";

/** What «Feed» shows of the contest. */
export type ContestShown = {
  /** The contest open, or closed less than a week ago; null: no card. */
  contest: Contest | null;
  /**
   * The best post of the account signed in: null when it has none that
   * takes part; undefined with nobody signed in, or before the API answered
   * for this account. Then the card has no line of its own.
   */
  mine: ContestMine | null | undefined;
  /** Asks the API again: with the pull of «Feed». */
  refresh: () => void;
};

type Options = { fetchFn?: typeof fetch; key?: string | null };

/**
 * The contest of «Feed» (TASK-299 part B, docs/CONCORSI.md §7): asked from
 * the API when «Feed» is on the screen (`active`), once per account while
 * the app is open, and again with each pull; until the answer comes, and
 * without a network, the one kept on the phone.
 */
export function useContest(active: boolean, options: Options = {}): ContestShown {
  const { apiUrl, account } = useFollowsDoor();
  const { state } = account;
  const token = state.status === "signedIn" ? state.session.token : null;
  const publicId =
    state.status === "signedIn" ? (state.session.user.public_id ?? null) : null;
  const kept = useContestKept();
  const { fetchFn, key } = options;

  useEffect(() => {
    if (active) {
      void askContestOnce(apiUrl, token, publicId, { fetchFn, key });
    }
  }, [active, apiUrl, fetchFn, key, publicId, token]);

  const refresh = useCallback(() => {
    void refreshContest(apiUrl, token, publicId, { fetchFn, key });
  }, [apiUrl, fetchFn, key, publicId, token]);

  const contest = kept === null ? null : kept.contest;
  const mine =
    kept !== null && publicId !== null && kept.account === publicId
      ? kept.contest.mine
      : undefined;
  return useMemo(() => ({ contest, mine, refresh }), [contest, mine, refresh]);
}
