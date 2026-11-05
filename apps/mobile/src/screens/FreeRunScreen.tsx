import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { isOnSnow } from "../activities/snow";
import type { FreeRun } from "../navigation/freeRun";
import { freeRunActivity } from "../navigation/freeSport";
import { t } from "../i18n";
import { LocationOff } from "../location/LocationOff";
import { distanceLabel } from "../navigation/phrases";
import {
  AT_START_M,
  compassWords,
  headingDeg,
  relativeDeg,
  toStart,
} from "../navigation/runStats";
import { emptyTrack, type Track } from "../navigation/trackRecorder";
import type { FreeRunState } from "../navigation/useFreeRun";
import { runActivityOf } from "../settings/sport";
import { useSport } from "../settings/useSport";
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
import { useUnits } from "../units/useUnits";
import { RunCard } from "./RunDashboard";
import { RunGrid, useRunNumbers } from "./RunPanel";
import { SnowFinishCard } from "./SnowFinishCard";

/**
 * A run without a route (TASK-149): over the map that follows the runner,
 * where the start is and which way the runner heads; under it the run's
 * card, with its two pages (TASK-169). At the end, how far, how long and
 * the rest of the numbers, and the line that was run.
 */

export function FreeRunBanner({ state }: { state: FreeRunState }) {
  if (state.status === "denied") {
    return (
      <View style={styles.banner}>
        <LocationOff use="record" />
      </View>
    );
  }
  return <StartPointer track={state.status === "running" ? state.track : null} />;
}

/** Where the start is and which way the runner heads: over the map, and on
 * the page of the data in its place. */
function StartPointer({
  track,
  flat = false,
}: {
  track: Track | null;
  flat?: boolean;
}) {
  // The way to the start in the app's units (TASK-182).
  const units = useUnits();
  const heading = useMemo(() => (track ? headingDeg(track) : null), [track]);
  const start = useMemo(() => (track ? toStart(track) : null), [track]);
  const box = flat ? styles.flat : styles.banner;
  if (start === null) {
    return (
      <View style={box}>
        <Text style={styles.message}>{t("Finding your position…")}</Text>
      </View>
    );
  }
  const headingText =
    heading === null
      ? null
      : t("Heading {direction}", { direction: t(compassWords(heading)) });
  if (start.distanceM < AT_START_M) {
    return (
      <View style={box}>
        <Text style={styles.title}>{t("You are at your start")}</Text>
        {headingText && <Text style={styles.message}>{headingText}</Text>}
      </View>
    );
  }
  // As the runner sees it: up is ahead. Before a heading, up is north, as
  // on the map.
  const turn = Math.round(relativeDeg(start.bearing, heading ?? 0));
  return (
    <View
      style={box}
      accessible
      accessibilityLabel={t(
        "Your start: {distance} in a straight line, to the {direction}",
        {
          distance: distanceLabel(start.distanceM, units),
          direction: t(compassWords(start.bearing)),
        },
      )}
    >
      <View style={styles.row}>
        <View style={styles.badge}>
          <Text
            testID="start-arrow"
            style={[styles.arrow, { transform: [{ rotate: `${turn}deg` }] }]}
          >
            ↑
          </Text>
        </View>
        <View style={styles.words}>
          <Text style={styles.distance}>{distanceLabel(start.distanceM, units)}</Text>
          <Text style={styles.title}>{t("Your start, in a straight line")}</Text>
          {headingText && <Text style={styles.message}>{headingText}</Text>}
        </View>
      </View>
    </View>
  );
}

/** No line yet: one track, so the panel is not told again of nothing. */
const NO_TRACK = emptyTrack();

export function FreeRunCard({
  running,
  track = NO_TRACK,
  onStop,
}: {
  /** The GPS is on: there is a run to pause, and pocket mode makes sense. */
  running: boolean;
  /** The line run so far, for the numbers (TASK-164). */
  track?: Track;
  onStop: () => void;
}) {
  // With «Paddle» in «Settings» the numbers are a paddler's (TASK-251),
  // with «Bike» speeds, as along a route (TASK-251 C); a run's as before.
  const sport = runActivityOf(useSport());
  return (
    <RunCard
      track={track}
      live={running}
      heading={<StartPointer track={running ? track : null} flat />}
      onStop={onStop}
      activity={freeRunActivity(sport)}
    />
  );
}

export function FreeFinishBanner() {
  // A day on the snow is a day, not a run (TASK-375 part C).
  const snow = isOnSnow(runActivityOf(useSport()));
  return (
    <View style={styles.banner}>
      <Text style={styles.title}>{snow ? t("Your day") : t("Your run")}</Text>
      <Text style={styles.message}>
        {snow ? t("White: where you skied.") : t("White: what you ran.")}
      </Text>
    </View>
  );
}

type FinishProps = {
  run: FreeRun;
  /** Goes back to the run, when its track can still go on. */
  onResume?: () => void;
  /** Leaves the screen, and the run with it. Absent when the way out is
   * not the card's: «Save» and «Discard», under it (TASK-172). */
  onDone?: () => void;
};

/** The end of a run without a route or, on the snow, of the day
 * (TASK-375 part C): the sport of «Settings» says which. */
export function FreeFinishCard(props: FinishProps) {
  const activity = runActivityOf(useSport());
  return isOnSnow(activity) ? (
    <SnowFinishCard {...props} activity={activity} />
  ) : (
    <RunFinishCard {...props} />
  );
}

function RunFinishCard({ run, onResume, onDone }: FinishProps) {
  const { track } = run;
  // A run that is over: its clock stands at the last fix.
  // On the water, a paddler's numbers: the file says so (TASK-251).
  const numbers = useRunNumbers(track, false, undefined, run.activity);
  // "4.01 km" or, with miles, "2.49 mi" (TASK-182).
  const total = runDistanceLabel(track.distanceM, numbers.units);
  return (
    <View style={styles.finish}>
      <Text
        style={styles.total}
        accessibilityLabel={t("Distance: {distance}", { distance: total })}
      >
        {total}
      </Text>
      <RunGrid numbers={numbers} />
      <View style={styles.finishButtons}>
        {/* The post of the run (TASK-231). */}
        <SharePostButton makeRun={() => postOfTrack(track, run.activity)} />
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

/** The disc of the arrow: a thumb wide, as the round buttons of the run. */
const BADGE = MIN_TAP_SIZE + space.md;

const box = {
  gap: space.xs,
  padding: space.md,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: color.borderStrong,
  backgroundColor: color.surfaceRaised,
} as const;

const styles = StyleSheet.create({
  // Alone at the top of the map: it takes the width the way back leaves.
  banner: {
    ...box,
    flex: 1,
  },
  // On the page of the data: as tall as what it says.
  flat: box,
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  // A dark disc under the arrow, so it reads as a sign (TASK-204).
  badge: {
    width: BADGE,
    height: BADGE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: color.background,
  },
  // The colour of the start (ADR-0040), not the yellow: that is the route's
  // and the main action's (ADR-0046).
  arrow: {
    color: color.startHere,
    fontSize: fontSize.title + space.sm,
    fontWeight: fontWeight.bold,
  },
  words: {
    flex: 1,
  },
  distance: {
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
  title: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  message: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  finish: {
    gap: space.md,
  },
  total: {
    color: color.text,
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
  },
  finishButtons: {
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
