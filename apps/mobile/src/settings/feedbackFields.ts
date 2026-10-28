import { MAX_FEEDBACK_LENGTH, type PushPlatform } from "@shaperoute/shared-types";
import Constants from "expo-constants";
import { Platform } from "react-native";

import type { AccountOutcome } from "../api/accounts";
import { accountProblem } from "../account/messages";
import { t } from "../i18n";

/** What «Send feedback» checks before it sends (TASK-308). */
export type CheckedFeedback =
  { ok: true; text: string } | { ok: false; problem: string };

/** The message as the API keeps it, or what is wrong with it, in words. */
export function checkFeedback(written: string): CheckedFeedback {
  const text = written.trim();
  if (text.length === 0) {
    return { ok: false, problem: t("Write something first.") };
  }
  // The field stops at MAX_FEEDBACK_LENGTH: only a paste could go past it.
  return { ok: true, text: text.slice(0, MAX_FEEDBACK_LENGTH) };
}

type Config = typeof Constants.expoConfig;

/**
 * The app's version and build, like «1.0.0 (7)», as the email to the team
 * says it; the version alone without a build in the config, null without
 * a version.
 */
export function appVersion(
  config: Config = Constants.expoConfig,
  os: string = Platform.OS,
): string | null {
  const version = config?.version;
  if (!version) {
    return null;
  }
  const build =
    os === "ios"
      ? config?.ios?.buildNumber
      : os === "android"
        ? config?.android?.versionCode
        : undefined;
  return build === undefined || build === null ? version : `${version} (${build})`;
}

/** The phone's system, as the API names it; null elsewhere (the web). */
export function phoneSystem(os: string = Platform.OS): PushPlatform | null {
  return os === "ios" || os === "android" ? os : null;
}

type Failed = Exclude<AccountOutcome<null>, { kind: "ok" }>;

/** A message the API did not take, in words. */
export function feedbackProblem(failed: Failed): string {
  if (failed.kind === "api_error" && failed.code === "too_many_requests") {
    return t("You sent a lot of feedback today. Try again tomorrow.");
  }
  // An API older than TASK-308, as the reports say it (`../social/ReportMenu`).
  if (failed.kind === "api_error" && failed.code === "http_error") {
    return t("This is not available any more.");
  }
  return accountProblem(failed);
}
