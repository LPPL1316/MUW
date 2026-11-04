import * as Updates from "expo-updates";

/**
 * The EAS Update channel this copy of the app takes its updates from:
 * `"preview"` on the testers' build, `"production"` on the stores', and
 * `null` in Expo Go or a development build, which take none.
 */
export function updateChannel(): string | null {
  return Updates.channel;
}

/**
 * Whether this copy is the testers' preview: a thing meant for a test
 * (TASK-351's reason under the yellow video) shows there and never on the
 * stores' build, because `main` goes to production with other work before
 * such a thing is taken out.
 */
export function isPreview(channel: string | null = updateChannel()): boolean {
  return channel === "preview";
}
