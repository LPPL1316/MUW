import { useContext } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { cityShort } from "../explore/presets";
import { useTapNotSwipe } from "../explore/useTapNotSwipe";
import { t, tLater } from "../i18n";
import type { Start } from "../location/startMode";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { TourScrollContext } from "../tour/tourParts";
import {
  SAMPLE_PICTURES,
  type SamplePicture,
  type SamplePictureId,
} from "./samplePictures";

/**
 * The tours of «CITY TOURS», categories of «Ask for a route» in «Explore»
 * (TASK-134): the user's choice of 2026-10-13. Each is sent as it is, the
 * words the API's tables read, from the start of «Draw».
 */
export const TOUR_CATEGORIES = [
  tLater("Famous Places"),
  tLater("Best Views"),
  tLater("Hidden Gems"),
  tLater("Romantic"),
] as const;

/**
 * Where the tours start from, in words, as «Explore» says it with «Near me»:
 * the app does not know the town of a GPS position, and no API tells it
 * (the user's choice of 2026-10-13: «near your start»). A place searched for
 * is named. Null without a start.
 */
export function toursFrom(start: Start | null): string | null {
  if (start === null) {
    return null;
  }
  return start.source === "search"
    ? t("near {place}", { place: cityShort(start.label) })
    : t("near your start");
}

/** The side of a picture on its tile. */
const PICTURE_SIZE = MIN_TAP_SIZE * 2 - space.sm;

type Props = {
  /** Where the tours start from, in words («near your start»); null when
   * there is no start yet: then there are no tours. */
  where: string | null;
  /** A tour tapped: its category, as the API reads it. */
  onTour: (category: string) => void;
  /** The ready-made picture shown in «Image» now, if one is. */
  chosen: SamplePictureId | null;
  onPicture: (picture: SamplePicture) => void;
};

/**
 * At the foot of «Draw», above «Draw route» (TASK-280): two rows that slide
 * sideways. «CITY TOURS», a themed route through real places around the
 * start, opened on the map as from «Explore»; «PICTURES», silhouettes drawn
 * by us that become the picture of «Image», outline and all.
 */
export function DrawIdeas({ where, onTour, chosen, onPicture }: Props) {
  // The page they sit in: a picture tapped brings «Image» at its top into
  // view, where its outline shows.
  const page = useContext(TourScrollContext);
  return (
    <View style={styles.ideas}>
      {where !== null && (
        <View style={styles.section}>
          <Text style={styles.label}>{t("CITY TOURS")}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
            testID="city-tours"
          >
            {TOUR_CATEGORIES.map((category) => (
              <TourTile
                key={category}
                category={category}
                where={where}
                onPress={() => onTour(category)}
              />
            ))}
          </ScrollView>
        </View>
      )}
      <View style={styles.section}>
        <Text style={styles.label}>{t("PICTURES")}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          testID="pictures"
        >
          {SAMPLE_PICTURES.map((picture) => (
            <PictureTile
              key={picture.id}
              picture={picture}
              selected={picture.id === chosen}
              onPress={() => {
                onPicture(picture);
                page?.view?.scrollTo({ y: 0, animated: true });
              }}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function TourTile({
  category,
  where,
  onPress,
}: {
  category: string;
  where: string;
  onPress: () => void;
}) {
  const tap = useTapNotSwipe(onPress);
  return (
    <Pressable
      style={({ pressed }) => [styles.tour, pressed && styles.pressed]}
      {...tap}
      accessibilityRole="button"
      accessibilityLabel={`${t(category)}, ${where}`}
    >
      <Text style={styles.tourText} numberOfLines={1}>
        {t(category)}
      </Text>
      <Text style={styles.tourWhere} numberOfLines={1}>
        {where}
      </Text>
    </Pressable>
  );
}

function PictureTile({
  picture,
  selected,
  onPress,
}: {
  picture: SamplePicture;
  selected: boolean;
  onPress: () => void;
}) {
  const tap = useTapNotSwipe(onPress);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.picture,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
      {...tap}
      accessibilityRole="button"
      accessibilityLabel={t(picture.name)}
      accessibilityState={{ selected }}
    >
      <Image source={picture.source} style={styles.image} />
      <Text style={[styles.name, selected && styles.selectedName]} numberOfLines={2}>
        {t(picture.name)}
      </Text>
    </Pressable>
  );
}

// As the other rows of tiles: the shapes of «Draw», «NEARBY TOWNS».
const styles = StyleSheet.create({
  ideas: {
    gap: space.lg,
  },
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
    gap: space.sm,
  },
  // A light touch: what is pressed dims, nothing moves.
  pressed: {
    opacity: 0.6,
  },
  // As a category of «Ask for a route».
  tour: {
    width: MIN_TAP_SIZE * 3.5,
    minHeight: 56,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    justifyContent: "center",
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  tourText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  tourWhere: {
    color: color.textMuted,
    fontSize: fontSize.detail,
  },
  // As a shape of the catalogue, a little wider for the picture.
  picture: {
    width: MIN_TAP_SIZE * 2,
    alignItems: "center",
    gap: space.xs,
    padding: space.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  // Chosen is told by the border, not by yellow: that is the route's.
  selected: {
    borderColor: color.text,
    backgroundColor: color.surfaceRaised,
  },
  image: {
    width: PICTURE_SIZE,
    height: PICTURE_SIZE,
    borderRadius: radius.sm,
  },
  name: {
    color: color.textMuted,
    fontSize: fontSize.small,
    textAlign: "center",
  },
  selectedName: {
    color: color.text,
    fontWeight: fontWeight.semibold,
  },
});
