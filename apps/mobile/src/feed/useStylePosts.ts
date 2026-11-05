import type { StylePost } from "@shaperoute/shared-types";
import { useEffect, useState } from "react";

import { fetchStylePage } from "../api/style";
import { useFollowsDoor } from "../social/followsDoor";

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** How many posts «All» reads: at 1 in 8, enough for 160 drawings. */
export const STYLE_IN_FEED = 20;

// The posts read last, kept while the app is open: 2–3 come out a day.
const kept = new Map<string, StylePost[]>();

/** Forgets the posts kept: for the tests. */
export function forgetStylePosts(): void {
  kept.clear();
}

/**
 * The newest MuW Style posts (TASK-384, ADR-0326), read once from the API
 * when «Feed» is on the screen (`active`), as MuW's routes are. Without an
 * API, or from one without Style, none: no card in «All», no «Style» tab.
 */
export function useStylePosts(active: boolean, options: Options = {}): StylePost[] {
  const { apiUrl } = useFollowsDoor();
  const { fetchFn, key } = options;
  const [, setRead] = useState(0);
  useEffect(() => {
    if (!active || apiUrl === null || kept.has(apiUrl)) {
      return;
    }
    const controller = new AbortController();
    void fetchStylePage(
      apiUrl,
      { limit: STYLE_IN_FEED },
      { fetchFn, key, signal: controller.signal },
    ).then((page) => {
      if (!controller.signal.aborted) {
        kept.set(apiUrl, page?.posts ?? []);
        setRead((n) => n + 1);
      }
    });
    return () => controller.abort();
  }, [active, apiUrl, fetchFn, key]);
  return (apiUrl === null ? undefined : kept.get(apiUrl)) ?? [];
}
