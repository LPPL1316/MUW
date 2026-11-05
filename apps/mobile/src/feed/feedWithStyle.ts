import type { StylePost } from "@shaperoute/shared-types";

import { adSlots, type FeedItem } from "./feedWithAds";

/**
 * Where the MuW Style posts go in «All» (TASK-384, ADR-0326; the user's
 * choice of 2026-11-04, «1 ogni 8, solo All»): one row in 8 at most, never
 * in the first 3, never two of ours in a row, and only between two posts.
 * Never in «Following».
 */

/** Rows between the start of two Style posts: 7 drawings, then one. */
export const STYLE_EVERY = 8;

/** A Style post in the list, with its place among them. */
export type StyleItem = { kind: "style"; style: StylePost; slot: number };

/**
 * The places for Style posts in a list of `posts` drawings, as the number of
 * drawings above each: after the 7th, the 14th… A place an ad already takes
 * (`adSlots`) moves one drawing down, so an ad and a Style post are never
 * side by side.
 */
export function styleSlots(posts: number): number[] {
  const ads = new Set(adSlots(posts));
  const slots: number[] = [];
  let after = STYLE_EVERY - 1;
  while (after < posts) {
    const place = ads.has(after) ? after + 1 : after;
    if (place >= posts) {
      break;
    }
    slots.push(place);
    // The next counts from this one: never nearer than 7 drawings.
    after = place + STYLE_EVERY - 1;
  }
  return slots;
}

/** The rows of «All» with the Style posts there are: `styles[i]` to slot `i`. */
export function feedWithStyle<P, A>(
  items: readonly FeedItem<P, A>[],
  styles: readonly StylePost[],
): (FeedItem<P, A> | StyleItem)[] {
  if (styles.length === 0) {
    return [...items];
  }
  const posts = items.filter((item) => item.kind === "post").length;
  const slots = styleSlots(posts);
  const rows: (FeedItem<P, A> | StyleItem)[] = [];
  let next = 0;
  for (const item of items) {
    rows.push(item);
    if (
      item.kind === "post" &&
      next < slots.length &&
      next < styles.length &&
      item.index + 1 === slots[next]
    ) {
      rows.push({ kind: "style", style: styles[next], slot: next });
      next += 1;
    }
  }
  return rows;
}
