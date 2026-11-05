import { StyleSheet } from "react-native";

import {
  color,
  font,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";

/** The look the screens of a workout at the gym share (TASK-385 part B):
 * the pills of the run's screens, the yellow one for what comes next. */
export const gymStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.background,
  },
  content: {
    paddingHorizontal: space.lg,
    gap: space.lg,
  },
  title: {
    ...font.title,
    color: color.text,
  },
  text: {
    ...font.body,
    color: color.text,
  },
  muted: {
    ...font.small,
    color: color.textMuted,
  },
  row: {
    flexDirection: "row",
    gap: space.sm,
  },
  button: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  primary: {
    borderColor: color.accent,
    backgroundColor: color.accent,
  },
  primaryText: {
    color: color.onAccent,
  },
  disabled: {
    opacity: 0.4,
  },
  danger: {
    color: color.error,
  },
  chip: {
    minHeight: MIN_TAP_SIZE - space.sm,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  chipOn: {
    borderColor: color.accent,
    backgroundColor: color.accent,
  },
  chipText: {
    color: color.text,
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
  },
  chipTextOn: {
    color: color.onAccent,
  },
  input: {
    minHeight: MIN_TAP_SIZE,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
    color: color.text,
    fontSize: fontSize.input,
  },
});
