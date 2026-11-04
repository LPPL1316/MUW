import { StyleSheet, View } from "react-native";

import { color, radius } from "../theme/tokens";

/** The thickness of every stroke. */
const STROKE = 2;

/**
 * The search's small drawings (TASK-344), made of Views as the lens of
 * «Feed» is: the app has no icons and no SVG. Each is hidden from the
 * screen reader: the control around it says what it does.
 */

/** A magnifying glass, drawn: the app has no icons (no react-native-svg). */
export function LensGlyph({
  side = 15,
  tint = color.text,
}: {
  side?: number;
  tint?: string;
}) {
  return (
    <View
      style={{ width: side + STROKE * 2, height: side + STROKE * 2 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.glass, { width: side, height: side, borderColor: tint }]} />
      <View style={[styles.handle, { height: side / 2, backgroundColor: tint }]} />
    </View>
  );
}

/** Three sliders, each with its knob somewhere else: the filters. */
export function SlidersGlyph({ tint = color.text }: { tint?: string }) {
  return (
    <View
      style={styles.sliders}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {[0.25, 0.7, 0.45].map((at, i) => (
        <View key={i} style={styles.slider}>
          <View style={[styles.rail, { backgroundColor: tint }]} />
          <View style={[styles.knob, { left: `${at * 100}%`, borderColor: tint }]} />
        </View>
      ))}
    </View>
  );
}

/** A cross: clear, remove. */
export function CrossGlyph({
  side = 12,
  tint = color.textMuted,
}: {
  side?: number;
  tint?: string;
}) {
  return (
    <View
      style={{ width: side, height: side }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {["45deg", "-45deg"].map((turn) => (
        <View
          key={turn}
          style={[
            styles.bar,
            { width: side, top: side / 2 - STROKE / 2, backgroundColor: tint },
            { transform: [{ rotate: turn }] },
          ]}
        />
      ))}
    </View>
  );
}

const KNOB = 7;

const styles = StyleSheet.create({
  glass: {
    borderRadius: radius.pill,
    borderWidth: STROKE,
  },
  // Out of the glass, down to the right.
  handle: {
    position: "absolute",
    right: 0,
    bottom: STROKE / 2,
    width: STROKE,
    borderRadius: STROKE / 2,
    transform: [{ rotate: "-45deg" }],
  },
  sliders: {
    width: 20,
    height: 18,
    justifyContent: "space-between",
  },
  slider: {
    height: KNOB,
    justifyContent: "center",
  },
  rail: {
    height: STROKE,
    borderRadius: STROKE / 2,
  },
  knob: {
    position: "absolute",
    width: KNOB,
    height: KNOB,
    marginLeft: -KNOB / 2,
    borderRadius: KNOB / 2,
    borderWidth: STROKE,
    backgroundColor: color.surfaceRaised,
  },
  bar: {
    position: "absolute",
    left: 0,
    height: STROKE,
    borderRadius: STROKE / 2,
  },
});
