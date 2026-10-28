import assert from "node:assert/strict";
import { test } from "node:test";

import publicProfile from "../fixtures/public-profile.json" with { type: "json" };
import userPhotos from "../fixtures/user-photos.json" with { type: "json" };
import {
  DRAWING_MAX_PHOTOS,
  type PublicProfile,
  type UserPhotosPage,
} from "../src/index.ts";

// The same JSON is validated by the API's test_profile_totals.py (TASK-324).
const page: UserPhotosPage = userPhotos;
const seen: PublicProfile = { ...publicProfile, follow: "following" };

test("a photo of a profile names its drawing and where to read it", () => {
  for (const photo of page.photos) {
    assert.deepEqual(Object.keys(photo).sort(), [
      "drawing_id",
      "height",
      "n",
      "started_at",
      "title",
      "url",
      "width",
    ]);
    assert.ok(photo.n >= 1 && photo.n <= DRAWING_MAX_PHOTOS);
    assert.ok(photo.url.startsWith(`/drawings/${photo.drawing_id}/photos/${photo.n}?`));
  }
});

test("the photos come the latest run first, each drawing's in its places", () => {
  const order = page.photos.map((p) => [p.started_at, p.drawing_id, p.n] as const);
  for (const [a, b] of order.slice(1).map((next, i) => [order[i], next])) {
    assert.ok(a[0] > b[0] || (a[1] === b[1] && a[2] < b[2]));
  }
  assert.match(page.next ?? "", /^\d{1,17}-[0-9a-f]{32}-[1-9]$/);
});

test("the totals of a profile are whole metres and a count", () => {
  for (const total of [seen.distance_m, seen.climb_m, seen.reactions]) {
    assert.ok(Number.isInteger(total) && (total ?? -1) >= 0);
  }
});
