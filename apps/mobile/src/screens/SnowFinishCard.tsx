import type { RecordActivity } from "@shaperoute/shared-types";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { snowDay } from "../activities/snowDay";
import { t } from "../i18n";
import type { FreeRun } from "../navigation/freeRun";
import { postOfTrack } from "../share/postRun";
import { SharePostButton } from "../share/SharePost";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { runDistanceLabel } from "../units/format";
import { paceUnit, speedUnit } from "../units/runFormat";
import type { Units } from "../units/units";
import { NO_NUMBER, Tile, useRunNumbers } from "./RunPanel";

/**
 * The end of a day on the snow (TASK-375 part C, ADR-0319), in place of a
 * run's numbers. Skiing: the kilometres of the descents, how many, the
 * metres skied down, the top and the average speed, the lifts and the
 * time. Cross-country: the distance, the average pace, the metres climbed
 * and the time. No calories on the snow: there is no estimate for it yet.
 */

/** Metres a second in km/h or, with miles, in mph: "42.3". */
export function speedOf(mps: number | null, units: Units): string {
  if (mps === null) {
    return NO_NUMBER;
  }
  const kmh = mps * 3.6;
  return (units === "mi" ? kmh / 1.609344 : kmh).toFixed(1);
}

function countOf(count: number | null): string {
  return count === null ? NO_NUMBER : String(count);
}

type Props = {
  run: FreeRun;
  activity: RecordActivity;
  /** Goes back to the day, when its track can still go on. */
  onResume?: () => void;
  /** Leaves the screen, and the day with it. Absent when «Save» and
   * «Discard» are under it (TASK-172). */
  onDone?: () => void;
};

export function SnowFinishCard({ run, activity, onResume, onDone }: Props) {
  const { track } = run;
  // The time, the pace and the metres climbed as a run's.
  const numbers = useRunNumbers(track, false);
  const day = useMemo(() => snowDay(track), [track]);
  const skiing = activity === "skiing";
  const total = runDistanceLabel(skiing ? day.skiedM : track.distanceM, numbers.units);
  const speed = speedUnit(numbers.units);
  return (
    <View style={styles.finish}>
      <Text
        style={styles.total}
        accessibilityLabel={
          skiing
            ? t("Skied: {distance}", { distance: total })
            : t("Distance: {distance}", { distance: total })
        }
      >
        {total}
      </Text>
      {skiing ? (
        <View style={styles.grid}>
          <View style={styles.tiles}>
            <Tile label={t("Descents")} value={countOf(day.descents)} />
            <Tile
              label={t("Vertical")}
              value={
                day.verticalM === null ? NO_NUMBER : String(Math.round(day.verticalM))
              }
              unit="m"
            />
            <Tile
              label={t("Top speed")}
              value={speedOf(day.topMps, numbers.units)}
              unit={speed}
            />
          </View>
          <View style={styles.tiles}>
            <Tile
              label={t("Avg speed")}
              value={speedOf(day.averageMps, numbers.units)}
              unit={speed}
            />
            <Tile label={t("Lifts")} value={countOf(day.lifts?.length ?? null)} />
            <Tile label={t("Time")} value={numbers.time} />
          </View>
        </View>
      ) : (
        <View style={styles.tiles}>
          <Tile
            label={t("Avg pace")}
            value={numbers.average}
            unit={paceUnit(numbers.units)}
          />
          <Tile label={t("Elev. gain")} value={numbers.climb} unit="m" />
          <Tile label={t("Time")} value={numbers.time} />
        </View>
      )}
      <View style={styles.buttons}>
        {/* The post of the day (TASK-231): a line, as a run without a route. */}
        <SharePostButton makeRun={() => postOfTrack(track)} />
        {onResume && (
          <Pressable
            style={styles.button}
            onPress={onResume}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{t("Keep running")}</Text>
          </Pressable>
        )}
        {onDone && (
          <Pressable style={styles.button} onPress={onDone} accessibilityRole="button">
            <Text style={styles.buttonText}>{t("Done")}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  finish: {
    gap: space.md,
  },
  total: {
    color: color.text,
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
  },
  grid: {
    gap: space.sm,
  },
  tiles: {
    flexDirection: "row",
    gap: space.sm,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: space.sm,
  },
  button: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
