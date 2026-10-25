import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { t } from "../i18n";
import { color } from "../theme/tokens";

/**
 * The phone's position during a run, also with the app in the background
 * (TASK-261, ADR-0225). On iOS the positions go to a task of
 * expo-task-manager, started while the app is in front: Core Location then
 * goes on with the phone locked or another app over MuW, with the permission
 * «While using» only, and iOS shows its blue bar. On Android the same task
 * runs in a foreground service (TASK-294): with «While using» too, and
 * Android shows its notification for as long as the run is on. Where that
 * cannot be (Expo Go, an app built without the background mode or the
 * service) the GPS is followed in the foreground only, as before TASK-261.
 */

/** The task iOS hands the run's positions to. */
export const RUN_LOCATION_TASK = "muw-run-location";

type OnPosition = (position: Location.LocationObject) => void;

export type RunWatch = {
  /** Whether the positions go on with the app in the background. */
  background: boolean;
  remove(): void;
};

/** The run the positions are for: one at a time, as the run file. */
let current: { onPosition: OnPosition } | null = null;

/** Starting and stopping the task, one after the other: a stop asked for
 * a run that ended never lands after the start of the next one. */
let turn: Promise<unknown> = Promise.resolve();

function inTurn<T>(step: () => Promise<T>): Promise<T> {
  const next = turn.then(step, step);
  turn = next.catch(() => undefined);
  return next;
}

/** Stops the task unless a run wants it again. */
async function stopUnwanted(): Promise<void> {
  if (current !== null) {
    return;
  }
  try {
    await Location.stopLocationUpdatesAsync(RUN_LOCATION_TASK);
  } catch {
    // Not started, or already stopped: as good as stopped.
  }
}

// Defined when the app loads, as expo-task-manager asks: iOS may hand it
// positions before any screen is drawn.
TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(
  RUN_LOCATION_TASK,
  async ({ data, error }) => {
    if (error !== null || data === null || data === undefined) {
      return;
    }
    const run = current;
    if (run === null) {
      // Positions for no run (the app closed during one, and iOS started
      // the task again): nothing wants them, and they cost battery.
      void inTurn(stopUnwanted);
      return;
    }
    for (const position of data.locations ?? []) {
      run.onPosition(position);
    }
  },
);

/** Whether this app can follow the GPS in the background. */
async function backgroundAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return false;
  }
  try {
    return (
      (await Location.isBackgroundLocationAvailableAsync()) &&
      (await TaskManager.isAvailableAsync())
    );
  } catch {
    return false;
  }
}

/** How the task follows the GPS, on top of the run's `options`. */
function backgroundOptions(): Location.LocationTaskOptions {
  if (Platform.OS === "android") {
    return {
      // Android follows the GPS with the app behind only from a service of
      // its own, shown as a notification: no «Allow all the time» needed.
      foregroundService: {
        notificationTitle: t("MuW is recording your activity"),
        notificationBody: t("It keeps going with the screen locked, voice included."),
        notificationColor: color.accent,
        // The app closed by hand ends the GPS with it: the run reopens
        // paused when the app comes back (TASK-272).
        killServiceOnDestroy: true,
      },
    };
  }
  return {
    // A run, a ride or a paddle: the phone keeps the GPS on for it.
    activityType: Location.ActivityType.Fitness,
    // Standing still at a light is still the run: iOS must not stop the GPS
    // by itself, or it would not start it again in the background.
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  };
}

/**
 * Follows the phone's position for a run with `options` (accuracy, metres
 * between two positions), calling `onPosition` with each one in the order
 * the GPS gave them, until `remove`. In the background as well when the app
 * can; otherwise as `watchPositionAsync` does, in the foreground only.
 */
export async function watchRunPosition(
  options: Location.LocationOptions,
  onPosition: OnPosition,
): Promise<RunWatch> {
  if (await backgroundAvailable()) {
    const mine = { onPosition };
    current = mine;
    const started = await inTurn(async () => {
      if (current !== mine) {
        return false;
      }
      try {
        await Location.startLocationUpdatesAsync(RUN_LOCATION_TASK, {
          ...options,
          ...backgroundOptions(),
        });
        return true;
      } catch {
        return false;
      }
    });
    if (started) {
      return {
        background: true,
        remove: () => {
          if (current === mine) {
            current = null;
            void inTurn(stopUnwanted);
          }
        },
      };
    }
    if (current === mine) {
      current = null;
    }
  }
  const subscription = await Location.watchPositionAsync(options, onPosition);
  return { background: false, remove: () => subscription.remove() };
}
