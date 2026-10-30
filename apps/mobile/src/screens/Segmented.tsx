import {
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { color, fontWeight, MIN_TAP_SIZE, radius, space } from "../theme/tokens";

type Props<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** The track: on the screen's background it wants a surface to show. */
  style?: StyleProp<ViewStyle>;
};

/**
 * One choice out of a few, side by side: the start (TASK-054), shape or word
 * (TASK-057). Touching the chosen one again still calls `onChange`: "My
 * position" asks the GPS again with it.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: Props<T>) {
  return (
    <View style={[styles.modes, style]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.mode, selected && styles.modeSelected]}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.modeText, selected && styles.modeTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  modes: {
    flexDirection: "row",
    padding: space.xs,
    gap: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.background,
  },
  mode: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  // Chosen is told by a lighter surface, not by yellow: that is the route's.
  modeSelected: {
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  // On two lines when a label does not fit (TASK-340: «A mano libera»).
  modeText: {
    textAlign: "center",
    color: color.textMuted,
    fontWeight: fontWeight.semibold,
  },
  modeTextSelected: {
    color: color.text,
  },
});
