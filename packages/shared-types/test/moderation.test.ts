import assert from "node:assert/strict";
import { test } from "node:test";

import reportRequest from "../fixtures/report-request.json" with { type: "json" };
import { REPORT_KINDS, REPORT_REASONS, type ReportRequest } from "../src/index.ts";

// The same JSON is validated by the API's test_moderation.py (TASK-121).
const asked = reportRequest as ReportRequest;

test("a report says what, which one and why", () => {
  assert.deepEqual(Object.keys(asked).sort(), ["id", "kind", "reason"]);
  assert.ok((REPORT_KINDS as readonly string[]).includes(asked.kind));
  assert.ok((REPORT_REASONS as readonly string[]).includes(asked.reason));
  assert.match(asked.id, /^[0-9a-f-]{36}$/);
});

test("the short list of reasons, «other» last", () => {
  assert.deepEqual(REPORT_REASONS, [
    "spam",
    "offensive",
    "harassment",
    "sexual",
    "other",
  ]);
  assert.deepEqual(REPORT_KINDS, ["drawing", "comment", "user", "group_run"]);
});
