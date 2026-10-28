import assert from "node:assert/strict";
import { test } from "node:test";

import unreadExample from "../fixtures/conversations-unread.json" with { type: "json" };
import conversationsExample from "../fixtures/conversations.json" with { type: "json" };
import messageRequest from "../fixtures/message-request.json" with { type: "json" };
import messageExample from "../fixtures/message.json" with { type: "json" };
import messagesExample from "../fixtures/messages.json" with { type: "json" };
import {
  CONVERSATION_STATES,
  MESSAGE_MAX_LENGTH,
  type ConversationsPage,
  type ConversationsUnread,
  type Message,
  type MessagePushData,
  type MessageRequest,
  type MessagesPage,
} from "../src/index.ts";

// The same JSON is validated by the API's test_messages.py (TASK-319).
const asked: MessageRequest = messageRequest;
const one: Message = messageExample;
const page = messagesExample as MessagesPage;
const list: ConversationsPage = conversationsExample;
const unread: ConversationsUnread = unreadExample;

test("a message is plain text within the limit", () => {
  assert.deepEqual(Object.keys(asked), ["text"]);
  assert.ok(asked.text.length > 0 && asked.text.length <= MESSAGE_MAX_LENGTH);
  assert.equal(one.text, asked.text);
  assert.equal(typeof one.mine, "boolean");
});

test("a conversation's page says where who asks stands, the latest first", () => {
  assert.ok((CONVERSATION_STATES as readonly string[]).includes(page.state));
  const times = page.messages.map((m) => Date.parse(m.created_at));
  assert.deepEqual(
    times,
    [...times].sort((a, b) => b - a),
  );
  assert.ok(!("email" in page.person));
});

test("a list of conversations has each one's latest message", () => {
  assert.equal(list.total, list.conversations.length);
  assert.deepEqual(list.conversations[0].last, page.messages[0]);
  assert.ok(unread.unread >= 0 && unread.requests >= 0);
});

test("a message's notification opens the conversation with who wrote", () => {
  const data: MessagePushData = {
    kind: "message",
    public_id: page.person.public_id,
    username: page.person.username,
  };
  assert.deepEqual(Object.keys(data).sort(), ["kind", "public_id", "username"]);
});
