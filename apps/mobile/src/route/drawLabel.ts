import type { Shape } from "@shaperoute/shared-types";

import { t } from "../i18n";
import { shapeWord } from "../i18n/shapeNames";
import { distanceLabel } from "../units/format";
import { appUnits, type Units } from "../units/units";

/** What «Draw» will ask the engine for, as its button needs it. */
export type DrawWhat =
  | { kind: "shape"; shape: Shape }
  | { kind: "word"; word: string }
  | { kind: "image" }
  | { kind: "none" };

/**
 * The words of the yellow button at the foot of «Draw» (TASK-361): what
 * will be drawn and how far, «Draw a 7.8 km circle», so the last look
 * before the tap checks the choice. Without a choice or a valid distance,
 * «Draw route» as before.
 */
export function drawLabel(
  what: DrawWhat,
  distanceM: number | null,
  units: Units = appUnits(),
): string {
  if (distanceM === null || what.kind === "none") {
    return t("Draw route");
  }
  const distance = distanceLabel(distanceM, units);
  switch (what.kind) {
    case "shape":
      return t("Draw a {distance} {name}", { distance, name: shapeWord(what.shape) });
    case "word":
      return t("Draw “{word}”, {distance}", { distance, word: what.word });
    case "image":
      return t("Draw the picture, {distance}", { distance });
  }
}
