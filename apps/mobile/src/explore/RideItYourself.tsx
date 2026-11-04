import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import { color, fontSize, fontWeight, space } from "../theme/tokens";
import { distanceLabel } from "../units/format";
import { useUnits } from "../units/useUnits";
import { BIKE_IDEAS, type BikeIdea, bikeIdeaName, bikeIdeaRoute } from "./bikeIdeas";
import { wantsMap } from "./IdeasFromEurope";
import type { RecommendedRoute } from "./recommendedRoutes";
import { CardMapsCredit, RouteCard } from "./RouteCard";

/** A card's share of the page, as «IDEAS FROM EUROPE». */
const CARD_SHARE = 0.42;

type Props = {
  /** What the page has between its side margins. */
  width: number;
  onOpen: (route: RecommendedRoute) => void;
  ideas?: readonly BikeIdea[];
  /** False while the page's own routes are loading: their maps go first. */
  maps?: boolean;
};

/**
 * «RIDE IT YOURSELF», under «IDEAS FROM EUROPE» (TASK-364, ADR-0309): bike
 * routes we drew, each on the map of its streets. A tap opens it on the map.
 * Under the row, that nobody has ridden them yet: the distance is the only
 * number a card says.
 */
export function RideItYourself({
  width,
  onOpen,
  ideas = BIKE_IDEAS,
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
      <Text style={styles.label}>{t("RIDE IT YOURSELF")}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={() => setSlid(true)}
        scrollEventThrottle={250}
        testID="bike-ideas"
      >
        <View style={styles.row}>
          {ideas.map((idea, index) => {
            const city = t(idea.city);
            const name = bikeIdeaName(idea);
            const how = t("By bike");
            const distance = distanceLabel(idea.route_m, units);
            return (
              <RouteCard
                key={idea.id}
                width={card}
                line={idea.preview}
                title={`${city} · ${name}`}
                detail={`${how} · ${distance}`}
                map={wantsMap(index, maps, slid)}
                onPress={() => onOpen(bikeIdeaRoute(idea))}
                accessibilityLabel={`${city}, ${name}, ${how}, ${distance}`}
              />
            );
          })}
        </View>
      </ScrollView>
      <CardMapsCredit />
      <Text style={styles.note}>
        {t("Routes drawn by MuW. Nobody has ridden them yet.")}
      </Text>
      {/* The roads of the routes are OpenStreetMap's. */}
      <Text style={styles.credit}>{t("© OpenStreetMap contributors")}</Text>
    </View>
  );
}

// As «IDEAS FROM EUROPE».
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
  note: {
    color: color.textMuted,
    fontSize: fontSize.label,
  },
  credit: {
    color: color.textFaint,
    fontSize: fontSize.label,
    textAlign: "right",
  },
});
