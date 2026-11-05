import session from "@shaperoute/shared-types/fixtures/session.json";
import signUpRequest from "@shaperoute/shared-types/fixtures/sign-up-request.json";
import type { Session, SignUpRequest } from "@shaperoute/shared-types";

import {
  ask,
  ASK_TIMEOUT_MS,
  authHeaders,
  deleteAccount,
  fetchMe,
  isSession,
  isUser,
  PUT_TIMEOUT_MS,
  signIn,
  signOut,
  signUp,
} from "./accounts";
import { readsHeaders } from "./reads";

const URL = "http://192.168.1.23:8000";
// The fixtures are the contract: they must fit the types as they are.
const SESSION = session as Session;
const SIGN_UP = signUpRequest as SignUpRequest;
const TOKEN = SESSION.token;

function answering(status: number, body?: unknown, headers?: Record<string, string>) {
  return jest.fn(async () =>
    body === undefined
      ? new Response(null, { status, headers })
      : Response.json(body, { status, headers }),
  );
}

function sent(
  fetchFn: jest.Mock,
): [string, RequestInit & { headers: Record<string, string> }] {
  return fetchFn.mock.calls[0] as never;
}

function apiError(code: string, message = "…") {
  return { error: { code, message, suggested_distance_m: null, reason: null } };
}

test("signing up sends the contract's request and gets a session", async () => {
  const fetchFn = answering(201, session);
  const outcome = await signUp(URL, SIGN_UP, { fetchFn, key: null });
  expect(outcome).toEqual({ kind: "ok", value: session });
  const [url, init] = sent(fetchFn);
  expect(url).toBe(`${URL}/accounts`);
  expect(init.method).toBe("POST");
  expect(init.headers).toEqual({
    "Content-Type": "application/json",
    "X-MuW-Reads": "swimming,walking,skiing,xc_skiing,gym,trackless",
  });
  expect(JSON.parse(init.body as string)).toEqual(signUpRequest);
});

test("logging in posts email and password to /session", async () => {
  const fetchFn = answering(200, session);
  const request = { email: SIGN_UP.email, password: SIGN_UP.password };
  expect(await signIn(URL, request, { fetchFn, key: null })).toEqual({
    kind: "ok",
    value: session,
  });
  const [url, init] = sent(fetchFn);
  expect(url).toBe(`${URL}/session`);
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body as string)).toEqual(request);
});

test("the token goes as a Bearer, beside the API key, and only where it is wanted", async () => {
  const me = answering(200, session.user);
  expect(await fetchMe(URL, TOKEN, { fetchFn: me, key: "k3y" })).toEqual({
    kind: "ok",
    value: session.user,
  });
  const [url, init] = sent(me);
  expect(url).toBe(`${URL}/me`);
  expect(init.method).toBe("GET");
  expect(init.headers).toEqual({
    Authorization: `Bearer ${TOKEN}`,
    "X-API-Key": "k3y",
    ...readsHeaders(),
  });
  expect(init.body).toBeUndefined();
  expect(authHeaders("abc")).toEqual({ Authorization: "Bearer abc" });

  // Signing up and in send no token at all.
  const up = answering(201, session);
  await signUp(URL, SIGN_UP, { fetchFn: up, key: null });
  expect(sent(up)[1].headers).not.toHaveProperty("Authorization");
});

test("logging out and deleting the account answer 204, with no body", async () => {
  const out = answering(204);
  expect(await signOut(URL, TOKEN, { fetchFn: out, key: null })).toEqual({
    kind: "ok",
    value: null,
  });
  expect(sent(out)[0]).toBe(`${URL}/session`);
  expect(sent(out)[1].method).toBe("DELETE");
  expect(sent(out)[1].headers).toEqual({
    Authorization: `Bearer ${TOKEN}`,
    ...readsHeaders(),
  });

  const gone = answering(204);
  expect(await deleteAccount(URL, TOKEN, { fetchFn: gone, key: null })).toEqual({
    kind: "ok",
    value: null,
  });
  expect(sent(gone)[0]).toBe(`${URL}/me`);
  expect(sent(gone)[1].method).toBe("DELETE");
});

