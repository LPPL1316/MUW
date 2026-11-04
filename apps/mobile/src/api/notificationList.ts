import type { NotificationLine, NotificationsPage } from "@shaperoute/shared-types";

import { type AccountOutcome, ask } from "./accounts";
import { isPerson } from "./people";

/**
 * The bell's list (TASK-367 part C, ADR-0311): the calls of docs/API.md,
 * «The bell», with the session token. The body is
 * packages/shared-types/fixtures/notifications.json. A server of before has
 * neither: it answers 404, and `isBellMissing` says so.
 */

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** GET /notifications: the newest first; the next page `before` an id. */
export function fetchNotifications(
  baseUrl: string,
  token: string,
  before: number | null = null,
  options: Options = {},
): Promise<AccountOutcome<NotificationsPage>> {
  const query = before === null ? "" : `?before=${before}`;
  return ask(
    baseUrl,
    `/notifications${query}`,
    { method: "GET", token },
    isNotificationsPage,
    options,
  );
}

/** POST /notifications/read: read up to the line `upTo`, the newest shown. */
export function readNotifications(
  baseUrl: string,
  token: string,
  upTo: number,
  options: Options = {},
): Promise<AccountOutcome<null>> {
  return ask(
    baseUrl,
    "/notifications/read",
    { method: "POST", token, body: { up_to: upTo } },
    isNoBody,
    options,
  );
}

/** The server has no bell: an API older than TASK-367 part C. */
export function isBellMissing(outcome: AccountOutcome<unknown>): boolean {
  return (
    (outcome.kind === "api_error" && outcome.code === "http_error") ||
    (outcome.kind === "bad_answer" && outcome.status === 404)
  );
}

function isRecord(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null;
}

function isNoBody(body: unknown, status: number): body is null {
  return status === 204 && body === null;
}

export function isNotificationLine(body: unknown): body is NotificationLine {
  return (
    isRecord(body) &&
    typeof body.id === "number" &&
    typeof body.kind === "string" &&
    typeof body.text === "string" &&
    typeof body.at === "string" &&
    typeof body.read === "boolean" &&
    isPerson(body.actor) &&
    isRecord(body.opens) &&
    Object.values(body.opens).every((value) => typeof value === "string")
  );
}

export function isNotificationsPage(body: unknown): body is NotificationsPage {
  return (
    isRecord(body) &&
    Array.isArray(body.notifications) &&
    body.notifications.every(isNotificationLine) &&
    typeof body.unread === "number" &&
    (body.before === null || typeof body.before === "number")
  );
}
