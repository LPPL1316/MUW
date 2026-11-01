import {
  CONVERSATION_STATES,
  MESSAGE_MAX_LENGTH,
  WITH_ATTACHMENTS,
  type Conversation,
  type ConversationBox,
  type ConversationsPage,
  type ConversationsUnread,
  type Message,
  type MessageAttachmentRequest,
  type MessageDrawing,
  type MessageRequest,
  type MessagesPage,
} from "@shaperoute/shared-types";

import { accountProblem, SESSION_ENDED } from "../account/messages";
import { t } from "../i18n";
import { type AccountOutcome, ask } from "./accounts";
import { isPerson } from "./people";

/**
 * Private messages (TASK-319, ADR-0279): the calls of docs/API.md,
 * «Messages», all with the session token. A conversation is asked with the
 * other's `public_id`; who is not followed by the one it writes to sends a
 * request, one message until it is accepted. The bodies are
 * packages/shared-types/fixtures/message*.json and conversations*.json.
 * Every page and message is asked `?with=attachments` (TASK-333): a message
 * carries its photo, video or drawing in `attachment`, and a server of
 * before simply has none.
 */

const WITH = `with=${WITH_ATTACHMENTS}`;

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** The message as the API keeps it: without the spaces around. */
export function messageOf(text: string): string {
  return text.trim();
}

/** Why `text` cannot go, as the API would say it; null when it can. */
export function messageTextProblem(text: string): string | null {
  const kept = messageOf(text);
  if (kept === "") {
    return t("A message needs some words.");
  }
  // Characters as the API counts them: an emoji is one, not two.
  if ([...kept].length > MESSAGE_MAX_LENGTH) {
    return t("A message is at most {max} characters.", { max: MESSAGE_MAX_LENGTH });
  }
  return null;
}

function conversationPath(publicId: string): string {
  return `/conversations/${encodeURIComponent(publicId)}`;
}

/** GET /me/conversations: a page of «Messages» or of the requests. */
export function fetchConversations(
  baseUrl: string,
  token: string,
  box: ConversationBox,
  cursor: string | null = null,
  options: Options = {},
): Promise<AccountOutcome<ConversationsPage>> {
  const query = cursor === null ? "" : `&cursor=${encodeURIComponent(cursor)}`;
  return ask(
    baseUrl,
    `/me/conversations?box=${box}${query}&${WITH}`,
    { method: "GET", token },
    isConversationsPage,
    options,
  );
}

/** GET /me/conversations/unread: what the dot of «Messages» counts. */
export function fetchUnread(
  baseUrl: string,
  token: string,
  options: Options = {},
): Promise<AccountOutcome<ConversationsUnread>> {
  return ask(
    baseUrl,
    "/me/conversations/unread",
    { method: "GET", token },
    isUnread,
    options,
  );
}

/**
 * GET /conversations/{public_id}/messages: a page, the latest first; the
 * first without a `cursor`. Before the first message, no messages.
 */
export function fetchMessages(
  baseUrl: string,
  token: string,
  publicId: string,
  cursor: string | null = null,
  options: Options = {},
): Promise<AccountOutcome<MessagesPage>> {
  const query = cursor === null ? "" : `&cursor=${encodeURIComponent(cursor)}`;
  return ask(
    baseUrl,
    `${conversationPath(publicId)}/messages?${WITH}${query}`,
    { method: "GET", token },
    isMessagesPage,
    options,
  );
}

/**
 * POST /conversations/{public_id}/messages: the message as kept. With an
 * attachment (TASK-333) the text may be empty.
 */
export function sendMessage(
  baseUrl: string,
  token: string,
  publicId: string,
  text: string,
  options: Options = {},
  attachment: MessageAttachmentRequest | null = null,
): Promise<AccountOutcome<Message>> {
  const body: MessageRequest =
    attachment === null
      ? { text: messageOf(text) }
      : { text: messageOf(text), attachment };
  return ask(
    baseUrl,
    `${conversationPath(publicId)}/messages?${WITH}`,
    { method: "POST", body, token },
    isMessage,
    options,
  );
}

/** GET /messages/{id}/drawing: the drawing of a message, whole (TASK-333). */
export function fetchMessageDrawing(
  baseUrl: string,
  token: string,
  messageId: string,
  options: Options = {},
): Promise<AccountOutcome<MessageDrawing>> {
  return ask(
    baseUrl,
    `/messages/${encodeURIComponent(messageId)}/drawing`,
    { method: "GET", token },
    isMessageDrawing,
    options,
  );
}

