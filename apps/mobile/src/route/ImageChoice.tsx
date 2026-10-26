import { useContext, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { t } from "../i18n";
import { OpenSettings } from "../permissions/OpenSettings";
import { ImageEditsContext } from "./imageEdits";
import { drawnApart, linesOver } from "./imagePieces";
import { ImagePreview } from "./ImagePreview";
import { OutlineBoard } from "./OutlineBoard";
import type { ImageSource } from "./pickImage";
import { imageProblemText } from "./problems";
import type { ImageProblem, ImageState } from "./useImageOutline";

/**
 * A picture instead of a shape or a word (TASK-073): choose one or take a
 * photo, see the outline the engine traced from it, then draw the route.
 * The outline shows before the route is asked for: if it does not look like
 * the subject, the route will not either.
 *
 * «Edit the outline» opens it on the whole screen, where a finger adds a
 * part or a detail and Undo takes the last one away (TASK-079): one line
 * always, which the engine checks.
 *
 * With `penUp` and pieces apart (TASK-297), the pieces show instead of the
 * strokes: the other subjects without their stems, and the holes. Edits
 * are of the line drawn with the pen down: «Edit the outline» shows with
 * the pen down only.
 */
export function ImageChoice({
  state,
  onChoose,
  penUp = false,
}: {
  state: ImageState;
  onChoose: (source: ImageSource) => void;
  penUp?: boolean;
}) {
  const [showPicture, setShowPicture] = useState(true);
  const [editing, setEditing] = useState(false);
  const edits = useContext(ImageEditsContext);
  const chosen = state.status !== "none" && state.picture !== null;
  const apart = state.status === "traced" && drawnApart(state.outline, penUp);
  return (
    <View style={styles.panel}>
      <View style={styles.row}>
        <Pressable
          style={[styles.button, styles.grow]}
          onPress={() => onChoose("library")}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>
            {chosen ? t("Choose another") : t("Choose picture")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.grow]}
          onPress={() => onChoose("camera")}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{t("Take photo")}</Text>
        </Pressable>
      </View>
      <ImageNote state={state} apart={apart} />
      {state.status === "traced" && (
        <>
          <ImagePreview
            picture={state.picture}
            points={state.outline.image_points}
            strokes={linesOver(state.outline, penUp)}
            aspect={state.outline.aspect}
            showPicture={showPicture}
          />
          <View style={styles.row}>
            <Pressable
              style={styles.link}
              onPress={() => setShowPicture((shown) => !shown)}
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>
                {showPicture ? t("Hide the picture") : t("Show the picture")}
              </Text>
            </Pressable>
          </View>
          {edits && !apart && (
            <>
              <Pressable
                style={styles.button}
                onPress={() => setEditing(true)}
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>{t("Edit the outline")}</Text>
              </Pressable>
              <OutlineBoard
                visible={editing}
                onClose={() => setEditing(false)}
                picture={state.picture}
                outline={state.outline}
                edits={edits}
              />
            </>
          )}
        </>
      )}
    </View>
  );
}

function ImageNote({ state, apart }: { state: ImageState; apart: boolean }) {
  switch (state.status) {
    case "none":
      return (
        <Text style={styles.note}>
          {t(
            "One subject on a plain background works best: a drawing, a logo, an object on a bare table. The route follows its outside line. Up to 4 separate subjects are joined in one line.",
          )}
        </Text>
      );
    case "tracing":
      return <Text style={styles.note}>{t("Tracing the outline…")}</Text>;
    case "traced":
      // Another picture could not be chosen (TASK-254): why, in the place
      // of the note; the outline and its edits stay below.
      if (state.problem) {
        return <ProblemNote problem={state.problem} />;
      }
      if (apart) {
        return (
          <Text style={styles.note}>
            {t(
              "The yellow lines are what the route will draw: each part on its own, going from one to the next without drawing. If they do not look like the subject, the route will not either: try another picture.",
            )}
          </Text>
        );
      }
      return (
        <Text style={styles.note}>
          {t(
            "The yellow line is what the route will draw. If it does not look like the subject, the route will not either: try another picture, or edit the outline. Separate subjects are joined by a short line, which the route runs there and back.",
          )}
        </Text>
      );
    case "failed":
      return <ProblemNote problem={state.problem} />;
  }
}

function ProblemNote({ problem }: { problem: ImageProblem }) {
  const { text, detail } = imageProblemText(problem);
  return (
    <View style={styles.problemBox}>
      <Text style={styles.problem}>{text}</Text>
      {detail && <Text style={styles.detail}>{detail}</Text>}
      {/* The camera refused: where it can be allowed (TASK-259). */}
      {problem.kind === "denied" && <OpenSettings />}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: space.sm,
  },
  row: {
    flexDirection: "row",
    gap: space.sm,
  },
  grow: {
    flex: 1,
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
  link: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  linkText: {
    color: color.text,
    fontWeight: fontWeight.bold,
    textDecorationLine: "underline",
  },
  note: {
    color: color.textMuted,
  },
  problemBox: {
    gap: space.sm,
  },
  problem: {
    color: color.error,
  },
  detail: {
    color: color.textFaint,
    fontSize: fontSize.detail,
  },
});
