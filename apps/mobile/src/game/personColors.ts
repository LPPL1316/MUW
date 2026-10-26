import type { GameChallenge, Person } from "@shaperoute/shared-types";

import { color } from "../theme/tokens";

/**
 * The colour of each person in a challenge (TASK-296 part D, docs/GIOCO.md
 * §9): the pieces are drawn in the colour of who holds or ran them, and the
 * legend says whose colour is whose. `tokens.ts` has no palette for people,
 * so a few of its colours take turns (ADR-0255, part D): the cyan of «Start
 * here», the orange of a warning, the yellow, the red of an error, and the
 * text's. Past five people a colour comes back, and the legend's names tell
 * them apart.
 */
export const PERSON_COLORS: readonly string[] = [
  color.startHere,
  color.warning,
  color.accent,
  color.error,
  color.text,
];

/** A piece nobody ran yet: the faint grey of a locked shape. */
export const FREE_PIECE_COLOR = color.textFaint;

/**
 * Who has which colour: the team's members in the order they joined, so
 * a person keeps a colour from one reading to the next; after them, in the
 * order they appear in the pieces and the contributions, those who left
 * the team and whose metres stay.
 */
export function personColors(
  members: readonly Pick<Person, "public_id">[],
  challenge: Pick<GameChallenge, "pieces" | "contributions">,
): Map<string, string> {
  const order: string[] = [];
  const seen = new Set<string>();
  const add = (id: string | undefined) => {
    if (id !== undefined && !seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  };
  members.forEach((member) => add(member.public_id));
  challenge.pieces.forEach((piece) => add(piece.holder?.public_id));
  challenge.contributions.forEach((gave) => add(gave.public_id));
  return new Map(order.map((id, i) => [id, PERSON_COLORS[i % PERSON_COLORS.length]]));
}
