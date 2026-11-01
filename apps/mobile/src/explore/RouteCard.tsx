import type { LatLon } from "@shaperoute/shared-types";
import { useMemo, useState } from "react";
import {
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { t } from "../i18n";

import { type Camera, lineCamera } from "../feed/feedMapPage";
import { useFeedMap } from "../feed/FeedMaps";
import { MAP_CREDIT } from "../feed/FeedPost";
import { turnedLine } from "../feed/turnedLine";
import { bearingOf } from "../map/turnedMap";
import {
  color,
  font,
  fontSize,
  fontWeight,
  radius,
  route as routeLine,
  space,
} from "../theme/tokens";
import { Tap } from "../ui/Tap";
import { thumbSegments } from "./RouteThumb";
import { useTapNotSwipe } from "./useTapNotSwipe";

/** How tall the drawing is, for how wide: room for a figure taller than wide. */
const DRAWING_RATIO = 0.66;
/** The line of a drawing half a phone wide: thicker than in a row's thumb. */
const LINE_WIDTH = 3;
/** Clear around the line, on every side. */
const DRAWING_PAD = space.md;

/** The dots saying whether the drawing or the photo is shown. */
const DOT_SIDE = 5;

/** No line: nothing to lay a map under. */
const NO_LINE: LatLon[] = [];

/** How wide a card is when two stand side by side in `width`, `gap` apart. */
export function cardWidth(width: number, gap: number = space.md): number {
  return Math.max(0, Math.floor((width - gap) / 2));
}

/** How tall the drawing of a card `width` wide is. */
export function cardDrawingHeight(width: number): number {
  return Math.round(width * DRAWING_RATIO);
}

/**
 * What the map under a line is called among the pictures taken: by what it
 * frames, not by its route. An example drawn again keeps its id and may
 * change its line; the same streets are the same picture.
 */
export function framingName(camera: Camera | null): string {
  if (camera === null) {
    return "card";
  }
  const [lon, lat] = camera.center;
  return `card:${lat.toFixed(5)},${lon.toFixed(5)}@${camera.zoom.toFixed(2)}`;
}

/**
 * Whose the maps under the cards are, as their makers ask to be named
 * (`MAP_CREDIT`), in one line. A card is half a phone wide: written on each
 * picture, the credit would cover the names of its towns.
 */
/** "Maps: © OpenStreetMap · …", in the app's language. */
export const cardMapsCredit = (): string =>
  t("Maps: {credit}", { credit: MAP_CREDIT.replace("\n", " · ") });

/** The credit of the maps of a group of cards: once, beside the cards. */
export function CardMapsCredit() {
  return <Text style={styles.credit}>{cardMapsCredit()}</Text>;
}

/**
 * A photo's credit in two: who, then the licence, as the API writes it
 * ("© LBM1948 · CC BY-SA 4.0"). On a narrow card the first is shortened,
 * never the licence. The space between is the licence's margin: a space
 * at the end of a line is dropped.
 */
export function creditParts(credit: string): string[] {
  const at = credit.lastIndexOf(" · ");
  return at < 0 ? [credit] : [credit.slice(0, at + 2), credit.slice(at + 3)];
}

/** A photo on a card: where it is read from, and what is written on it. */
export type CardPhoto = {
  source: { uri: string; headers?: Record<string, string> };
  credit: string | null;
  onError?: () => void;
};

type Props = {
  /** How wide the card is: the drawing fills it. */
  width: number;
  /** The line to draw; null while there is none, as an example not drawn yet. */
  line: LatLon[] | null;
  /** The points of `line` reached without drawing: no segment ends there
   * (a shape drawn in pieces on the water, TASK-226). */
  gaps?: readonly number[];
  /** "Star · 5.1 km". */
  title: string;
  /** Under the title: where it is, or where its drawing has got to. */
  detail?: string;
  /** How much it looks like the shape, from 0 to 1; shown as "97%". */
  match?: number;
  /** Lays the map of its streets under the line, as in «Feed» (TASK-174). */
  map?: boolean;
  /**
   * A town's photo, with the credit its licence asks for written small on
   * it (TASK-283): one swipe after the drawing, or alone on a card with no
   * line. `onError` when it cannot be shown.
   */
  photo?: CardPhoto;
  /**
   * How far the route's shape is turned, counterclockwise
   * (`RouteResult.rotation_deg`): the line and its map are turned the other
   * way, so the drawing reads upright (TASK-232). Without it, north up.
   */
  rotationDeg?: number | null;
  /**
   * Opens the route; without it the card is not a button. A tap opens it, a
   * swipe that ends over the card does not (TASK-196).
   */
  onPress?: () => void;
  /** What a screen reader says in place of the texts. */
  accessibilityLabel?: string;
};

/**
 * A route as a card of «Explore» (TASK-167, ADR-0135): the drawing first,
 * as wide as the card, then what it is and where. Two stand side by side.
 * The line is yellow, the route's colour; nothing else on the card is.
 * With `map`, under the line is the map of where it runs, towns named, once
 * its picture is taken (TASK-174): the pictures are those of «Feed»
 * (TASK-162), taken by its page. Who shows cards with `map` shows
 * `CardMapsCredit` beside them. A finger that slides over a card has not
 * touched it (TASK-196, `useTapNotSwipe`). A route whose shape is turned is
 * drawn turned back, as the map shows it once opened (TASK-232). With
 * `photo`, the drawing comes first and the photo a swipe after it, two dots
 * saying which is shown (TASK-350). The card has the large radius and no
 * border, its words under the drawing in the card's title style, and it
 * answers the finger through `Tap` (TASK-339, ADR-0293).
 */
export function RouteCard({
  width,
  line,
  gaps,
  title,
  detail,
  match,
  map = false,
  photo,
  rotationDeg,
  onPress,
  accessibilityLabel,
}: Props) {
  const height = cardDrawingHeight(width);
  const bearing = bearingOf(rotationDeg);
  const mapped = map && line !== null ? line : NO_LINE;
  const framing = useMemo(
    () => framingName(lineCamera(mapped, width, height, DRAWING_PAD, bearing)),
    [mapped, width, height, bearing],
  );
  const picture = useFeedMap(framing, mapped, width, height, DRAWING_PAD, bearing);
  const segments = useMemo(
    () =>
      line === null
        ? []
        : thumbSegments(turnedLine(line, bearing), width, height, DRAWING_PAD, gaps),
    [line, bearing, width, height, gaps],
  );
  const tap = useTapNotSwipe(onPress);
  const [page, setPage] = useState(0);
  const onPageScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(nativeEvent.contentOffset.x / Math.max(1, width)));
  const drawingPage = (
    <>
      {picture !== null && (
        <Image
          testID="route-card-map"
          style={StyleSheet.absoluteFill}
          source={{ uri: picture }}
          accessible={false}
        />
      )}
      {segments.map((s, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            {
              left: s.left,
              top: s.top - LINE_WIDTH / 2,
              width: s.length + LINE_WIDTH / 2,
              transform: [{ rotate: `${s.angle}deg` }],
            },
          ]}
        />
      ))}
    </>
  );
  const photoPage = photo !== undefined && (
    <>
      <Image
        testID="route-card-photo"
        style={StyleSheet.absoluteFill}
        source={photo.source}
        resizeMode="cover"
        onError={photo.onError}
        accessible={false}
      />
      {photo.credit !== null && (
        <View style={styles.photoCredit} pointerEvents="none">
          <View style={[StyleSheet.absoluteFill, styles.photoCreditShade]} />
          {creditParts(photo.credit).map((part, i) => (
            <Text
              key={i}
              style={[
                styles.photoCreditText,
                i === 0 ? styles.photoCreditWho : styles.photoCreditLicence,
              ]}
              numberOfLines={1}
            >
              {part}
            </Text>
          ))}
        </View>
      )}
    </>
  );
  const body = (
    <>
      <View style={[styles.drawing, { width, height }]} testID="route-card-drawing">
        {photo !== undefined && line !== null ? (
          <>
            <ScrollView
              horizontal
              pagingEnabled
              bounces={false}
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onPageScroll}
              scrollEventThrottle={32}
              testID="route-card-pages"
            >
              {/* The touch is taken inside the pages, as in «Feed»: a card
                  taking it around them would stop them from sliding. */}
              <Tap
                style={{ width, height }}
                onPressIn={tap.onPressIn}
                onPress={tap.onPress}
                accessible={false}
                testID="route-card-first-page"
              >
                {drawingPage}
              </Tap>
              <Tap
                style={{ width, height }}
                onPressIn={tap.onPressIn}
                onPress={tap.onPress}
                accessible={false}
                testID="route-card-second-page"
              >
                {photoPage}
              </Tap>
            </ScrollView>
            <View style={styles.dots} pointerEvents="none" testID="route-card-dots">
              <View style={[StyleSheet.absoluteFill, styles.photoCreditShade]} />
              {[0, 1].map((i) => (
                <View
                  key={i}
                  style={[styles.dot, i !== page && styles.dotOff]}
                  testID={`route-card-dot-${i}`}
                />
              ))}
            </View>
          </>
        ) : photo !== undefined ? (
          photoPage
        ) : (
          drawingPage
        )}
        {match !== undefined && (
          <View style={styles.match}>
            <Text style={styles.matchText}>{`${Math.round(match * 100)}%`}</Text>
          </View>
        )}
      </View>
      <View style={styles.words}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {detail !== undefined && (
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        )}
      </View>
    </>
  );
  if (onPress === undefined) {
    return (
      <View style={[styles.card, { width }]} testID="route-card">
        {body}
      </View>
    );
  }
  return (
    <Tap
      style={[styles.card, { width }]}
      onPressIn={tap.onPressIn}
      onPress={tap.onPress}
      testID="route-card"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {body}
    </Tap>
  );
}

