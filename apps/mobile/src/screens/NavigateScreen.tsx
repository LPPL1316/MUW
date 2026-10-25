import type { Activity } from "@shaperoute/shared-types";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { type Navigation, remainingM, upcoming } from "../navigation/navigator";
import { t } from "../i18n";
import { useLanguage } from "../i18n/useLanguage";
import { LocationOff } from "../location/LocationOff";
import { ARROWS, distanceLabel } from "../navigation/phrases";
import { wordsOf } from "../voice/words";
import { compassPoint, compassWords, headingDeg, share } from "../navigation/runStats";
import { emptyTrack, type Track } from "../navigation/trackRecorder";
import type { NavigationState } from "../navigation/useNavigation";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { useUnits } from "../units/useUnits";
import { RunCard } from "./RunDashboard";

/**
 * Navigation over the map (TASK-049): the next turn at the top, big enough
 * to read while running, and under the map the run's card, with its two
 * pages (TASK-169). Voice and vibration say the same (useNavigation).
 */

/** The share of the route that is run, 0 to 1. */
function doneOf(navigation: Navigation): number {
  return share(navigation.alongM, navigation.along[navigation.along.length - 1] ?? 0);
}

export function NavigationBanner({ state }: { state: NavigationState }) {
  const track = state.status === "following" ? state.track : null;
  const heading = useMemo(() => (track ? headingDeg(track) : null), [track]);
  if (state.status === "denied") {
    return (
      <View style={styles.banner}>
        <LocationOff use="navigate" />
      </View>
    );
  }
  if (state.status === "starting") {
    return (
      <View style={styles.banner}>
        <Text style={styles.message}>{t("Finding your position…")}</Text>
      </View>
    );
  }
  const { navigation } = state;
  if (navigation.arrived) {
    return (
      <View style={styles.banner}>
        <Text style={styles.instruction}>{t("You have arrived.")}</Text>
      </View>
    );
  }
  return (
    <View style={styles.top}>
      <NextTurn navigation={navigation} />
      {/* How much of the drawing is done, and which way the runner heads. */}
      <View style={styles.chips}>
        <Text style={styles.chip}>
          {t("{percent}% drawn", { percent: Math.round(doneOf(navigation) * 100) })}
        </Text>
        {heading !== null && (
          <Text
            style={styles.chip}
            accessibilityLabel={t("Heading {direction}", {
              direction: t(compassWords(heading)),
            })}
          >
            {t(compassPoint(heading))}
          </Text>
        )}
      </View>
    </View>
  );
}

function NextTurn({ navigation }: { navigation: Navigation }) {
  // The way to the turn in the app's units (TASK-182): metres, or feet,
  // and its words in the app's language (TASK-210): the voice's phrasebook
  // writes the banner too, so a street is said and shown the same way.
  const units = useUnits();
  const words = wordsOf(useLanguage(), units);
  if (navigation.offRoute) {
    return (
      <View style={[styles.box, styles.off]}>
        <Text style={styles.instruction}>{t("Off the route")}</Text>
        <Text style={styles.message}>{t("Head back to the yellow line.")}</Text>
      </View>
    );
  }
  const next = upcoming(navigation);
  if (next === null) {
    return (
      <View style={styles.box}>
        <Text style={styles.instruction}>{t("Follow the route to the end.")}</Text>
      </View>
    );
  }
  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      <View style={styles.row}>
        <View style={styles.badge}>
          <Text style={styles.arrow} accessibilityElementsHidden>
            {ARROWS[next.direction.turn]}
          </Text>
        </View>
        <View style={styles.words}>
          <Text style={styles.distance}>{distanceLabel(next.inM, units)}</Text>
          <Text style={styles.instruction}>{words.direction(next.direction)}</Text>
        </View>
      </View>
      {next.then.length > 0 && (
        <Text style={styles.message}>
          {t("Then {directions}", {
            directions: lower(words.announcement(next.then, null)),
          })}
        </Text>
      )}
    </View>
  );
}

/** No line yet: one track, so the panel is not told again of nothing. */
const NO_TRACK = emptyTrack();

export function NavigationCard({
  navigation,
  track = NO_TRACK,
  onStop,
  activity,
}: {
  navigation: Navigation | null;
  /** The line run so far, for the numbers (TASK-164). */
  track?: Track;
  onStop: () => void;
  /** The route's: on a bike the numbers are speeds (TASK-216). */
  activity?: Activity;
}) {
  const arrived = navigation?.arrived ?? false;
  return (
    <RunCard
      track={track}
      // Without the GPS there is no run to pause, and no pocket mode.
      live={navigation !== null}
      arrived={arrived}
      route={
        navigation
          ? { remainingM: remainingM(navigation), done: doneOf(navigation) }
          : undefined
      }
      // On the page of the data the turn stays, in place of the map.
      heading={
        navigation === null ? undefined : arrived ? (
          <View style={styles.box}>
            <Text style={styles.instruction}>{t("You have arrived.")}</Text>
          </View>
        ) : (
          <NextTurn navigation={navigation} />
        )
      }
      onStop={onStop}
      activity={activity}
    />
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
  // The turn, and under it what the map alone does not say.
  top: {
    flex: 1,
    gap: space.sm,
  },
  box,
  off: {
    borderColor: color.warning,
  },
  chips: {
    flexDirection: "row",
    gap: space.sm,
  },
  chip: {
    overflow: "hidden",
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    color: color.text,
    fontSize: fontSize.detail,
    fontWeight: fontWeight.semibold,
  },
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
  arrow: {
    color: color.accent,
    fontSize: fontSize.title + space.sm,
    fontWeight: fontWeight.bold,
  },
  words: {
    flex: 1,
  },
  distance: {
    color: color.accent,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
  instruction: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  message: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
});

/** "Turn right…" as "turn right…": after "Then". */
function lower(words: string): string {
  return words.charAt(0).toLowerCase() + words.slice(1);
}
