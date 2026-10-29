import { PROFILE_BADGES, type ProfileBadge } from "@shaperoute/shared-types";
import { StyleSheet, Text, View } from "react-native";

import { WinnerBadge } from "../contest/WinnerBadge";
import { t } from "../i18n";
import { color, fontSize, fontWeight, radius, space } from "../theme/tokens";
import { wholeDistanceLabel } from "../units/format";
import type { Units } from "../units/units";
import { useUnits } from "../units/useUnits";

/** The metres of «30 km drawing», as the API counts it (badges.py). */
export const LONG_DRAWING_M = 30_000;

/** The emoji of each badge: the only colour not a token, as the cup. */
const ICONS: Record<ProfileBadge, string> = {
  first_drawing: "✏️",
  ten_drawings: "🖼️",
  long_drawing: "🛣️",
};

/** What a badge says, in the app's language and units. */
export function badgeText(badge: ProfileBadge, units: Units): string {
  switch (badge) {
    case "first_drawing":
      return t("First drawing");
    case "ten_drawings":
      return t("10 drawings");
    case "long_drawing":
      return t("{distance} drawing", {
        distance: wholeDistanceLabel(LONG_DRAWING_M, units),
      });
  }
}

type Props = {
  /** It won a contest: «Winner» first. */
  winner: boolean;
  /** The badges it earned; null from an API older than TASK-341. */
  badges: readonly ProfileBadge[] | null;
  /** One's own profile: also the badges not earned yet, dimmed. */
  own?: boolean;
};

/**
 * The badges under the name of a profile (TASK-341, ADR-0294): «Winner»
 * (TASK-299), then the first drawing, ten drawings and a drawing of 30 km,
 * as the API decides them. On one's own profile the ones still to earn are
 * there too, dimmed, to say what can be earned; on another's only those
 * earned. Nothing earned and nothing to show: no row.
 */
export function BadgeRow({ winner, badges, own = false }: Props) {
  const units = useUnits();
  const earned = new Set(badges ?? []);
  // From an older API nothing is known of the others: «Winner» alone.
  const shown = PROFILE_BADGES.filter(
    (badge) => earned.has(badge) || (own && badges !== null),
  );
  if (!winner && shown.length === 0) {
    return null;
  }
  return (
    <View style={styles.row} testID="badge-row">
      {winner && <WinnerBadge />}
      {shown.map((badge) => (
        <Badge
          key={badge}
          badge={badge}
          text={badgeText(badge, units)}
          earned={earned.has(badge)}
        />
      ))}
    </View>
  );
}

type BadgeProps = { badge: ProfileBadge; text: string; earned: boolean };

function Badge({ badge, text, earned }: BadgeProps) {
  return (
    <View
      style={[styles.badge, !earned && styles.notEarned]}
      testID={`badge-${badge}`}
      accessible
      accessibilityLabel={earned ? text : t("Not earned yet: {badge}", { badge: text })}
      accessibilityState={{ disabled: !earned }}
    >
      <Text style={styles.icon} accessibilityElementsHidden>
        {ICONS[badge]}
      </Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: space.xs,
  },
  // As WinnerBadge: neutral, the yellow belongs to the route.
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  notEarned: {
    opacity: 0.4,
  },
  icon: {
    fontSize: fontSize.body,
  },
  text: {
    color: color.text,
    fontSize: fontSize.small,
    fontWeight: fontWeight.bold,
  },
});