test("the API's errors come back with their code, and Retry-After when sent", async () => {
  const taken = await signUp(URL, SIGN_UP, {
    fetchFn: answering(409, apiError("email_taken")),
    key: null,
  });
  expect(taken).toMatchObject({
    kind: "api_error",
    code: "email_taken",
    retryAfterS: null,
  });

  const many = await signIn(
    URL,
    { email: SIGN_UP.email, password: "wrong" },
    {
      fetchFn: answering(429, apiError("too_many_requests"), { "Retry-After": "600" }),
      key: null,
    },
  );
  expect(many).toMatchObject({
    kind: "api_error",
    code: "too_many_requests",
    retryAfterS: 600,
  });

  const expired = await fetchMe(URL, TOKEN, {
    fetchFn: answering(401, apiError("session_expired")),
    key: null,
  });
  expect(expired).toMatchObject({ kind: "api_error", code: "session_expired" });
});

test("no API is unreachable; an answer out of the contract is a bad answer", async () => {
  const failing = jest.fn(async () => {
    throw new Error("Network request failed");
  });
  expect(await fetchMe(URL, TOKEN, { fetchFn: failing, key: null })).toEqual({
    kind: "unreachable",
    url: URL,
  });
  for (const [status, body] of [
    [200, { token: "", user: session.user }],
    [200, { token: TOKEN, user: { ...session.user, role: "owner" } }],
    [201, "<html>"],
    [500, { detail: "oops" }],
  ] as const) {
    expect(
      await signIn(URL, SIGN_UP, { fetchFn: answering(status, body), key: null }),
    ).toEqual({ kind: "bad_answer", status });
  }
  // A 200 with a body where a 204 was due is not the contract either.
  expect(await signOut(URL, TOKEN, { fetchFn: answering(200, {}), key: null })).toEqual(
    {
      kind: "bad_answer",
      status: 200,
    },
  );
});

test("the guards accept the contract's fixtures", () => {
  expect(isSession(session)).toBe(true);
  expect(isUser(session.user)).toBe(true);
  expect(isSession({ token: TOKEN })).toBe(false);
  expect(isUser({ ...session.user, id: "1" })).toBe(false);
});

describe("a connection that accepts and then stays silent (TASK-252)", () => {
  /** A fetch that never answers, and fails when its request is cut. */
  function silent() {
    const signals: AbortSignal[] = [];
    const fetchFn = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            signals.push(signal);
            signal.addEventListener("abort", () => reject(new Error("Aborted")));
          }
        }),
    );
    return { fetchFn, signals };
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("a request is cut after its time, and the API counts as unreachable", async () => {
    const { fetchFn, signals } = silent();
    const outcome = fetchMe(URL, TOKEN, { fetchFn, key: null });

    await jest.advanceTimersByTimeAsync(ASK_TIMEOUT_MS - 1);
    expect(signals[0].aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(signals[0].aborted).toBe(true);
    expect(await outcome).toEqual({ kind: "unreachable", url: URL });
  });

  test("a PUT, which may carry a run or a picture, is given longer", async () => {
    const { fetchFn, signals } = silent();
    const isAnything = (body: unknown): body is unknown => true;
    const outcome = ask(
      URL,
      "/me/photo",
      { method: "PUT", body: { image: "…" }, token: TOKEN },
      isAnything,
      { fetchFn, key: null },
    );

    await jest.advanceTimersByTimeAsync(ASK_TIMEOUT_MS);
    expect(signals[0].aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(PUT_TIMEOUT_MS - ASK_TIMEOUT_MS);
    expect(await outcome).toEqual({ kind: "unreachable", url: URL });
  });

  test("a body that stops coming is no answer either", async () => {
    const fetchFn = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = new Promise<unknown>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
      });
      return { ok: true, status: 200, json: () => body } as unknown as Response;
    });
    const outcome = fetchMe(URL, TOKEN, { fetchFn, key: null });

    await jest.advanceTimersByTimeAsync(ASK_TIMEOUT_MS);
    expect(await outcome).toEqual({ kind: "unreachable", url: URL });
  });

  test("an answer in time leaves no timer behind", async () => {
    const fetchFn = jest.fn(async () => Response.json(SESSION.user, { status: 200 }));
    expect(await fetchMe(URL, TOKEN, { fetchFn, key: null })).toMatchObject({
      kind: "ok",
    });
    expect(jest.getTimerCount()).toBe(0);
  });
});
