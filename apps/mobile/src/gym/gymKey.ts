/**
 * The key of a workout at the gym on the API (TASK-385 part B): made once,
 * when it begins, so a «Save» sent twice is the same workout. A run's key
 * comes from its first fix (activityKey.ts); a workout has none, so it is
 * its start in base 36 and eight random letters or digits, within the
 * API's `^[a-z0-9]{8,40}$`.
 */
export function gymKey(startedMs: number, random: () => number = Math.random): string {
  let tail = "";
  for (let i = 0; i < 8; i += 1) {
    tail += Math.floor(random() * 36)
      .toString(36)
      .slice(-1);
  }
  return `${Math.max(0, Math.floor(startedMs)).toString(36)}${tail}`;
}
