import unreadExample from "@shaperoute/shared-types/fixtures/conversations-unread.json";
import conversationsExample from "@shaperoute/shared-types/fixtures/conversations.json";
import messageExample from "@shaperoute/shared-types/fixtures/message.json";
import messagesExample from "@shaperoute/shared-types/fixtures/messages.json";
import { MESSAGE_MAX_LENGTH } from "@shaperoute/shared-types";

import { answers, apiError } from "../account/testing";
import {
  acceptConversation,
  clearConversation,
  deleteMessage,
  fetchConversations,
  fetchMessages,
  fetchUnread,
  isConversationsPage,
  isMessage,
  isMessagesPage,
  isUnread,
  messageProblem,
  messageTextProblem,
  readConversation,
  sendMessage,
} from "./messages";

// The calls of the private messages (TASK-319, ADR-0279): the paths, the
// methods, the token, and the bodies of packages/shared-types/fixtures.

const URL = "http://api";
const TOKEN = "token-of-ada";
const ID = "8c1f7a52-3d4e-4b9a-9f61-2a7c0e5d9b13";

const asFetch = (fake: jest.Mock) => fake as unknown as typeof fetch;

test("the examples are what the app accepts", () => {
  expect(isMessage(messageExample)).toBe(true);
  expect(isMessagesPage(messagesExample)).toBe(true);
  expect(isConversationsPage(conversationsExample)).toBe(true);
  expect(isUnread(unreadExample)).toBe(true);
  expect(isMessagesPage({ ...messagesExample, state: "maybe" })).toBe(false);
  expect(isMessage({ ...messageExample, mine: "yes" })).toBe(false);
});

test("each call asks its path and method, with the token", async () => {
  const fetchFn = answers(
    { status: 200, body: conversationsExample },
    { status: 200, body: conversationsExample },
    { status: 200, body: unreadExample },
    { status: 200, body: messagesExample },
    { status: 201, body: messageExample },
    { status: 204 },
    { status: 204 },
    { status: 204 },
    { status: 204 },
  );
  const options = { fetchFn: asFetch(fetchFn), key: null };
  expect((await fetchConversations(URL, TOKEN, "inbox", null, options)).kind).toBe(
    "ok",
  );
  await fetchConversations(URL, TOKEN, "requests", "17-ab", options);
  await fetchUnread(URL, TOKEN, options);
  await fetchMessages(URL, TOKEN, ID, null, options);
  const sent = await sendMessage(URL, TOKEN, ID, "  Hi!\n ", options);
  expect(sent).toEqual({ kind: "ok", value: messageExample });
  await acceptConversation(URL, TOKEN, ID, options);
  await readConversation(URL, TOKEN, ID, options);
  await clearConversation(URL, TOKEN, ID, options);
  await deleteMessage(URL, TOKEN, messageExample.id, options);
  const asked = fetchFn.mock.calls.map(([url, init]) => [
    init?.method,
    String(url).replace(URL, ""),
  ]);
  expect(asked).toEqual([
    // With what each message carries (TASK-333).
    ["GET", "/me/conversations?box=inbox&with=attachments"],
    ["GET", "/me/conversations?box=requests&cursor=17-ab&with=attachments"],
    ["GET", "/me/conversations/unread"],
    ["GET", `/conversations/${ID}/messages?with=attachments`],
    ["POST", `/conversations/${ID}/messages?with=attachments`],
    ["PUT", `/conversations/${ID}/accept`],
    ["PUT", `/conversations/${ID}/read`],
    ["DELETE", `/conversations/${ID}`],
    ["DELETE", `/messages/${messageExample.id}`],
  ]);
  for (const [, init] of fetchFn.mock.calls) {
    expect(init).toMatchObject({ headers: { Authorization: `Bearer ${TOKEN}` } });
  }
  // Without the spaces around, as the API keeps it.
  expect(JSON.parse(String(fetchFn.mock.calls[4][1]?.body))).toEqual({ text: "Hi!" });
});

test("a text that cannot go says why before asking", () => {
  expect(messageTextProblem("  \n ")).toBe("A message needs some words.");
  expect(messageTextProblem("x".repeat(MESSAGE_MAX_LENGTH + 1))).toBe(
    `A message is at most ${MESSAGE_MAX_LENGTH} characters.`,
  );
  // An emoji is one character, as the API counts.
  expect(messageTextProblem("🏃".repeat(MESSAGE_MAX_LENGTH))).toBeNull();
});

test("what the API refuses is said in words", async () => {
  const say = async (status: number, code: string, message = "…") => {
    const fetchFn = answers({ status, body: apiError(code, message) });
    return messageProblem(
      await sendMessage(URL, TOKEN, ID, "Hi", { fetchFn: asFetch(fetchFn), key: null }),
    );
  };
  expect(await say(422, "comment_rejected")).toBe(
    "You can't send negative messages in this app.",
  );
  expect(await say(429, "too_many_requests")).toBe(
    "Too many messages in a minute. Wait a moment and try again.",
  );
  expect(await say(422, "invalid_request", "You cannot write to yourself.")).toBe(
    "You cannot write to yourself.",
  );
  expect(await say(404, "http_error")).toBe("This conversation is not available.");
  expect(await say(401, "not_signed_in")).toBe("Your session has ended. Log in again.");
  const offline = answers(new TypeError("Network request failed"));
  expect(
    messageProblem(
      await fetchUnread(URL, TOKEN, { fetchFn: asFetch(offline), key: null }),
    ),
  ).toBe("No connection. Try again when you are online.");
});
