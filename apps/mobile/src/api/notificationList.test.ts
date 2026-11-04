import example from "@shaperoute/shared-types/fixtures/notifications.json";

import {
  fetchNotifications,
  isBellMissing,
  isNotificationsPage,
  readNotifications,
} from "./notificationList";

// The calls of the bell's list (TASK-367 part C): the paths, the bodies,
// what is an answer, and how a server without the list is told apart.

const URL = "http://api";

function answering(response: () => Response) {
  return jest.fn(async (_input: string, _init?: RequestInit) => response());
}

test("the example of the API is a page", () => {
  expect(isNotificationsPage(example)).toBe(true);
});

test("a line without what it opens, or with a number there, is no page", () => {
  const [line] = example.notifications;
  for (const bad of [
    { ...line, opens: undefined },
    { ...line, opens: { kind: "comment", drawing_id: 7 } },
    { ...line, actor: { username: "x" } },
    { ...line, read: "no" },
  ]) {
    expect(isNotificationsPage({ ...example, notifications: [bad] })).toBe(false);
  }
  expect(isNotificationsPage({ ...example, before: "41" })).toBe(false);
});

test("the first page, the next one, and reading up to a line", async () => {
  const pages = answering(() => Response.json(example));
  expect(
    (await fetchNotifications(URL, "tok", null, { fetchFn: pages, key: null })).kind,
  ).toBe("ok");
  await fetchNotifications(URL, "tok", 41, { fetchFn: pages, key: null });
  expect(pages.mock.calls.map(([url]) => url)).toEqual([
    `${URL}/notifications`,
    `${URL}/notifications?before=41`,
  ]);
  expect(pages.mock.calls[0][1]?.headers).toMatchObject({
    Authorization: "Bearer tok",
  });

  const read = answering(() => new Response(null, { status: 204 }));
  const outcome = await readNotifications(URL, "tok", 42, { fetchFn: read, key: null });
  expect(outcome.kind).toBe("ok");
  const [url, init] = read.mock.calls[0];
  expect(url).toBe(`${URL}/notifications/read`);
  expect(init?.method).toBe("POST");
  expect(JSON.parse(String(init?.body))).toEqual({ up_to: 42 });
});

test("a server without the list answers 404, and only that is missing", async () => {
  const missing = answering(() =>
    Response.json(
      { error: { code: "http_error", message: "Not Found" } },
      { status: 404 },
    ),
  );
  expect(
    isBellMissing(await fetchNotifications(URL, "tok", null, { fetchFn: missing })),
  ).toBe(true);
  const bare = answering(() => Response.json({ detail: "Not Found" }, { status: 404 }));
  expect(
    isBellMissing(await fetchNotifications(URL, "tok", null, { fetchFn: bare })),
  ).toBe(true);
  const down = answering(() =>
    Response.json({ error: { code: "internal", message: "x" } }, { status: 500 }),
  );
  expect(
    isBellMissing(await fetchNotifications(URL, "tok", null, { fetchFn: down })),
  ).toBe(false);
});
