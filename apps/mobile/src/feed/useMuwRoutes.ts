import type { MuwRoute } from "@shaperoute/shared-types";
import { useEffect, useState } from "react";

import { fetchMuwRoutes } from "../api/muwRoutes";
import { useFollowsDoor } from "../social/followsDoor";

type Options = { fetchFn?: typeof fetch; key?: string | null };

// The routes of the API read last, kept while the app is open: they change
// only with the API, and «Feed» is built again after a drawing on the map.
const kept = new Map<string, MuwRoute[]>();

/** Forgets the routes kept: for the tests. */
export function forgetMuwRoutes(): void {
  kept.clear();
}

/**
 * The routes MuW draws for «Feed» (TASK-365, ADR-0310), read once from the
 * API when «Feed» is on the screen (`active`). Without an API, or from an API
 * that does not have them, none: the Feed is as before.
 */
export function useMuwRoutes(active: boolean, options: Options = {}): MuwRoute[] {
  const { apiUrl } = useFollowsDoor();
  const { fetchFn, key } = options;
  // Bumped when a read comes back, so the routes kept are shown.
  const [, setRead] = useState(0);
  useEffect(() => {
    if (!active || apiUrl === null || kept.has(apiUrl)) {
      return;
    }
    const controller = new AbortController();
    void fetchMuwRoutes(apiUrl, { fetchFn, key, signal: controller.signal }).then(
      (read) => {
        if (!controller.signal.aborted) {
          kept.set(apiUrl, read);
          setRead((n) => n + 1);
        }
      },
    );
    return () => controller.abort();
  }, [active, apiUrl, fetchFn, key]);
  return (apiUrl === null ? undefined : kept.get(apiUrl)) ?? [];
}
