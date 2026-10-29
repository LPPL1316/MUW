import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

import { type AnyRouteRequest, isImageRequest } from "../api/routes";
import { cityName } from "../explore/recommendedRoutes";
import { CardMapsCredit } from "../explore/RouteCard";
import { thumbSegments } from "../explore/RouteThumb";
import { postsFor } from "../explore/WhileDrawing";
import { FeedMapShooter, useFeedMap } from "../feed/FeedMaps";
import { postFacts } from "../feed/FeedPost";
import { SAMPLE_FEED, type SamplePost } from "../feed/sampleFeed";
import { turnedLine } from "../feed/turnedLine";
import { t } from "../i18n";
import { bearingOf } from "../map/turnedMap";
import {
  color,
  fontSize,
  fontWeight,
  radius,
  route as routeLine,
  space,
} from "../theme/tokens";

/** A route the server keeps comes in a second or two: the drawings wait
 * this long, so they do not flash by and move the map for nothing. */
export const SHOWN_AFTER_MS = 3000;
/** Enough to scroll through while a route is drawn. */
export const POSTS_SHOWN = 6;
/** A card, as small as the tiles of «Draw»: the map above stays large. */
const CARD_WIDTH = 132;
const DRAWING_HEIGHT = 88;
/** Clear around the line, on every side. */
const DRAWING_PAD = space.sm;
/** The maps asked for and not come yet, at most: the page takes one while the
 * next waits, so it stays between the two (it goes when none is waited for).
 * Two that do not come, with no signal, and the cards after them ask nothing. */
export const MAPS_ASKED_AHEAD = 2;
const LINE_WIDTH = 2;

/**
 * The drawings of «Feed» shown while `request` is drawn: on the water those
 * on the water, else those of the runs, in the feed's order from a place
 * that depends on what is drawn (`postsFor`).
 */
export function postsWhileRouting(
  request: AnyRouteRequest,
  feed: readonly SamplePost[] = SAMPLE_FEED,
  most: number = POSTS_SHOWN,
): SamplePost[] {
  const onWater = request.activity === "paddling";
  const same = feed.filter((post) => (post.activity === "paddling") === onWater);
  const what = isImageRequest(request) ? "picture" : (request.word ?? request.shape);
  return postsFor(`${what}-${request.distance_m}`, same, most);
}

/** True once `after` ms have gone since `startedAt`; a new start waits
 * again. */
export function useShownAfter(startedAt: number, after: number): boolean {
  const [shownFor, setShownFor] = useState<number | null>(null);
  useEffect(() => {
    const left = Math.max(0, startedAt + after - Date.now());
    const timer = setTimeout(() => setShownFor(startedAt), left);
    return () => clearTimeout(timer);
  }, [startedAt, after]);
  return shownFor === startedAt;
}

type Props = {
  /** What is being drawn. */
  request: AnyRouteRequest;
  /** When it was asked for, as the waiting state says. */
  startedAt: number;
};

/**
 * Something to look at while «Draw» waits for a route (TASK-317,
 * ADR-0277): the example drawings of «Feed», in a row to scroll sideways,
 * as «Explore» shows them while it draws (TASK-163). Under each line the
 * picture of its map (TASK-335, ADR-0291): a page under the row takes them,
 * as the one of «Feed» does (ADR-0131), one card after the other, and a card
 * shows the line alone until its own comes. Pictures that do not come (no
 * signal, most likely) stop the next ones from being asked. The cards are
 * not buttons: opening one would leave the search half done.
 */
