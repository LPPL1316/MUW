import assert from "node:assert/strict";
import { test } from "node:test";

import activities from "../fixtures/activities-imported.json" with { type: "json" };
import activity from "../fixtures/activity-imported.json" with { type: "json" };
import request from "../fixtures/activity-request-imported.json" with { type: "json" };
import drawingDetailsBefore from "../fixtures/drawing-details.json" with { type: "json" };
import drawingDetails from "../fixtures/drawing-details-imported.json" with { type: "json" };
import feedBefore from "../fixtures/feed.json" with { type: "json" };
import feed from "../fixtures/feed-imported.json" with { type: "json" };
import myDrawingBefore from "../fixtures/my-drawing-details.json" with { type: "json" };
import myDrawing from "../fixtures/my-drawing-imported.json" with { type: "json" };
import {
  ACTIVITIES,
  type Activity,
  API_ERROR_CODES,
  type DrawingDetail,
  type FeedPage,
  type LatLon,
  type MyDrawing,
  RUN_SOURCES,
  type RunSource,
  VISIBILITIES,
  type Visibility,
} from "../src/index.ts";

// A run added from another app's file (TASK-312, ADR-0272). The same JSON
// is validated by the API's test_imported_runs.py; the bodies of My
// activities are typed in the app (src/api/activities.ts).
function source(value: string): RunSource {
  const found = RUN_SOURCES.find((s) => s === value);
  assert.ok(found, value);
  return found;
}

function visibility(value: string): Visibility {
  const found = VISIBILITIES.find((v) => v === value);
  assert.ok(found, value);
  return found;
}

function sport(value: string): Activity {
  const found = ACTIVITIES.find((a) => a === value);
  assert.ok(found, value);
  return found;
}

const mine: MyDrawing = {
  ...myDrawing,
  visibility: visibility(myDrawing.visibility),
  activity: sport(myDrawing.activity),
  source: source(myDrawing.source),
};
const whole: DrawingDetail = {
  ...drawingDetails,
  visibility: visibility(drawingDetails.visibility),
  activity: sport(drawingDetails.activity),
  source: source(drawingDetails.source),
  track: drawingDetails.track.map(([lat, lon]): LatLon => [lat, lon]),
};
const page: FeedPage = {
  ...feed,
  posts: feed.posts.map((post) => ({
    ...post,
    visibility: visibility(post.visibility),
    activity: sport(post.activity),
    source: source(post.source),
    track_preview: post.track_preview.map(([lat, lon]): LatLon => [lat, lon]),
  })),
};

test("a run from a file says so in every answer", () => {
  const [listed] = activities.activities;
  assert.ok(listed);
  const [post] = page.posts;
  assert.ok(post);
  for (const said of [request.source, listed.source, activity.source]) {
    assert.equal(source(said), "file");
  }
  for (const said of [mine.source, whole.source, post.source]) {
    assert.equal(said, "file");
  }
  // The same run, and the same drawing, in each.
  assert.equal(listed.id, activity.id);
  assert.equal(mine.key, activity.id);
  assert.equal(whole.id, mine.id);
  assert.equal(post.id, mine.id);
});

test("the examples written before are runs of the app, and say nothing of it", () => {
  assert.deepEqual(RUN_SOURCES, ["muw", "file"]);
  assert.ok(!("source" in drawingDetailsBefore));
  assert.ok(!("source" in myDrawingBefore));
  assert.ok(feedBefore.posts.every((post) => !("source" in post)));
});

test("a run from a file has no route and the times of the file", () => {
  assert.equal(request.points, null);
  assert.equal(request.similarity, null);
  assert.ok(request.track.every((fix) => fix.accuracy_m === null));
  const [first] = request.track;
  assert.ok(first);
  assert.equal(Date.parse(activity.started_at), first.time_ms);
  assert.equal(Date.parse(whole.started_at), first.time_ms);
  // A hole in the file is an auto pause: its time does not count.
  assert.ok(request.pauses.every((pause) => pause.auto));
  assert.equal(activity.score, null);
  assert.equal(activity.points, null);
});

test("Send to Strava refuses it with a code of its own", () => {
  assert.ok((API_ERROR_CODES as readonly string[]).includes("imported_run"));
});
