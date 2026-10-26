import session from "@shaperoute/shared-types/fixtures/session.json";
import signUpRequest from "@shaperoute/shared-types/fixtures/sign-up-request.json";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { NO_API } from "./messages";
import { answers, apiError, held, type MemorySecureStore } from "./testing";
import { type AccountState, useAccount } from "./useAccount";

jest.mock("expo-secure-store", () =>
  jest.requireActual<typeof import("./testing")>("./testing").memorySecureStore(),
);

const store = jest.requireMock<MemorySecureStore>("expo-secure-store");
const URL = "http://192.168.1.23:8000";
const KEY = "shaperoute.session";
const SIGN_UP = {
  email: signUpRequest.email,
  username: signUpRequest.username,
  password: signUpRequest.password,
  atLeast16: true,
  noAwayEmail: false,
};

beforeEach(() => {
  store.kept.clear();
});

function kept() {
  const value = store.kept.get(KEY);
  return value === undefined ? null : JSON.parse(value);
}

function keep(value: unknown) {
  store.kept.set(KEY, JSON.stringify(value));
}

/** The hook, and every state it rendered with, the first one included. */
async function account(fetchFn: jest.Mock, baseUrl: string | null = URL) {
  const states: AccountState[] = [];
  const { result } = await renderHook(() => {
    const hook = useAccount(baseUrl, { fetchFn, key: null });
    states.push(hook.state);
    return hook;
  });
  return { result, states };
}

test("a new phone is signed out and asks the API nothing", async () => {
  const fetchFn = answers();
  const { result } = await account(fetchFn);
  expect(result.current.state).toEqual({ status: "signedOut", notice: null });
  expect(fetchFn).not.toHaveBeenCalled();
});

test("reopened, the app is signed in at once, then the API says who it is now", async () => {
  keep(session);
  const renamed = { ...session.user, username: "Runner_43" };
  const fetchFn = answers({ status: 200, body: renamed });
  const { result, states } = await account(fetchFn);
  expect(states[0]).toEqual({ status: "signedIn", session });
  await waitFor(() =>
    expect(result.current.state).toEqual({
      status: "signedIn",
      session: { token: session.token, user: renamed },
    }),
  );
  expect(fetchFn.mock.calls[0][0]).toBe(`${URL}/me`);
  expect(kept()).toEqual({ token: session.token, user: renamed });
});

test("reopened with an expired session, the app asks to log in again", async () => {
  keep(session);
  const { result } = await account(
    answers({ status: 401, body: apiError("session_expired") }),
  );
  await waitFor(() =>
    expect(result.current.state).toEqual({ status: "signedOut", notice: "ended" }),
  );
  expect(kept()).toBeNull();
});

test("reopened offline, the app stays signed in", async () => {
  keep(session);
  const fetchFn = answers(new Error("Network request failed"));
  const { result } = await account(fetchFn);
  await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
  await act(async () => {});
  expect(result.current.state).toEqual({ status: "signedIn", session });
  expect(kept()).toEqual(session);
});

test("signing up waits, then keeps the session for the next opening", async () => {
  const api = held();
  const { result } = await account(api.fetchFn);
  await act(async () => result.current.signUp(SIGN_UP));
  expect(result.current.busy).toBe("signUp");
  expect(JSON.parse(api.fetchFn.mock.calls[0][1]!.body as string)).toEqual(
    signUpRequest,
  );
  await act(async () => api.answer(201, session));
  await waitFor(() =>
    expect(result.current.state).toEqual({ status: "signedIn", session }),
  );
  expect(result.current.busy).toBeNull();
  expect(kept()).toEqual(session);
});

test("fields that cannot work are told without asking the API", async () => {
  const fetchFn = answers();
  const { result } = await account(fetchFn);
  await act(async () => result.current.signUp({ ...SIGN_UP, atLeast16: false }));
  expect(result.current.problem).toBe("You must be at least 16 to sign up.");
  expect(fetchFn).not.toHaveBeenCalled();
  await act(async () => result.current.clearProblem());
  expect(result.current.problem).toBeNull();
});

test("a wrong password is told in words, and nothing is kept", async () => {
  const fetchFn = answers({ status: 401, body: apiError("wrong_credentials") });
  const { result } = await account(fetchFn);
  await act(async () =>
    result.current.signIn({ email: SIGN_UP.email, password: "nope" }),
  );
  await waitFor(() => expect(result.current.problem).toBe("Wrong email or password."));
  expect(result.current.state).toEqual({ status: "signedOut", notice: null });
  expect(kept()).toBeNull();
});

test("a second tap while waiting sends nothing more", async () => {
  const api = held();
  const { result } = await account(api.fetchFn);
  const fields = { email: SIGN_UP.email, password: SIGN_UP.password };
  await act(async () => result.current.signIn(fields));
  await act(async () => result.current.signIn(fields));
  await act(async () => api.answer(200, session));
  await waitFor(() => expect(result.current.state.status).toBe("signedIn"));
  expect(api.fetchFn).toHaveBeenCalledTimes(1);
});

test("without an API address, the account says where to open the app from", async () => {
  const { result } = await account(answers(), null);
  await act(async () => result.current.signIn({ email: SIGN_UP.email, password: "x" }));
  expect(result.current.problem).toBe(NO_API);
});

test("logging out is at once, even with the API unreachable", async () => {
  keep(session);
  const fetchFn = answers(
    { status: 200, body: session.user },
    new Error("Network request failed"),
  );
  const { result } = await account(fetchFn);
  await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
  await act(async () => result.current.signOut());
  expect(result.current.state).toEqual({ status: "signedOut", notice: "loggedOut" });
  await waitFor(() => expect(kept()).toBeNull());
  // The API is told, with the token it can close.
  const [url, init] = fetchFn.mock.calls[1];
  expect(url).toBe(`${URL}/session`);
  expect(init!.method).toBe("DELETE");
  expect((init!.headers as Record<string, string>).Authorization).toBe(
    `Bearer ${session.token}`,
  );
});

test("deleting the account signs out only with the API's yes", async () => {
  keep(session);
  const fetchFn = answers(
    { status: 200, body: session.user },
    new Error("Network request failed"),
    { status: 204 },
  );
  const { result } = await account(fetchFn);
  await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));

  await act(async () => result.current.deleteAccount());
  await waitFor(() => expect(result.current.problem).toMatch(/^No connection/));
  expect(result.current.busy).toBeNull();
  expect(result.current.state.status).toBe("signedIn");
  expect(kept()).toEqual(session);

  await act(async () => result.current.deleteAccount());
  await waitFor(() =>
    expect(result.current.state).toEqual({ status: "signedOut", notice: "deleted" }),
  );
  expect(result.current.problem).toBeNull();
  expect(fetchFn.mock.calls[2][0]).toBe(`${URL}/me`);
  expect(fetchFn.mock.calls[2][1]!.method).toBe("DELETE");
  expect(kept()).toBeNull();
});

test("a session that ended while the app was open asks to log in again", async () => {
  keep(session);
  const fetchFn = answers(
    { status: 200, body: session.user },
    { status: 401, body: apiError("not_signed_in") },
  );
  const { result } = await account(fetchFn);
  await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
  await act(async () => result.current.deleteAccount());
  await waitFor(() =>
    expect(result.current.state).toEqual({ status: "signedOut", notice: "ended" }),
  );
  expect(kept()).toBeNull();
});
