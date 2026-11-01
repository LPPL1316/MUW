import { Pressable, StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { useMessagesDoor } from "./messagesDoor";

/** The most the row counts: beyond it, «9+», as the badge of «Profile». */
const COUNT_MAX = 9;

/** A count in a red badge: «9+» beyond the most it says. */
export function countLabel(count: number): string {
  return count > COUNT_MAX ? `${COUNT_MAX}+` : String(count);
}

/**
 * «Messages» on the first page of «Profile» (TASK-319, ADR-0279): a row
 * that opens the conversations over the app, with a red number for the
 * conversations with news and the requests waiting. Nothing until the API
 * has said it has messages: an API older than them, or nobody signed in,
 * shows no row.
 */
export function MessagesRow() {
  const { unread, openList } = useMessagesDoor();
  if (unread === null) {
    return null;
  }
  const count = unread.unread + unread.requests;
  const name = t("Messages");
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => openList("inbox")}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? t("Messages, {count} waiting", { count }) : name}
      testID="messages-row"
    >
      <View style={styles.badge}>
        <Text style={styles.emoji}>✉️</Text>
      </View>
      <Text style={styles.rowText}>{name}</Text>
      {count > 0 && (
        <View style={styles.count}>
          <Text style={styles.countText}>{countLabel(count)}</Text>
        </View>
      )}
      <Text style={styles.rowArrow}>›</Text>
    </Pressable>
  );
}

// As the rows of «Settings» and «Guide» (ProfileHome.tsx).
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  pressed: {
    opacity: 0.6,
  },
  badge: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
  },
  emoji: {
    fontSize: fontSize.title - space.xs,
  },
  rowText: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  // Someone waits for an answer: the red of the follow requests (TASK-239).
  count: {
    minWidth: space.xl,
    height: space.xl,
    paddingHorizontal: space.xs,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: color.badge,
  },
  countText: {
    color: color.onBadge,
    fontSize: fontSize.small,
    fontWeight: fontWeight.bold,
  },
  rowArrow: {
    color: color.textMuted,
    fontSize: fontSize.title,
  },
});
