import { useSyncExternalStore } from "react";

import { spokenWords } from "../voice/voiceChoice";
import { openPause, type TrackFix } from "./trackRecorder";
import type { RunRecorder } from "./trackStore";

/**
 * The controls of the run in progress (TASK-169, ADR-0137): the countdown
 * before it, «Pause» and «Resume», the pause that comes by itself when the
 * runner stands still, the pause of the pen between two letters of a word
 * (TASK-198), and whether the voice speaks. One run at a time, as
 * in the run file (trackStore): the screens press here, and the recording
 * (useFreeRun, useNavigation) does what was pressed.
 */

/** From «Start» to the first metre that counts: 3, 2, 1. */
export const COUNTDOWN_MS = 3000;
/** Standing still this long pauses the run, when the runner wants it. */
export const AUTO_PAUSE_AFTER_MS = 10_000;
/** How often standing still is looked for. */
export const AUTO_PAUSE_CHECK_MS = 1000;

export type RunPhase = "idle" | "countdown" | "running" | "paused";

export type RunControl = {
  phase: RunPhase;
  /** When the countdown ends, in milliseconds; null out of it. */
  startsAtMs: number | null;
  /** Paused by standing still, not by the runner: moving again resumes. */
  auto: boolean;
  /** Paused by the pen, lifted at the end of a letter of a word (TASK-198):
   * the start of the next letter resumes. */
  pen: boolean;
  /** The runner's choices; they stay for the next run. */
  autoPause: boolean;
  voice: boolean;
};

let state: RunControl = {
  phase: "idle",
  startsAtMs: null,
  auto: false,
  pen: false,
  autoPause: true,
  voice: true,
};

const listeners = new Set<() => void>();

function set(next: Partial<RunControl>): void {
  state = { ...state, ...next };
  for (const listener of listeners) {
    listener();
  }
}

export function runControl(): RunControl {
  return state;
}

