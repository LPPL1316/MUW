import type { Activity } from "@shaperoute/shared-types";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";

import { clockLabel } from "../navigation/freeRun";
import { isPaddle, PADDLE_PACE_M, per500S } from "../navigation/paddle";
import { distanceLabel } from "../navigation/phrases";
import { isRide, speedNumber } from "../navigation/ride";
import { useRunControl } from "../navigation/runControl";
import { climbM, kcal } from "../navigation/runMetrics";
import {
  aboutMinutes,
  averagePaceS,
  etaMs,
  lastKmS,
  paceClock,
  recentPaceS,
} from "../navigation/runStats";
import { activeMs, openPause, type Track } from "../navigation/trackRecorder";
import { color, fontSize, fontWeight, radius, space } from "../theme/tokens";
import { metresPer } from "../units/format";
import { paceUnit, perUnitS, runDistanceNumber, speedUnit } from "../units/runFormat";
import type { Units } from "../units/units";
import { useUnits } from "../units/useUnits";

/**
 * The numbers of a run in progress (TASK-164, TASK-169), the same with a
 * route and without one. Few of them under the map (`RunStrip`): how far,
 * the pace now and the time. All of them on the page of the data and while
 * the run is paused (`RunGrid`): also the average pace, the last kilometre,
 * the metres climbed and the energy. On a bike the speed in km/h takes the
 * place of every pace (TASK-216). With miles (TASK-182) the distance is in
 * miles, the paces are a mile's, the last mile takes the place of the last
 * kilometre and the speed is in mph; the metres climbed stay metres. On the
 * water (TASK-251) the speed takes the place of the pace now and of the
 * average pace, as on a bike, and the pace is a paddler's: the average time
 * of 500 m and the last 500 m, with miles too, where a run has the last
 * kilometre and the metres climbed, which a lake does not have.
 */

/** The clock ticks once a second. */
export const TICK_MS = 1000;

/** No number yet: the pace before it means anything. */
export const NO_NUMBER = "–";

/** Now, again every `everyMs` while `on`. */
export function useNow(on: boolean, everyMs: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!on) {
      return;
    }
    // Read the moment it is turned on (TASK-254): the clock read at the
    // mount is as old as the screen, and the countdown would start from it.
    const tick = () => setNow(Date.now());
    tick();
    // Then stale for at most a tick: the clock never goes below 0:00.
    const timer = setInterval(tick, everyMs);
    return () => clearInterval(timer);
  }, [on, everyMs]);
  return now;
}

/** Along a route: the metres left, and the share of it done, 0 to 1. */
export type RouteProgress = { remainingM: number; done: number };

export type RunNumbers = {
  /** "2.34": the kilometres, without their unit; with miles, the miles. */
  km: string;
  /** What the distance, the paces and the speeds are written in (TASK-182). */
  units: Units;
  /** On a bike (TASK-216): `average`, `recent` and `lastKm` are speeds. */
  ride: boolean;
  /** On the water (TASK-251): `average` and `recent` are speeds, `lastKm`
   * is the time of the last whole 500 m. */
  paddle: boolean;
  /** "5:21", or NO_NUMBER before the pace means anything; on a bike
   * "24.3", in km/h. With miles, a mile's pace and mph. */
  average: string;
  recent: string;
  /** The last whole kilometre or, with miles, the last whole mile. */
  lastKm: string;
  /** "5:00": the average time of 500 m, a paddler's pace (TASK-251). */
  pace500: string;
  /** "12:34". */
  time: string;
  /** "42", metres, or NO_NUMBER when the phone gives no height. */
  climb: string;
  /** "187", kilocalories. */
  energy: string;
  /** "3.2 km to go" and "about 17 min", along a route; with miles
   * "2.0 mi to go". */
  toGo: string | null;
  eta: string | null;
};

/**
 * The numbers of `track`, again every second while `live`: the GPS is on
 * and the run is not over. The clock waits during the countdown and during
 * a pause, and a run that is over stops it at its last fix. Along a route
 * of `activity` "cycling" the paces are speeds (TASK-216), and of
 * "paddling" speeds and a pace of 500 m (TASK-251). In the app's units, and
 * again when «Settings» changes them (TASK-182).
 */
