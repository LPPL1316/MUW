import type { RouteResult } from "@shaperoute/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";

import { routeQueue } from "../api/routeQueue";
import { requestRoute } from "../api/routes";
import {
  type ExampleDetail,
  exampleRequest,
  failureText,
  movedExample,
} from "../explore/exampleRoutes";
import type { Explored } from "../explore/explored";
import type { LngLat } from "../map/coordinates";
import { leftElsewhere, movable, movedRequest } from "./shapeMove";

export type MoveExample = {
  /** The example on the map is on the water and says where its shape is. */
  available: boolean;
  /** The user is moving the shape: a finger drags it, not the map. */
  moving: boolean;
  begin: () => void;
  cancel: () => void;
  /** The map's `onMoved`: asks for the example with its shape there. */
  onMoved: (by: LngLat) => void;
  /** The moved route is being drawn: the one of before stays on the map,
   * where the finger left it. */
  waiting: boolean;
  /** The moved shape did not fit where it was left. */
  elsewhere: boolean;
  /** Why the moved route could not be drawn: the one of before is back. */
  problem: string | null;
};

/** What the card says of the route a move ended with. */
type Told = { detail: ExampleDetail; elsewhere: boolean; problem: string | null };

/**
 * Moving the shape of an example of «Explore» on the water (TASK-244), as
 * useMoveShape does for a drawn route: «Move the shape», a drag on the map,
 * and the request the example was drawn for again, with `near`
 * (shapeMove.ts). The answer takes the example's place on the map
 * (`redraw`); the list keeps the example as it was. `explored` is the route
 * of «Explore» on the map: one that is not an example with its `centre` is
 * not moved.
 */
export function useMoveExample(
  apiUrl: string | null,
  explored: Explored | null,
  redraw: (detail: ExampleDetail) => void,
  request: typeof requestRoute = requestRoute,
): MoveExample {
  const detail = explored?.status === "done" ? explored.detail : null;
  const result = explored?.status === "done" ? explored.result : null;
  const id = detail?.id ?? null;
  const asked = id === null ? undefined : exampleRequest(id);
  const available =
    apiUrl !== null && result !== null && asked !== undefined && movable(asked, result);

  // The route being moved, and the one left while its moved one is drawn:
  // another route on the map is neither.
  const [moved, setMoved] = useState<RouteResult | null>(null);
  const [left, setLeft] = useState<RouteResult | null>(null);
  const [told, setTold] = useState<Told | null>(null);
  const flight = useRef<AbortController | null>(null);

  // Another route on the map, or none: nobody waits for the one asked.
  useEffect(
    () => () => {
      flight.current?.abort();
      flight.current = null;
    },
    [id],
  );

  const begin = useCallback(() => {
    setTold(null);
    setMoved(result);
  }, [result]);
  const cancel = useCallback(() => setMoved(null), []);
  const onMoved = useCallback(
    (by: LngLat) => {
      // Only the route being moved: a drag told late is nobody's.
      if (
        apiUrl === null ||
        detail === null ||
        result === null ||
        asked === undefined ||
        moved !== result
      ) {
        return;
      }
      const wanted = movedRequest(asked, result, by);
      if (wanted === null) {
        return;
      }
      setMoved(null);
      setLeft(result);
      const controller = new AbortController();
      flight.current = controller;
      // The user's: first in the app's queue of route requests (TASK-287).
      const asking = routeQueue.user(() =>
        request(apiUrl, wanted, { signal: controller.signal }),
      );
      void asking.then((outcome) => {
        if (controller.signal.aborted || outcome.kind === "cancelled") {
          return;
        }
        flight.current = null;
        setLeft(null);
        if (outcome.kind === "route") {
          const next = movedExample(detail, outcome.result);
          setTold({
            detail: next,
            elsewhere: leftElsewhere(wanted, outcome.result),
            problem: null,
          });
          redraw(next);
          return;
        }
        // The same route in a new line: the map draws it again where it
        // was, not where the finger left it.
        const back = { ...detail, points: [...detail.points] };
        setTold({
          detail: back,
          elsewhere: false,
          problem: failureText(outcome, "paddling"),
        });
        redraw(back);
      });
    },
    [apiUrl, detail, result, asked, moved, request, redraw],
  );

  const said = told !== null && told.detail === detail ? told : null;
  return {
    available,
    moving: available && moved !== null && moved === result,
    begin,
    cancel,
    onMoved,
    waiting: left !== null && left === result,
    elsewhere: said?.elsewhere ?? false,
    problem: said?.problem ?? null,
  };
}
