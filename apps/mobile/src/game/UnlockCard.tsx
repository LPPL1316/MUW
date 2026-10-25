import type { GameShape } from "@shaperoute/shared-types";
import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { t } from "../i18n";
import type { Language } from "../i18n/languages";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { shapeNameIn } from "./ShapeCard";
import { ShapeOutline } from "./ShapeOutline";

type Props = {
  shape: GameShape;
  language: Language;
  /** «See collection»: the app shows «Play». */
  onPlay: () => void;
  onClose: () => void;
};

/** How long the pen takes to draw the shape. */
export const DRAW_MS = 1200;
/** The drawing takes this much of the screen's width, never huge. */
const DRAW_SHARE = 0.55;
const DRAW_WIDEST = 260;

/**
 * «New shape unlocked» (TASK-296 part B, docs/GIOCO.md §9): over the app,
 * once the logo after «Save» has gone, the shape is drawn in the yellow,
 * stroke by stroke, with its name. A touch outside closes it.
 */
export function UnlockCard({ shape, language, onPlay, onClose }: Props) {
  const { width } = useWindowDimensions();
  const size = Math.min(width * DRAW_SHARE, DRAW_WIDEST);
  const [draw] = useState(() => new Animated.Value(0));
  const name = shapeNameIn(shape, language);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      t("New shape unlocked: {name}", { name }),
    );
    const drawing = Animated.timing(draw, {
      toValue: 1,
      duration: DRAW_MS,
      useNativeDriver: true,
    });
    drawing.start();
    return () => drawing.stop();
  }, [draw, name]);
  return (
    <Pressable
      style={[StyleSheet.absoluteFill, styles.scrim]}
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel={t("Close")}
      testID="unlock-card"
    >
      <Pressable style={styles.card} onPress={() => {}} accessible={false}>
        <Text style={styles.title}>{t("New shape unlocked")}</Text>
        <ShapeOutline
          outline={shape.outline}
          size={size}
          color={color.accent}
          thickness={5}
          draw={draw}
          testID="unlock-drawing"
        />
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.line}>{t("It is in your collection.")}</Text>
        <View style={styles.buttons}>
          <Pressable
            style={styles.button}
            onPress={onClose}
            accessibilityRole="button"
            testID="unlock-close"
          >
            <Text style={styles.buttonText}>{t("Close")}</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.buttonMain]}
            onPress={onPlay}
            accessibilityRole="button"
            testID="unlock-play"
          >
            <Text style={[styles.buttonText, styles.buttonMainText]}>
              {t("See collection")}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: color.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
  },
  card: {
    alignItems: "center",
    alignSelf: "stretch",
    padding: space.lg,
    borderRadius: radius.sheet,
    backgroundColor: color.surface,
    gap: space.sm,
  },
  title: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  name: {
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
  line: {
    color: color.textMuted,
    fontSize: fontSize.body,
    textAlign: "center",
  },
  buttons: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.md,
    alignSelf: "stretch",
  },
  button: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
    paddingHorizontal: space.md,
  },
  buttonMain: {
    backgroundColor: color.accent,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
  },
  buttonMainText: {
    color: color.onAccent,
  },
});
