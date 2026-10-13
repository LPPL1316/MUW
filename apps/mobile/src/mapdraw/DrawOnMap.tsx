import { type Shape, SHAPES } from "@shaperoute/shared-types";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { t, tLater } from "../i18n";
import type { CanvasMode } from "../map/messages";
import { imageProblemText } from "../route/problems";
import { DrawButton } from "../route/RoutePanel";
import { SHAPE_SIGNS } from "../route/ShapeTiles";
import { shapeName } from "../route/shapeWords";
import type { ImageState } from "../route/useImageOutline";
import { Segmented } from "../screens/Segmented";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { distanceLabel } from "../units/format";
import type { DrawingProblem } from "./drawing";
import type { Placed } from "./figure";

// Translated where shown, with t().
const MODES = [
  { value: "draw", label: tLater("Draw") },
  { value: "move", label: tLater("Move") },
] as const;

/** What the fingers do, said under the switch. */
const HINTS: Record<CanvasMode, string> = {
  draw: tLater("Draw with one finger. Lines after the first are joined to it."),
  move: tLater("Drag the figure or the map. Two fingers on the figure resize it."),
};

const PROBLEMS: Record<DrawingProblem, string> = {
  crosses: tLater("This line crosses itself. Draw it again without crossing it."),
  too_much: tLater(
    "That is too much for one route. Undo something, or draw simpler lines.",
  ),
};

type Props = {
  mode: CanvasMode;
  onMode: (mode: CanvasMode) => void;
  placed: Placed | null;
  onPick: (shape: Shape) => void;
  photo: ImageState;
  onPhoto: () => void;
  onUndo: () => void;
  canUndo: boolean;
  /** What the figure would make, in metres; none without a figure. */
  distanceM: number | null;
  problem: DrawingProblem | null;
  /** «Draw route»: on with a figure. */
  onDraw: (() => void) | null;
};

/**
 * Under the map of «Draw on the map» (TASK-281): «Draw | Move» and «Undo»,
 * what the fingers do, a row of tiles that put a figure on the map or
 * change it where it is («+ photo» first, then the shapes of the
 * catalogue), the distance the figure would make, and «Draw route».
 */
export function DrawOnMap({
  mode,
  onMode,
  placed,
  onPick,
  photo,
  onPhoto,
  onUndo,
  canUndo,
  distanceM,
  problem,
  onDraw,
}: Props) {
  const chosen = placed?.figure.kind === "shape" ? placed.figure.shape : null;
  return (
    <View style={styles.panel}>
      <View style={styles.top}>
        <Segmented
          options={MODES.map((option) => ({ ...option, label: t(option.label) }))}
          value={mode}
          onChange={onMode}
          style={styles.modes}
        />
        <Pressable
          style={[styles.undo, !canUndo && styles.off]}
          onPress={onUndo}
          disabled={!canUndo}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canUndo }}
        >
          <Text style={styles.undoText}>{t("Undo")}</Text>
        </Pressable>
      </View>
      <Note mode={mode} photo={photo} problem={problem} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
        testID="map-tiles"
      >
        <Pressable
          style={[styles.tile, styles.photo]}
          onPress={onPhoto}
          disabled={photo.status === "tracing"}
          accessibilityRole="button"
        >
          <Text style={styles.photoText}>{t("+ photo")}</Text>
        </Pressable>
        {SHAPES.map((shape) => {
          const selected = shape === chosen;
          return (
            <Pressable
              key={shape}
              style={[styles.tile, selected && styles.selected]}
              onPress={() => onPick(shape)}
              accessibilityRole="button"
              accessibilityLabel={shapeName(shape)}
              accessibilityState={{ selected }}
            >
              <Text style={styles.sign}>{SHAPE_SIGNS[shape]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.foot}>
        <Text style={styles.distance} testID="map-distance">
          {distanceM === null ? " " : `≈ ${distanceLabel(distanceM)}`}
        </Text>
        <View style={styles.draw}>
          <DrawButton enabled={onDraw !== null} onDraw={() => onDraw?.()} />
        </View>
      </View>
    </View>
  );
}

/** One line: why the last line or photo gave nothing, the photo being
 * traced, or what the fingers do. */
function Note({
  mode,
  photo,
  problem,
}: {
  mode: CanvasMode;
  photo: ImageState;
  problem: DrawingProblem | null;
}) {
  if (problem !== null) {
    return <Text style={styles.problem}>{t(PROBLEMS[problem])}</Text>;
  }
  if (photo.status === "tracing") {
    return <Text style={styles.note}>{t("Tracing the outline…")}</Text>;
  }
  const refused =
    photo.status === "failed"
      ? photo.problem
      : photo.status === "traced"
        ? (photo.problem ?? null)
        : null;
  if (refused !== null) {
    return <Text style={styles.problem}>{imageProblemText(refused).text}</Text>;
  }
  return <Text style={styles.note}>{t(HINTS[mode])}</Text>;
}

const TILE = MIN_TAP_SIZE + space.md;

const styles = StyleSheet.create({
  panel: {
    gap: space.sm,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  modes: {
    flex: 1,
  },
  undo: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  undoText: {
    color: color.text,
    fontWeight: fontWeight.bold,
  },
  off: {
    opacity: 0.4,
  },
  note: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.small,
  },
  row: {
    gap: space.sm,
  },
  tile: {
    width: TILE,
    height: TILE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceRaised,
  },
  // Chosen is told by the border, not by yellow: that is the route's.
  selected: {
    borderColor: color.text,
  },
  photo: {
    width: TILE + space.xl,
    borderColor: color.borderStrong,
  },
  photoText: {
    color: color.text,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  sign: {
    color: color.text,
    fontSize: fontSize.title,
  },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  distance: {
    minWidth: 88,
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.bold,
  },
  draw: {
    flex: 1,
  },
});
