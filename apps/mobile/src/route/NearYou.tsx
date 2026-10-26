import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { CardMapsCredit, RouteCard } from "../explore/RouteCard";
import type { RecommendedRoute } from "../explore/recommendedRoutes";
import { t } from "../i18n";
import { shapeName } from "../i18n/shapeNames";
import { color, fontSize, fontWeight, space } from "../theme/tokens";
import { distanceLabel } from "../units/format";
import { useUnits } from "../units/useUnits";
import type { NearCard } from "./nearYouShapes";

/** A card's share of the page: two whole and the edge of the third, as
 * «NEARBY TOWNS», so the row is seen to go on. */
const CARD_SHARE = 0.42;

type Props = {
  cards: readonly NearCard[];
  /** A ready card tapped: its route opens on the map. */
  onOpen: (route: RecommendedRoute) => void;
};

/**
 * Under the distance of «Draw» (TASK-306): shapes of 5 km ready to run, in
 * a row to scroll. «NEAR YOU» while one of them starts from the phone's
 * position; «SHAPES TO TRY» when all are of other cities, each named under
 * it. Nothing without cards.
 */
export function NearYou({ cards, onOpen }: Props) {
  const units = useUnits();
  const window = useWindowDimensions();
  if (cards.length === 0) {
    return null;
  }
  const card = Math.round((window.width - 2 * space.lg) * CARD_SHARE);
  const nearAny = cards.some((each) => each.near);
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{nearAny ? t("NEAR YOU") : t("SHAPES TO TRY")}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        testID="near-you"
      >
        {cards.map((each) => {
          const name = shapeName(each.shape);
          const key = `${each.near ? "near" : "city"} ${each.shape}`;
          if (each.status === "drawing") {
            return (
              <RouteCard
                key={key}
                width={card}
                line={null}
                title={name}
                detail={t("Drawing…")}
              />
            );
          }
          const { route } = each;
          const distance = distanceLabel(route.route_m, units);
          const city = each.near ? null : route.city;
          return (
            <RouteCard
              key={key}
              width={card}
              line={route.preview}
              rotationDeg={route.rotation_deg}
              title={`${name} · ${distance}`}
              detail={city ?? undefined}
              map
              onPress={() => onOpen(route)}
              accessibilityLabel={
                city === null ? `${name}, ${distance}` : `${name}, ${distance}, ${city}`
              }
            />
          );
        })}
      </ScrollView>
      {cards.some((each) => each.status === "ready") && <CardMapsCredit />}
    </View>
  );
}

// As the other rows of «Draw» and «Explore».
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
    gap: space.md,
  },
});
