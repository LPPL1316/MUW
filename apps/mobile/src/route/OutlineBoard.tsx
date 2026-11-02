import type { EditKind, ImageOutline, OutlinePoint } from "@shaperoute/shared-types";
import { type ReactNode, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  initialWindowMetrics,
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { t, tLater } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import {
  type BoardView,
  type Box,
  FIT,
  fitBox,
  panned,
  type Pinch,
  pinched,
  pinchOf,
  shareAt,
} from "./boardView";
import { MIN_STEP_SHARE, thinLine } from "./drawnLine";
import type { ImageEdits } from "./imageEdits";
import { LINE, OutlineLines, segmentsOf, Sides } from "./ImagePreview";
import type { Picture } from "./pickImage";
import { editProblemText } from "./problems";

/** The line under the finger, thinner: it is not the outline yet. */
const DRAWN_LINE = 2;

// In English: translated where shown, with t() (TASK-210).
const EDIT_BUTTONS: { kind: EditKind; label: string }[] = [
  { kind: "part", label: tLater("Add a part") },
  { kind: "detail", label: tLater("Add a detail") },
];

/** What to do, before and once a button is on. */
const HINT = tLater("Choose what to add. Two fingers zoom and move the picture.");
const DRAW_HINT: Record<EditKind, string> = {
  part: tLater(
    "Draw a closed shape. Across the yellow line it becomes part of the outline; anywhere else it is joined to the nearest yellow line.",
  ),
  detail: tLater(
    "Draw a line anywhere: it is joined to the nearest yellow line, and the route runs along it and back. Close a loop to make an eye.",
  ),
};

type Point = [x: number, y: number];

/** What the fingers on the board are doing, from touch-down to lift. */
type Gesture =
  | { kind: "none" }
  | { kind: "draw"; line: OutlinePoint[] }
  | { kind: "pan"; from: Point; view: BoardView }
  | { kind: "pinch"; pinch: Pinch }
  /** Two fingers were down: nothing more until all of them lift. */
  | { kind: "done" };

function touchesOf(event: GestureResponderEvent): Point[] {
  const { touches, locationX, locationY } = event.nativeEvent;
  if (touches && touches.length > 0) {
    return touches.map((touch) => [touch.locationX, touch.locationY]);
  }
  return [[locationX, locationY]];
}

/**
 * The outline on the whole screen, to change it with a finger (TASK-079,
 * ADR-0074): out of the page, so the page does not scroll while drawing.
 * With «Add a part» or «Add a detail» on, one finger draws, and the line
 * goes to the API when it lifts; otherwise one finger moves the picture.
 * Two fingers zoom and move it, and the lines keep their width.
 * «Save», at the foot, keeps the edits and closes the board (TASK-229, ADR-0191):
 * the edits are already in the outline, so saving is closing.
 */
export function OutlineBoard({
  visible,
  onClose,
  picture,
  outline,
  edits,
}: {
  visible: boolean;
  onClose: () => void;
  picture: Picture;
  outline: ImageOutline;
  edits: ImageEdits;
}) {
  const [drawing, setDrawing] = useState<EditKind | null>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);
  const [view, setView] = useState<BoardView>(FIT);
  const [line, setLine] = useState<OutlinePoint[]>([]);
  const gesture = useRef<Gesture>({ kind: "none" });
  const box: Box = fitBox(size[0], size[1], outline.aspect);
  const sending = edits.edit.status === "sending";
  const refused =
    edits.edit.status === "refused" ? editProblemText(edits.edit.problem) : null;

  const follow = (next: Gesture) => {
    gesture.current = next;
    setLine(next.kind === "draw" ? next.line : []);
  };

  const onStart = (event: GestureResponderEvent) => {
    const [first] = touchesOf(event);
    follow(
      drawing && !sending
        ? { kind: "draw", line: [shareAt(first, view, box)] }
        : { kind: "pan", from: first, view },
    );
  };

  const onMove = (event: GestureResponderEvent) => {
    const fingers = touchesOf(event);
    const now = gesture.current;
    if (fingers.length >= 2) {
      const [a, b] = fingers;
      if (now.kind === "pinch") {
        setView(pinched(now.pinch, a, b, box));
      } else if (now.kind !== "done") {
        // A second finger: whatever was being drawn is dropped.
        follow({ kind: "pinch", pinch: pinchOf(a, b, view) });
      }
      return;
    }
    if (now.kind === "pinch") {
      follow({ kind: "done" });
    } else if (now.kind === "draw") {
      follow({ ...now, line: [...now.line, shareAt(fingers[0], view, box)] });
    } else if (now.kind === "pan") {
      const [x, y] = fingers[0];
      setView(panned(now.view, x - now.from[0], y - now.from[1], box));
    }
  };

  const onRelease = () => {
    const now = gesture.current;
    follow({ kind: "none" });
    if (now.kind === "draw" && now.line.length >= 2 && drawing) {
      // Zoomed in, a finger draws finer: the step shrinks with the zoom.
      edits.add(drawing, thinLine(now.line, MIN_STEP_SHARE / view.scale));
    }
  };

  const zoomed = view.scale !== 1 || view.x !== 0 || view.y !== 0;
  // Lines of the same width on the screen, whatever the zoom.
  const width = LINE / view.scale;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <BoardScreen>
        <View style={styles.header}>
          <Text style={styles.title}>{t("Edit the outline")}</Text>
          {zoomed && (
            <Pressable
              style={styles.headerButton}
              onPress={() => setView(FIT)}
              accessibilityRole="button"
            >
              <Text style={styles.link}>{t("Fit")}</Text>
            </Pressable>
          )}
        </View>
        <View
          style={styles.board}
          testID="outline-board"
          onLayout={(event) => {
            const { width: w, height: h } = event.nativeEvent.layout;
            setSize([w, h]);
          }}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={onStart}
          onResponderMove={onMove}
          onResponderRelease={onRelease}
          onResponderTerminate={() => follow({ kind: "none" })}
        >
          {box.width > 0 && (
            // No touches below the board: a touch's location is always
            // in the board's own points.
            <View
              pointerEvents="none"
              testID="board-picture"
              style={[
                styles.picture,
                {
                  left: box.left,
                  top: box.top,
                  width: box.width,
                  height: box.height,
                  transform: [
                    { translateX: view.x },
                    { translateY: view.y },
                    { scale: view.scale },
                  ],
                },
              ]}
            >
              <Image
                source={{ uri: picture.uri }}
                style={styles.photo}
                resizeMode="stretch"
              />
              <OutlineLines
                points={outline.image_points}
                strokes={outline.image_strokes}
                width={box.width}
                height={box.height}
                line={width}
              />
              <Sides
                segments={segmentsOf(
                  line,
                  box.width,
                  box.height,
                  DRAWN_LINE / view.scale,
                )}
                line={DRAWN_LINE / view.scale}
                testID="drawn-side"
                faint
              />
            </View>
          )}
        </View>
        <View style={styles.tools}>
          {sending ? (
            <Text style={styles.note}>
              {edits.edit.status === "sending" && edits.edit.kind === "part"
                ? t("Adding the part…")
                : t("Adding the detail…")}
            </Text>
          ) : refused ? (
            <View>
              <Text style={styles.problem}>{refused.text}</Text>
              {refused.detail && <Text style={styles.detail}>{refused.detail}</Text>}
            </View>
          ) : (
            <Text style={styles.note}>{t(drawing ? DRAW_HINT[drawing] : HINT)}</Text>
          )}
          <View style={styles.row}>
            {EDIT_BUTTONS.map(({ kind, label }) => {
              const on = drawing === kind;
              return (
                <Pressable
                  key={kind}
                  style={[styles.button, styles.grow, on && styles.buttonOn]}
                  onPress={() => setDrawing(on ? null : kind)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.buttonText, on && styles.buttonTextOn]}>
                    {t(label)}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              style={[styles.button, edits.earlier.length === 0 && styles.buttonOff]}
              onPress={edits.undo}
              disabled={edits.earlier.length === 0}
              accessibilityRole="button"
              accessibilityState={{ disabled: edits.earlier.length === 0 }}
            >
              <Text style={styles.buttonText}>{t("Undo")}</Text>
            </Pressable>
          </View>
          {/* At the foot, under the thumb: in Expo Go its own button
              covers the top right corner. */}
          <Pressable style={styles.button} onPress={onClose} accessibilityRole="button">
            <Text style={styles.buttonText}>{t("Save")}</Text>
          </Pressable>
        </View>
      </BoardScreen>
    </Modal>
  );
}

/**
 * The board's screen, inside the phone's edges: its own, since «Draw» is a
 * page of the Pager, which gives its pages no top edge (TASK-366).
 */
function BoardScreen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <Edges>{children}</Edges>
    </SafeAreaProvider>
  );
}

function Edges({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  title: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
  },
  headerButton: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
  },
  link: {
    color: color.text,
    fontWeight: fontWeight.bold,
    textDecorationLine: "underline",
  },
  board: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: color.surface,
  },
  picture: {
    position: "absolute",
  },
  photo: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.35,
  },
  tools: {
    gap: space.sm,
    padding: space.lg,
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
  buttonOn: {
    borderColor: color.accent,
    backgroundColor: color.accent,
  },
  buttonOff: {
    opacity: 0.4,
  },
  buttonText: {
    color: color.text,
    fontWeight: fontWeight.bold,
  },
  buttonTextOn: {
    color: color.onAccent,
  },
  note: {
    color: color.textMuted,
  },
  problem: {
    color: color.error,
  },
  detail: {
    color: color.textFaint,
    fontSize: fontSize.detail,
  },
});
