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

/**
 * Over the map of «Draw on the map» (TASK-281): the way back to «Draw», as
 * on the map of a route, and the place the map is of, when «Draw» starts
 * from a place searched for (the phone's position has no name).
 */
export function CanvasTop({
  place,
  onBack,
}: {
  place: string | null;
  onBack: () => void;
}) {
  return (
    <View style={styles.row} pointerEvents="box-none">
      <Pressable
        style={styles.back}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t("Back")}
      >
        <Text style={styles.backText}>←</Text>
      </Pressable>
      {place !== null && (
        <View style={styles.place}>
          <Text style={styles.placeText} numberOfLines={1}>
            {place}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    flexShrink: 1,
  },
  // As the way back of MapScreen.
  back: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  backText: {
    color: color.text,
    fontSize: fontSize.title,
  },
  place: {
    flexShrink: 1,
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
  },
  placeText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
