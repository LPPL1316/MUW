import session from "@shaperoute/shared-types/fixtures/session.json";
import passwordReset from "@shaperoute/shared-types/fixtures/password-reset-request.json";

import { answers, apiError } from "../account/testing";
import {
  askPasswordReset,
  cancelEmailChange,
  fetchEmailService,
  sendConfirmationAgain,
} from "./accountEmail";

// The emails of the account (TASK-300), as docs/API.md, «Confirmed email
// and forgotten password», says them.

const URL = "http://192.168.1.23:8000";
const TOKEN = session.token;
const options = (fetchFn: jest.Mock) => ({ fetchFn, key: null });

test("the server says it sends these emails, or has no such path", async () => {
  const fetchFn = answers(
    { status: 200, body: { on: true } },
    { status: 404, body: apiError("http_error") },
  );
  expect(await fetchEmailService(URL, options(fetchFn))).toEqual({
    kind: "ok",
    value: { on: true },
  });
  expect(fetchFn.mock.calls[0][0]).toBe(`${URL}/account-email`);
  expect((await fetchEmailService(URL, options(fetchFn))).kind).toBe("api_error");
});

test("a new password is asked for with the address, without a token", async () => {
  const fetchFn = answers({ status: 202 });
  const outcome = await askPasswordReset(
    URL,
    { email: passwordReset.email, language: "it" },
    options(fetchFn),
  );
  expect(outcome).toEqual({ kind: "ok", value: null });
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe(`${URL}/password-reset`);
  expect(init?.method).toBe("POST");
  expect(JSON.parse(init?.body as string)).toEqual(passwordReset);
  expect(init?.headers).not.toHaveProperty("Authorization");
});

test("too many asks for one address are said with the wait", async () => {
  const fetchFn = answers({
    status: 429,
    body: apiError("too_many_requests"),
    headers: { "Retry-After": "120" },
  });
  const outcome = await askPasswordReset(URL, { email: "a@b.co" }, options(fetchFn));
  expect(outcome).toMatchObject({
    kind: "api_error",
    code: "too_many_requests",
    retryAfterS: 120,
  });
});

test("the link again: sent, or nothing left to confirm", async () => {
  const fetchFn = answers({ status: 202 }, { status: 204 });
  expect(await sendConfirmationAgain(URL, TOKEN, options(fetchFn))).toEqual({
    kind: "ok",
    value: "sent",
  });
  expect(await sendConfirmationAgain(URL, TOKEN, options(fetchFn))).toEqual({
    kind: "ok",
    value: "nothing",
  });
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe(`${URL}/me/email/confirmation`);
  expect(init?.method).toBe("POST");
  expect(init?.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
});

test("the change that waits is dropped, and the account comes back", async () => {
  const user = { ...session.user, pending_email: null };
  const fetchFn = answers({ status: 200, body: user });
  expect(await cancelEmailChange(URL, TOKEN, options(fetchFn))).toEqual({
    kind: "ok",
    value: user,
  });
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe(`${URL}/me/email/pending`);
  expect(init?.method).toBe("DELETE");
});
