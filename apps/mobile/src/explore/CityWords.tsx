import { ScrollView, StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import { color, fontSize, fontWeight, space } from "../theme/tokens";
import { distanceLabel, withPoint } from "../units/format";
import { useUnits } from "../units/useUnits";
import { shownWords, type WordExample } from "./exampleRoutes";
import { cityName, type RecommendedRoute } from "./recommendedRoutes";
import { CARD_SHARE } from "./RecommendedRow";
import { CardMapsCredit, RouteCard } from "./RouteCard";

type Props = {
  words: WordExample[];
  /** What the page has between its side margins. */
  width: number;
  onOpen: (route: RecommendedRoute) => void;
  /** The maps' credit under the row: when nothing above it has one. */
  credit: boolean;
};

/**
 * The words written from a chosen city's centre, the pen up between the
 * letters (TASK-279): a row of cards as «NEARBY TOWNS», under the city's
 * shapes. A word is a card from its turn on, as the other shapes; one that
 * does not come out is none, and without any there is no row. A ready one
 * opens on the map as the examples.
 */
export function CityWords({ words, width, onOpen, credit }: Props) {
  // The cards are written again when «Settings» changes the units (TASK-182).
  const units = useUnits();
  const shown = shownWords(words);
  if (shown.length === 0) {
    return null;
  }
  // Two cards whole and the edge of the third, as «NEARBY TOWNS».
  const card = Math.round(width * CARD_SHARE);
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{t("WORDS")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {shown.map((example) => {
            if (example.status !== "ready") {
              return (
                <RouteCard
                  key={example.word}
                  width={card}
                  line={null}
                  title={example.word}
                  detail={t("Drawing…")}
                />
              );
            }
            const { route } = example;
            // With a point, as the examples' cards.
            const distance = distanceLabel(route.route_m, units, withPoint);
            return (
              <RouteCard
                key={example.word}
                width={card}
                line={route.preview}
                // The walks between the letters are not drawn (TASK-226).
                gaps={route.gaps}
                rotationDeg={route.rotation_deg}
                title={`${example.word} · ${distance}`}
                // "Vercelli", or "Trento" as the city's own routes name it.
                detail={cityName(route.city)}
                match={route.similarity}
                map
                onPress={() => onOpen(route)}
                accessibilityLabel={`${example.word}, ${distance}`}
              />
            );
          })}
        </View>
      </ScrollView>
      {credit && shown.some((e) => e.status === "ready") && <CardMapsCredit />}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space.sm,
  },
  // As the label of «NEARBY TOWNS».
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
