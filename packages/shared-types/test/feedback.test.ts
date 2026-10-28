import assert from "node:assert/strict";
import { test } from "node:test";

import feedbackRequest from "../fixtures/feedback-request.json" with { type: "json" };
import { type FeedbackRequest, MAX_FEEDBACK_LENGTH } from "../src/index.ts";

// The same JSON is validated by the API's test_feedback.py (TASK-308).
const sent = feedbackRequest as FeedbackRequest;

test("feedback is a text, with the app's version and system", () => {
  assert.deepEqual(Object.keys(sent).sort(), ["app_version", "platform", "text"]);
  assert.ok(sent.text.trim().length > 0);
  assert.ok(sent.text.length <= MAX_FEEDBACK_LENGTH);
  assert.ok(sent.platform === "ios" || sent.platform === "android");
});
