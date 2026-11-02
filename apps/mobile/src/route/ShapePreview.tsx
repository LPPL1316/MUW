import type { Shape } from "@shaperoute/shared-types";
import { StyleSheet, Text, View } from "react-native";

import { decimal, t } from "../i18n";
import { color, fontSize, radius, space } from "../theme/tokens";
import { inUnits } from "../units/format";
import type { Units } from "../units/units";
import { useUnits } from "../units/useUnits";
import { OutlineLines } from "./ImagePreview";
import { scaleBar, shapeScale } from "./shapeScale";
import { shapeName } from "./shapeWords";

/** The side of the preview, in points: small beside the distance. */
export const PREVIEW_SIZE = 112;
/** The line, thinner than a picture's: the box is small. */
const PREVIEW_LINE = 2.5;
/** Room around the shape, so the line is not cut at the edge. */
const INSET = space.sm;

/** «500 m», «2 km», «0.3 mi»: a scale bar's length. */
export function barLabel(metres: number, units: Units): string {
  if (units === "mi") {
    return `${decimal(inUnits(metres, "mi"), 1)} mi`;
  }
  return metres < 1000 ? `${metres} m` : `${decimal(metres / 1000, 0)} km`;
}

/** «1,9 × 2,1 km»: the shape's size on the ground. */
export function sizeLabel(widthM: number, heightM: number, units: Units): string {
  return `${decimal(inUnits(widthM, units), 1)} × ${decimal(inUnits(heightM, units), 1)} ${units}`;
}

/**
 * The shape chosen, drawn to scale on a piece of map (TASK-361): its
 * outline, a scale bar and its size on the ground. It follows the shape
 * and the distance as they change; a still picture, no map loaded.
 */
export function ShapePreview({
  shape,
  distanceM,
}: {
  shape: Shape;
  distanceM: number;
}) {
  const units = useUnits();
  const scale = shapeScale(shape, distanceM);
  const bar = scaleBar(scale.boxM);
  const inner = PREVIEW_SIZE - 2 * INSET;
  const size = sizeLabel(scale.widthM, scale.heightM, units);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t("{name}, about {size} on the map", {
        name: shapeName(shape),
        size,
      })}
      testID="shape-preview"
    >
      <View style={styles.map}>
        <View style={[styles.street, styles.streetAcross]} />
        <View style={[styles.street, styles.streetDown]} />
        <View style={styles.lines}>
          <OutlineLines
            points={scale.lines[0] ?? []}
            strokes={scale.lines.slice(1)}
            width={inner}
            height={inner}
            line={PREVIEW_LINE}
          />
        </View>
      </View>
      <View style={styles.facts}>
        <Text style={styles.size}>≈ {size}</Text>
        <View style={[styles.bar, { width: Math.max(space.sm, bar.share * inner) }]} />
        <Text style={styles.barText}>{barLabel(bar.metres, units)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  map: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: color.map.background,
    borderWidth: 1,
    borderColor: color.border,
  },
  // Two streets, so the box reads as a piece of map, not an icon.
  street: {
    position: "absolute",
    backgroundColor: color.map.roadMinor,
  },
  streetAcross: {
    left: 0,
    right: 0,
    top: "38%",
    height: 3,
  },
  streetDown: {
    top: 0,
    bottom: 0,
    left: "62%",
    width: 3,
  },
  lines: {
    position: "absolute",
    left: INSET,
    top: INSET,
    right: INSET,
    bottom: INSET,
  },
  facts: {
    flex: 1,
    gap: space.xs,
  },
  size: {
    color: color.text,
    fontSize: fontSize.body,
  },
  bar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: color.textMuted,
  },
  barText: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
});
