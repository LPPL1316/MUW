import type { Message, MessageAttachment } from "@shaperoute/shared-types";

import { favoriteTitle } from "../favorites/favoriteRoute";
import { t } from "../i18n";
import { distanceLabel } from "../units/format";

/**
 * What a message carries, in words (TASK-333, texts approved by the user on
 * 2026-10-29): the line of the list, and what VoiceOver says of it.
 */

const SIGN: Record<MessageAttachment["kind"], string> = {
  photo: "📷",
  video: "🎬",
  drawing: "🗺️",
};

/** «📷 Photo», «🎬 Video», «🗺️ Drawing». */
export function attachmentLine(kind: MessageAttachment["kind"]): string {
  switch (kind) {
    case "photo":
      return t("📷 Photo");
    case "video":
      return t("🎬 Video");
    case "drawing":
      return t("🗺️ Drawing");
  }
}

/** A message on one line, as the list shows it: its text, after what it
 * carries («📷 The river»), or what it carries alone. */
export function messageLine(message: Message): string {
  const text = message.text.split("\n").join(" ").trim();
  const kind = message.attachment?.kind;
  if (kind === undefined) {
    return text;
  }
  return text === "" ? attachmentLine(kind) : `${SIGN[kind]} ${text}`;
}

/** «0:24»: a video's length. */
export function duration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** What VoiceOver says of an attachment. */
export function attachmentLabel(attachment: MessageAttachment): string {
  switch (attachment.kind) {
    case "photo":
      return t("Photo");
    case "video":
      return attachment.expired
        ? t("This video has expired.")
        : t("Video, {duration}", {
            duration: duration(attachment.duration_ms ?? 0),
          });
    case "drawing": {
      const card = attachment.drawing;
      return t("Drawing: {title}, {distance}", {
        title: card === null ? "" : favoriteTitle(card),
        distance: distanceLabel(card?.route_m ?? 0),
      });
    }
  }
}