const styles = StyleSheet.create({
  // A drawing or a photo at its face: the large radius, no border (TASK-339).
  card: {
    borderRadius: radius.xl,
    backgroundColor: color.surface,
    overflow: "hidden",
  },
  drawing: {
    backgroundColor: color.map.background,
    overflow: "hidden",
  },
  segment: {
    position: "absolute",
    height: LINE_WIDTH,
    borderRadius: LINE_WIDTH / 2,
    backgroundColor: routeLine.color,
  },
  // Not yellow: that is the line's (docs/UI.md, «Il tema»).
  match: {
    position: "absolute",
    top: space.sm,
    right: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs / 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.background,
  },
  matchText: {
    color: color.text,
    fontSize: fontSize.detail,
    fontWeight: fontWeight.semibold,
  },
  credit: {
    color: color.textFaint,
    fontSize: fontSize.label,
    textAlign: "right",
  },
  // A photo's credit, small in its corner: on a dark shade in both tones,
  // so it reads on any photo (TASK-283).
  photoCredit: {
    position: "absolute",
    right: 0,
    bottom: 0,
    maxWidth: "100%",
    flexDirection: "row",
    paddingHorizontal: space.xs,
    paddingVertical: 1,
    borderTopLeftRadius: radius.sm / 2,
    overflow: "hidden",
  },
  photoCreditShade: {
    backgroundColor: color.scrim,
    opacity: 0.6,
  },
  photoCreditText: {
    color: color.onScrim,
    fontSize: fontSize.label,
  },
  photoCreditWho: {
    flexShrink: 1,
  },
  photoCreditLicence: {
    marginLeft: space.xs,
  },
  // Which page is shown: at the top, where a photo's credit is not, on the
  // credit's shade so it reads on any photo.
  dots: {
    position: "absolute",
    top: space.xs,
    alignSelf: "center",
    flexDirection: "row",
    gap: space.xs,
    padding: space.xs,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  dot: {
    width: DOT_SIDE,
    height: DOT_SIDE,
    borderRadius: DOT_SIDE / 2,
    backgroundColor: color.onScrim,
  },
  dotOff: {
    opacity: 0.4,
  },
  words: {
    gap: 2,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  title: {
    ...font.cardTitle,
    color: color.text,
  },
  // The detail keeps the smaller size: half a phone wide, "Best Views ·
  // 8.1 km" would not fit a size up.
  detail: {
    ...font.detail,
    color: color.textMuted,
  },
});
