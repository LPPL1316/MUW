import { ScrollView, StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import { shapeName } from "../i18n/shapeNames";
import { color, fontSize, fontWeight, space } from "../theme/tokens";
import { distanceLabel } from "../units/format";
import { useUnits } from "../units/useUnits";
import { CardMapsCredit, RouteCard } from "./RouteCard";
import { THEMED_IDEAS, type ThemedIdea } from "./themedIdeas";

/** A card's share of the page: the next one peeks in, as «NEARBY TOWNS». */
const CARD_SHARE = 0.42;

type Props = {
  /** What the page has between its side margins. */
  width: number;
  onIdea: (idea: ThemedIdea) => void;
  ideas?: readonly ThemedIdea[];
};

/**
 * «IDEAS FROM EUROPE», at the top of «Ask for a route»: our routes in big
 * cities of Europe, in a row that slides sideways, each on the map of its
 * streets. A tap opens it on the map, as a route asked for.
 */
export function IdeasFromEurope({ width, onIdea, ideas = THEMED_IDEAS }: Props) {
  // Written again when «Settings» changes the units (TASK-182).
  const units = useUnits();
  if (ideas.length === 0) {
    return null;
  }
  const card = Math.round(width * CARD_SHARE);
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{t("IDEAS FROM EUROPE")}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        testID="themed-ideas"
      >
        <View style={styles.row}>
          {ideas.map((idea) => {
            const city = t(idea.city);
            const shape = shapeName(idea.result.shape);
            const category = t(idea.category);
            const distance = distanceLabel(idea.result.distance_m, units);
            return (
              <RouteCard
                key={idea.id}
                width={card}
                line={idea.preview}
                title={`${city} · ${shape}`}
                detail={`${category} · ${distance}`}
                map
                onPress={() => onIdea(idea)}
                accessibilityLabel={`${city}, ${shape}, ${category}, ${distance}`}
              />
            );
          })}
        </View>
      </ScrollView>
      <CardMapsCredit />
    </View>
  );
}

// As «NEARBY TOWNS».
const styles = StyleSheet.create({
  section: {
    gap: space.sm,
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
  },
  row: {
    flexDirection: "row",
    gap: space.md,
  },
});
