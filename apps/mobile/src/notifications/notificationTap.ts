import type {
  ChallengePushKind,
  ContestPushKind,
  MessagePushKind,
  Person,
} from "@shaperoute/shared-types";

/**
 * What a touched notification opens (TASK-262): the `data` the API put in
 * it (`PushData`, docs/API.md, «Push notifications»), read without trusting
 * it. A drawing for a reaction, a comment or a tag; the profile of who
 * acted for a follow request or a request accepted. «Play» for a shape of
 * the game unlocked (TASK-296): its data names the runner, but the shape is
 * in the collection. The challenge for a piece done, a shape completed or
 * a day left (TASK-296 part C): its data names the challenge; without a
 * good id, «Play» on its «Challenges» tab. The conversation with who wrote
 * for a message or a message request (TASK-319). The page of a monthly
 * challenge for its three notifications (TASK-343 part B): not the game's
 * challenge above. Anything else: nothing.
 */
export type TapTarget =
  | { kind: "drawing"; id: string }
  | { kind: "profile"; person: Person }
  | { kind: "conversation"; person: Person }
  | { kind: "play" }
  | { kind: "challenge"; id: string }
  | { kind: "contest"; id: string };

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The kinds of a challenge's notifications (TASK-296 part C). */
const CHALLENGE_KINDS: readonly ChallengePushKind[] = [
  "piece_done",
  "challenge_done",
  "challenge_ending",
];

/** The kinds of a private message's notifications (TASK-319). */
const MESSAGE_KINDS: readonly MessagePushKind[] = ["message", "message_request"];

/** The kinds of a monthly challenge's notifications (TASK-343). */
const CONTEST_KINDS: readonly ContestPushKind[] = [
  "contest_open",
  "contest_last_days",
  "contest_results",
];

function field(data: object, name: string): string | null {
  const value: unknown = (data as Record<string, unknown>)[name];
  return typeof value === "string" ? value : null;
}

export function tapTarget(data: unknown): TapTarget | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const kind = field(data, "kind");
  if (kind === "shape_unlocked") {
    return { kind: "play" };
  }
  if (kind !== null && (CHALLENGE_KINDS as readonly string[]).includes(kind)) {
    const challenge = field(data, "challenge_id");
    return challenge !== null && ID.test(challenge)
      ? { kind: "challenge", id: challenge }
      : { kind: "play" };
  }
  if (kind !== null && (CONTEST_KINDS as readonly string[]).includes(kind)) {
    const contest = field(data, "contest_id");
    return contest !== null && ID.test(contest)
      ? { kind: "contest", id: contest }
      : null;
  }
  const drawing = field(data, "drawing_id");
  if (drawing !== null && ID.test(drawing)) {
    return { kind: "drawing", id: drawing };
  }
  const publicId = field(data, "public_id");
  const username = field(data, "username");
  if (publicId !== null && ID.test(publicId) && username !== null && username !== "") {
    const person = { public_id: publicId, username, photo: null };
    return kind !== null && (MESSAGE_KINDS as readonly string[]).includes(kind)
      ? { kind: "conversation", person }
      : { kind: "profile", person };
  }
  return null;
}
