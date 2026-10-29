import { useState } from "react";
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
/** The cards seen before the row slides: two and the one that peeks in. */
export const SEEN_AT_FIRST = 3;

/**
 * Whether the card at `index` asks for the map under its line. The maps are
 * taken one at a time for the whole app: ours wait for the page's own
 * routes (`maps`), and only the cards in sight ask, all of them once the
 * row has slid.
 */
export function wantsMap(index: number, maps: boolean, slid: boolean): boolean {
  return maps && (slid || index < SEEN_AT_FIRST);
}

type Props = {
  /** What the page has between its side margins. */
  width: number;
  onIdea: (idea: ThemedIdea) => void;
  ideas?: readonly ThemedIdea[];
  /** False while the page's own routes are loading: their maps go first. */
  maps?: boolean;
};

/**
 * «IDEAS FROM EUROPE», at the top of «Ask for a route»: our routes in big
 * cities of Europe, in a row that slides sideways, each on the map of its
 * streets. A tap opens it on the map, as a route asked for. Under the row,
 * whose the maps are, and whose the places and roads.
 */
export function IdeasFromEurope({
  width,
  onIdea,
  ideas = THEMED_IDEAS,
  maps = true,
}: Props) {
  // Written again when «Settings» changes the units (TASK-182).
  const units = useUnits();
  const [slid, setSlid] = useState(false);
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
        onScroll={() => setSlid(true)}
        scrollEventThrottle={250}
        testID="themed-ideas"
      >
        <View style={styles.row}>
          {ideas.map((idea, index) => {
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
                map={wantsMap(index, maps, slid)}
                onPress={() => onIdea(idea)}
                accessibilityLabel={`${city}, ${shape}, ${category}, ${distance}`}
              />
            );
          })}
        </View>
      </ScrollView>
      <CardMapsCredit />
      {/* The places and the roads of the ideas are OpenStreetMap's. */}
      <Text style={styles.credit}>{t("© OpenStreetMap contributors")}</Text>
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
  // As the maps' credit above it.
  credit: {
    color: color.textFaint,
    fontSize: fontSize.label,
    textAlign: "right",
  },
});
