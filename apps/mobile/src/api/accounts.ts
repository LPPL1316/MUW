import {
  type ApiError,
  type Session,
  type SignInRequest,
  type SignUpRequest,
  type User,
  USER_ROLES,
} from "@shaperoute/shared-types";

import { apiKey, keyHeaders } from "./apiUrl";
import { readsHeaders } from "./reads";
import { isApiError } from "./routes";

/**
 * Every way an account request can end (TASK-115). `retryAfterS` is the
 * API's Retry-After, in seconds, when it says how long to wait.
 */
export type AccountOutcome<T> =
  | { kind: "ok"; value: T }
  | ({ kind: "api_error"; retryAfterS: number | null } & ApiError["error"])
  | { kind: "unreachable"; url: string }
  | { kind: "bad_answer"; status: number };

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** How long a request of the account may take before it counts as an API
 * that cannot be reached (TASK-252): a connection that accepts and then
 * stays silent would otherwise hold the page that asked for good. */
export const ASK_TIMEOUT_MS = 30_000;
/** A PUT may carry a whole run or a picture, and sending it twice changes
 * nothing: it is given longer. */
export const PUT_TIMEOUT_MS = 90_000;

/** The header that carries the session token (ADR-0120). */
export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** POST /accounts: signing up also signs in (docs/API.md, «Account»). */
export function signUp(
  baseUrl: string,
  request: SignUpRequest,
  options: Options = {},
): Promise<AccountOutcome<Session>> {
  return ask(
    baseUrl,
    "/accounts",
    { method: "POST", body: request },
    isSession,
    options,
  );
}

/** POST /session: the same answer as signing up. */
export function signIn(
  baseUrl: string,
  request: SignInRequest,
  options: Options = {},
): Promise<AccountOutcome<Session>> {
  return ask(
    baseUrl,
    "/session",
    { method: "POST", body: request },
    isSession,
    options,
  );
}

/** DELETE /session: signs out this phone only. */
export function signOut(
  baseUrl: string,
  token: string,
  options: Options = {},
): Promise<AccountOutcome<null>> {
  return ask(baseUrl, "/session", { method: "DELETE", token }, isEmpty, options);
}

/** GET /me: who the token belongs to, while its session lasts. */
export function fetchMe(
  baseUrl: string,
  token: string,
  options: Options = {},
): Promise<AccountOutcome<User>> {
  return ask(baseUrl, "/me", { method: "GET", token }, isUser, options);
}

/** DELETE /me: the account and everything that is its own, at once. */
export function deleteAccount(
  baseUrl: string,
  token: string,
  options: Options = {},
): Promise<AccountOutcome<null>> {
  return ask(baseUrl, "/me", { method: "DELETE", token }, isEmpty, options);
}

/**
 * One request of the account, or in its name with `token` (the favorites,
 * src/api/favorites.ts). Never throws. Every one says what this app reads
 * (reads.ts, TASK-387): the API sends no activity it cannot show.
 */
export async function ask<T>(
  baseUrl: string,
  path: string,
  { method, body, token }: { method: string; body?: unknown; token?: string },
  accept: (body: unknown, status: number) => body is T,
  { fetchFn = fetch, key = apiKey() }: Options,
): Promise<AccountOutcome<T>> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    method === "PUT" ? PUT_TIMEOUT_MS : ASK_TIMEOUT_MS,
  );
  let response: Response;
  let answer: unknown;
  try {
    response = await fetchFn(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...keyHeaders(key),
        ...readsHeaders(),
        ...(token === undefined ? {} : authHeaders(token)),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    // A 204 has no body: reading it as JSON fails, and that is no answer.
    answer =
      response.status === 204 ? null : await response.json().catch(() => undefined);
  } catch {
    return { kind: "unreachable", url: baseUrl };
  } finally {
    clearTimeout(timer);
  }
  // Cut while its body was still coming: no answer either.
  if (controller.signal.aborted) {
    return { kind: "unreachable", url: baseUrl };
  }
  if (response.ok && accept(answer, response.status)) {
    return { kind: "ok", value: answer };
  }
  return !response.ok && isApiError(answer)
    ? { kind: "api_error", ...answer.error, retryAfterS: retryAfterOf(response) }
    : { kind: "bad_answer", status: response.status };
}

/** Retry-After in seconds; the API never sends it as a date. */
function retryAfterOf(response: Response): number | null {
  const seconds = Number(response.headers.get("Retry-After") ?? undefined);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function isEmpty(body: unknown, status: number): body is null {
  return status === 204 && body === null;
}

export function isSession(body: unknown): body is Session {
  return (
    isRecord(body) &&
    typeof body.token === "string" &&
    body.token !== "" &&
    isUser(body.user)
  );
}

export function isUser(body: unknown): body is User {
  return (
    isRecord(body) &&
    typeof body.id === "number" &&
    typeof body.email === "string" &&
    typeof body.username === "string" &&
    (USER_ROLES as readonly unknown[]).includes(body.role) &&
    typeof body.created_at === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
