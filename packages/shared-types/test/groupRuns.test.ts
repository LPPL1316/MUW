import assert from "node:assert/strict";
import { test } from "node:test";

import change from "../fixtures/group-run-change.json" with { type: "json" };
import pushData from "../fixtures/group-run-push-data.json" with { type: "json" };
import request from "../fixtures/group-run-request.json" with { type: "json" };
import detail from "../fixtures/group-run.json" with { type: "json" };
import ofProfile from "../fixtures/group-runs-of-profile.json" with { type: "json" };
import row from "../fixtures/group-runs.json" with { type: "json" };
import {
  GROUP_RUN_DESCRIPTION_MAX,
  GROUP_RUN_MEETING_NOTE_MAX,
  GROUP_RUN_TITLE_MAX,
  type GroupRun,
  type GroupRunChange,
  type GroupRunDetail,
  type GroupRunPushData,
  type GroupRunPushKind,
  type GroupRunRequest,
  type GroupRunsPage,
  type LatLon,
  type ProfileGroupRuns,
} from "../src/index.ts";

// Group runs (TASK-309, ADR-0269): the examples the app's tests read,
// shaped as group_runs.py answers; test_group_runs.py validates the same.
const point = ([lat, lon]: number[]): LatLon => [lat, lon];

function card(json: (typeof row.group_runs)[number]): GroupRun {
  return {
    ...json,
    visibility: json.visibility === "followers" ? "followers" : "everyone",
    status: json.status === "over" ? "over" : "upcoming",
    start: point(json.start),
    preview: json.preview.map(point),
  };
}

const asked: GroupRunRequest = {
  ...request,
  style: null,
  points: request.points.map(point),
  visibility: "everyone",
};
const changed: GroupRunChange = change;
const page: GroupRunsPage = { group_runs: row.group_runs.map(card) };
const profile: ProfileGroupRuns = {
  upcoming: ofProfile.upcoming.map(card),
  past: ofProfile.past.map(card),
};
const whole: GroupRunDetail = {
  ...detail,
  ...card(detail),
  points: detail.points.map(point),
  walks: [],
  on_foot: [],
};
const KINDS: readonly GroupRunPushKind[] = [
  "group_run_soon",
  "group_run_changed",
  "group_run_cancelled",
];
const opened: GroupRunPushData[] = pushData.map((data) => ({
  kind: KINDS.find((kind) => kind === data.kind) ?? "group_run_soon",
  group_run_id: data.group_run_id,
}));

test("a group run is asked for with a route, a time with its offset and who sees it", () => {
  assert.ok(asked.points.length >= 2);
  assert.match(asked.starts_at, /[+-]\d\d:\d\d$|Z$/);
  assert.ok(asked.title.length <= GROUP_RUN_TITLE_MAX);
  assert.ok((asked.meeting_note ?? "").length <= GROUP_RUN_MEETING_NOTE_MAX);
  assert.ok((asked.description ?? "").length <= GROUP_RUN_DESCRIPTION_MAX);
  assert.deepEqual(Object.keys(changed).sort(), [
    "description",
    "meeting_note",
    "starts_at",
    "title",
  ]);
});

test("the organiser comes first, and goes", () => {
  for (const one of [...page.group_runs, ...profile.upcoming, ...profile.past, whole]) {
    assert.deepEqual(one.faces[0], one.organiser);
    assert.ok(one.going >= one.faces.length);
    assert.deepEqual(one.start, one.preview[0]);
  }
  assert.deepEqual(whole.people[0], whole.organiser);
  assert.equal(whole.people.length, whole.going);
  assert.equal(whole.next, null);
});

test("the row is in time order, the profile's past the latest first", () => {
  const times = page.group_runs.map((one) => Date.parse(one.starts_at));
  assert.deepEqual(
    times,
    [...times].sort((a, b) => a - b),
  );
  assert.ok(profile.past.every((one) => one.status === "over"));
});

test("a notification of a group run opens it", () => {
  assert.deepEqual(
    opened.map((data) => data.kind),
    KINDS,
  );
  assert.ok(opened.every((data) => data.group_run_id === whole.id));
});
