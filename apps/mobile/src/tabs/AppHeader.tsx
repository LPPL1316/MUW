import type { ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, font, MIN_TAP_SIZE, space, tracking } from "../theme/tokens";
import { tourPart } from "../tour/tourParts";
import { TOUR_PART } from "../tour/tourSteps";

const HEART = require("../../assets/ui/tabs/heart.png");

/** The side of the heart of the logo, in points. */
const HEART_SIZE = 22;

type Props = {
  /** At the right: the sport (SportButton). */
  action?: ReactNode;
};

/**
 * The header of the pages of the tab bar (TASK-367, ADR-0311): the yellow
 * heart and «MuW» at the left, the sport at the right, under the status
 * bar and the Dynamic Island. The same on every page: what page is on
 * screen the tab bar says.
 */
export function AppHeader({ action }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.xs }]}>
      {/* The brand, not a control: read once, as its name. */}
      <View style={styles.brand} accessible accessibilityLabel="MuW">
        <Image source={HEART} style={styles.heart} />
        <Text style={styles.name}>MuW</Text>
      </View>
      {action && (
        // The sport, shown by the tour (TASK-266).
        <View ref={tourPart(TOUR_PART.header)} collapsable={false}>
          {action}
        </View>
      )}
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
    gap: space.xs + space.xs / 2,
    minHeight: MIN_TAP_SIZE,
  },
  // The brand's yellow, as the launch's (TASK-181): the logo, not a route.
  heart: {
    width: HEART_SIZE,
    height: HEART_SIZE,
    tintColor: color.accent,
  },
  name: {
    ...font.heading,
    color: color.text,
    letterSpacing: tracking.heading,
  },
});
