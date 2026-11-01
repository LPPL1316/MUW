import { type ReactNode, useMemo, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { drawingPhotoSource } from "../api/drawings";
import { cityName } from "../explore/recommendedRoutes";
import { thumbSegments } from "../explore/RouteThumb";
import { t, tLater } from "../i18n";
import { shapeName } from "../i18n/shapeNames";
import { bearingOf } from "../map/turnedMap";
import { paddlePaceLabel } from "../navigation/paddle";
import { durationLabel } from "../screens/FinishScreen";
import { SPORTS } from "../settings/sport";
import { useBlockedNow } from "../social/blockedNow";
import { useFollowsDoor } from "../social/followsDoor";
import { ReportMenu } from "../social/ReportMenu";
import {
  color,
  font,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  route as routeLine,
  space,
} from "../theme/tokens";
import { Scrim } from "../ui/Scrim";
import { Tap } from "../ui/Tap";
import { distanceLabel, paceLabel } from "../units/format";
import { useUnits } from "../units/useUnits";
import { useFeedMap } from "./FeedMaps";
import { isImportedPost, isShown } from "./feedPosts";
import { postEnergy } from "./postEnergy";
import type { SamplePost } from "./sampleFeed";
import { turnedLine } from "./turnedLine";

/** How tall the drawing is, for how wide: most figures are wider than tall. */
const DRAWING_RATIO = 0.62;
/** The line of a drawing this wide: thicker than on a card of «Explore». */
const LINE_WIDTH = 3;
/** Clear around the line, on every side. */
const DRAWING_PAD = space.xl;
/** How far a finger may move, in points, and still have tapped. */
const TAP_SLOP = 12;
/** The side of a dot under the photos. */
const DOT = 6;
/** How far up a photo the dark under its words reaches (TASK-339). */
export const SCRIM_HEIGHT = 150;

/** How tall the drawing of a card `width` wide is. */
export function drawingHeight(width: number): number {
  return Math.round(width * DRAWING_RATIO);
}

/**
 * Whose the map is, as its makers ask to be named (`ATTRIBUTION` in
 * `map/mapStyle`), on every picture of it. In two lines, in a corner.
 * In English: shown with `t(MAP_CREDIT)` (TASK-210).
 */
export const MAP_CREDIT = tLater("OpenFreeMap © OpenMapTiles\nData from OpenStreetMap");

type Props = {
  post: SamplePost;
  /** How wide the card is: the drawing fills it. */
  width: number;
  /** Opens its route on the map; without it the card is not a button. */
  onOpen?: () => void;
};

/** "dog_head" → "Dog head", in the app's language. */
export function shapeLabel(shape: string): string {
  return shapeName(shape);
}

/** The sports' names, as their buttons say them: shown with `t(name)`, in
 * the app's language («Pagaia», «Bici»; TASK-210, part H). */
const PADDLE = SPORTS.find((sport) => sport.id === "paddle")?.name ?? tLater("Paddle");
const BIKE = SPORTS.find((sport) => sport.id === "bike")?.name ?? tLater("Bike");

/**
 * "Moon · 4.9 km · 27 min · 5:32 /km": what was drawn, how far, how long,
 * the average pace (TASK-326). A drawing on the water says so first, and
 * its pace is a paddler's, "Paddle · Moon · 2.0 km · 24 min · 6:00 /500 m"
 * (TASK-228); one on a bike "Bike · …" (TASK-118), its pace a kilometre's
 * as in «My activities». In the app's units (TASK-182): "Moon · 3.0 mi ·
 * 27 min · 8:54 /mi". A member's drawing says what it draws in its own
 * words, a word or a route's title, and a run without a route says only
 * how far, how long and how fast. A run too short has no pace. An activity
 * added from a file of another app says so before all, "Imported · 4.9 km ·
 * 27 min" (TASK-312). A run ends with its energy, "· 355 kcal" (TASK-345).
 */
export function postFacts(post: SamplePost): string {
  const what = post.what === undefined ? shapeLabel(post.shape) : post.what;
  // A member's drawing has the seconds; an example only its minutes.
  const ms = isShown(post) ? post.drawing.duration_s * 1000 : post.minutes * 60_000;
  const facts = [
    what,
    distanceLabel(post.route_m),
    durationLabel(post.minutes * 60_000),
    post.activity === "paddling"
      ? paddlePaceLabel(post.route_m, ms)
      : paceLabel(post.route_m, ms),
    postEnergy(post),
  ]
    .filter((fact): fact is string => fact !== null)
    .join(" · ");
  const sport =
    post.activity === "paddling" ? PADDLE : post.activity === "cycling" ? BIKE : null;
  const withSport = sport === null ? facts : `${t(sport)} · ${facts}`;
  return isImportedPost(post) ? `${t("Imported")} · ${withSport}` : withSport;
}

/**
 * A drawing in «Feed» (TASK-156): who ran it and where, the line, its
 * title. The line is yellow, the route's colour. Nothing is written over the
 * drawing but the map's credit: its score is neither shown nor read out
 * (TASK-241). Under
 * the line, once its picture is taken, the map of where it was run
 * (TASK-162). With `onOpen` a tap opens its route on the map, to keep among
 * the favorites or to run (TASK-188). A drawing on the water is drawn the
 * same, in pieces when its shape is (TASK-228). A figure the engine turned
 * is drawn turned back, line and map, so it reads upright (TASK-232). A
 * drawing a member published is shown the same (TASK-118): its tap opens
 * it whole, with its reactions and comments, as from a profile. On a
 * member's drawing, but not on one's own, a «…» reports the drawing or
 * blocks its author (TASK-121): once blocked, the card goes away at once.
 * A drawing with photos shows them in the card, after the drawing, one
 * whole width each, to swipe sideways, and under them a dot for each with
 * the one shown lit (TASK-315). The card has the large radius and no
 * border, and answers the finger through `Tap` (TASK-339, ADR-0293): under
 * the drawing its words stay below it, so as not to cover the figure; on a
 * photo they lie over it, light on the dark that rises from its foot.
 */
export function FeedPost({ post, width, onOpen }: Props) {
  // The line of facts is written again when «Settings» changes the units
  // (TASK-182).
  useUnits();
  const { apiUrl, account } = useFollowsDoor();
  // Which of the drawing (0) and its photos is shown, and the furthest
  // reached: the photos up to the one after it are loaded, and stay.
  const [page, setPage] = useState(0);
  const [reached, setReached] = useState(0);
  const author = isShown(post) ? post.drawing.author : null;
  const blocked = useBlockedNow(author === null ? null : author.public_id);
  const height = drawingHeight(width);
  const bearing = bearingOf(post.rotation_deg);
  const segments = useMemo(
    () =>
      thumbSegments(
        turnedLine(post.line, bearing),
        width,
        height,
        DRAWING_PAD,
        post.gaps,
      ),
    [post.line, bearing, post.gaps, width, height],
  );
  const map = useFeedMap(post.id, post.line, width, height, DRAWING_PAD, bearing);
  const city = cityName(post.city);
  // Where the finger came down. «Feed» is the first page: a swipe towards
  // it moves nothing, so nothing takes the touch away, and it would end as
  // a tap on the card it crossed.
  const down = useRef<{ x: number; y: number } | null>(null);
  function onPressIn({ nativeEvent }: GestureResponderEvent) {
    down.current = { x: nativeEvent.pageX, y: nativeEvent.pageY };
  }
  function onPress({ nativeEvent }: GestureResponderEvent) {
    const from = down.current;
    down.current = null;
    const moved =
      from === null
        ? 0
        : Math.hypot(nativeEvent.pageX - from.x, nativeEvent.pageY - from.y);
    if (moved <= TAP_SLOP) {
      onOpen?.();
    }
  }
  if (blocked) {
    return null;
  }
  const { state } = account;
  const menu =
    isShown(post) &&
    author !== null &&
    apiUrl !== null &&
    state.status === "signedIn" &&
    state.session.user.public_id !== author.public_id ? (
      <ReportMenu
        apiUrl={apiUrl}
        token={state.session.token}
        target={{ kind: "drawing", id: post.drawing.id }}
        person={author}
        onSessionEnded={account.sessionEnded}
      />
    ) : null;
  // A member's photos, read with the token; an example has none.
  const photos =
    isShown(post) && apiUrl !== null && state.status === "signedIn"
      ? (post.drawing.photos ?? []).map((photo) => ({
          n: photo.n,
          source: drawingPhotoSource(apiUrl, state.session.token, photo),
        }))
      : [];
  // Each page of the photos takes a tap itself (TASK-330): were the card
  // the one touched, iOS would not let the photos scroll inside it, and the
  // swipe would turn the app's page to «Draw» instead. A page is as wide as
  // the card and as tall as the tallest, the drawing with its words.
  function tappable(key: string | number, shown: ReactNode) {
    if (onOpen === undefined) {
      return (
        <View key={key} style={{ width }}>
          {shown}
        </View>
      );
    }
    return (
      <Tap
        key={key}
        style={{ width }}
        onPressIn={onPressIn}
        onPress={onPress}
        accessible={false}
        testID="feed-page-tap"
      >
        {shown}
      </Tap>
    );
  }
  function onPaged({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) {
    const shown = Math.round(nativeEvent.contentOffset.x / width);
    setPage(shown);
    setReached((was) => Math.max(was, shown));
  }
  // A member's run may have no place found (TASK-118): then none is read.
  const label =
    city === ""
      ? t("{user}: {title}. {facts}.", {
          user: post.user,
          title: post.title,
          facts: postFacts(post),
        })
      : t("{user} in {city}: {title}. {facts}.", {
          user: post.user,
          city,
          title: post.title,
          facts: postFacts(post),
        });
  const drawing = (
    <View style={[styles.drawing, { width, height }]} testID="feed-drawing">
      {map !== null && (
        <Image
          testID="feed-map"
          style={StyleSheet.absoluteFill}
          source={{ uri: map }}
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
      {map !== null && <Text style={styles.credit}>{t(MAP_CREDIT)}</Text>}
    </View>
  );
  // Under the drawing, so as not to cover the figure.
  const words = (
    <View style={styles.words}>
      <Text style={styles.title}>{post.title}</Text>
      <Text style={styles.facts}>{postFacts(post)}</Text>
    </View>
  );
  // Over a photo, light on the dark that rises from its foot. The same
  // words as under the drawing: a screen reader hears the card as one
  // thing, so these are hidden from it.
  const wordsOnPhoto = (
    <>
      <Scrim height={SCRIM_HEIGHT} />
      <View
        style={styles.wordsOnPhoto}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="feed-photo-words"
      >
        <Text style={styles.titleOnPhoto}>{post.title}</Text>
        <Text style={styles.factsOnPhoto}>{postFacts(post)}</Text>
      </View>
    </>
  );
  const body = (
    <>
      <View style={styles.who}>
        <View style={styles.avatar}>
          <Text style={styles.initial}>{post.user.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.names}>
          <Text style={styles.user}>{post.user}</Text>
          {city !== "" && <Text style={styles.city}>{city}</Text>}
        </View>
        {menu}
      </View>
      {photos.length === 0 ? (
        <>
          {drawing}
          {words}
        </>
      ) : (
        <>
          {/* It bounces at its ends, as by default: a swipe past the last
              photo stays here and never turns the app's page. */}
          <ScrollView
            style={{ width }}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onPaged}
            testID="feed-pages"
          >
            {tappable(
              "drawing",
              <>
                {drawing}
                {words}
              </>,
            )}
            {photos.map((photo, i) =>
              tappable(
                photo.n,
                // Photo i is page i + 1: loaded once the page before it was
                // shown, never further on (the phone's data is the runner's).
                i <= reached ? (
                  <>
                    <Image
                      testID="feed-photo"
                      style={[StyleSheet.absoluteFill, styles.photo]}
                      source={photo.source}
                      resizeMode="cover"
                      accessible={false}
                    />
                    {wordsOnPhoto}
                  </>
                ) : (
                  <View
                    testID="feed-photo-later"
                    style={[StyleSheet.absoluteFill, styles.photo]}
                  />
                ),
              ),
            )}
          </ScrollView>
          <View style={styles.dots} testID="feed-dots">
            {[0, ...photos.map((photo) => photo.n)].map((key, i) => (
              <View
                key={key}
                testID={i === page ? "feed-dot-on" : "feed-dot"}
                style={[styles.dot, i === page && styles.dotOn]}
              />
            ))}
          </View>
        </>
      )}
    </>
  );
  if (onOpen === undefined) {
    return (
      <View
        style={styles.card}
        testID="feed-post"
        accessible
        accessibilityLabel={label}
      >
        {body}
      </View>
    );
  }
  return (
    <Tap
      style={styles.card}
      onPressIn={onPressIn}
      onPress={onPress}
      testID="feed-post"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t("Opens the route on the map")}
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
  who: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
  },
  avatar: {
    width: MIN_TAP_SIZE - space.sm,
    height: MIN_TAP_SIZE - space.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
  },
  // Names are medium, not bold: the weight is the yellow controls' (ADR-0293).
  initial: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
  },
  names: {
    flex: 1,
    gap: 2,
  },
  user: {
    ...font.body,
    color: color.text,
    fontWeight: fontWeight.medium,
  },
  city: {
    ...font.detail,
    color: color.textMuted,
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
  credit: {
    position: "absolute",
    right: space.sm,
    bottom: space.xs,
    color: color.textFaint,
    fontSize: fontSize.label,
    textAlign: "right",
  },
  photo: {
    backgroundColor: color.surfaceRaised,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: space.xs,
    paddingBottom: space.md,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: color.borderStrong,
  },
  dotOn: {
    backgroundColor: color.text,
  },
  words: {
    gap: 2,
    padding: space.md,
  },
  title: {
    ...font.cardTitle,
    color: color.text,
  },
  facts: {
    ...font.small,
    color: color.textMuted,
  },
  // On `Scrim`: light in both tones, since the dark under them is.
  wordsOnPhoto: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    bottom: space.lg,
    gap: space.xs,
  },
  titleOnPhoto: {
    ...font.heading,
    color: color.onScrim,
  },
  factsOnPhoto: {
    ...font.small,
    color: color.onScrim,
    opacity: 0.85,
  },
});
