import { Platform, TurboModuleRegistry } from "react-native";

import { appleHealthPhone, type HealthKitModule } from "./appleHealth";
import { healthConnectPhone, type HealthConnectModule } from "./healthConnect";
import type { HealthPhone } from "./healthPhone";

type AppleLibrary = typeof import("@kingstinct/react-native-healthkit");
type AndroidLibrary = typeof import("react-native-health-connect");

/**
 * Apple Health and Health Connect only where the build has their native
 * code (TASK-321, ADR-0281): the 1.0.1 for the iPhone, a new Android build.
 * Expo Go and today's builds have none (`react-native.config.js` keeps the
 * libraries out of linking), so there the libraries are never loaded, as
 * AdMob's (`ads/admob.ts`), and the end of an activity has no line for them.
 */

function appleHealth(): HealthPhone | null {
  // The HealthKit library is a Nitro module: without Nitro's native code,
  // loading it would throw.
  if (TurboModuleRegistry.get("NitroModules") === null) {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const library = require("@kingstinct/react-native-healthkit") as AppleLibrary;
    // What MuW uses of it, checked against the library's own types.
    const kit: HealthKitModule = library;
    return appleHealthPhone(kit);
  } catch {
    return null;
  }
}

function healthConnect(): HealthPhone | null {
  if (TurboModuleRegistry.get("HealthConnect") === null) {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const library = require("react-native-health-connect") as AndroidLibrary;
    const hc: HealthConnectModule = library;
    return healthConnectPhone(hc);
  } catch {
    return null;
  }
}

let shared: HealthPhone | null | undefined;

/** The phone's health data, made the first time; null without the native
 * module. */
export function healthPhone(): HealthPhone | null {
  if (shared === undefined) {
    shared =
      Platform.OS === "ios"
        ? appleHealth()
        : Platform.OS === "android"
          ? healthConnect()
          : null;
  }
  return shared;
}
