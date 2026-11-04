import type { ThemedContest } from "@shaperoute/shared-types";
import { Pressable, StyleSheet, Text } from "react-native";

import type { DrawingEntry } from "../api/drawings";
import { t } from "../i18n";
import { useLanguage } from "../i18n/useLanguage";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { themedOf, themeText } from "./contestApi";
import { type KeptContest, useContestKept } from "./contestKept";
import { useClock } from "./useClock";

/**
 * The monthly challenge that takes entries now on the phone's clock: begun,
 * not ended, not closed. Null without one, as with an API with no themes.
 */
export function enterable(
  kept: KeptContest | null,
  nowMs: number,
): ThemedContest | null {
  const contest = kept === null ? null : themedOf(kept.contest);
  if (
    contest === null ||
    contest.closed_at !== null ||
    nowMs < Date.parse(contest.starts_at) ||
    nowMs >= Date.parse(contest.ends_at)
  ) {
    return null;
  }
  return contest;
}

type Props = {
  entry: DrawingEntry | undefined;
  onEntry: (entry: DrawingEntry) => void;
  disabled?: boolean;
};

/**
 * «Enter “{theme}”» in the form of a drawing (TASK-343 part B,
 * docs/CONCORSI.md §15), under «Who can see it»: the form shows it only for
 * «Everyone» and a run recorded by the app, and it shows only while a
 * challenge takes entries. It changes the choice: the call goes after the
 * drawing is saved, also from the queue of `drawingOutbox`.
 */
export function EnterSwitch({ entry, onEntry, disabled }: Props) {
  const kept = useContestKept();
  const language = useLanguage();
  const contest = enterable(kept, useClock());
  if (contest === null) {
    return null;
  }
  return (
    <SwitchRow
      label={t("Enter “{theme}”", { theme: themeText(contest.theme, language).title })}
      on={entry?.contest === contest.id && entry.entered}
      onChange={(entered) => onEntry({ contest: contest.id, entered })}
      disabled={disabled}
    />
  );
}

/**
 * On or off, in the form and on a post, as the other switches of the app are
 * (`StravaSwitch`, RoutePanel's pen). Not the phone's own: in the simulator
 * (TASK-343 part B) a tap turned it on and never off.
 */
export function SwitchRow({
  label,
  on,
  onChange,
  disabled,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.switch, on && styles.switchOn, disabled && styles.busy]}
      onPress={() => onChange(!on)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      accessibilityLabel={label}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.state, on && styles.stateOn]}>{t(on ? "On" : "Off")}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  switch: {
    minHeight: MIN_TAP_SIZE,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  // A stronger border, not the yellow: that is the route's.
  switchOn: {
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  busy: {
    opacity: 0.6,
  },
  label: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  state: {
    color: color.textFaint,
    fontWeight: fontWeight.semibold,
  },
  stateOn: {
    color: color.text,
  },
});