export function WhileRouting({ request, startedAt }: Props) {
  const shown = useShownAfter(startedAt, SHOWN_AFTER_MS);
  const posts = useMemo(() => postsWhileRouting(request), [request]);
  // The drawings whose map has come: the card after each may ask for its own.
  const [mapped, setMapped] = useState<ReadonlySet<string>>(() => new Set());
  const onMap = useCallback(
    (id: string) => setMapped((was) => (was.has(id) ? was : new Set(was).add(id))),
    [],
  );
  if (!shown || posts.length === 0) {
    return null;
  }
  return (
    <View testID="while-routing">
      {/* Under the row, which covers it: «Draw» has no «Feed» behind it. */}
      <FeedMapShooter width={CARD_WIDTH} height={DRAWING_HEIGHT} />
      <View style={styles.section}>
        <Text style={styles.label}>{t("MEANWHILE, FROM THE FEED")}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {posts.map((post, i) => (
            <Card
              key={post.id}
              post={post}
              mapAsked={
                i < MAPS_ASKED_AHEAD || mapped.has(posts[i - MAPS_ASKED_AHEAD].id)
              }
              onMap={onMap}
            />
          ))}
        </ScrollView>
        <CardMapsCredit />
      </View>
    </View>
  );
}

type CardProps = {
  post: SamplePost;
  /** The picture of its map may be asked for. */
  mapAsked: boolean;
  /** Its map has come. */
  onMap: (id: string) => void;
};

/** One drawing: its line on its map, its title, what it is and how far. */
function Card({ post, mapAsked, onMap }: CardProps) {
  const bearing = bearingOf(post.rotation_deg);
  const segments = useMemo(
    () =>
      thumbSegments(
        turnedLine(post.line, bearing),
        CARD_WIDTH,
        DRAWING_HEIGHT,
        DRAWING_PAD,
        post.gaps,
      ),
    [post.line, bearing, post.gaps],
  );
  const city = cityName(post.city);
  const facts = postFacts(post);
  const label =
    city === ""
      ? t("{user}: {title}. {facts}.", { user: post.user, title: post.title, facts })
      : t("{user} in {city}: {title}. {facts}.", {
          user: post.user,
          city,
          title: post.title,
          facts,
        });
  return (
    <View
      style={styles.card}
      testID="while-routing-post"
      accessible
      accessibilityLabel={label}
    >
      <View style={styles.drawing}>
        {mapAsked && <CardMap post={post} bearing={bearing} onMap={onMap} />}
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
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {post.title}
      </Text>
      <Text style={styles.facts} numberOfLines={1}>
        {facts}
      </Text>
    </View>
  );
}

/** The picture of a card's map, under its line: asked for once mounted, and
 * taken once in the app's life (`useFeedMap`). */
function CardMap({
  post,
  bearing,
  onMap,
}: {
  post: SamplePost;
  bearing: number;
  onMap: (id: string) => void;
}) {
  const map = useFeedMap(
    post.id,
    post.line,
    CARD_WIDTH,
    DRAWING_HEIGHT,
    DRAWING_PAD,
    bearing,
  );
  useEffect(() => {
    if (map !== null) {
      onMap(post.id);
    }
  }, [map, onMap, post.id]);
  if (map === null) {
    return null;
  }
  return (
    <Image
      testID="feed-map"
      style={StyleSheet.absoluteFill}
      source={{ uri: map }}
      accessible={false}
    />
  );
}

const styles = StyleSheet.create({
  // Opaque, as the card it is in: the page taking the pictures is under it.
  section: {
    gap: space.sm,
    paddingTop: space.xs,
    backgroundColor: color.surface,
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
  card: {
    width: CARD_WIDTH,
    gap: 2,
  },
  drawing: {
    width: CARD_WIDTH,
    height: DRAWING_HEIGHT,
    borderRadius: radius.sm,
    backgroundColor: color.map.background,
    overflow: "hidden",
    marginBottom: space.xs,
  },
  segment: {
    position: "absolute",
    height: LINE_WIDTH,
    borderRadius: LINE_WIDTH / 2,
    backgroundColor: routeLine.color,
  },
  title: {
    color: color.text,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  facts: {
    color: color.textMuted,
    fontSize: fontSize.detail,
  },
});
