import type { DrawingDetail } from "@shaperoute/shared-types";
import { useCallback, useState } from "react";

import { shareGpx } from "../route/shareGpx";
import { drawingGpx, gpxFileName } from "./drawingRoute";

/** «Export GPX» under a drawing, for the drawing it is about: another
 * drawing opened leaves an old failure behind. */
export type DrawingExport =
  | { status: "idle" }
  | { status: "preparing"; id: string }
  | { status: "failed"; id: string };

/**
 * «Export GPX» of a drawing on the map (TASK-307): the phone writes the
 * file from the track it already has, no API asked, and opens the share
 * sheet as for a route (ADR-0033).
 */
export function useDrawingGpx(): {
  exporting: (id: string) => "idle" | "preparing" | "failed";
  exportGpx: (drawing: DrawingDetail) => void;
} {
  const [state, setState] = useState<DrawingExport>({ status: "idle" });

  const exportGpx = useCallback((drawing: DrawingDetail) => {
    const { id } = drawing;
    setState({ status: "preparing", id });
    void (async () => {
      try {
        const shared = await shareGpx(drawingGpx(drawing), gpxFileName(drawing));
        setState(shared === "shared" ? { status: "idle" } : { status: "failed", id });
      } catch {
        setState({ status: "failed", id });
      }
    })();
  }, []);

  const exporting = useCallback(
    (id: string) =>
      state.status !== "idle" && state.id === id ? state.status : "idle",
    [state],
  );

  return { exporting, exportGpx };
}
