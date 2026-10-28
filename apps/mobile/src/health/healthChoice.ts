import { File, Paths } from "expo-file-system";

/**
 * «Save to Apple Health» (or «Save to Health Connect») at the end of an
 * activity is said once (TASK-321, the user's choice, 2026-10-28): after
 * the yes every «Save» writes there too, with no switch. Kept on the phone,
 * as Strava's switch (`strava/stravaChoice.ts`). It is turned off in the
 * Health app or in Health Connect, never here: the permission is read
 * before every write.
 */

export const HEALTH_CHOICE_FILE = "health.json";

/** Whether the user said yes; no when never asked, or the file does not
 * read. */
export function loadHealthOn(): boolean {
  try {
    const file = new File(Paths.document, HEALTH_CHOICE_FILE);
    if (!file.exists) {
      return false;
    }
    const data: unknown = JSON.parse(file.textSync());
    return (
      typeof data === "object" && data !== null && "on" in data && data.on === true
    );
  } catch {
    return false;
  }
}

/** Keeps the yes; a phone that refuses keeps nothing, and the line asks
 * again at the next end of an activity. */
export function keepHealthOn(): void {
  try {
    const file = new File(Paths.document, HEALTH_CHOICE_FILE);
    file.create({ overwrite: true });
    file.write(JSON.stringify({ on: true }));
  } catch {
    // The permission sheet still opens.
  }
}
