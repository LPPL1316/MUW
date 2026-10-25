import { t } from "../i18n";
import type { VideoSample } from "./mp4";
import type { VideoPageMessage } from "./videoPage";

/**
 * The app's side of a run's video (TASK-295, ADR-0254): what the hidden
 * WebView sends, read back into bytes, and what the post's screen says
 * when the video did not go.
 */

/** What became of a video to share. */
export type VideoOutcome = "shared" | "no_sharing" | "unsupported" | "failed";

/** The file the video is written to, in the cache folder the system may
 * empty: one at a time, the last one made. */
export const VIDEO_FILE = "MuW-run.mp4";

/** With no word from the page this long, the video is given up. */
export const VIDEO_SILENCE_MS = 20_000;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const VALUES = new Map(Array.from(ALPHABET, (character, i) => [character, i]));

/** The bytes of a base64 text; throws on a character base64 has not. */
export function bytesOfBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let held = 0;
  let at = 0;
  for (const character of clean) {
    const value = VALUES.get(character);
    if (value === undefined) {
      throw new Error("not base64");
    }
    bits = (bits << 6) | value;
    held += 6;
    if (held >= 8) {
      held -= 8;
      out[at] = (bits >> held) & 0xff;
      at += 1;
    }
  }
  return out;
}

/** A message of the page, or null for anything else. */
export function pageMessageOf(data: string): VideoPageMessage | null {
  try {
    const message: unknown = JSON.parse(data);
    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      typeof message.type === "string"
    ) {
      return message as VideoPageMessage;
    }
  } catch {
    // Not one of the page's.
  }
  return null;
}

/** The encoded pictures of a "chunks" message, as the file takes them. */
export function samplesOf(
  message: Extract<VideoPageMessage, { type: "chunks" }>,
): VideoSample[] {
  return message.list.map((chunk) => ({
    data: bytesOfBase64(chunk.data),
    time: chunk.time,
    key: chunk.key,
  }));
}

/** What the post says when the video did not go; null when it did. */
export function videoProblem(outcome: VideoOutcome): string | null {
  switch (outcome) {
    case "shared":
      return null;
    case "no_sharing":
      return t("This phone cannot open the share sheet.");
    case "unsupported":
      return t("This phone cannot make the video.");
    case "failed":
      return t("The video could not be made. Try again.");
  }
}
