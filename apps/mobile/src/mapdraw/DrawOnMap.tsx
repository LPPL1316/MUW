import type { Shape } from "@shaperoute/shared-types";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { t, tLater } from "../i18n";
import type { CanvasMode } from "../map/messages";
import { imageProblemText } from "../route/problems";
import { DrawButton } from "../route/RoutePanel";
import type { SamplePicture } from "../route/samplePictures";
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
import type { Placed } from "./figure";
import { FigureTiles } from "./FigureTiles";
import { placedTile } from "./resultFigure";
import type { ToolProblem } from "./tools";

// Translated where shown, with t().
const MODES = [
  { value: "draw", label: tLater("Draw") },
  { value: "line", label: tLater("Line") },
  { value: "erase", label: tLater("Erase") },
  { value: "move", label: tLater("Move") },
] as const;

/** What the fingers do, said under the switch: with «Draw», a first line
 * stays open unless it ends where it started, and the lines after it join
 * a drawing or a photo (TASK-331); the tools of TASK-331 part B. */
const HINTS: Record<CanvasMode, string> = {
  draw: tLater(
    "Draw with one finger. End where you started to close it. Two fingers move the map.",
  ),
  line: tLater(
    "Tap point after point. Tap the first point to close it, the last one to finish.",
  ),
  erase: tLater(
    "Rub a line to erase that piece. A piece cut off joins the drawing with a dash.",
  ),
  move: tLater(
    "Drag the figure or the map. Hold a line still, then drag to bend it. Two fingers resize.",
  ),
};
const ON_FIGURE = tLater("Each new line joins the drawing. Two fingers move the map.");

const PROBLEMS: Record<ToolProblem, string> = {
  too_much: tLater(
    "That is too much for one route. Undo something, or draw simpler lines.",
  ),
  crosses: tLater("The outline cannot cross itself. Bend it less."),
};

type Props = {
  mode: CanvasMode;
  onMode: (mode: CanvasMode) => void;
  placed: Placed | null;
  onPick: (shape: Shape) => void;
  /** A ready-made picture of «Draw» (TASK-280). */
  onSample: (sample: SamplePicture) => void;
  photo: ImageState;
  onPhoto: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onRedo: () => void;
  canRedo: boolean;
  /** «Clear all»: asked first; on with a figure. */
  onClear: () => void;
  /** What the figure would make, in metres; none without a figure. */
  distanceM: number | null;
  problem: ToolProblem | null;
  /** «Draw route»: on with a figure. */
  onDraw: (() => void) | null;
};

/**
 * Under the map of «Draw on the map» (TASK-281): «Draw | Line | Erase |
 * Move» (TASK-331), «Undo», «Redo» and «Clear all» (TASK-331 part B), what
 * the fingers do, a row of tiles that put a figure on the map or change it
 * where it is («+ photo» first, then the shapes of the catalogue and the
 * ready-made pictures of «Draw»), the distance the figure would make, and
 * «Draw route».
 */
export function DrawOnMap({
  mode,
  onMode,
  placed,
  onPick,
  onSample,
  photo,
  onPhoto,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  onClear,
  distanceM,
  problem,
  onDraw,
}: Props) {
  const askClear = () =>
    Alert.alert(t("Clear the whole drawing?"), undefined, [
      { text: t("Cancel"), style: "cancel" },
      { text: t("Clear all"), style: "destructive", onPress: onClear },
    ]);
  return (
    <View style={styles.panel}>
      <Segmented
        options={MODES.map((option) => ({ ...option, label: t(option.label) }))}
        value={mode}
        onChange={onMode}
      />
      <View style={styles.top}>
        <Step label={t("Undo")} onPress={onUndo} enabled={canUndo} />
        <Step label={t("Redo")} onPress={onRedo} enabled={canRedo} />
        <View style={styles.gap} />
        <Step label={t("Clear all")} onPress={askClear} enabled={placed !== null} />
      </View>
      <Note
        mode={mode}
        // A line joins a drawing or a photo; on a shape it is a new drawing.
        onFigure={placed !== null && placed.figure.kind !== "shape"}
        photo={photo}
        problem={problem}
      />
      <FigureTiles
        chosen={placedTile(placed)}
        onChoose={(choice) => {
          if (choice.kind === "shape") {
            onPick(choice.shape);
          } else {
            onSample(choice.sample);
          }
        }}
        onPhoto={onPhoto}
        photoBusy={photo.status === "tracing"}
        testID="map-tiles"
      />
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

/** «Undo», «Redo» or «Clear all»: a pill, faint while it would do nothing. */
function Step({
  label,
  onPress,
  enabled,
}: {
  label: string;
  onPress: () => void;
  enabled: boolean;
}) {
  return (
    <Pressable
      style={[styles.step, !enabled && styles.off]}
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
    >
      <Text style={styles.stepText}>{label}</Text>
    </Pressable>
  );
}

/** One line: why the last line, tool or photo gave nothing, the photo
 * being traced, or what the fingers do; with «Draw» on a figure, that a
 * line joins it. */
function Note({
  mode,
  onFigure,
  photo,
  problem,
}: {
  mode: CanvasMode;
  onFigure: boolean;
  photo: ImageState;
  problem: ToolProblem | null;
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
  const hint = mode === "draw" && onFigure ? ON_FIGURE : HINTS[mode];
  return <Text style={styles.note}>{t(hint)}</Text>;
}

/** Two lines of the note, kept whatever it says: the modes do not move the
 * tiles up and down. */
const NOTE_HEIGHT = Math.ceil(fontSize.small * 1.35) * 2;

const styles = StyleSheet.create({
  panel: {
    gap: space.sm,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  gap: {
    flex: 1,
  },
  step: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  stepText: {
    color: color.text,
    fontWeight: fontWeight.bold,
  },
  off: {
    opacity: 0.4,
  },
  note: {
    minHeight: NOTE_HEIGHT,
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  problem: {
    minHeight: NOTE_HEIGHT,
    color: color.error,
    fontSize: fontSize.small,
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