export function isMessageDrawing(body: unknown): body is MessageDrawing {
  return (
    isRecord(body) &&
    Array.isArray(body.points) &&
    body.points.length >= 2 &&
    typeof body.distance_m === "number" &&
    typeof body.route_m === "number"
  );
}

/**
 * What a photo or a video may be attached as in a conversation now: none
 * outside an open one, none on a server before TASK-333 (its page has no
 * `attachments`), no video while the server is full.
 */
export function attachableFiles(page: MessagesPage): ("photo" | "video")[] {
  const kinds = page.attachments?.kinds ?? [];
  return kinds.filter((kind): kind is "photo" | "video" => kind !== "drawing");
}

/** PUT /conversations/{public_id}/accept: the request taken into «Messages». */
export function acceptConversation(
  baseUrl: string,
  token: string,
  publicId: string,
  options: Options = {},
): Promise<AccountOutcome<null>> {
  return ask(
    baseUrl,
    `${conversationPath(publicId)}/accept`,
    { method: "PUT", token },
    isNoBody,
    options,
  );
}

/** PUT /conversations/{public_id}/read: read up to now. */
export function readConversation(
  baseUrl: string,
  token: string,
  publicId: string,
  options: Options = {},
): Promise<AccountOutcome<null>> {
  return ask(
    baseUrl,
    `${conversationPath(publicId)}/read`,
    { method: "PUT", token },
    isNoBody,
    options,
  );
}

/** DELETE /conversations/{public_id}: out of one's own view, up to now. */
export function clearConversation(
  baseUrl: string,
  token: string,
  publicId: string,
  options: Options = {},
): Promise<AccountOutcome<null>> {
  return ask(
    baseUrl,
    conversationPath(publicId),
    { method: "DELETE", token },
    isNoBody,
    options,
  );
}

/** DELETE /messages/{id}: one's own message, for both. */
export function deleteMessage(
  baseUrl: string,
  token: string,
  messageId: string,
  options: Options = {},
): Promise<AccountOutcome<null>> {
  return ask(
    baseUrl,
    `/messages/${encodeURIComponent(messageId)}`,
    { method: "DELETE", token },
    isNoBody,
    options,
  );
}

/** Words for a call of the messages that did not go; null when it did. */
export function messageProblem(outcome: AccountOutcome<unknown>): string | null {
  if (outcome.kind === "ok") {
    return null;
  }
  if (outcome.kind === "unreachable") {
    return t("No connection. Try again when you are online.");
  }
  if (outcome.kind === "api_error") {
    switch (outcome.code) {
      case "session_expired":
      case "not_signed_in":
        return t(SESSION_ENDED);
      // The API's own words: a message it refuses as written.
      case "invalid_request":
        return outcome.message;
      case "too_many_requests":
        return t("Too many messages in a minute. Wait a moment and try again.");
      // The one message of a request, negative (ADR-0176).
      case "comment_rejected":
        return t("You can't send negative messages in this app.");
      // Gone, blocked, or a request still waiting; or an API without them.
      case "http_error":
        return t("This conversation is not available.");
    }
  }
  return accountProblem(outcome);
}

function isRecord(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null;
}

function isNoBody(body: unknown, status: number): body is null {
  return status === 204 && body === null;
}

export function isMessage(body: unknown): body is Message {
  return (
    isRecord(body) &&
    typeof body.id === "string" &&
    typeof body.text === "string" &&
    typeof body.created_at === "string" &&
    typeof body.mine === "boolean"
  );
}

export function isMessagesPage(body: unknown): body is MessagesPage {
  return (
    isRecord(body) &&
    isPerson(body.person) &&
    typeof body.state === "string" &&
    (CONVERSATION_STATES as readonly string[]).includes(body.state) &&
    Array.isArray(body.messages) &&
    body.messages.every(isMessage) &&
    (body.next === null || typeof body.next === "string")
  );
}

export function isConversation(body: unknown): body is Conversation {
  return (
    isRecord(body) &&
    isPerson(body.person) &&
    isMessage(body.last) &&
    typeof body.unread === "boolean" &&
    (body.unread_count === undefined || typeof body.unread_count === "number")
  );
}

export function isConversationsPage(body: unknown): body is ConversationsPage {
  return (
    isRecord(body) &&
    Array.isArray(body.conversations) &&
    body.conversations.every(isConversation) &&
    (body.next === null || typeof body.next === "string") &&
    typeof body.total === "number"
  );
}

export function isUnread(body: unknown): body is ConversationsUnread {
  return (
    isRecord(body) &&
    typeof body.unread === "number" &&
    typeof body.requests === "number"
  );
}
