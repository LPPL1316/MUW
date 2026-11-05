import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BellButton } from "../bell/BellButton";
import { HeartBadge } from "../intro/HeartBadge";
import { color, fontSize, fontWeight, MIN_TAP_SIZE, space } from "../theme/tokens";
import { tourPart } from "../tour/tourParts";
import { TOUR_PART } from "../tour/tourSteps";

/** The side of the logo's yellow square, in points: as at the top of «Draw»
 * before it moved here. */
const BADGE_SIZE = 32;

type Props = {
  /** At the right: the sport (SportButton). */
  action?: ReactNode;
};

/**
 * The header of the pages of the tab bar (TASK-367, ADR-0311): the logo,
 * the heart of the launch on its yellow and «MuW» (TASK-221), at the left;
 * the bell (part C) and the sport at the right, under the status bar and
 * the Dynamic Island. The same on every page: what page is on screen the
 * tab bar says.
 */
export function AppHeader({ action }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.xs }]}>
      {/* The brand, not a control: read once, as its name. */}
      <View style={styles.brand} accessible accessibilityLabel="MuW">
        <HeartBadge size={BADGE_SIZE} />
        <Text style={styles.name}>MuW</Text>
      </View>
      <View style={styles.right}>
        <BellButton />
        {action && (
          // The sport, shown by the tour (TASK-266).
          <View ref={tourPart(TOUR_PART.header)} collapsable={false}>
            {action}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.xs,
    minHeight: MIN_TAP_SIZE,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: MIN_TAP_SIZE,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  name: {
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
});