export function subscribeRunControl(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The controls, for a screen: it is drawn again when they change. */
export function useRunControl(): RunControl {
  return useSyncExternalStore(subscribeRunControl, runControl, runControl);
}

export function setAutoPause(on: boolean): void {
  set({ autoPause: on });
}

export function setVoice(on: boolean): void {
  set({ voice: on });
}

type Session = {
  recorder: RunRecorder;
  onChange: () => void;
  say: (text: string) => void;
  arrived: boolean;
  /** Where the runner was last seen during the countdown. */
  waiting: TrackFix | null;
  countdown: ReturnType<typeof setTimeout> | null;
  watch: ReturnType<typeof setInterval>;
};

let session: Session | null = null;

/** The run waits, by the runner's hand. */
export function pauseRun(): void {
  if (session === null || state.phase !== "running" || session.arrived) {
    return;
  }
  session.recorder.pause(Date.now());
  set({ phase: "paused", auto: false, pen: false });
  session.onChange();
}

/** The run goes on, whoever paused it: the pen too, on a walk. */
export function resumeRun(): void {
  if (session === null || state.phase !== "paused") {
    return;
  }
  session.recorder.resume(Date.now());
  set({ phase: "running", auto: false, pen: false });
  session.onChange();
}

/** The countdown ends now: when it has run out, and in tests. */
export function skipCountdown(): void {
  if (session?.countdown) {
    clearTimeout(session.countdown);
    session.countdown = null;
  }
  if (state.phase !== "countdown") {
    return;
  }
  set({ phase: "running", startsAtMs: null });
  // The run starts here and now, where the runner stands: the GPS gives
  // nothing more until the first metres, and the clock should not wait.
  if (session?.waiting) {
    const { recorder, waiting, onChange } = session;
    session.waiting = null;
    recorder.onFix({ ...waiting, timeMs: Date.now() }, false);
    onChange();
  }
}

/** Since when the runner has not moved: the last fix, or the last «Resume». */
function stillSinceMs(recorder: RunRecorder): number | null {
  const track = recorder.track();
  const last = track.fixes[track.fixes.length - 1];
  if (last === undefined) {
    return null;
  }
  const pause = track.pauses?.[track.pauses.length - 1];
  return Math.max(last.timeMs, pause?.toMs ?? 0);
}

function watchStanding(): void {
  if (
    session === null ||
    session.arrived ||
    !state.autoPause ||
    state.phase !== "running"
  ) {
    return;
  }
  const since = stillSinceMs(session.recorder);
  const now = Date.now();
  if (since === null || now - since < AUTO_PAUSE_AFTER_MS) {
    return;
  }
  session.recorder.pause(now, true);
  set({ phase: "paused", auto: true });
  session.say(spokenWords().paused);
  session.onChange();
}

export type RunSession = {
  /** A fix from the GPS, for the track. During the countdown only the last
   * one is kept, and it becomes the run's first when the countdown ends. */
  onFix(fix: TrackFix, arrived: boolean): void;
  /** The pen is lifted at the end of a letter (TASK-198): a running run
   * pauses at `atMs`, and a pause by standing still becomes the pen's. A
   * pause of the runner's stays theirs. */
  liftPen(atMs: number): void;
  /** The next letter starts: the pen's pause ends at `atMs`. Any other
   * pause, the runner's above all, stays. */
  lowerPen(atMs: number): void;
  /** The run is left: the controls are free for the next one. */
  end(): void;
};

/**
 * Puts the run that `recorder` records under these controls until `end`.
 * A new run begins with the countdown; one taken up again goes on at once,
 * unless it comes with its pause still open: a run the app was closed
 * during waits for «Resume» (TASK-272, ADR-0240), and on a walk between two
 * letters for the next one too.
 * `onChange` is called when a control changed the track, `say` with what the
 * voice has to tell (it is the caller's to keep quiet when the voice is off).
 */
export function controlRun(
  recorder: RunRecorder,
  { onChange, say }: { onChange: () => void; say: (text: string) => void },
): RunSession {
  // One run at a time: a run still under the controls leaves them.
  if (session !== null) {
    if (session.countdown) {
      clearTimeout(session.countdown);
    }
    clearInterval(session.watch);
  }
  const fresh = recorder.track().fixes.length === 0;
  const held = fresh ? null : openPause(recorder.track());
  const mine: Session = {
    recorder,
    onChange,
    say,
    arrived: false,
    waiting: null,
    countdown: fresh ? setTimeout(skipCountdown, COUNTDOWN_MS) : null,
    watch: setInterval(watchStanding, AUTO_PAUSE_CHECK_MS),
  };
  session = mine;
  set({
    phase: fresh ? "countdown" : held !== null ? "paused" : "running",
    startsAtMs: fresh ? Date.now() + COUNTDOWN_MS : null,
    auto: false,
    pen: held?.pen === true,
  });
  return {
    onFix(fix, arrived) {
      if (session !== mine) {
        return;
      }
      if (state.phase === "countdown") {
        mine.waiting = fix;
        return;
      }
      recorder.onFix(fix, arrived);
      mine.arrived = mine.arrived || arrived;
      // Moving again ended the pause that standing still began.
      if (state.phase === "paused" && state.auto && !openPause(recorder.track())) {
        set({ phase: "running", auto: false });
        say(spokenWords().resumed);
      }
    },
    liftPen(atMs) {
      const running = state.phase === "running";
      const standing = state.phase === "paused" && state.auto;
      if (session !== mine || mine.arrived || !(running || standing)) {
        return;
      }
      recorder.liftPen(atMs);
      set({ phase: "paused", auto: false, pen: true });
      onChange();
    },
    lowerPen(atMs) {
      if (session !== mine || state.phase !== "paused" || !state.pen) {
        return;
      }
      recorder.lowerPen(atMs);
      set({ phase: "running", pen: false });
      onChange();
    },
    end() {
      if (mine.countdown) {
        clearTimeout(mine.countdown);
      }
      clearInterval(mine.watch);
      if (session === mine) {
        session = null;
        set({ phase: "idle", startsAtMs: null, auto: false, pen: false });
      }
    },
  };
}
