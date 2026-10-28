import { useRef, useState } from "react";
import {
  type GestureResponderEvent,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
import {
  type BoardPoint,
  ERASE_SHARE,
  type FreehandFigure,
  type FreehandProblem,
} from "./freehand";
import { LINE, OutlineLines, segmentsOf, Sides } from "./ImagePreview";

/** The line under the finger, thinner: it is not the figure yet. */
const DRAWN_LINE = 2;
/** A finger that moved less than this, in points, tapped. */
const TAP_POINTS = 8;

// In English: translated where shown, with t() (TASK-210). The texts of
// the first line and of «Erase» are the user's (TASK-320); the others are
// the map's (TASK-281).
const HINT_FIRST = tLater("Draw the outline with one finger: it closes by itself.");
const HINT_MORE = tLater(
  "Draw with one finger. Lines after the first are joined to it.",
);
const HINT_ERASE = tLater(
  "Tap a line to erase it. The outline takes its details with it.",
);

const PROBLEMS: Record<FreehandProblem, string> = {
  open: tLater("This line encloses nothing. Draw a closed shape."),
  crosses: tLater("This line crosses itself. Draw it again without crossing it."),
  too_much: tLater(
    "That is too much for one route. Undo something, or draw simpler lines.",
  ),
};

type Point = [x: number, y: number];

/** What the fingers on the board are doing, from touch-down to lift. */
type Gesture =
  | { kind: "none" }
  | { kind: "draw"; line: BoardPoint[] }
  /** «Erase» on: a tap erases, a finger that moves pans the zoomed board. */
  | { kind: "tap"; from: Point; view: BoardView; moved: boolean }
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

type Props = {
  visible: boolean;
  /** «Save»: the figure is already kept, so saving is closing (ADR-0191). */
  onClose: () => void;
  figure: FreehandFigure | null;
  problem: FreehandProblem | null;
  /** A line drawn, as shares of the board's square. */
  onLine: (line: BoardPoint[]) => void;
  /** A tap with «Erase» on, and how near a line must be, in shares. */
  onErase: (point: BoardPoint, within: number) => void;
  onUndo: () => void;
  canUndo: boolean;
};

/**
 * The board to draw a figure by hand (TASK-320, ADR-0280): a square on the
 * whole screen, out of the page so the page does not scroll while drawing
 * (as the outline's board, TASK-079). One finger draws: the first line is
 * the outline, the lines after it details hung on it, as on the map
 * (ADR-0245). Two fingers zoom and move the square; the lines keep their
 * width. With «Erase» on, a tap takes a line away. «Undo» takes back the
 * last line drawn or erased; «Save», at the foot, closes. Nothing here
 * asks the network.
 */
export function FreehandBoard({
  visible,
  onClose,
  figure,
  problem,
  onLine,
  onErase,
  onUndo,
  canUndo,
}: Props) {
  const [eraseOn, setEraseOn] = useState(false);
  const [size, setSize] = useState<[number, number]>([0, 0]);
  const [view, setView] = useState<BoardView>(FIT);
  const [line, setLine] = useState<BoardPoint[]>([]);
  const gesture = useRef<Gesture>({ kind: "none" });
  const insets = useSafeAreaInsets();
  // The square that fits the board: the figure's frame.
  const box: Box = fitBox(size[0], size[1], 1);
  // With no figure there is nothing to erase: the next line is the outline.
  const erasing = eraseOn && figure !== null;

  const follow = (next: Gesture) => {
    gesture.current = next;
    setLine(next.kind === "draw" ? next.line : []);
  };

  const onStart = (event: GestureResponderEvent) => {
    const [first] = touchesOf(event);
    follow(
      erasing
        ? { kind: "tap", from: first, view, moved: false }
        : { kind: "draw", line: [shareAt(first, view, box)] },
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
    } else if (now.kind === "tap") {
      const [x, y] = fingers[0];
      const [dx, dy] = [x - now.from[0], y - now.from[1]];
      if (now.moved || Math.hypot(dx, dy) >= TAP_POINTS) {
        follow({ ...now, moved: true });
        setView(panned(now.view, dx, dy, box));
      }
    }
  };

  const onRelease = (event: GestureResponderEvent) => {
    const now = gesture.current;
    follow({ kind: "none" });
    if (now.kind === "draw" && now.line.length >= 2) {
      // Zoomed in, a finger draws finer: the step shrinks with the zoom.
      onLine(thinLine(now.line, MIN_STEP_SHARE / view.scale));
    } else if (now.kind === "tap" && !now.moved) {
      const [first] = touchesOf(event);
      onErase(shareAt(first, view, box), ERASE_SHARE / view.scale);
    }
  };

  const zoomed = view.scale !== 1 || view.x !== 0 || view.y !== 0;
  // Lines of the same width on the screen, whatever the zoom.
  const width = LINE / view.scale;
  const hint = erasing ? HINT_ERASE : figure === null ? HINT_FIRST : HINT_MORE;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.screen,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t("Edit the drawing")}</Text>
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
          testID="freehand-board"
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
              testID="board-square"
              style={[
                styles.square,
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
              {figure !== null && (
                <OutlineLines
                  points={figure.outline}
                  strokes={figure.details}
                  width={box.width}
                  height={box.height}
                  line={width}
                />
              )}
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
          {problem !== null ? (
            <Text style={styles.problem}>{t(PROBLEMS[problem])}</Text>
          ) : (
            <Text style={styles.note}>{t(hint)}</Text>
          )}
          <View style={styles.row}>
            <Pressable
              style={[
                styles.button,
                styles.grow,
                erasing && styles.buttonOn,
                figure === null && styles.buttonOff,
              ]}
              onPress={() => setEraseOn((on) => !on)}
              disabled={figure === null}
              accessibilityRole="button"
              accessibilityState={{ selected: erasing, disabled: figure === null }}
            >
              <Text style={[styles.buttonText, erasing && styles.buttonTextOn]}>
                {t("Erase")}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.button, !canUndo && styles.buttonOff]}
              onPress={onUndo}
              disabled={!canUndo}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canUndo }}
            >
              <Text style={styles.buttonText}>{t("Undo")}</Text>
            </Pressable>
          </View>
          {/* At the foot, under the thumb: in Expo Go its own button
              covers the top right corner (ADR-0191). */}
          <Pressable style={styles.button} onPress={onClose} accessibilityRole="button">
            <Text style={styles.buttonText}>{t("Save")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
    backgroundColor: color.background,
  },
  // The square to draw in, told from the board around it.
  square: {
    position: "absolute",
    borderRadius: radius.md,
    backgroundColor: color.surface,
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
});
