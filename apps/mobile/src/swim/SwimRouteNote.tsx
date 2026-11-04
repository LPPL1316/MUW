import { StyleSheet, Text, View } from "react-native";

import { t, tLater } from "../i18n";
import { color, fontSize, radius, space } from "../theme/tokens";

/** The line under every swim (TASK-323 C), the text the user approved
 * (ADR-0283): where the route stays, and the one rule the notice puts first. */
export const SWIM_ROUTE_NOTE = tLater("Within 150 m of the shore. Never swim alone.");

/**
 * Under every swim route, always, the notice read or not: a note with the
 * stripe of the engine's warnings to watch for (RoutePanel's NoteRow).
 */
export function SwimRouteNote() {
  return (
    <View style={styles.row}>
      <Text style={styles.text}>{t(SWIM_ROUTE_NOTE)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderLeftWidth: 3,
    borderLeftColor: color.warning,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceRaised,
  },
  text: {
    color: color.text,
    fontSize: fontSize.small,
  },
});
