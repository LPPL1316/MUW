import type { Notifications, User } from "@shaperoute/shared-types";

import { accountProblem } from "../account/messages";
import type { AccountOutcome } from "../api/accounts";
import { t, tLater } from "../i18n";

/**
 * What the notification switches of «Settings» read and say
 * (TASK-185, ADR-0206, docs/API.md, «Notifications»).
 */

type Failed = Exclude<AccountOutcome<unknown>, { kind: "ok" }>;

/** An API older than TASK-185 has no PUT /me/notifications. Shown with `t()`. */
export const NO_NOTIFICATIONS = tLater(
  "Notifications are not available on this API yet.",
);

/** «Push notifications» turned on, and the phone refuses them (TASK-262).
 * Shown with `t()`, above «Open Settings». */
export const PUSH_NOT_ALLOWED = tLater(
  "Notifications are off for MuW on this phone. Allow them in Settings to turn this on.",
);

/** An account that never touched its switches: email and push off, «Email
 * when I'm away» on (TASK-284). */
const UNTOUCHED: Required<Notifications> = { email: false, push: false, away: true };

/** The switches of an account; an API older than TASK-185 tells none, one
 * older than TASK-284 no `away`: as never touched. */
export function notificationsOf(user: User): Required<Notifications> {
  return { ...UNTOUCHED, ...user.notifications };
}

/** A switch that could not be kept, in words (docs/UI.md), as a change of
 * email or phone number says it (`contactProblem`). */
export function notificationsProblem(failed: Failed): string {
  if (failed.kind === "api_error" && failed.code === "http_error") {
    return t(NO_NOTIFICATIONS);
  }
  return accountProblem(failed);
}
