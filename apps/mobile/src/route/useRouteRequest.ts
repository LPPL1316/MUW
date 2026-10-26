import type { JobStatus, RouteResult } from "@shaperoute/shared-types";
import { useCallback, useRef, useState } from "react";

import { routeQueue } from "../api/routeQueue";
import { type AnyRouteRequest, isImageRequest, type RouteOutcome } from "../api/routes";
import { requestRouteOnPhoneFirst } from "../engine/onPhone";

export type { AnyRouteRequest };

/** What can go wrong, as the screen explains it (see problems.ts). */
export type RouteProblem =
  | Exclude<RouteOutcome, { kind: "route" } | { kind: "cancelled" }>
  | { kind: "no_api_url" }
  /** Export GPX: the phone has no share sheet, or could not save the file. */
  | { kind: "no_sharing" }
  | { kind: "share_failed" };

export type RouteState =
  | { status: "idle" }
  | {
      status: "waiting";
      request: AnyRouteRequest;
      startedAt: number;
      /** What the API says it is doing; "sending" until it has answered. */
      phase: "sending" | JobStatus;
    }
  | { status: "done"; request: AnyRouteRequest; result: RouteResult }
  | { status: "failed"; request: AnyRouteRequest; problem: RouteProblem };

/**
 * One route request at a time: a new one, or `cancel`, stops waiting for the
 * previous and tells the API to drop it (ADR-0032).
 */
export function useRouteRequest(baseUrl: string | null): {
  state: RouteState;
  draw: (request: AnyRouteRequest) => void;
  cancel: () => void;
  /** Sends the last request again, as it was (TASK-256): the «Try again»
   * under an error. Nothing before the first request. */
  retry: () => void;
} {
  const [state, setState] = useState<RouteState>({ status: "idle" });
  const current = useRef<AbortController | null>(null);
  const last = useRef<AnyRouteRequest | null>(null);

  const draw = useCallback(
    (request: AnyRouteRequest) => {
      current.current?.abort();
      const mine = new AbortController();
      current.current = mine;
      last.current = request;
      setState({ status: "waiting", request, startedAt: Date.now(), phase: "sending" });
      // Asked again at each poll: the same phase is the same state, and
      // nothing is drawn again (TASK-287).
      const onStatus = (phase: JobStatus) => {
        if (current.current === mine) {
          setState((now) =>
            now.status === "waiting" && now.phase !== phase ? { ...now, phase } : now,
          );
        }
      };
      // The user's: first in the app's queue of route requests (TASK-287).
      const outcome: Promise<RouteOutcome | { kind: "no_api_url" }> = baseUrl
        ? routeQueue.user(() =>
            requestRouteOnPhoneFirst(baseUrl, request, {
              signal: mine.signal,
              onStatus,
            }),
          )
        : Promise.resolve({ kind: "no_api_url" });
      void outcome.then((answer) => {
        if (current.current !== mine) {
          return;
        }
        current.current = null;
        if (answer.kind === "cancelled") {
          setState({ status: "idle" });
        } else if (answer.kind === "route") {
          setState({ status: "done", request, result: answer.result });
        } else {
          setState({ status: "failed", request, problem: answer });
        }
      });
    },
    [baseUrl],
  );

  const cancel = useCallback(() => current.current?.abort(), []);

  const retry = useCallback(() => {
    if (last.current) {
      draw(last.current);
    }
  }, [draw]);

  return { state, draw, cancel, retry };
}

/** Same start, shape, word or image, and distance: the state still belongs
 * to the screen. An image's outline is the same when it is the one traced
 * for the same picture, or the same edit of it (TASK-079): the same arrays,
 * and so the same pieces. A word with the pen up is another route than the
 * same word without (TASK-198), and so a picture in pieces (TASK-297). */
export function sameRequest(a: AnyRouteRequest, b: AnyRouteRequest): boolean {
  const drawn =
    isImageRequest(a) || isImageRequest(b)
      ? isImageRequest(a) &&
        isImageRequest(b) &&
        a.outline === b.outline &&
        a.strokes === b.strokes &&
        (a.pen_up ?? false) === (b.pen_up ?? false)
      : a.shape === b.shape &&
        a.word === b.word &&
        (a.style ?? "round") === (b.style ?? "round") &&
        (a.pen_up ?? false) === (b.pen_up ?? false);
  return (
    a.start[0] === b.start[0] &&
    a.start[1] === b.start[1] &&
    drawn &&
    a.distance_m === b.distance_m &&
    a.activity === b.activity
  );
}
