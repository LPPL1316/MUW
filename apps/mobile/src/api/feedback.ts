import type { FeedbackRequest } from "@shaperoute/shared-types";

import { type AccountOutcome, ask } from "./accounts";

/**
 * «Send feedback» (TASK-308, ADR-0268): the call of docs/API.md,
 * «Feedback», with the session token. The request is
 * packages/shared-types/fixtures/feedback-request.json; the API keeps the
 * message and emails it to whoever runs MuW. At most 5 in any 24 hours,
 * then `too_many_requests`. GET /feedback says the server takes it.
 */

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** POST /feedback: 204 once the message is kept. */
export function sendFeedback(
  baseUrl: string,
  token: string,
  request: FeedbackRequest,
  options: Options = {},
): Promise<AccountOutcome<null>> {
  return ask(
    baseUrl,
    "/feedback",
    { method: "POST", token, body: request },
    isDone,
    options,
  );
}

/** GET /feedback: 204 on a server that takes feedback, 404 on an older one. */
export function checkFeedbackService(
  baseUrl: string,
  options: Options = {},
): Promise<AccountOutcome<null>> {
  return ask(baseUrl, "/feedback", { method: "GET" }, isDone, options);
}

function isDone(body: unknown, status: number): body is null {
  return status === 204 && body === null;
}
