import type {
  ChangeEmailRequest,
  ChangePhoneRequest,
  EditProfileRequest,
  NotificationsRequest,
  Session,
  User,
} from "@shaperoute/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  type AccountOutcome,
  deleteAccount as deleteRequest,
  fetchMe,
  signIn as signInRequest,
  signOut as signOutRequest,
  signUp as signUpRequest,
} from "../api/accounts";
import {
  changeEmail as emailRequest,
  changePhone as phoneRequest,
} from "../api/contact";
import { changeNotifications as notificationsRequest } from "../api/notifications";
import { editProfile as editRequest } from "../api/profiles";
import { forgetPushToken } from "../api/pushToken";
import { forgetPushSent, loadPushSent } from "../notifications/pushSent";
import { forgetOutboxOf } from "../activities/outbox";
import { t } from "../i18n";
import { profileProblem } from "../profile/profileFields";
import { contactProblem } from "../settings/contactFields";
import { notificationsProblem } from "../settings/notificationFields";
import { forgetDrawingsOf } from "../social/drawingOutbox";
import { forgetStravaOf } from "../strava/stravaOutbox";
import {
  type Checked,
  checkSignIn,
  checkSignUp,
  type SignInFields,
  type SignUpFields,
} from "./fields";
import { accountProblem, NO_API, SESSION_ENDED, sessionEnded } from "./messages";
import { type AccountEmail, useAccountEmail } from "./accountEmail";
import { forgetSession, loadSession, saveSession } from "./sessionStore";

/**
 * Who is signed in on this phone (TASK-115). Signed out, a notice may say
 * why: the session ended on the API (log in again), the account was
 * deleted, or "Log out" was tapped.
 */
export type AccountState =
  | { status: "signedIn"; session: Session }
  | { status: "signedOut"; notice: SignedOutNotice | null };

export type SignedOutNotice = "ended" | "deleted" | "loggedOut";

/** The request on its way, so a second tap does not send it again. */
export type Busy = "signUp" | "signIn" | "delete" | null;

export type Account = {
  state: AccountState;
  busy: Busy;
  /** The last request that failed, in words; null once another starts. */
  problem: string | null;
  signUp: (fields: SignUpFields) => void;
  signIn: (fields: SignInFields) => void;
  signOut: () => void;
  deleteAccount: () => void;
  /**
   * PATCH /me (TASK-116): the new username and bio. Resolves to null once
   * the API kept them and the account shows them, or to what went wrong,
   * in words; the page that asked says it, not `problem`.
   */
  editProfile: (changes: EditProfileRequest) => Promise<string | null>;
  /**
   * PUT /me/email (TASK-183): the new address, with the password of the
   * account. Resolves as `editProfile` does.
   */
  changeEmail: (request: ChangeEmailRequest) => Promise<string | null>;
  /**
   * PUT /me/phone (TASK-183): the phone number, or null for none. Resolves
   * as `editProfile` does.
   */
  changePhone: (request: ChangePhoneRequest) => Promise<string | null>;
  /**
   * PUT /me/notifications (TASK-185): the notification switches that
   * change. With «Push notifications» on, the API sends push notifications
   * (TASK-262); with «Email notifications» on, one email a day at most
   * (TASK-262 B); «Email when I'm away» (TASK-284) is on until turned off.
   * Resolves as `editProfile` does.
   */
  changeNotifications: (request: NotificationsRequest) => Promise<string | null>;
  clearProblem: () => void;
  /**
   * A request sent with `token` elsewhere in the app (the favorites) was
   * answered «the session is over»: the account signs out here too.
   */
  sessionEnded: (token: string) => void;
  /**
   * The emails of the account (TASK-300): «Forgot password?», the link of
   * confirmation again, the change of address dropped. Left out by the
   * pages' tests that build an Account by hand: then none of it shows.
   */
  email?: AccountEmail;
};

type Options = { fetchFn?: typeof fetch; key?: string | null };

type Failed = Exclude<AccountOutcome<User>, { kind: "ok" }>;

