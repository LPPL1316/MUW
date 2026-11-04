import {
  CYCLING_BEST_DISTANCES,
  type PersonalBest,
  RUNNING_BEST_DISTANCES,
} from "@shaperoute/shared-types";
import { StyleSheet, Text, View } from "react-native";

import { dayLabel } from "../activities/activityText";
import { useActivitiesDoor } from "../activities/activitiesDoor";
import { t, tLater } from "../i18n";
import { clockLabel } from "../navigation/freeRun";
import { useDrawingsDoor } from "../social/drawingsDoor";
import {
  color,
  font,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { Hairline } from "../ui/Hairline";
import { Tap } from "../ui/Tap";

/** The names of the distances that are not a number of kilometres. */
const NAMED: Readonly<Record<string, string>> = {
  half: tLater("Half marathon"),
  marathon: tLater("Marathon"),
};

/** «5K», «Half marathon» on foot, as races are called; «40 km» by bike. */
export function distanceName(best: Pick<PersonalBest, "sport" | "distance">): string {
  const named = NAMED[best.distance];
  if (named !== undefined) {
    return t(named);
  }
  const km = best.distance.replace(/k$/, "");
  return best.sport === "running" ? `${km}K` : `${km} km`;
}

/** «24:31», «1:51:02»: the moving time of a best. */
export function bestTime(seconds: number): string {
  return clockLabel(seconds * 1000);
}

/** The bests of `sport` in the order of their distances. */
function ofSport(
  bests: readonly PersonalBest[],
  sport: PersonalBest["sport"],
): PersonalBest[] {
  const order: readonly string[] =
    sport === "running" ? RUNNING_BEST_DISTANCES : CYCLING_BEST_DISTANCES;
  return bests
    .filter((best) => best.sport === sport)
    .sort((a, b) => order.indexOf(a.distance) - order.indexOf(b.distance));
}

type Props = {
  bests: readonly PersonalBest[];
};

/**
 * The personal bests of a profile (TASK-368, ADR-0312), under its totals:
 * on foot, then by bike, each with the distances it has a best of, the
 * time and the day. A best opens its run for who may see it: the drawing
 * for the others, the run of «My activities» for its owner; one of a
 * private run stays closed (the user's choice 7). Nothing without a best.
 */
export function PersonalBests({ bests }: Props) {
  const drawings = useDrawingsDoor();
  const activities = useActivitiesDoor();
  const groups = (
    [
      ["running", t("Run")],
      ["cycling", t("Bike")],
    ] as const
  )
    .map(([sport, name]) => ({ sport, name, bests: ofSport(bests, sport) }))
    .filter((group) => group.bests.length > 0);
  if (groups.length === 0) {
    return null;
  }
  function opener(best: PersonalBest): (() => void) | null {
    const { drawing, key } = best;
    if (key !== null) {
      return () => activities.open({ id: key });
    }
    if (drawing !== null) {
      return () => drawings.open({ id: drawing });
    }
    return null;
  }
  return (
    <View style={styles.box} testID="personal-bests">
      <Text style={styles.title} accessibilityRole="header">
        {t("Personal bests")}
      </Text>
      {groups.map((group, index) => (
        <View key={group.sport} style={styles.group}>
          {index > 0 && <Hairline />}
          <Text style={styles.sport}>{group.name.toUpperCase()}</Text>
          {group.bests.map((best) => (
            <Row key={best.distance} best={best} onOpen={opener(best)} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Row({ best, onOpen }: { best: PersonalBest; onOpen: (() => void) | null }) {
  const name = distanceName(best);
  const time = bestTime(best.seconds);
  const day = dayLabel(best.started_at);
  const said = [name, time, day].filter((part) => part !== "").join(", ");
  const body = (
    <>
      <View style={styles.rowText}>
        <Text style={styles.distance}>{name}</Text>
        {day !== "" && <Text style={styles.day}>{day}</Text>}
      </View>
      <Text style={styles.time}>{time}</Text>
      {/* Its room kept on every row, so the times line up. */}
      <Text
        style={[styles.arrow, onOpen === null && styles.noArrow]}
        importantForAccessibility="no"
      >
        ›
      </Text>
    </>
  );
  // A best of a run who looks cannot see is read, never opened.
  return onOpen === null ? (
    <View style={styles.row} accessible accessibilityLabel={said}>
      {body}
    </View>
  ) : (
    <Tap
      style={styles.row}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={said}
    >
      {body}
    </Tap>
  );
}

// As the totals over it (ProfileStats.tsx): a box on the surface.
const styles = StyleSheet.create({
  box: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  title: {
    ...font.heading,
    color: color.text,
  },
  group: {
    gap: space.xs,
  },
  sport: {
    ...font.label,
    color: color.textMuted,
    paddingTop: space.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: MIN_TAP_SIZE,
    paddingVertical: space.xs,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  distance: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  day: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  time: {
    color: color.text,
    fontSize: fontSize.heading,
    fontWeight: fontWeight.bold,
    fontVariant: ["tabular-nums"],
  },
  arrow: {
    width: space.sm,
    color: color.textFaint,
    fontSize: fontSize.heading,
  },
  noArrow: {
    opacity: 0,
  },
});
