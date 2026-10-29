import { useEffect, useMemo, useState } from "react";

import { apiKey, keyHeaders } from "../api/apiUrl";
import type { TownPhoto } from "./nearbyCities";

/**
 * The photos of the places a themed route passes by (TASK-329, ADR-0287):
 * a route the API plans has them on its places; our ideas, planned once by
 * tools/themed_ideas.py, keep only the places' Wikidata items, and ask
 * GET /place-photos for their photos, whose credit can change. The photos
 * come from the API, as the towns' do: the phone never asks Wikimedia.
 */

/** As many items as the API answers in one request. */
export const MAX_ASKED = 15;

/** A photo as the API gives it, when it reads: a path on the API itself,
 * never another host, and its credit or none. */
export function apiPhoto(value: unknown): TownPhoto | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { url, credit } = value as Record<string, unknown>;
  if (typeof url !== "string" || !/^\/[^/]/.test(url)) {
    return null;
  }
  return { url, credit: typeof credit === "string" && credit.trim() ? credit : null };
}

type Options = { fetchFn?: typeof fetch; key?: string | null; signal?: AbortSignal };

/**
 * GET /place-photos for `items`, at most MAX_ASKED: the photos of those
 * that have one, by item. Never throws: null when the API does not answer,
 * or is older than the photos (404).
 */
export async function fetchPlacePhotos(
  baseUrl: string,
  items: readonly string[],
  { fetchFn = fetch, key = apiKey(), signal }: Options = {},
): Promise<Map<string, TownPhoto> | null> {
  try {
    const query = encodeURIComponent(items.slice(0, MAX_ASKED).join(","));
    const response = await fetchFn(`${baseUrl}/place-photos?items=${query}`, {
      headers: keyHeaders(key),
      signal,
    });
    if (!response.ok) {
      return null;
    }
    const body: unknown = await response.json();
    const photos = (body as { photos?: unknown } | null)?.photos;
    if (typeof photos !== "object" || photos === null) {
      return null;
    }
    const found = new Map<string, TownPhoto>();
    for (const item of items) {
      const photo = apiPhoto((photos as Record<string, unknown>)[item]);
      if (photo !== null) {
        found.set(item, photo);
      }
    }
    return found;
  } catch {
    return null;
  }
}

// What each API said of an item in this run of the app: its photo, or null
// for none. An item it did not answer for is asked again next time.
const known = new Map<string, Map<string, TownPhoto | null>>();

function knownOf(apiUrl: string): Map<string, TownPhoto | null> {
  let kept = known.get(apiUrl);
  if (kept === undefined) {
    kept = new Map();
    known.set(apiUrl, kept);
  }
  return kept;
}

/** For tests: forgets every photo. */
export function forgetPlacePhotos(): void {
  known.clear();
}

const NO_PHOTOS: ReadonlyMap<string, TownPhoto> = new Map();

/**
 * The photos of `items` the API has, by item: those known in this run at
 * once, the others asked for, a request each MAX_ASKED. Without an API,
 * none.
 */
export function usePlacePhotos(
  apiUrl: string | null,
  items: readonly string[],
  fetchFn: typeof fetch = fetch,
): ReadonlyMap<string, TownPhoto> {
  // The same items in another array are the same request.
  const asked = items.join(",");
  const [answered, setAnswered] = useState(0);
  useEffect(() => {
    if (apiUrl === null || asked === "") {
      return;
    }
    const kept = knownOf(apiUrl);
    const missing = [...new Set(asked.split(","))].filter((i) => !kept.has(i));
    if (missing.length === 0) {
      return;
    }
    const controller = new AbortController();
    for (let at = 0; at < missing.length; at += MAX_ASKED) {
      const chunk = missing.slice(at, at + MAX_ASKED);
      void fetchPlacePhotos(apiUrl, chunk, { fetchFn, signal: controller.signal }).then(
        (found) => {
          if (found === null) {
            return;
          }
          for (const item of chunk) {
            kept.set(item, found.get(item) ?? null);
          }
          if (!controller.signal.aborted) {
            setAnswered((n) => n + 1);
          }
        },
      );
    }
    return () => controller.abort();
  }, [apiUrl, asked, fetchFn]);
  return useMemo(() => {
    const kept = apiUrl === null ? undefined : known.get(apiUrl);
    if (kept === undefined || asked === "") {
      return NO_PHOTOS;
    }
    const found = new Map<string, TownPhoto>();
    for (const item of asked.split(",")) {
      const photo = kept.get(item);
      if (photo) {
        found.set(item, photo);
      }
    }
    return found;
    // `answered` says the kept photos changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, asked, answered]);
}
