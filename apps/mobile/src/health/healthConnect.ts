import type { HealthConnectRecord } from "react-native-health-connect";

import { healthConnectWorkout } from "./healthConnectWorkout";
import type { HealthPhone } from "./healthPhone";

/**
 * Health Connect on Android (TASK-321, ADR-0281), through
 * `react-native-health-connect`: what of it MuW uses. MuW only writes; it
 * never asks to read.
 */

type Permission = { accessType: "read" | "write"; recordType: string };

export type HealthConnectModule = {
  /** SdkAvailabilityStatus: 3 when Health Connect is there. */
  getSdkStatus(): Promise<number>;
  initialize(): Promise<boolean>;
  requestPermission(permissions: Permission[]): Promise<Permission[]>;
  getGrantedPermissions(): Promise<Permission[]>;
  insertRecords(records: HealthConnectRecord[]): Promise<string[]>;
};

const SDK_AVAILABLE = 3;

/** To write the session, its route, its distance and a run's calories. */
const TO_WRITE: Permission[] = [
  { accessType: "write", recordType: "ExerciseSession" },
  { accessType: "write", recordType: "ExerciseRoute" },
  { accessType: "write", recordType: "Distance" },
  { accessType: "write", recordType: "ActiveCaloriesBurned" },
];

export function healthConnectPhone(hc: HealthConnectModule): HealthPhone {
  // Health Connect wants `initialize` once, before anything else.
  let ready: Promise<boolean> | null = null;
  const isReady = () => {
    ready ??= (async () =>
      (await hc.getSdkStatus()) === SDK_AVAILABLE && (await hc.initialize()))().catch(
      () => false,
    );
    return ready;
  };
  const granted = async () => {
    const permissions = await hc.getGrantedPermissions();
    return (recordType: string) =>
      permissions.some(
        (permission) =>
          permission.accessType === "write" && permission.recordType === recordType,
      );
  };
  return {
    store: "healthConnect",
    available: isReady,
    // Health Connect does not tell a «no» from a sheet never shown: the
    // line asks only before the user's yes, so after it a no is a no.
    permission: async () =>
      (await isReady()) && (await granted())("ExerciseSession") ? "allowed" : "refused",
    ask: async () => {
      if (await isReady()) {
        await hc.requestPermission(TO_WRITE);
      }
    },
    write: async (workout) => {
      if (!(await isReady())) {
        return false;
      }
      const may = await granted();
      if (!may("ExerciseSession")) {
        return false;
      }
      const { session, distance, calories } = healthConnectWorkout(workout);
      // Each kind of data can be turned off on its own in Health Connect.
      const { exerciseRoute, ...withoutRoute } = session;
      await hc.insertRecords([
        may("ExerciseRoute") &&
        exerciseRoute !== undefined &&
        exerciseRoute.route.length > 1
          ? session
          : withoutRoute,
      ]);
      if (distance !== null && may("Distance")) {
        await hc.insertRecords([distance]);
      }
      if (calories !== null && may("ActiveCaloriesBurned")) {
        await hc.insertRecords([calories]);
      }
      return true;
    },
  };
}
