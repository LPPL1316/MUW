import type {
  LocationForSaving,
  ObjectTypeIdentifier,
  QuantitySampleForSaving,
  SampleTypeIdentifierWriteable,
  WorkoutActivityType,
} from "@kingstinct/react-native-healthkit";

import { appleWorkout, DISTANCE_TYPE, ENERGY_TYPE } from "./appleWorkout";
import type { HealthPhone } from "./healthPhone";

/**
 * Apple Health on the iPhone (TASK-321, ADR-0281), through
 * `@kingstinct/react-native-healthkit`: what of it MuW uses. MuW only
 * writes; it never asks to read.
 */
export type HealthKitModule = {
  isHealthDataAvailable(): boolean;
  isObjectTypeAvailable(type: ObjectTypeIdentifier): boolean;
  requestAuthorization(request: {
    toShare: SampleTypeIdentifierWriteable[];
  }): Promise<boolean>;
  /** HKAuthorizationStatus: 0 not asked, 1 denied, 2 allowed. */
  authorizationStatusFor(type: ObjectTypeIdentifier): number;
  saveWorkoutSample(
    activityType: WorkoutActivityType,
    quantities: readonly QuantitySampleForSaving[],
    startDate: Date,
    endDate: Date,
    totals: { distance: number; energyBurned?: number },
    metadata: {
      HKSyncIdentifier: string;
      HKSyncVersion: number;
      HKIndoorWorkout: boolean;
    },
  ): Promise<{
    saveWorkoutRoute(locations: readonly LocationForSaving[]): Promise<boolean>;
  }>;
};

const WORKOUT = "HKWorkoutTypeIdentifier";
const ROUTE = "HKWorkoutRouteTypeIdentifier";
const SHARING_DENIED = 1;
const SHARING_AUTHORIZED = 2;

/** What the sheet asks to write: the workout, its route, the distance of
 * every activity and the energy of a run. */
const TO_SHARE: readonly SampleTypeIdentifierWriteable[] = [
  WORKOUT,
  ROUTE,
  ...new Set(Object.values(DISTANCE_TYPE)),
  ENERGY_TYPE,
];

export function appleHealthPhone(kit: HealthKitModule): HealthPhone {
  // A type the phone has not got (paddling's distance before iOS 18) is
  // neither asked for nor written.
  const allowed = (type: ObjectTypeIdentifier) =>
    kit.isObjectTypeAvailable(type) &&
    kit.authorizationStatusFor(type) === SHARING_AUTHORIZED;
  return {
    store: "apple",
    available: async () => kit.isHealthDataAvailable(),
    permission: async () => {
      const status = kit.authorizationStatusFor(WORKOUT);
      return status === SHARING_AUTHORIZED
        ? "allowed"
        : status === SHARING_DENIED
          ? "refused"
          : "unasked";
    },
    ask: async () => {
      await kit.requestAuthorization({
        toShare: TO_SHARE.filter((type) => kit.isObjectTypeAvailable(type)),
      });
    },
    write: async (workout) => {
      if (!allowed(WORKOUT)) {
        return false;
      }
      const apple = appleWorkout(workout);
      // Each kind of data can be turned off on its own in the Health app.
      const saved = await kit.saveWorkoutSample(
        apple.activityType,
        apple.quantities.filter((sample) => allowed(sample.quantityType)),
        apple.startDate,
        apple.endDate,
        apple.totals,
        apple.metadata,
      );
      if (apple.locations.length > 1 && allowed(ROUTE)) {
        await saved.saveWorkoutRoute(apple.locations);
      }
      return true;
    },
  };
}
