import type { Person } from "@shaperoute/shared-types";

import type { TapTarget } from "./notificationTap";

/** What a notification can open: the doors «Profile» hands out. */
export type Opens = {
  /** Shows the drawing `id` on the map, fetched whole. */
  openDrawing: (id: string) => void;
  /** Shows the profile of `person`. */
  openProfile: (person: Person) => void;
  /** Shows the «Play» page: a shape of the game unlocked (TASK-296). */
  openPlay: () => void;
  /** Shows the challenge `id` of the game (TASK-296 part D): a piece done,
   * a shape completed, a day left. */
  openChallenge: (id: string) => void;
  /** Shows the conversation with `person`: a message, a message request
   * (TASK-319). Without it, their profile. */
  openConversation?: (person: Person) => void;
  /** Shows the page of the monthly challenge `id` (TASK-343 part B): a new
   * one, its last days, its results. */
  openContest?: (id: string) => void;
};

/**
 * Opens what a touched notification points at: a push (TASK-262) or a line
 * of the bell (TASK-367 part C), the same for both.
 */
export function openTarget(target: TapTarget, opens: Opens): void {
  if (target.kind === "drawing") {
    opens.openDrawing(target.id);
  } else if (target.kind === "profile") {
    opens.openProfile(target.person);
  } else if (target.kind === "conversation") {
    (opens.openConversation ?? opens.openProfile)(target.person);
  } else if (target.kind === "challenge") {
    opens.openChallenge(target.id);
  } else if (target.kind === "contest") {
    opens.openContest?.(target.id);
  } else {
    opens.openPlay();
  }
}