export function useRunNumbers(
  track: Track,
  live: boolean,
  route?: RouteProgress,
  activity?: Activity,
): RunNumbers {
  const { phase } = useRunControl();
  const units = useUnits();
  const pause = openPause(track);
  const ticking =
    live && pause === null && phase !== "countdown" && track.fixes.length > 0;
  const now = useNow(ticking, TICK_MS);
  const last = track.fixes[track.fixes.length - 1];
  const at = pause !== null ? pause.fromMs : ticking ? now : (last?.timeMs ?? 0);
  const ms = activeMs(track, at);
  const average = averagePaceS(track, ms);
  const recent = pause === null ? recentPaceS(track, at) : null;
  // Every fix of the run, once per fix and not once per second.
  const ride = isRide(activity);
  const paddle = isPaddle(activity);
  // The last whole kilometre; with miles, the last whole mile; on the
  // water, the last whole 500 m.
  const lastM = paddle ? PADDLE_PACE_M : metresPer(units);
  const lastKm = useMemo(() => lastKmS(track, lastM), [track, lastM]);
  const climbed = useMemo(() => climbM(track), [track]);
  const eta = route ? etaMs(route.remainingM, track, ms) : null;
  // The seconds of a kilometre or of a mile, as a pace or as a speed.
  const said = (seconds: number | null) =>
    seconds === null
      ? NO_NUMBER
      : ride || paddle
        ? speedNumber(seconds)
        : paceClock(seconds);
  // A time as it is: the last 500 m, and the average of 500 m.
  const clock = (seconds: number | null) =>
    seconds === null ? NO_NUMBER : paceClock(seconds);
  // The track's paces are a kilometre's: with miles, a mile's.
  const perUnit = (secondsPerKm: number | null) =>
    secondsPerKm === null ? null : perUnitS(secondsPerKm, units);
  return {
    km: runDistanceNumber(track.distanceM, units),
    units,
    ride,
    paddle,
    average: said(perUnit(average)),
    recent: said(perUnit(recent)),
    lastKm: paddle ? clock(lastKm) : said(lastKm),
    pace500: clock(average === null ? null : per500S(average)),
    time: clockLabel(ms),
    climb: climbed === null ? NO_NUMBER : String(Math.round(climbed)),
    energy: String(kcal(track.distanceM)),
    toGo: route
      ? t("{distance} to go", { distance: distanceLabel(route.remainingM, units) })
      : null,
    eta: eta === null ? null : aboutMinutes(eta),
  };
}

/** Whether `recent` and `average` are speeds: on a bike and on the water. */
function speeds(numbers: RunNumbers): boolean {
  return numbers.ride || numbers.paddle;
}

/** The unit of a pace, or on a bike and on the water of a speed: "/km" and
 * "km/h" or, with miles, "/mi" and "mph". */
function unitOf(numbers: RunNumbers): string {
  return speeds(numbers) ? speedUnit(numbers.units) : paceUnit(numbers.units);
}

/** The name of the last whole kilometre's tile or, with miles, of the last
 * whole mile's. */
function lastLabel(numbers: RunNumbers): string {
  if (numbers.units === "mi") {
    return t("Last mi");
  }
  return t("Last km");
}

/** Under the map, where the map is what is looked at: three numbers, the
 * distance first and largest (TASK-204), with no box around them. */
export function RunStrip({ numbers }: { numbers: RunNumbers }) {
  return (
    <View style={styles.strip}>
      <Metric label={t("Distance")} value={numbers.km} unit={numbers.units} lead />
      <View style={styles.divider} />
      <Metric
        label={speeds(numbers) ? t("Speed now") : t("Pace now")}
        value={numbers.recent}
        unit={unitOf(numbers)}
      />
      <View style={styles.divider} />
      <Metric label={t("Time")} value={numbers.time} />
    </View>
  );
}

