import { useCallback, useEffect, useRef, useState } from "react";
import { t, tLater } from "../i18n";

import { routeQueue } from "../api/routeQueue";
import { MAX_POLL_FAILURES } from "../api/routes";
import { ideaRequest, type ThemedIdea } from "./themedIdeas";
import {
  getThemed,
  postThemed,
  type ThemedRequest,
  type ThemedResult,
} from "./themedRoutes";

/** How often the job is asked about while the engine works. */
export const POLL_MS = 1500;
/** A themed route plans the shape a few times: up to a few minutes. */
export const GIVE_UP_MS = 5 * 60 * 1000;

export type ThemedState =
  | { status: "idle" }
  | { status: "waiting"; request: ThemedRequest }
  | {
      status: "done";
      request: ThemedRequest;
      result: ThemedResult;
      /** One of our ideas, opened without asking the API. */
      idea?: ThemedIdea;
    }
  | { status: "failed"; request: ThemedRequest; message: string };

const UNREACHABLE = tLater(
  "The API did not answer. Check the connection and try again.",
);

/**
 * Asks for a themed route and follows its job until it ends (TASK-129); or
 * shows one of our ideas, planned already.
 */
export function useThemedRoute(
  apiUrl: string | null,
  {
    fetchFn = fetch,
    pollMs = POLL_MS,
  }: { fetchFn?: typeof fetch; pollMs?: number } = {},
): {
  state: ThemedState;
  ask: (request: ThemedRequest) => void;
  show: (idea: ThemedIdea) => void;
  close: () => void;
} {
  const [state, setState] = useState<ThemedState>({ status: "idle" });
  const run = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    run.current?.abort();
    run.current = null;
    setState({ status: "idle" });
  }, []);

  useEffect(() => () => run.current?.abort(), []);

  const show = useCallback((idea: ThemedIdea) => {
    run.current?.abort();
    run.current = null;
    setState({ status: "done", request: ideaRequest(idea), result: idea.result, idea });
  }, []);

  const ask = useCallback(
    (request: ThemedRequest) => {
      run.current?.abort();
      const controller = new AbortController();
      run.current = controller;
      const { signal } = controller;
      if (apiUrl === null) {
        setState({ status: "failed", request, message: t(UNREACHABLE) });
        return;
      }
      setState({ status: "waiting", request });
      // The user's: first in the app's queue of route requests (TASK-287).
      void routeQueue.user(async () => {
        const began = Date.now();
        let job = await postThemed(apiUrl, request, { fetchFn, signal });
        // Asks that fail in a row (TASK-254): forgiven as requestRoute
        // forgives them, the engine is still at work on the job.
        let failures = 0;
        while (job !== null && (job.status === "queued" || job.status === "running")) {
          if (Date.now() - began > GIVE_UP_MS) {
            job = null;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, pollMs));
          if (signal.aborted) {
            return;
          }
          const asked = await getThemed(apiUrl, job.job_id, { fetchFn, signal });
          if (asked === null) {
            failures += 1;
            if (failures >= MAX_POLL_FAILURES) {
              job = null;
            }
            continue;
          }
          failures = 0;
          job = asked;
        }
        if (signal.aborted) {
          return;
        }
        if (job?.status === "done" && job.result) {
          setState({ status: "done", request, result: job.result });
        } else {
          setState({
            status: "failed",
            request,
            message: job?.error?.message ?? t(UNREACHABLE),
          });
        }
      });
    },
    [apiUrl, fetchFn, pollMs],
  );

  return { state, ask, show, close };
}
