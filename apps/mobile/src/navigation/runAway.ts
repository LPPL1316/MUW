import { AppState, Platform } from "react-native";

import type { RunRecorder } from "./trackStore";

/** How often the run looks whether the phone froze the app. */
export const TICK_MS = 1000;
/** A tick this late means the app was frozen, not just busy: iOS stopped
 * it, the GPS with it (TASK-261, ADR-0225). */
export const FROZEN_AFTER_MS = 15_000;

export type RunAway = {
  /** Before each fix: a freeze the ticks have not seen yet is told first,
   * so the fix that ends it is the one that starts a new stretch. */
  beforeFix(): void;
  remove(): void;
};

/**
 * Tells `recorder` when the GPS may have stopped with the app (TASK-255,
 * ADR-0219): then a fix more than AWAY_AFTER_MS after the last starts a new
 * stretch, with neither metres nor time in between.
 *
 * With the GPS in the foreground only (`background` false, as before
 * TASK-261) that is whenever the app leaves the front. With the GPS in the
 * background (TASK-261) the fixes go on with the phone locked, and a runner
 * standing still at a light has none either: the GPS stopped only if iOS
 * froze the app, which a tick of the clock coming far too late tells.
 * The freeze counts in both cases. On Android in the background
 * (TASK-294) the clock of the app stops with the screen off while the
 * service goes on with the GPS: a late tick means nothing there. While the
 * service runs Android does not freeze the app; it may only end it, and the
 * run then reopens paused (TASK-272).
 */
export function watchAway(
  recorder: Pick<RunRecorder, "leave">,
  { background }: { background: boolean },
): RunAway {
  const freezes = !(background && Platform.OS === "android");
  let tickMs = Date.now();
  function tick(): void {
    const nowMs = Date.now();
    if (freezes && nowMs - tickMs > FROZEN_AFTER_MS) {
      // Frozen since the last tick: nothing after it was followed.
      recorder.leave(tickMs);
    }
    tickMs = nowMs;
  }
  const ticks = setInterval(tick, TICK_MS);
  const leaving = background
    ? null
    : AppState.addEventListener("change", (next) => {
        if (next === "background") {
          recorder.leave(Date.now());
        }
      });
  return {
    beforeFix: tick,
    remove() {
      clearInterval(ticks);
      leaving?.remove();
    },
  };
}
