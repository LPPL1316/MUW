import type {
  AccountEmailService,
  PasswordResetRequest,
  User,
} from "@shaperoute/shared-types";

import { type AccountOutcome, ask, isUser } from "./accounts";

/**
 * The emails of an account (TASK-300, docs/API.md, «Confirmed email and
 * forgotten password»): whether the server sends them, a new password asked
 * for without an account, the link of confirmation again, and the change
 * of address that waits dropped. An API without these emails, or older
 * than TASK-300, has none of them: `http_error`.
 */

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** GET /account-email: 200 when the server sends these emails. */
export function fetchEmailService(
  baseUrl: string,
  options: Options = {},
): Promise<AccountOutcome<AccountEmailService>> {
  return ask(baseUrl, "/account-email", { method: "GET" }, isService, options);
}

/** POST /password-reset: the same answer whoever has the address. */
export async function askPasswordReset(
  baseUrl: string,
  request: PasswordResetRequest,
  options: Options = {},
): Promise<AccountOutcome<null>> {
  const outcome = await ask(
    baseUrl,
    "/password-reset",
    { method: "POST", body: request },
    isAccepted,
    options,
  );
  return outcome.kind === "ok" ? { kind: "ok", value: null } : outcome;
}

/**
 * POST /me/email/confirmation: "sent" (202), or "nothing" left to confirm
 * (204, no email).
 */
export async function sendConfirmationAgain(
  baseUrl: string,
  token: string,
  options: Options = {},
): Promise<AccountOutcome<"sent" | "nothing">> {
  const outcome = await ask(
    baseUrl,
    "/me/email/confirmation",
    { method: "POST", token },
    (body, status): body is unknown => status === 202 || status === 204,
    options,
  );
  if (outcome.kind !== "ok") {
    return outcome;
  }
  // A 204 reads as null; a 202 has no JSON at all.
  return { kind: "ok", value: outcome.value === null ? "nothing" : "sent" };
}

/** DELETE /me/email/pending: the account without the address that waits. */
export function cancelEmailChange(
  baseUrl: string,
  token: string,
  options: Options = {},
): Promise<AccountOutcome<User>> {
  return ask(
    baseUrl,
    "/me/email/pending",
    { method: "DELETE", token },
    isUser,
    options,
  );
}

function isService(body: unknown): body is AccountEmailService {
  return typeof body === "object" && body !== null && "on" in body && body.on === true;
}

/** A 202 has no body to read. */
function isAccepted(body: unknown, status: number): body is unknown {
  return status === 202;
}
