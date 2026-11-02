import { requireOptionalNativeModule } from "expo";

/**
 * A light touch of the phone under the finger (TASK-361): a shape picked in
 * «Draw», a step of the distance. expo-haptics is loaded only when it is
 * used, and only in an app built with it, as expo-contacts is
 * (`contacts/phoneContacts.ts`): Expo Go has it, the store's 1.0 does not,
 * and there nothing happens. Never an error: a phone that cannot buzz is
 * no problem of the runner's.
 */

type ExpoHaptics = typeof import("expo-haptics");

/** expo-haptics' native module (expo-haptics/src/ExpoHaptics.ts). */
const NATIVE_MODULE = "ExpoHaptics";

/** Whether this app was built with expo-haptics. */
export function hapticsAvailable(): boolean {
  try {
    return requireOptionalNativeModule(NATIVE_MODULE) !== null;
  } catch {
    return false;
  }
}

/** expo-haptics, loaded at its first use; null in an app built without it. */
function expoHaptics(): ExpoHaptics | null {
  if (!hapticsAvailable()) {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-haptics") as ExpoHaptics;
}

/** A choice made: a shape, a switch. */
export function selectionFeel(): void {
  const haptics = expoHaptics();
  haptics?.selectionAsync().catch(() => {});
}

/** One step of a stepper: lighter than a choice, it may come many times. */
export function stepFeel(): void {
  const haptics = expoHaptics();
  haptics?.impactAsync(haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
