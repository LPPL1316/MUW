import type { FeedFilter, FeedPost } from "@shaperoute/shared-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { sessionEnded } from "../account/messages";
import { fetchFeed } from "../api/feed";
import { useFollowsDoor } from "../social/followsDoor";

/** What a tab of «Feed» has of the drawings the members publish. */
export type FeedShown =
  /** The first page is on its way. */
  | { kind: "loading" }
  /** The pages read so far; `next` while there are more. */
  | {
      kind: "ready";
      posts: FeedPost[];
      next: string | null;
      /** In «Following»: whether the account follows anyone. */
      followsAnyone?: boolean;
      /** The API said the page is of this tab. False from an API before the
       * tabs, which ignores `filter` and sends the feed of before. */
      filtered?: boolean;
      /** The next page did not come: `more` asks again. */
      moreFailed?: boolean;
    }
  /** The first page did not come: the page offers to ask again. */
  | { kind: "failed" }
  /** Nobody signed in, or «Feed» not on the screen yet. */
  | { kind: "off" };

export type Feed = {
  shown: FeedShown;
  /** An account is signed in and the API is known: a pull reads again. */
  signedIn: boolean;
  /** The first page is being read again, on a pull. */
  refreshing: boolean;
  /** Reads the first page again. */
  refresh: () => void;
  /** Reads the next page, when there is one and none is on its way. */
  more: () => void;
};

const OFF: FeedShown = { kind: "off" };
const LOADING: FeedShown = { kind: "loading" };
const FAILED: FeedShown = { kind: "failed" };

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** What was read, with the token it was read with: another account's
 * feed is not this one's. */
type Read = { token: string; shown: FeedShown };

// The last read of each tab, kept while the app is open: «Feed» is built
// again after a drawing on the map, and shows what it had without asking again.
const kept = new Map<FeedFilter, Read>();

/** Forgets the reads kept: for the tests. */
export function forgetFeed(): void {
  kept.clear();
}

/**
 * One tab of the account's feed (TASK-118, TASK-362, ADR-0308): the drawings
 * it may see, the last published first, read a page at a time from the API
 * once the tab is on the screen (`active`). Each tab has its own read and its
 * own cursor, and a pull reads only its own. Without an account the feed is
 * off; when the first page does not come it has failed, and a pull asks again.
 */
export function useFeed(
  active: boolean,
  filter: FeedFilter,
  options: Options = {},
): Feed {
  const { apiUrl, account } = useFollowsDoor();
  const { state, sessionEnded: endSession } = account;
  const token = state.status === "signedIn" ? state.session.token : null;
  const { fetchFn, key } = options;
  const [read, setRead] = useState<Read | null>(kept.get(filter) ?? null);
  const [refreshing, setRefreshing] = useState(false);
  // The request on its way: its answer is the only one kept.
  const asking = useRef(0);
  const loadingMore = useRef(false);
  // The token the first page was asked for: once per account.
  const askedFor = useRef<string | null>(kept.get(filter)?.token ?? null);
  useEffect(() => {
    if (read !== null) {
      kept.set(filter, read);
    }
  }, [filter, read]);

  const first = useCallback(
    (of: string, url: string, pull: boolean) => {
      const request = ++asking.current;
      loadingMore.current = false;
      askedFor.current = of;
      if (pull) {
        setRefreshing(true);
      }
      void fetchFeed(url, of, { filter }, { fetchFn, key }).then((outcome) => {
        if (request !== asking.current) {
          return;
        }
        setRefreshing(false);
        if (outcome.kind === "ok") {
          setRead({
            token: of,
            shown: {
              kind: "ready",
              posts: outcome.value.posts,
              next: outcome.value.next,
              followsAnyone: outcome.value.follows_anyone,
              filtered: outcome.value.filter === filter,
            },
          });
          return;
        }
        if (sessionEnded(outcome)) {
          endSession(of);
          setRead({ token: of, shown: OFF });
          return;
        }
        // A pull that did not come leaves what was there.
        setRead((was) =>
          pull && was !== null && was.token === of ? was : { token: of, shown: FAILED },
        );
      });
    },
    [endSession, fetchFn, filter, key],
  );

  useEffect(() => {
    if (!active || token === null || apiUrl === null) {
      return;
    }
    if (askedFor.current === token) {
      return;
    }
    first(token, apiUrl, false);
  }, [active, apiUrl, first, token]);

  const refresh = useCallback(() => {
    if (token !== null && apiUrl !== null) {
      first(token, apiUrl, true);
    }
  }, [apiUrl, first, token]);

  const more = useCallback(() => {
    if (
      token === null ||
      apiUrl === null ||
      read === null ||
      read.token !== token ||
      read.shown.kind !== "ready" ||
      read.shown.next === null ||
      loadingMore.current
    ) {
      return;
    }
    const request = asking.current;
    const { next } = read.shown;
    loadingMore.current = true;
    void fetchFeed(apiUrl, token, { cursor: next, filter }, { fetchFn, key }).then(
      (outcome) => {
        if (request !== asking.current) {
          return;
        }
        loadingMore.current = false;
        if (outcome.kind === "ok") {
          const { posts, next: after } = outcome.value;
          setRead((was) =>
            was !== null && was.token === token && was.shown.kind === "ready"
              ? {
                  token,
                  shown: {
                    ...was.shown,
                    posts: [...was.shown.posts, ...posts],
                    next: after,
                    moreFailed: false,
                  },
                }
              : was,
          );
          return;
        }
        if (sessionEnded(outcome)) {
          endSession(token);
          return;
        }
        setRead((was) =>
          was !== null && was.token === token && was.shown.kind === "ready"
            ? { token, shown: { ...was.shown, moreFailed: true } }
            : was,
        );
      },
    );
  }, [apiUrl, endSession, fetchFn, filter, key, read, token]);

  const signedIn = token !== null && apiUrl !== null;
  // Nothing read for this account yet: the first page is on its way, or
  // will be as soon as the tab is on the screen.
  const shown: FeedShown =
    token !== null && read !== null && read.token === token
      ? read.shown
      : signedIn && active
        ? LOADING
        : OFF;
  return useMemo(
    () => ({ shown, signedIn, refreshing, refresh, more }),
    [shown, signedIn, refreshing, refresh, more],
  );
}
