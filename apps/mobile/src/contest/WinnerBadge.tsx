import { StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import { color, fontSize, fontWeight, radius, space } from "../theme/tokens";

type Props = {
  /** The band across a drawing's card, not the badge under a name. */
  band?: boolean;
};

/**
 * «Winner» (TASK-299 part B, docs/CONCORSI.md §7): the badge under the name
 * of who won a contest, and the band on the winning drawing. Neutral, as
 * the tags of a drawing: the yellow belongs to the route, the red to who
 * waits for an answer. The cup is an emoji, the only colour not a token.
 */
export function WinnerBadge({ band = false }: Props) {
  return (
    <View
      style={[styles.badge, band && styles.band]}
      testID={band ? "winner-band" : "winner-badge"}
      accessible
      accessibilityLabel={t("Winner")}
    >
      <Text style={styles.cup} accessibilityElementsHidden>
        🏆
      </Text>
      <Text style={styles.text}>{t("Winner")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: space.xs,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  band: {
    alignSelf: "stretch",
    justifyContent: "center",
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  cup: {
    fontSize: fontSize.body,
  },
  text: {
    color: color.text,
    fontSize: fontSize.small,
    fontWeight: fontWeight.bold,
  },
});
