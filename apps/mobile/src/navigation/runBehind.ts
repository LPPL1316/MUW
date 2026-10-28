import { useSyncExternalStore } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { useRunControl } from "./runControl";

function watchApp(onChange: () => void): () => void {
  const watching = AppState.addEventListener("change", onChange);
  return () => watching.remove();
}

/** Out of a run nothing is watched. */
function watchNothing(): () => void {
  return () => {};
}

function appState(): AppStateStatus {
  return AppState.currentState;
}

/**
 * Whether a run is on with the app in the background, behind the camera
 * say (TASK-304, ADR-0264). The map is not drawn then: MuW asks less of the
 * phone, so iOS is less likely to close it and stop the GPS, and the map
 * draws nothing nobody sees. «inactive» (Control Center, a notification
 * pulled down) is not behind: the map stays. Watched only during a run.
 */
export function useRunBehind(): boolean {
  const running = useRunControl().phase !== "idle";
  const state = useSyncExternalStore(
    running ? watchApp : watchNothing,
    appState,
    appState,
  );
  return running && state === "background";
}
