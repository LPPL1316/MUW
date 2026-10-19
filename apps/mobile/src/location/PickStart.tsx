import type { LatLon } from "@shaperoute/shared-types";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";

type Props = {
  /** The middle of the map, where the pin is; null until the map says. */
  centre: LatLon | null;
  /** «Start here»: the middle of the map becomes the start. */
  onStart: (point: LatLon) => void;
};

/**
 * Under the map while the start is chosen on it (TASK-292, ADR-0252): the
 * pin stays in the middle of the map and the fingers move the map under
 * it; «Start here» takes the point under the pin.
 */
export function PickStart({ centre, onStart }: Props) {
  const enabled = centre !== null;
  return (
    <View style={styles.panel}>
      <Text style={styles.note}>
        {t("Move the map to put the pin where you want to start.")}
      </Text>
      <Pressable
        style={[styles.start, !enabled && styles.off]}
        onPress={() => {
          if (centre !== null) {
            onStart(centre);
          }
        }}
        disabled={!enabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: !enabled }}
      >
        <Text style={styles.startText}>{t("Start here")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: space.md,
  },
  note: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  // As «Draw route»: the one thing to do here.
  start: {
    minHeight: MIN_TAP_SIZE + space.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: color.accent,
  },
  off: {
    opacity: 0.4,
  },
  // Dark on yellow: white does not reach the contrast minimum (ADR-0046).
  startText: {
    color: color.onAccent,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.input,
  },
});
