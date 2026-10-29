import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { keyHeaders } from "../api/apiUrl";
import { t } from "../i18n";
import { shapeName } from "../i18n/shapeNames";
import { color, fontSize, fontWeight, space } from "../theme/tokens";
import { distanceLabel } from "../units/format";
import { useUnits } from "../units/useUnits";
import { usePlacePhotos } from "./placePhotos";
import {
  type CardPhoto,
  CardMapsCredit,
  cardDrawingHeight,
  RouteCard,
} from "./RouteCard";
import { RouteThumb } from "./RouteThumb";
import { THEMED_IDEAS, type ThemedIdea } from "./themedIdeas";

/** A card's share of the page: the next one peeks in, as «NEARBY TOWNS». */
const CARD_SHARE = 0.42;
/** The cards seen before the row slides: two and the one that peeks in. */
export const SEEN_AT_FIRST = 3;
/** The drawing of the shape over a card's photo: this share of its height. */
const SHAPE_SHARE = 0.45;

/** The Wikidata item of the first place the idea passes by that has one:
 * its card shows that place's photo (TASK-329). */
export function ideaItem(idea: ThemedIdea): string | null {
  const stop = idea.result.stops.find(
    (s) => s.passed && typeof s.wikidata === "string",
  );
  return typeof stop?.wikidata === "string" ? stop.wikidata : null;
}

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
  /** Where the places' photos are read from (TASK-329): none without. */
  apiUrl?: string | null;
  fetchFn?: typeof fetch;
};

/**
 * «IDEAS FROM EUROPE», at the top of «Ask for a route»: our routes in big
 * cities of Europe, in a row that slides sideways, each on the map of its
 * streets. A tap opens it on the map, as a route asked for. Under the row,
 * whose the maps are, and whose the places and roads. A card whose first
 * place passed by has a free photo shows it, with its credit and the shape
 * drawn small over it (TASK-329); its map is not taken. One whose photo
 * does not load goes back to its map.
 */
export function IdeasFromEurope({
  width,
  onIdea,
  ideas = THEMED_IDEAS,
  maps = true,
  apiUrl = null,
  fetchFn,
}: Props) {
  // Written again when «Settings» changes the units (TASK-182).
  const units = useUnits();
  const [slid, setSlid] = useState(false);
  const items = useMemo(() => ideas.flatMap((idea) => ideaItem(idea) ?? []), [ideas]);
  const photos = usePlacePhotos(apiUrl, items, fetchFn);
  // The photos that did not load: their cards go back to the map.
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  // One source a photo, as long as the photos are the same: a new one
  // would have the photo read again.
  const sources = useMemo(() => {
    const found = new Map<string, CardPhoto["source"]>();
    for (const photo of photos.values()) {
      if (apiUrl !== null) {
        found.set(photo.url, { uri: `${apiUrl}${photo.url}`, headers: keyHeaders() });
      }
    }
    return found;
  }, [photos, apiUrl]);
  if (ideas.length === 0) {
    return null;
  }
  const card = Math.round(width * CARD_SHARE);
  const shape = Math.round(cardDrawingHeight(card) * SHAPE_SHARE);
  const photoOf = (idea: ThemedIdea): CardPhoto | undefined => {
    const item = ideaItem(idea);
    const photo = item === null ? undefined : photos.get(item);
    const source = photo && sources.get(photo.url);
    if (photo === undefined || source === undefined || broken.has(photo.url)) {
      return undefined;
    }
    return {
      source,
      credit: photo.credit,
      onError: () => setBroken((was) => new Set(was).add(photo.url)),
    };
  };
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
            const name = shapeName(idea.result.shape);
            const category = t(idea.category);
            const distance = distanceLabel(idea.result.distance_m, units);
            const photo = photoOf(idea);
            return (
              <View key={idea.id}>
                <RouteCard
                  width={card}
                  line={idea.preview}
                  title={`${city} · ${name}`}
                  detail={`${category} · ${distance}`}
                  map={wantsMap(index, maps, slid)}
                  photo={photo}
                  onPress={() => onIdea(idea)}
                  accessibilityLabel={`${city}, ${name}, ${category}, ${distance}`}
                />
                {photo !== undefined && (
                  <View style={styles.shape} pointerEvents="none" testID="idea-shape">
                    <RouteThumb line={idea.preview} width={shape} height={shape} />
                  </View>
                )}
              </View>
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
  // The shape small in the photo's corner, inside the card's border.
  shape: {
    position: "absolute",
    top: 1 + space.xs,
    left: 1 + space.xs,
  },
  // As the maps' credit above it.
  credit: {
    color: color.textFaint,
    fontSize: fontSize.label,
    textAlign: "right",
  },
});
