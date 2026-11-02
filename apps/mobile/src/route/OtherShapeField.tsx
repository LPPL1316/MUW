import { MAX_SHAPE_TEXT_LENGTH, type Shape } from "@shaperoute/shared-types";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { shapeName } from "./shapeWords";

/**
 * Whether the field shows by itself: words typed that are not the name of
 * the shape chosen (a word the AI reads, one it could not), so they are
 * never hidden. A tile picked writes its own name: that keeps it closed.
 */
export function typedOtherShape(text: string, shape: Shape | null): boolean {
  const typed = text.trim().toLowerCase();
  if (typed === "") {
    return false;
  }
  return shape === null || typed !== shapeName(shape).toLowerCase();
}

type Props = {
  /** The shape field as typed, and the shape it names (null: none). */
  text: string;
  shape: Shape | null;
  onText: (text: string) => void;
  /** The runner is done typing: the AI may read it. */
  onDone: () => void;
  /** Under the field: the shape the words name, or why there is none. */
  children?: ReactNode;
};

/**
 * In «Shape», under the grid (TASK-361, the user's choice of 2026-10-30):
 * the field for a shape out of the catalogue, which the AI reads («prancing
 * horse»), behind «Type another shape». The tiles say the shape chosen, so
 * the field no longer repeats it; it opens with a tap, or by itself when
 * the words in it are not a tile's.
 */
export function OtherShapeField({ text, shape, onText, onDone, children }: Props) {
  const [opened, setOpened] = useState(false);
  if (!opened && !typedOtherShape(text, shape)) {
    return (
      <Pressable
        style={styles.link}
        onPress={() => setOpened(true)}
        accessibilityRole="button"
        accessibilityHint={t("Write a shape that is not among the tiles")}
        testID="other-shape-link"
      >
        <Text style={styles.linkText}>{t("Type another shape")}</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.box}>
      <TextInput
        style={styles.field}
        // A picked tile's name is not something typed: the field starts empty.
        value={typedOtherShape(text, shape) ? text : ""}
        onChangeText={onText}
        onEndEditing={onDone}
        maxLength={MAX_SHAPE_TEXT_LENGTH}
        placeholder={t("heart, star, horse…")}
        placeholderTextColor={color.textMuted}
        keyboardAppearance="dark"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        autoFocus={opened}
        accessibilityLabel={t("Type another shape")}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  link: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  // Not yellow: that is the route's. Underlined, so it reads as a link.
  linkText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    textDecorationLine: "underline",
  },
  box: {
    gap: space.sm,
  },
  field: {
    minHeight: MIN_TAP_SIZE,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: fontSize.input,
    color: color.text,
    backgroundColor: color.surface,
  },
});
