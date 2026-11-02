import type { Activity } from "@shaperoute/shared-types";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";

import {
  againOfDrawing,
  type DrawAgain,
  drawsAgain,
  type DrawnFigure,
} from "../route/drawAgain";

/**
 * «Draw it near me» from a card of «Feed» (TASK-355, ADR-0306): the action
 * for a figure, when «Draw» can draw it. The app knows how; the card only
 * asks, and `FeedScreen` stays out of it.
 */
export type DrawAgainDoor = (figure: DrawnFigure) => (() => void) | undefined;

/** Without the app around it (a test of one screen): no button. */
export const DrawAgainContext = createContext<DrawAgainDoor>(() => undefined);

export function useDrawAgainDoor(): DrawAgainDoor {
  return useContext(DrawAgainContext);
}

/**
 * The door for the sport of «Draw», with the rule of the drawing's own button
 * (`drawsAgain`): the post's sport does not matter, «Draw» draws in its own.
 * The same door until that sport changes, whatever `onDrawAgain` is this
 * render, so the cards under it are not drawn again with the app.
 */
export function useDrawAgainOf(
  activity: Activity,
  onDrawAgain: (again: DrawAgain) => void,
): DrawAgainDoor {
  const latest = useRef(onDrawAgain);
  useEffect(() => {
    latest.current = onDrawAgain;
  });
  return useMemo(
    () => (figure) => {
      const again = againOfDrawing(figure);
      return drawsAgain(again, activity) ? () => latest.current(again) : undefined;
    },
    [activity],
  );
}