function keptState(): AccountState {
  const session = loadSession();
  return session === null
    ? { status: "signedOut", notice: null }
    : { status: "signedIn", session };
}

/**
 * The account of the app: kept in the keychain between openings, checked
 * once with the API when the app opens. Without an account nothing else in
 * the app changes.
 */
export function useAccount(baseUrl: string | null, options: Options = {}): Account {
  const [state, setState] = useState<AccountState>(keptState);
  const [busy, setBusy] = useState<Busy>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // Read by the answers that arrive later: the state they were asked in
  // may be gone. Every change goes through `put`, which keeps it.
  const current = useRef(state);
  const put = useCallback((next: AccountState) => {
    current.current = next;
    setState(next);
  }, []);
  const busyNow = useRef<Busy>(null);
  // The fake fetch of the tests; the same for the whole life of the app.
  const { fetchFn, key } = options;

  /** The API says the session is over: sign out here too, and say so. */
  const ended = useCallback(
    (token: string) => {
      const now = current.current;
      if (now.status === "signedIn" && now.session.token === token) {
        void forgetSession();
        put({ status: "signedOut", notice: "ended" });
      }
    },
    [put],
  );

  // When the app opens with a session, the API says whether it still holds
  // (90 days from its last use) and who it is now. Without an answer the
  // app stays signed in: offline is not signed out.
  useEffect(() => {
    const opened = current.current;
    if (baseUrl === null || opened.status !== "signedIn") {
      return;
    }
    const { token } = opened.session;
    void fetchMe(baseUrl, token, { fetchFn, key }).then((outcome) => {
      const now = current.current;
      if (outcome.kind === "ok") {
        if (now.status === "signedIn" && now.session.token === token) {
          const session = { token, user: outcome.value };
          void saveSession(session);
          put({ status: "signedIn", session });
        }
      } else if (sessionEnded(outcome)) {
        ended(token);
      }
    });
    // Once, when the app opens: later requests find out by their answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Sign up or log in: both answer with a session. */
  const enter = useCallback(
    async <T>(
      kind: "signUp" | "signIn",
      checked: Checked<T>,
      request: (url: string, body: T) => Promise<AccountOutcome<Session>>,
    ) => {
      if (busyNow.current !== null) {
        return;
      }
      if (!checked.ok) {
        setProblem(checked.problem);
        return;
      }
      if (baseUrl === null) {
        setProblem(t(NO_API));
        return;
      }
      busyNow.current = kind;
      setBusy(kind);
      setProblem(null);
      const outcome = await request(baseUrl, checked.request);
      busyNow.current = null;
      setBusy(null);
      if (outcome.kind !== "ok") {
        setProblem(accountProblem(outcome));
        return;
      }
      // Kept before it shows: a session on screen is one the next opening has.
      await saveSession(outcome.value);
      put({ status: "signedIn", session: outcome.value });
    },
    [baseUrl, put],
  );

  const signUp = useCallback(
    (fields: SignUpFields) =>
      void enter("signUp", checkSignUp(fields), (url, body) =>
        signUpRequest(url, body, { fetchFn, key }),
      ),
    [enter, fetchFn, key],
  );

  const signIn = useCallback(
    (fields: SignInFields) =>
      void enter("signIn", checkSignIn(fields), (url, body) =>
        signInRequest(url, body, { fetchFn, key }),
      ),
    [enter, fetchFn, key],
  );

  // Out at once, even offline: the phone forgets the token, and the API is
  // told when it can be reached (its session would end in 90 days anyway).
  const signOut = useCallback(() => {
    const now = current.current;
    if (now.status !== "signedIn" || busyNow.current !== null) {
      return;
    }
    void forgetSession();
    setProblem(null);
    put({ status: "signedOut", notice: "loggedOut" });
    // This phone's push token first (TASK-262): its session is still open,
    // and the account is notified here no more.
    const sent = loadPushSent();
    void forgetPushSent();
    if (baseUrl !== null) {
      const { token, user } = now.session;
      void (async () => {
        if (sent !== null && sent.userId === user.id) {
          await forgetPushToken(baseUrl, token, sent.token, { fetchFn, key });
        }
        await signOutRequest(baseUrl, token, { fetchFn, key });
      })();
    }
  }, [baseUrl, fetchFn, key, put]);

  // Only with the API's yes: an account the phone forgot but the API kept
  // would not be deleted at all.
  const deleteAccount = useCallback(async () => {
    const now = current.current;
    if (now.status !== "signedIn" || busyNow.current !== null) {
      return;
    }
    if (baseUrl === null) {
      setProblem(t(NO_API));
      return;
    }
    const { token, user } = now.session;
    busyNow.current = "delete";
    setBusy("delete");
    setProblem(null);
    const outcome = await deleteRequest(baseUrl, token, { fetchFn, key });
    busyNow.current = null;
    setBusy(null);
    if (outcome.kind === "ok") {
      // What waited on this phone for the account goes with it (TASK-252):
      // its runs not sent yet, and what was to follow them to Strava and to
      // «Public». Nobody will sign in to send them.
      forgetOutboxOf(user.id);
      forgetStravaOf(user.id);
      forgetDrawingsOf(user.id);
      // The API deleted its push tokens with it (TASK-262).
      await forgetPushSent();
      await forgetSession();
      put({ status: "signedOut", notice: "deleted" });
    } else if (sessionEnded(outcome)) {
      ended(token);
    } else {
      setProblem(accountProblem(outcome));
    }
  }, [baseUrl, ended, fetchFn, key, put]);

  // The account as the API answers, kept like a sign-in: the next opening
  // has it, and every page shows it at once. What went wrong comes back in
  // words, for the page that asked.
  const change = useCallback(
    async (
      request: (url: string, token: string) => Promise<AccountOutcome<User>>,
      problemOf: (failed: Failed) => string,
    ): Promise<string | null> => {
      const now = current.current;
      if (now.status !== "signedIn") {
        return t(SESSION_ENDED);
      }
      if (baseUrl === null) {
        return t(NO_API);
      }
      const { token } = now.session;
      const outcome = await request(baseUrl, token);
      if (outcome.kind !== "ok") {
        if (sessionEnded(outcome)) {
          ended(token);
        }
        return problemOf(outcome);
      }
      const latest = current.current;
      if (latest.status === "signedIn" && latest.session.token === token) {
        const session = { token, user: outcome.value };
        await saveSession(session);
        put({ status: "signedIn", session });
      }
      return null;
    },
    [baseUrl, ended, put],
  );

  const editProfile = useCallback(
    (changes: EditProfileRequest) =>
      change(
        (url, token) => editRequest(url, token, changes, { fetchFn, key }),
        profileProblem,
      ),
    [change, fetchFn, key],
  );

  const changeEmail = useCallback(
    (request: ChangeEmailRequest) =>
      change(
        (url, token) => emailRequest(url, token, request, { fetchFn, key }),
        (failed) => contactProblem(failed, "email"),
      ),
    [change, fetchFn, key],
  );

  const changePhone = useCallback(
    (request: ChangePhoneRequest) =>
      change(
        (url, token) => phoneRequest(url, token, request, { fetchFn, key }),
        (failed) => contactProblem(failed, "phone"),
      ),
    [change, fetchFn, key],
  );

  const changeNotifications = useCallback(
    (request: NotificationsRequest) =>
      change(
        (url, token) => notificationsRequest(url, token, request, { fetchFn, key }),
        notificationsProblem,
      ),
    [change, fetchFn, key],
  );

  const clearProblem = useCallback(() => setProblem(null), []);

  const sessionNow = useCallback(() => {
    const now = current.current;
    return now.status === "signedIn" ? now.session : null;
  }, []);
  const email = useAccountEmail(
    baseUrl,
    { session: sessionNow, change, ended },
    { fetchFn, key },
  );

  return {
    state,
    busy,
    problem,
    signUp,
    signIn,
    signOut,
    deleteAccount: () => void deleteAccount(),
    editProfile,
    changeEmail,
    changePhone,
    changeNotifications,
    clearProblem,
    sessionEnded: ended,
    email,
  };
}
