import type { Ref } from "react";
import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";

import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";

type Props = TextInputProps & {
  label: string;
  ref?: Ref<TextInput>;
};

/**
 * A labelled field of «Change email» and «Phone number» (TASK-183), as in
 * «Edit profile» (`../profile/EditProfile`).
 */
export function ContactField({ label, ref, ...input }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        style={styles.input}
        placeholderTextColor={color.textFaint}
        keyboardAppearance="dark"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={label.toLowerCase()}
        {...input}
      />
    </View>
  );
}

/** What the two rows share: a row of «Settings» and the form under it. */
export const contactStyles = StyleSheet.create({
  // As the other rows of «Settings» (`../profile/SettingsPage`).
  menu: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  row: {
    minHeight: MIN_TAP_SIZE + space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.md,
  },
  emoji: {
    fontSize: fontSize.input + space.xs,
  },
  rowText: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.medium,
  },
  value: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  form: {
    gap: space.md,
    padding: space.md,
  },
  note: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  // Neutral: the yellow belongs to the route (docs/UI.md, «Il tema»).
  button: {
    minHeight: MIN_TAP_SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  quiet: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  quietText: {
    color: color.error,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  busy: {
    opacity: 0.6,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.body,
  },
});

const styles = StyleSheet.create({
  field: {
    gap: space.xs,
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
  },
  input: {
    minHeight: MIN_TAP_SIZE,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: fontSize.input,
    color: color.text,
    backgroundColor: color.background,
  },
});
