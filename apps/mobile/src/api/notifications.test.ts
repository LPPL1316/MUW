import request from "@shaperoute/shared-types/fixtures/notifications-request.json";
import session from "@shaperoute/shared-types/fixtures/session.json";

import { answers, apiError } from "../account/testing";
import { isUser } from "./accounts";
import { changeNotifications } from "./notifications";

const URL = "http://api";
const TOKEN = "the-token";
const AUTH = { Authorization: `Bearer ${TOKEN}` };

test("a user reads with its switches, and from an API of before without them", () => {
  expect(isUser(session.user)).toBe(true);
  expect(session.user.notifications).toEqual({ email: false, push: false, away: true });
  const { notifications: _notifications, ...before } = session.user;
  expect(isUser(before)).toBe(true);
});

test("only the switch that changes is sent, with the token", async () => {
  const changed = { ...session.user, notifications: { email: false, push: true } };
  const fetchFn: jest.Mock = answers(
    { status: 200, body: changed },
    { status: 200, body: session.user },
  );
  const on = await changeNotifications(URL, TOKEN, request, { fetchFn, key: null });
  expect(on).toEqual({ kind: "ok", value: changed });
  const off = await changeNotifications(
    URL,
    TOKEN,
    { push: false },
    { fetchFn, key: null },
  );
  expect(off).toEqual({ kind: "ok", value: session.user });
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe("http://api/me/notifications");
  expect(init).toMatchObject({ method: "PUT", headers: AUTH });
  expect(JSON.parse(init.body)).toEqual({ push: true });
  expect(JSON.parse(fetchFn.mock.calls[1][1].body)).toEqual({ push: false });
});

test("what the API refuses comes back with its code", async () => {
  const fetchFn: jest.Mock = answers(
    { status: 401, body: apiError("session_expired") },
    { status: 404, body: apiError("http_error", "Not Found") },
    new Error("Network request failed"),
  );
  const ask = () => changeNotifications(URL, TOKEN, request, { fetchFn, key: null });
  expect(await ask()).toMatchObject({ kind: "api_error", code: "session_expired" });
  // An API older than TASK-185.
  expect(await ask()).toMatchObject({ kind: "api_error", code: "http_error" });
  expect(await ask()).toEqual({ kind: "unreachable", url: URL });
});
