import type { Activity } from "@shaperoute/shared-types";
import { useCallback, useEffect, useState } from "react";

import type { Track } from "../navigation/trackRecorder";
import { keepHealthOn, loadHealthOn } from "./healthChoice";
import type { HealthPermission, HealthPhone } from "./healthPhone";
import { workoutOf } from "./workout";

/**
 * The line of Apple Health (or Health Connect) at the end of an activity
 * (TASK-321, ADR-0281):
 * - `hidden`: the phone has none, or the build has no native module;
 * - `ask`: before the user's yes, the button;
 * - `on`: every «Save» writes there;
 * - `refused`: the user said yes, the phone's permission says no.
 */
export type HealthLine = "hidden" | "ask" | "on" | "refused";

export type HealthState = {
  line: HealthLine;
  /** The phone's sheet is open. */
  asking: boolean;
  /** The button: the user's yes, then the phone's sheet. */
  turnOn: () => void;
};

/** The line once the user said yes, from the phone's permission. */
function lineOf(permission: HealthPermission): HealthLine {
  return permission === "allowed" ? "on" : permission === "refused" ? "refused" : "ask";
}

export function useHealth(phone: HealthPhone | null): HealthState {
  const [line, setLine] = useState<HealthLine>("hidden");
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (phone === null) {
      return;
    }
    let gone = false;
    void (async () => {
      try {
        if (!(await phone.available())) {
          return;
        }
        const next = loadHealthOn() ? lineOf(await phone.permission()) : "ask";
        if (!gone) {
          setLine(next);
        }
      } catch {
        // No line: the activity is saved as ever.
      }
    })();
    return () => {
      gone = true;
    };
  }, [phone]);

  const turnOn = useCallback(() => {
    if (phone === null || asking) {
      return;
    }
    keepHealthOn();
    setAsking(true);
    void (async () => {
      try {
        await phone.ask();
        setLine(lineOf(await phone.permission()));
      } catch {
        // The button stays, to try again.
      } finally {
        setAsking(false);
      }
    })();
  }, [phone, asking]);

  return { line, asking, turnOn };
}

/**
 * With «Save»: the activity also goes to the phone's health data, when the
 * user said yes and the permission, read now, still allows it (turned off
 * in the Health app or in Health Connect, it does not). Never fails «Save»:
 * true once written, false otherwise.
 */
export async function saveToHealth(
  phone: HealthPhone | null,
  track: Track,
  activity: Activity,
): Promise<boolean> {
  if (phone === null || !loadHealthOn()) {
    return false;
  }
  try {
    if (!(await phone.available()) || (await phone.permission()) !== "allowed") {
      return false;
    }
    const workout = workoutOf(track, activity);
    return workout !== null && (await phone.write(workout));
  } catch {
    return false;
  }
}
