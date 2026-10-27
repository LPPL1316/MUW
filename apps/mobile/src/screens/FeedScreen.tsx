import type { LatLon } from "@shaperoute/shared-types";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";
import type { NativeAd } from "react-native-google-mobile-ads";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { feedAds } from "../ads/admob";
import type { FeedAds } from "../ads/feedAds";
import { useFeedAds } from "../ads/useFeedAds";
import { FeedContest } from "../contest/FeedContest";
import { useContest } from "../contest/useContest";
import { FeedAd } from "../feed/FeedAd";
import { FeedMapShooter } from "../feed/FeedMaps";
import { drawingHeight, FeedPost } from "../feed/FeedPost";
import { isShown, type ShownPost, shownPost } from "../feed/feedPosts";
import { SAMPLE_FEED, type SamplePost } from "../feed/sampleFeed";
import { type FeedItem, feedWithAds } from "../feed/feedWithAds";
import { useFeed } from "../feed/useFeed";
import { useDrawingsDoor } from "../social/drawingsDoor";
import { FindFriendsButton } from "../social/FindFriendsButton";
import { color, fontSize, space } from "../theme/tokens";

type Props = {
  /** An example drawing was tapped: its route goes on the map. */
  onOpen: (post: SamplePost) => void;
  /** «Feed» is the page on the screen. Built behind «Draw» at the start, it
   * asks for no ad (and no consent), and no drawings, until it is
   * (TASK-235, TASK-118). */
  active?: boolean;
  /** The ad network: AdMob in a build of the app, none in Expo Go. */
  ads?: FeedAds;
  /** Where the phone is, for the drawings nearby; null when unknown. */
  near?: LatLon | null;
};

/** A row of the list: a member's drawing, or an example. */
type Post = SamplePost | ShownPost;
type Item = FeedItem<Post, NativeAd>;

/** How far from the end of the list, in screens, the next page is asked. */
const MORE_AT_SCREENS = 1;

/**
 * «Feed», the page at the left of «Draw» (TASK-154): the drawings the
 * members publish (TASK-118, ADR-0227), the account's own first, then
 * those of the people it follows, then the others' nearby, the last
 * published first; a pull reads them again, the end of the list reads
 * more. Without an account, and while nobody has published anything the
 * account may see, it shows examples: figures of the catalogue with
 * made-up runners (TASK-156, ADR-0127). Nothing on the page says they are
 * examples: the user's choice. Under each line is the map of its streets
 * (TASK-162): a picture, taken by a map page that the list covers. A tap
 * on a member's drawing opens it whole on the map, with its reactions and
 * comments, as from a profile (TASK-117); one on an example opens its
 * route (TASK-188). Above the drawings, at the right, the lens that finds
 * friends by name (TASK-215, TASK-219); under it, while the API has a
 * contest, its card (TASK-299, docs/CONCORSI.md §7), asked with the feed
 * and with each pull. Between the drawings, one ad every 5 (TASK-235,
 * ADR-0198).
 */
export function FeedScreen({
  onOpen,
  active = true,
  ads = feedAds(),
  near = null,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = width - 2 * space.lg;
  const { shown, signedIn, refreshing, refresh, more } = useFeed(active, near);
  const { open, openProblem } = useDrawingsDoor();
  const contest = useContest(active);
  const onRefresh = useCallback(() => {
    refresh();
    contest.refresh();
  }, [contest, refresh]);
  const posts: readonly Post[] = useMemo(() => {
    if (shown.kind === "ready" && shown.posts.length > 0) {
      return shown.posts.map(shownPost);
    }
    return shown.kind === "loading" ? [] : SAMPLE_FEED;
  }, [shown]);
  const { ads: placed, see } = useFeedAds(posts.length, active, ads);
  const items = useMemo(() => feedWithAds(posts, placed), [posts, placed]);
  // The posts that have been on the screen: an ad never goes where the user
  // is looking.
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<Item>[] }) => {
      for (const { item } of viewableItems) {
        if (item.kind === "post") {
          see(item.index);
        }
      }
    },
    [see],
  );
  return (
    <View style={StyleSheet.absoluteFill}>
      <FeedMapShooter width={cardWidth} height={drawingHeight(cardWidth)} />
      <FlatList<Item>
        style={[StyleSheet.absoluteFill, styles.screen]}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + space.lg,
            paddingBottom: insets.bottom + space.xl,
          },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.lens}>
              <FindFriendsButton />
            </View>
            {contest.contest !== null && (
              <FeedContest
                contest={contest.contest}
                mine={contest.mine}
                width={cardWidth}
                onOpen={signedIn ? open : undefined}
              />
            )}
            {openProblem !== null && (
              <Text style={styles.problem} accessibilityRole="alert">
                {openProblem}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          shown.kind === "loading" ? (
            <ActivityIndicator
              color={color.textMuted}
              style={styles.loading}
              testID="feed-loading"
            />
          ) : null
        }
        refreshControl={
          signedIn ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={color.textMuted}
            />
          ) : undefined
        }
        onEndReached={more}
        onEndReachedThreshold={MORE_AT_SCREENS}
        data={items}
        keyExtractor={(item) =>
          item.kind === "post" ? item.post.id : `ad-${item.slot}`
        }
        renderItem={({ item }) =>
          item.kind === "post" ? (
            <FeedPost
              post={item.post}
              width={cardWidth}
              onOpen={() =>
                isShown(item.post) ? open(item.post.drawing) : onOpen(item.post)
              }
            />
          ) : ads.views === null ? null : (
            <FeedAd ad={item.ad} views={ads.views} width={cardWidth} />
          )
        }
        onViewableItemsChanged={onViewableItemsChanged}
        testID="feed-list"
        // A drawing is a hundred views: a few at a time, the others as they come.
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={5}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: color.background,
  },
  header: {
    gap: space.md,
  },
  // The lens at the right, under the button of «Profile».
  lens: {
    alignItems: "flex-end",
  },
  problem: {
    color: color.error,
    fontSize: fontSize.small,
  },
  loading: {
    paddingVertical: space.xl,
  },
  content: {
    gap: space.md,
    paddingHorizontal: space.lg,
  },
});
