import session from "@shaperoute/shared-types/fixtures/session.json";
import type { User } from "@shaperoute/shared-types";

import { SESSION_ENDED } from "../account/messages";
import {
  NO_NOTIFICATIONS,
  notificationsOf,
  notificationsProblem,
} from "./notificationFields";

const user = session.user as User;

function refused(code: "http_error" | "session_expired" | "accounts_unavailable") {
  return {
    kind: "api_error" as const,
    retryAfterS: null,
    code,
    message: "…",
    suggested_distance_m: null,
    reason: null,
  };
}

test("the switches of an account are what the API tells", () => {
  // «Email when I'm away» is on until turned off (TASK-284).
  expect(notificationsOf(user)).toEqual({ email: false, push: false, away: true });
  const on = { email: true, push: true };
  expect(notificationsOf({ ...user, notifications: on })).toEqual(on);
});

test("an account from an API older than TASK-185 has both off", () => {
  const { notifications: _notifications, ...before } = user;
  expect(notificationsOf(before)).toEqual({ email: false, push: false });
});

test("a switch that could not be kept is said in words", () => {
  // The published server, before TASK-185, has no such endpoint.
  expect(notificationsProblem(refused("http_error"))).toBe(NO_NOTIFICATIONS);
  expect(NO_NOTIFICATIONS).toBe("Notifications are not available on this API yet.");
  // The rest as every request of the account says it.
  expect(notificationsProblem(refused("session_expired"))).toBe(SESSION_ENDED);
  expect(notificationsProblem(refused("accounts_unavailable"))).toBe(
    "Accounts are not available right now. Try again later.",
  );
  expect(notificationsProblem({ kind: "unreachable", url: "http://api" })).toBe(
    "No connection. Check the network and try again. (Cannot reach the API at http://api.)",
  );
});
