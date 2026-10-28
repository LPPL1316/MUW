import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { type AnyRouteRequest, isImageRequest } from "../api/routes";
import { cityName } from "../explore/recommendedRoutes";
import { thumbSegments } from "../explore/RouteThumb";
import { postsFor } from "../explore/WhileDrawing";
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
 * as «Explore» shows them while it draws (TASK-163). Only the line on the
 * map's colour, with no picture of the map: nothing is asked of the network
 * while the engine works. The cards are not buttons: opening one would
 * leave the search half done.
 */
export function WhileRouting({ request, startedAt }: Props) {
  const shown = useShownAfter(startedAt, SHOWN_AFTER_MS);
  const posts = useMemo(() => postsWhileRouting(request), [request]);
  if (!shown || posts.length === 0) {
    return null;
  }
  return (
    <View style={styles.section} testID="while-routing">
      <Text style={styles.label}>{t("MEANWHILE, FROM THE FEED")}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {posts.map((post) => (
          <Card key={post.id} post={post} />
        ))}
      </ScrollView>
    </View>
  );
}

/** One drawing: its line, its title, what it is and how far. */
function Card({ post }: { post: SamplePost }) {
  const segments = useMemo(
    () =>
      thumbSegments(
        turnedLine(post.line, bearingOf(post.rotation_deg)),
        CARD_WIDTH,
        DRAWING_HEIGHT,
        space.sm,
        post.gaps,
      ),
    [post],
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

const styles = StyleSheet.create({
  section: {
    gap: space.sm,
    paddingTop: space.xs,
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
