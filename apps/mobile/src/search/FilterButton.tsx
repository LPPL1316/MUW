import { StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import { Tap } from "../ui/Tap";
import { color, fontSize, fontWeight, MIN_TAP_SIZE, radius } from "../theme/tokens";
import { SlidersGlyph } from "./Glyphs";

/** The side of the badge with the number of filters on. */
const BADGE = 18;

type Props = {
  /** How many filters are on: a badge from one. */
  count: number;
  onPress: () => void;
};

/**
 * The button beside the field that opens the filters (TASK-344), round as
 * the lens of «Feed». With filters on, their number in a badge at its top
 * right; VoiceOver reads it after «Filters».
 */
export function FilterButton({ count, onPress }: Props) {
  return (
    <Tap
      style={styles.button}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("Filters")}
      accessibilityValue={count > 0 ? { text: String(count) } : undefined}
      testID="search-filters"
    >
      <SlidersGlyph />
      {count > 0 && (
        <View style={styles.badge} testID="search-filters-count">
          <Text style={styles.count}>{count}</Text>
        </View>
      )}
    </Tap>
  );
}

const styles = StyleSheet.create({
  button: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: BADGE,
    height: BADGE,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BADGE / 2,
    backgroundColor: color.accent,
  },
  count: {
    fontSize: fontSize.label,
    fontWeight: fontWeight.bold,
    color: color.onAccent,
  },
});
