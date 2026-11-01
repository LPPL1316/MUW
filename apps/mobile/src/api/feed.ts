import type { FeedPage, FeedPost, LatLon } from "@shaperoute/shared-types";

import { type AccountOutcome, ask } from "./accounts";
import { isDrawing } from "./drawings";

/**
 * The feed (TASK-118, ADR-0227): GET /feed of docs/API.md, «Feed», with
 * the session token. A page of the drawings the account may see: its own
 * first, then those of the people it follows, then the others' near the
 * phone (all of them when the phone does not say where it is), the last
 * published first in each. Never a private one. The body is
 * packages/shared-types/fixtures/feed.json.
 */

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** What a page is asked with: the first without a `cursor`. */
export type FeedQuery = {
  cursor?: string | null;
  /** Where the phone is, for the drawings nearby; null when unknown. */
  near?: LatLon | null;
};

/** Two decimals, about a kilometre: the 50 km of «nearby» ask for no more,
 * and the privacy text says so (TASK-356). */
function rounded(degrees: number): string {
  return String(Math.round(degrees * 100) / 100);
}

/** The query of a page: the point first, so the pages of one read agree. */
export function feedPath({ cursor = null, near = null }: FeedQuery): string {
  const query = new URLSearchParams();
  if (near !== null) {
    query.set("lat", rounded(near[0]));
    query.set("lon", rounded(near[1]));
  }
  if (cursor !== null) {
    query.set("cursor", cursor);
  }
  const text = query.toString();
  return text === "" ? "/feed" : `/feed?${text}`;
}

/** GET /feed: a page; an older API has no feed and says 404 `http_error`. */
export function fetchFeed(
  baseUrl: string,
  token: string,
  query: FeedQuery = {},
  options: Options = {},
): Promise<AccountOutcome<FeedPage>> {
  return ask(baseUrl, feedPath(query), { method: "GET", token }, isFeedPage, options);
}

export function isFeedPost(body: unknown): body is FeedPost {
  if (!isDrawing(body)) {
    return false;
  }
  const { author } = body as { author?: unknown };
  return (
    typeof author === "object" &&
    author !== null &&
    typeof (author as { public_id?: unknown }).public_id === "string" &&
    typeof (author as { username?: unknown }).username === "string"
  );
}

export function isFeedPage(body: unknown): body is FeedPage {
  return (
    typeof body === "object" &&
    body !== null &&
    Array.isArray((body as { posts?: unknown }).posts) &&
    (body as { posts: unknown[] }).posts.every(isFeedPost) &&
    (typeof (body as { next?: unknown }).next === "string" ||
      (body as { next?: unknown }).next === null)
  );
}
