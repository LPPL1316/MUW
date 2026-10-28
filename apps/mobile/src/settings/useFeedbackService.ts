import { useEffect, useState } from "react";

import { checkFeedbackService } from "../api/feedback";

type Options = { fetchFn?: typeof fetch; key?: string | null };

/**
 * Whether the server takes «Send feedback» (TASK-308, ADR-0268): GET
 * /feedback, asked each time «Settings» opens. False until it answers 204,
 * and so on an older API (404), without an address or without a network:
 * then «Settings» shows no «FEEDBACK», and nobody writes a message the
 * server cannot take. A server updated later shows it at the next opening.
 */
export function useFeedbackService(
  baseUrl: string | null,
  { fetchFn, key }: Options = {},
): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (baseUrl === null) {
      return;
    }
    // An answer after «Settings» closed changes nothing.
    let open = true;
    void checkFeedbackService(baseUrl, { fetchFn, key }).then((outcome) => {
      if (open) {
        setOn(outcome.kind === "ok");
      }
    });
    return () => {
      open = false;
    };
  }, [baseUrl, fetchFn, key]);
  return on;
}
