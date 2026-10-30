import type { SwimTurn } from "@shaperoute/shared-types";

import { t } from "../i18n";
import { nearDistanceLabel } from "../units/format";
import { appUnits, type Units } from "../units/units";

/**
 * The turns to learn before going in (TASK-323 C): the first lap's. Every
 * lap goes round the same shape, so it turns in the same places; the GPX
 * keeps the first lap's too (route_engine/swim_turns.py, with_turns).
 */
export function firstLapTurns(turns: readonly SwimTurn[] | undefined): SwimTurn[] {
  return (turns ?? []).filter((turn) => turn.lap === 1);
}

/**
 * «Turn left», «Turn right · Bagno 54»: as the turn's waypoint in the GPX
 * (route_engine/swim_turns.py, turn_label), the place on the shore to turn
 * opposite when the engine found one within 300 m.
 */
export function turnLabel(turn: SwimTurn): string {
  const place = turn.landmark?.name;
  if (turn.side === "left") {
    return place !== undefined ? t("Turn left · {place}", { place }) : t("Turn left");
  }
  return place !== undefined ? t("Turn right · {place}", { place }) : t("Turn right");
}

/** "120 m from the start", "2.1 km from the start": along the swim, the
 * way in from the shore included. */
export function turnAt(turn: SwimTurn, units: Units = appUnits()): string {
  return t("{distance} from the start", {
    distance: nearDistanceLabel(turn.at_m, units),
  });
}

/** Above the turns of a swim of more than one lap: the others turn at the
 * same corners of the shape, without the first lap's turn in from the
 * shore; the last one turns back to it. */
export function lapsNote(laps: number | undefined): string | null {
  return laps !== undefined && laps > 1
    ? t("The same turns every lap, {laps} laps, then back to the shore.", { laps })
    : null;
}
