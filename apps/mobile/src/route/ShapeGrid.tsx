import { type Shape, SHAPES } from "@shaperoute/shared-types";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { selectionFeel } from "../haptics/haptics";
import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { useTourPart } from "../tour/tourParts";
import { TOUR_PART } from "../tour/tourSteps";
import { SHAPE_SIGNS } from "./ShapeTiles";
import { shapeName } from "./shapeWords";

/** Tiles in a row: four fit a phone with room for the names. */
export const PER_ROW = 4;
/** Shapes shown closed: two rows, the last tile «See all». */
export const SHOWN_CLOSED = PER_ROW * 2 - 1;

/**
 * The shapes the grid shows (TASK-361): all of them when open; closed,
 * the first seven, with the chosen one in the last place when it is not
 * among them, so the shape chosen is always in sight.
 */
export function gridShapes(
  chosen: Shape | null,
  open: boolean,
  shapes: readonly Shape[] = SHAPES,
): Shape[] {
  if (open || shapes.length <= SHOWN_CLOSED + 1) {
    return [...shapes];
  }
  const first = shapes.slice(0, SHOWN_CLOSED);
  if (chosen === null || first.includes(chosen)) {
    return first;
  }
  return [...first.slice(0, SHOWN_CLOSED - 1), chosen];
}

type Props = {
  /** The shape chosen, marked by its border; null for none. */
  chosen: Shape | null;
  /** Gets the shape's name as the runner reads it, as `ShapeTiles` does. */
  onPick: (name: string) => void;
};

/**
 * The shapes of the catalogue in a grid of two rows (TASK-361), in place of
 * the row that slid sideways and was cut at the edge (ADR-0084): nothing
 * hides. The last tile, «See all», opens every shape; «Show fewer» closes.
 */
export function ShapeGrid({ chosen, onPick }: Props) {
  const [open, setOpen] = useState(false);
  // Shown by the tour of the first opening (TASK-266).
  const tourRef = useTourPart(TOUR_PART.shapes);
  const shown = gridShapes(chosen, open);
  const more = !open && shown.length < SHAPES.length;
  return (
    <View ref={tourRef} collapsable={false} style={styles.grid} testID="shape-grid">
      {shown.map((shape) => {
        const selected = shape === chosen;
        return (
          <Pressable
            key={shape}
            style={[styles.tile, selected && styles.selected]}
            onPress={() => {
              selectionFeel();
              onPick(shapeName(shape));
            }}
            accessibilityRole="button"
            accessibilityLabel={shapeName(shape)}
            accessibilityState={{ selected }}
          >
            <Text style={styles.sign}>{SHAPE_SIGNS[shape]}</Text>
            <Text
              style={[styles.name, selected && styles.selectedName]}
              numberOfLines={2}
            >
              {shapeName(shape)}
            </Text>
          </Pressable>
        );
      })}
      {(more || open) && (
        <Pressable
          style={[styles.tile, styles.moreTile]}
          onPress={() => setOpen(!open)}
          accessibilityRole="button"
          accessibilityLabel={
            open
              ? t("Show fewer shapes")
              : t("See all {count} shapes", { count: SHAPES.length })
          }
          accessibilityState={{ expanded: open }}
          testID="shape-grid-more"
        >
          <Text style={styles.moreSign}>
            {open ? "−" : `+${SHAPES.length - shown.length}`}
          </Text>
          <Text style={styles.moreText}>{open ? t("Show fewer") : t("See all")}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  tile: {
    // Four to a row: a quarter of the row less its three gaps.
    flexBasis: "22%",
    flexGrow: 1,
    maxWidth: "24%",
    minHeight: MIN_TAP_SIZE * 2,
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    paddingHorizontal: space.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  // Chosen is told by the border, not by yellow: that is the route's.
  selected: {
    borderColor: color.text,
    borderWidth: 2,
    backgroundColor: color.surfaceRaised,
  },
  sign: {
    color: color.text,
    fontSize: fontSize.title,
  },
  // textMuted, not textFaint: the names are read, not hinted (WCAG AA).
  name: {
    color: color.textMuted,
    fontSize: fontSize.small,
    textAlign: "center",
  },
  selectedName: {
    color: color.text,
    fontWeight: fontWeight.semibold,
  },
  moreTile: {
    borderStyle: "dashed",
    borderColor: color.borderStrong,
  },
  moreSign: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.bold,
  },
  moreText: {
    color: color.text,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
});
