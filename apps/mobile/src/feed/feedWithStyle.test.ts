import post from "@shaperoute/shared-types/fixtures/style-post.json";
import type { StylePost } from "@shaperoute/shared-types";

import { feedWithAds } from "./feedWithAds";
import { feedWithStyle, STYLE_EVERY, styleSlots } from "./feedWithStyle";

const STYLE = post as StylePost;
const styles = (n: number): StylePost[] =>
  Array.from({ length: n }, (_, i) => ({ ...STYLE, id: `MS-00${i + 1}` }));
const drawings = (n: number): string[] => Array.from({ length: n }, (_, i) => `d${i}`);

function rows(posts: number, ads: (string | undefined)[], style: number): string[] {
  return feedWithStyle(feedWithAds(drawings(posts), ads), styles(style)).map((row) =>
    row.kind === "post" ? "d" : row.kind === "ad" ? "AD" : "S",
  );
}

test("one row in 8 at most: after the 7th drawing, the 14th…", () => {
  expect(STYLE_EVERY).toBe(8);
  expect(styleSlots(30)).toEqual([7, 14, 21, 28]);
  // 35 is an ad's: one drawing down.
  expect(styleSlots(40)).toEqual([7, 14, 21, 28, 36]);
});

test("never in the first 3, never at the end, never two in a row", () => {
  expect(rows(3, [], 5)).toEqual(["d", "d", "d"]);
  expect(rows(7, [], 5)).toEqual(Array(7).fill("d"));
  const list = rows(40, [], 10);
  expect(list.slice(0, 3)).toEqual(["d", "d", "d"]);
  expect(list.at(-1)).toBe("d");
  for (let at = 1; at < list.length; at += 1) {
    expect(list[at] === "S" && list[at - 1] === "S").toBe(false);
  }
  // At most one row in 8 in any 8 rows.
  for (let at = 0; at + 8 <= list.length; at += 1) {
    expect(list.slice(at, at + 8).filter((r) => r === "S").length).toBeLessThanOrEqual(
      1,
    );
  }
});

test("an ad and a Style post are never side by side", () => {
  const ads = Array(10).fill("ad");
  const list = rows(40, ads, 10);
  for (let at = 1; at < list.length; at += 1) {
    expect([list[at - 1], list[at]].sort().join()).not.toBe("AD,S");
  }
});

test("as many as there are, in their order; none, and the Feed is as before", () => {
  const items = feedWithAds(drawings(30), []);
  const placed = feedWithStyle(items, styles(2)).filter((r) => r.kind === "style");
  expect(placed.map((r) => (r.kind === "style" ? r.style.id : ""))).toEqual([
    "MS-001",
    "MS-002",
  ]);
  expect(feedWithStyle(items, [])).toEqual(items);
});
