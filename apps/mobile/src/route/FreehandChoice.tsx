import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import { color, fontWeight, MIN_TAP_SIZE, radius, space } from "../theme/tokens";
import type { FreehandFigure } from "./freehand";
import { MAX_PREVIEW_HEIGHT, OutlineLines } from "./ImagePreview";

/**
 * «Freehand» in «Draw» (TASK-320, ADR-0280): the figure drawn by hand, in
 * its square as the preview of a picture shows an outline, with «Edit the
 * drawing» under it; or, with none yet, «Draw with your finger», which
 * opens the board. The route is asked with the distance and the start of
 * «Draw», as for a picture.
 */
export function FreehandChoice({
  figure,
  onEdit,
}: {
  figure: FreehandFigure | null;
  /** Opens the board, on the figure or empty. */
  onEdit: () => void;
}) {
  if (figure === null) {
    return (
      <View style={styles.panel}>
        <Pressable style={styles.button} onPress={onEdit} accessibilityRole="button">
          <Text style={styles.buttonText}>{t("Draw with your finger")}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.panel}>
      <FreehandPreview figure={figure} />
      <EditDrawingButton onPress={onEdit} />
    </View>
  );
}

/** «Edit the drawing»: under the shape chosen, under the figure drawn and
 * beside the figures of the result. */
export function EditDrawingButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress} accessibilityRole="button">
      <Text style={styles.buttonText}>{t("Edit the drawing")}</Text>
    </Pressable>
  );
}

/** The figure in a square, in the route's yellow: what the route will
 * draw. It only shows: drawing happens on the board. */
function FreehandPreview({ figure }: { figure: FreehandFigure }) {
  // The room across, measured; then the largest square that fits it and
  // MAX_PREVIEW_HEIGHT, so the distance stays in view.
  const [room, setRoom] = useState(0);
  const side = Math.min(room, MAX_PREVIEW_HEIGHT);
  return (
    <View
      style={styles.room}
      onLayout={(event) => setRoom(event.nativeEvent.layout.width)}
      testID="freehand-preview"
    >
      <View
        style={[styles.frame, { width: side, height: side }]}
        accessibilityRole="image"
        accessibilityLabel={t("Drawing")}
      >
        {side > 0 && (
          <OutlineLines
            points={figure.outline}
            strokes={figure.details}
            width={side}
            height={side}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: space.sm,
  },
  room: {
    width: "100%",
    alignItems: "center",
  },
  frame: {
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: color.surface,
  },
  button: {
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  buttonText: {
    color: color.text,
    fontWeight: fontWeight.bold,
  },
});