/** A number of the strip: the value with its unit, its name under it. */
function Metric({
  label,
  value,
  unit,
  lead = false,
}: {
  label: string;
  value: string;
  unit?: string;
  /** The number looked for first: larger, and given more of the width. */
  lead?: boolean;
}) {
  return (
    <View
      style={[styles.metric, lead && styles.metricLead]}
      accessible
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ""}`}
    >
      <Value value={value} unit={unit} size={lead ? "lead" : "metric"} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** A value and, smaller beside it, its unit. */
function Value({
  value,
  unit,
  size,
}: {
  value: string;
  unit?: string;
  size: "lead" | "metric" | "tile";
}) {
  return (
    <View style={styles.valueRow}>
      {/* An hour and more is seven characters: smaller, never cut. */}
      <Text
        style={[styles.value, size === "lead" && styles.valueLead]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      {unit && <Text style={styles.unit}>{unit}</Text>}
    </View>
  );
}

/** Every number but the distance, three to a row: beside the kilometres
 * on the page of the data, and under them while the run is paused. */
export function RunGrid({ numbers }: { numbers: RunNumbers }) {
  return (
    <View style={styles.grid}>
      <View style={styles.tiles}>
        <Tile
          label={speeds(numbers) ? t("Speed now") : t("Pace now")}
          value={numbers.recent}
          unit={unitOf(numbers)}
        />
        <Tile
          label={speeds(numbers) ? t("Avg speed") : t("Avg pace")}
          value={numbers.average}
          unit={unitOf(numbers)}
        />
        <Tile label={t("Time")} value={numbers.time} />
      </View>
      {numbers.paddle ? (
        // On the water: a paddler's pace where a run has the last
        // kilometre and the metres climbed (TASK-251). Its unit is in the
        // name: beside the number it made the number smaller.
        <View style={styles.tiles}>
          <Tile label={t("Avg /500 m")} value={numbers.pace500} />
          <Tile label={t("Last 500 m")} value={numbers.lastKm} />
        </View>
      ) : (
        <View style={styles.tiles}>
          <Tile
            label={lastLabel(numbers)}
            value={numbers.lastKm}
            unit={unitOf(numbers)}
          />
          <Tile label={t("Elev. gain")} value={numbers.climb} unit="m" />
          {/* The energy is a runner's (KCAL_PER_KG_KM): on a bike it would
              read about three times the truth. Off a run, no tile
              (TASK-255, the user's choice). */}
          {!numbers.ride && (
            <Tile label={t("Calories")} value={numbers.energy} unit="kcal" />
          )}
        </View>
      )}
    </View>
  );
}

/** How much of the route is run, and what is left of it. */
export function RouteBar({
  route,
  numbers,
}: {
  route: RouteProgress;
  numbers: RunNumbers;
}) {
  const percent = Math.round(route.done * 100);
  return (
    <View style={styles.route}>
      <View
        style={styles.bar}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
      >
        <View testID="route-done" style={[styles.done, { width: `${percent}%` }]} />
      </View>
      <View style={styles.left}>
        <Text style={styles.leftText}>{numbers.toGo}</Text>
        {numbers.eta !== null && <Text style={styles.leftText}>{numbers.eta}</Text>}
      </View>
    </View>
  );
}

export function Tile({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <View
      style={styles.tile}
      accessible
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ""}`}
    >
      <Value value={value} unit={unit} size="tile" />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.md,
  },
  metric: {
    flex: 1,
    gap: space.xs,
  },
  metricLead: {
    flex: 1.4,
  },
  // A thin line between two numbers, as tall as they are.
  divider: {
    alignSelf: "stretch",
    width: StyleSheet.hairlineWidth,
    backgroundColor: color.border,
  },
  grid: {
    gap: space.sm,
  },
  tiles: {
    flexDirection: "row",
    gap: space.sm,
  },
  tile: {
    flex: 1,
    gap: space.xs,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: color.background,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: space.xs,
  },
  // Not the yellow: that is the route's and the main action's (ADR-0046).
  value: {
    flexShrink: 1,
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    fontVariant: ["tabular-nums"],
  },
  valueLead: {
    fontSize: fontSize.display,
  },
  unit: {
    color: color.textMuted,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  // Under the number, small and spaced: read after it, not before.
  label: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  route: {
    gap: space.sm,
  },
  bar: {
    height: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
    overflow: "hidden",
  },
  // The route, as far as it is run: the yellow is the route's.
  done: {
    height: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
  },
  left: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: space.md,
  },
  leftText: {
    color: color.textMuted,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
});
