import type { Person } from "@shaperoute/shared-types";

/**
 * What a touched notification opens (TASK-262): the `data` the API put in
 * it (`PushData`, docs/API.md, «Push notifications»), read without trusting
 * it. A drawing for a reaction, a comment or a tag; the profile of who
 * acted for a follow request or a request accepted. «Play» for a shape of
 * the game unlocked (TASK-296): its data names the runner, but the shape is
 * in the collection. Anything else: nothing.
 */
export type TapTarget =
  | { kind: "drawing"; id: string }
  | { kind: "profile"; person: Person }
  | { kind: "play" };

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function field(data: object, name: string): string | null {
  const value: unknown = (data as Record<string, unknown>)[name];
  return typeof value === "string" ? value : null;
}

export function tapTarget(data: unknown): TapTarget | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  if (field(data, "kind") === "shape_unlocked") {
    return { kind: "play" };
  }
  const drawing = field(data, "drawing_id");
  if (drawing !== null && ID.test(drawing)) {
    return { kind: "drawing", id: drawing };
  }
  const publicId = field(data, "public_id");
  const username = field(data, "username");
  if (publicId !== null && ID.test(publicId) && username !== null && username !== "") {
    return { kind: "profile", person: { public_id: publicId, username, photo: null } };
  }
  return null;
}
