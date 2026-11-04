import { useSyncExternalStore } from "react";

import { appBody, type BodyProfile, subscribeBody } from "./bodyProfile";

/**
 * The runner's body, and a new render each time «Body» in «Settings»
 * changes it (TASK-374): the calories on the screen follow at once.
 */
export function useBody(): BodyProfile {
  return useSyncExternalStore(subscribeBody, appBody);
}
