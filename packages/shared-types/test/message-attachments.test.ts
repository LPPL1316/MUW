import assert from "node:assert/strict";
import { test } from "node:test";

import attachmentRequest from "../fixtures/message-attachment-request.json" with { type: "json" };
import attachmentsExample from "../fixtures/message-attachments.json" with { type: "json" };
import mediaExample from "../fixtures/message-media.json" with { type: "json" };
import {
  MESSAGE_ATTACHMENT_KINDS,
  MESSAGE_VIDEO_MAX_BYTES,
  MESSAGE_VIDEO_MAX_S,
  type MessageAttachmentRequest,
  type MessageMedia,
  type MessageRequest,
  type MessagesPage,
} from "../src/index.ts";

// The same JSON is validated by the API's test_message_media.py (TASK-333).
const asked: MessageRequest = attachmentRequest as MessageRequest;
const uploaded: MessageMedia = mediaExample as MessageMedia;
const page = attachmentsExample as MessagesPage;

test("a message sends an uploaded file by its id", () => {
  const attachment = asked.attachment as MessageAttachmentRequest;
  assert.equal(attachment.media_id, uploaded.id);
  assert.equal(attachment.drawing, undefined);
});

test("an upload says what the API kept, within the limits", () => {
  assert.equal(uploaded.kind, "video");
  assert.ok(uploaded.duration_ms !== null);
  assert.ok(uploaded.duration_ms <= MESSAGE_VIDEO_MAX_S * 1000);
  assert.ok(uploaded.bytes <= MESSAGE_VIDEO_MAX_BYTES);
});

test("each attachment of a page is a photo, a video or a drawing", () => {
  const kinds = page.messages.map((m) => m.attachment?.kind);
  assert.deepEqual(new Set(kinds), new Set(MESSAGE_ATTACHMENT_KINDS));
  for (const message of page.messages) {
    const attachment = message.attachment;
    assert.ok(attachment);
    assert.equal(attachment.drawing !== null, attachment.kind === "drawing");
    if (attachment.kind === "drawing" || attachment.expired) {
      assert.equal(attachment.media_id, null);
    }
  }
  assert.deepEqual(page.attachments?.kinds, ["photo", "video", "drawing"]);
});

test("an expired video keeps its length but no file", () => {
  const expired = page.messages.find((m) => m.attachment?.expired);
  assert.ok(expired?.attachment);
  assert.equal(expired.attachment.kind, "video");
  assert.equal(expired.attachment.poster, false);
  assert.ok(expired.attachment.duration_ms);
});
