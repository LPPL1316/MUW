import type { Session, User } from "@shaperoute/shared-types";
import { useCallback, useRef, useState } from "react";

import type { AccountOutcome } from "../api/accounts";
import {
  askPasswordReset,
  cancelEmailChange,
  fetchEmailService,
  sendConfirmationAgain,
} from "../api/accountEmail";
import { t, tLater } from "../i18n";
import { appLanguage } from "../i18n/language";
import { emailProblem } from "./fields";
import { accountProblem, NO_API, SESSION_ENDED, sessionEnded } from "./messages";

/**
 * The emails of the account (TASK-300, ADR-0261): whether the server sends
 * them, «Forgot password?», the link of confirmation again and the change
 * of address that waits dropped. The pages that show them ask the API
 * first, once in the life of the app (`check`): an API without them, or
 * older, answers 404 and the app shows none of it.
 */
export type AccountEmail = {
  /** GET /account-email answered 200. */
  on: boolean;
  /** GET /account-email, the first time only; `on` follows the answer. */
  check: () => void;
  /**
   * POST /password-reset: resolves to null once asked (the same whoever
   * has the address), or to what went wrong, in words.
   */
  askReset: (email: string) => Promise<string | null>;
  /** POST /me/email/confirmation: null once sent; as `askReset` otherwise. */
  sendAgain: () => Promise<string | null>;
  /** DELETE /me/email/pending: the account as the API keeps it now. */
  cancelChange: () => Promise<string | null>;
};

/** In English: where it is shown, `t(TOO_MANY_EMAILS)` (TASK-210). */
export const TOO_MANY_EMAILS = tLater(
  "Too many emails asked: wait a few minutes and try again.",
);

type Failed = Exclude<AccountOutcome<unknown>, { kind: "ok" }>;

/** An email request that failed, in words. */
export function emailsProblem(failed: Failed): string {
  return failed.kind === "api_error" && failed.code === "too_many_requests"
    ? t(TOO_MANY_EMAILS)
    : accountProblem(failed);
}

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** What useAccount lends: the session of now, its way to keep a changed
 * account, and its way out when the API says the session is over. */
type Lent = {
  session: () => Session | null;
  change: (
    request: (url: string, token: string) => Promise<AccountOutcome<User>>,
    problemOf: (failed: Failed) => string,
  ) => Promise<string | null>;
  ended: (token: string) => void;
};

export function useAccountEmail(
  baseUrl: string | null,
  { session, change, ended }: Lent,
  { fetchFn, key }: Options = {},
): AccountEmail {
  const [on, setOn] = useState(false);
  const asked = useRef(false);

  // Not when the app opens: a phone that never shows these pages asks
  // nothing more than before.
  const check = useCallback(() => {
    if (baseUrl === null || asked.current) {
      return;
    }
    asked.current = true;
    void fetchEmailService(baseUrl, { fetchFn, key }).then((outcome) =>
      setOn(outcome.kind === "ok"),
    );
  }, [baseUrl, fetchFn, key]);

  const askReset = useCallback(
    async (written: string) => {
      const email = written.trim();
      const problem = emailProblem(email);
      if (problem !== null) {
        return problem;
      }
      if (baseUrl === null) {
        return t(NO_API);
      }
      const outcome = await askPasswordReset(
        baseUrl,
        { email, language: appLanguage() },
        { fetchFn, key },
      );
      return outcome.kind === "ok" ? null : emailsProblem(outcome);
    },
    [baseUrl, fetchFn, key],
  );

  const sendAgain = useCallback(async () => {
    const now = session();
    if (now === null) {
      return t(SESSION_ENDED);
    }
    if (baseUrl === null) {
      return t(NO_API);
    }
    const outcome = await sendConfirmationAgain(baseUrl, now.token, { fetchFn, key });
    if (outcome.kind === "ok") {
      return null;
    }
    if (sessionEnded(outcome)) {
      ended(now.token);
    }
    return emailsProblem(outcome);
  }, [baseUrl, ended, fetchFn, key, session]);

  const cancelChange = useCallback(
    () =>
      change(
        (url, token) => cancelEmailChange(url, token, { fetchFn, key }),
        emailsProblem,
      ),
    [change, fetchFn, key],
  );

  return { on, check, askReset, sendAgain, cancelChange };
}
