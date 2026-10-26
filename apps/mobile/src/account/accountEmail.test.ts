import session from "@shaperoute/shared-types/fixtures/session.json";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { appLanguage } from "../i18n/language";
import { TOO_MANY_EMAILS } from "./accountEmail";
import { NO_API, SESSION_ENDED } from "./messages";
import { answers, apiError, type MemorySecureStore } from "./testing";
import { useAccount } from "./useAccount";

// The emails of the account through useAccount (TASK-300): the server is
// asked whether it sends them only when a page wants to know, a new
// password is asked for with the app's language, and the change of address
// dropped becomes the account on the phone.

jest.mock("expo-secure-store", () =>
  jest.requireActual<typeof import("./testing")>("./testing").memorySecureStore(),
);

const store = jest.requireMock<MemorySecureStore>("expo-secure-store");
const URL = "http://192.168.1.23:8000";
const KEY = "shaperoute.session";
const WAITING = { ...session.user, pending_email: "runner.new@example.com" };

beforeEach(() => {
  store.kept.clear();
});

function kept() {
  const value = store.kept.get(KEY);
  return value === undefined ? null : JSON.parse(value);
}

type Hook = Awaited<ReturnType<typeof account>>;

/** The emails of the account: useAccount always has them. */
function email(result: Hook) {
  const emails = result.current.email;
  if (emails === undefined) {
    throw new Error("useAccount without its emails");
  }
  return emails;
}

async function account(fetchFn: jest.Mock, baseUrl: string | null = URL) {
  const { result } = await renderHook(() =>
    useAccount(baseUrl, { fetchFn, key: null }),
  );
  return result;
}

/** Signed in, with GET /me of the opening answered by the first answer. */
async function signedIn(fetchFn: jest.Mock) {
  store.kept.set(KEY, JSON.stringify({ ...session, user: WAITING }));
  const result = await account(fetchFn);
  await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
  return result;
}

test("nothing is asked until a page wants to know, then once", async () => {
  const fetchFn = answers({ status: 200, body: { on: true } });
  const result = await account(fetchFn);
  expect(fetchFn).not.toHaveBeenCalled();
  expect(email(result).on).toBe(false);
  await act(async () => email(result).check());
  await waitFor(() => expect(email(result).on).toBe(true));
  await act(async () => email(result).check());
  expect(fetchFn).toHaveBeenCalledTimes(1);
  expect(fetchFn.mock.calls[0][0]).toBe(`${URL}/account-email`);
});

test("a server without these emails, or out of reach, shows none of it", async () => {
  for (const answer of [
    { status: 404, body: apiError("http_error") },
    new Error("Network request failed"),
  ]) {
    const fetchFn = answers(answer);
    const result = await account(fetchFn);
    await act(async () => email(result).check());
    await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    expect(email(result).on).toBe(false);
  }
});

test("a new password is asked for with the app's language", async () => {
  const fetchFn = answers({ status: 202 });
  const result = await account(fetchFn);
  let problem: string | null = "not yet";
  await act(async () => {
    problem = await email(result).askReset(" runner@example.com ");
  });
  expect(problem).toBeNull();
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe(`${URL}/password-reset`);
  expect(JSON.parse(init?.body as string)).toEqual({
    email: "runner@example.com",
    language: appLanguage(),
  });
});

test("a wrong address is said before anything is sent, too many after", async () => {
  const fetchFn = answers({ status: 429, body: apiError("too_many_requests") });
  const result = await account(fetchFn);
  let problem: string | null = null;
  await act(async () => {
    problem = await email(result).askReset("not an email");
  });
  expect(problem).toBe("Enter an email address, like name@example.com.");
  expect(fetchFn).not.toHaveBeenCalled();
  await act(async () => {
    problem = await email(result).askReset("runner@example.com");
  });
  expect(problem).toBe(TOO_MANY_EMAILS);
});

test("without the address of the service nothing is sent", async () => {
  const fetchFn = answers();
  const result = await account(fetchFn, null);
  let problem: string | null = null;
  await act(async () => {
    problem = await email(result).askReset("runner@example.com");
  });
  expect(problem).toBe(NO_API);
  expect(fetchFn).not.toHaveBeenCalled();
});

test("the link again goes with the session's token", async () => {
  const fetchFn = answers(
    { status: 200, body: WAITING },
    { status: 202 },
    { status: 401, body: apiError("session_expired") },
  );
  const result = await signedIn(fetchFn);
  let problem: string | null = "not yet";
  await act(async () => {
    problem = await email(result).sendAgain();
  });
  expect(problem).toBeNull();
  const [url, init] = fetchFn.mock.calls[1];
  expect(url).toBe(`${URL}/me/email/confirmation`);
  expect(init?.headers).toMatchObject({ Authorization: `Bearer ${session.token}` });
  // The session over: signed out, and said so.
  await act(async () => {
    problem = await email(result).sendAgain();
  });
  expect(problem).toBe(SESSION_ENDED);
  expect(result.current.state).toEqual({ status: "signedOut", notice: "ended" });
});

test("the change dropped is the account on the phone, kept for the next opening", async () => {
  const dropped = { ...WAITING, pending_email: null };
  const fetchFn = answers(
    { status: 200, body: WAITING },
    { status: 200, body: dropped },
  );
  const result = await signedIn(fetchFn);
  let problem: string | null = "not yet";
  await act(async () => {
    problem = await email(result).cancelChange();
  });
  expect(problem).toBeNull();
  expect(fetchFn.mock.calls[1][0]).toBe(`${URL}/me/email/pending`);
  expect(result.current.state).toEqual({
    status: "signedIn",
    session: { token: session.token, user: dropped },
  });
  expect(kept()).toEqual({ token: session.token, user: dropped });
});
