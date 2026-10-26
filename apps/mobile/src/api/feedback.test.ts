import feedbackRequest from "@shaperoute/shared-types/fixtures/feedback-request.json";
import type { FeedbackRequest } from "@shaperoute/shared-types";

import { answers, apiError } from "../account/testing";
import { sendFeedback } from "./feedback";

const URL = "http://api";
const TOKEN = "the-token";
const request = feedbackRequest as FeedbackRequest;

test("POST /feedback carries the fixture's body with the session; 204 is done", async () => {
  const fetchFn: jest.Mock = answers({ status: 204 });
  expect(await sendFeedback(URL, TOKEN, request, { fetchFn, key: null })).toEqual({
    kind: "ok",
    value: null,
  });
  const [url, init] = fetchFn.mock.calls[0];
  expect([url, init.method]).toEqual([`${URL}/feedback`, "POST"]);
  expect(init).toMatchObject({ headers: { Authorization: `Bearer ${TOKEN}` } });
  expect(JSON.parse(init.body)).toEqual(request);
});

test("the limit of the day comes back with the seconds to wait", async () => {
  const fetchFn: jest.Mock = answers({
    status: 429,
    body: apiError("too_many_requests"),
    headers: { "Retry-After": "3600" },
  });
  expect(await sendFeedback(URL, TOKEN, request, { fetchFn, key: null })).toMatchObject(
    {
      kind: "api_error",
      code: "too_many_requests",
      retryAfterS: 3600,
    },
  );
});
