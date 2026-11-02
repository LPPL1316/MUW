import type { FeedFilter } from "@shaperoute/shared-types";
import { type ReactElement, useCallback, useMemo, useState } from "react";
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
import { loadFeedTab, saveFeedTab } from "../feed/feedTabChoice";
import { feedTabName, FeedTabs } from "../feed/FeedTabs";
import { SAMPLE_FEED, type SamplePost } from "../feed/sampleFeed";
import { type FeedItem, feedWithAds } from "../feed/feedWithAds";
import { type Feed, type FeedShown, useFeed } from "../feed/useFeed";
import { t } from "../i18n";
import { useDrawingsDoor } from "../social/drawingsDoor";
import { FindFriendsButton } from "../social/FindFriendsButton";
import { usePeopleDoor } from "../social/peopleDoor";
import { color, font, fontSize, MIN_TAP_SIZE, radius, space } from "../theme/tokens";
import { EmptyState } from "../ui/EmptyState";
import { HEART } from "../ui/outlines";
import { Tap } from "../ui/Tap";

type Props = {
  /** An example drawing was tapped: its route goes on the map. */
  onOpen: (post: SamplePost) => void;
  /** «Feed» is the page on the screen. Built behind «Draw» at the start, it
   * asks for no ad (and no consent), and no drawings, until it is
   * (TASK-235, TASK-118). */
  active?: boolean;
  /** The ad network: AdMob in a build of the app, none in Expo Go. */
  ads?: FeedAds;
};

/** A row of the list: a member's drawing, or an example. */
type Post = SamplePost | ShownPost;
type Item = FeedItem<Post, NativeAd>;

/** How far from the end of the list, in screens, the next page is asked. */
const MORE_AT_SCREENS = 1;

/** The rows of a tab: only «All» falls back on the examples, while it has
 * nothing the account may see or nobody is signed in (ADR-0127). */
function postsOf(tab: FeedFilter, shown: FeedShown): readonly Post[] {
  if (shown.kind === "ready" && shown.posts.length > 0) {
    return shown.posts.map(shownPost);
  }
  if (tab === "following" || shown.kind === "loading" || shown.kind === "failed") {
    return [];
  }
  return SAMPLE_FEED;
}

/**
 * «Feed», the page at the left of «Draw» (TASK-154): the drawings the
 * members publish (TASK-118, ADR-0227), in two tabs (TASK-362, ADR-0308):
 * «All», what everyone may see, and «Following», the account's own and those
 * of the people it follows, the last published first in both. Each tab keeps
 * its own list, read and place: both stay built, and the one not on the
 * screen is only hidden. The last tab chosen opens again. A pull reads the
 * open tab again, the end of its list reads more. Without an account there
 * are no tabs, only «All». While nobody has published anything the account
 * may see, and without an account, «All» shows examples: figures of the
 * catalogue with made-up runners (TASK-156, ADR-0127). Nothing on the page
 * says they are examples: the user's choice. Under each line is the map of
 * its streets (TASK-162): a picture, taken by a map page that the list
 * covers. A tap on a member's drawing opens it whole on the map, with its
 * reactions and comments, as from a profile (TASK-117); one on an example
 * opens its route (TASK-188). Next to the tabs, at the right, the lens that
 * finds friends by name (TASK-215, TASK-219); above the drawings of «All»,
 * while the API has a contest, its card (TASK-299, docs/CONCORSI.md §7),
 * asked with the feed and with each pull. Between the drawings, one ad every
 * 5 (TASK-235, ADR-0198).
 */
export function FeedScreen({ onOpen, active = true, ads = feedAds() }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = width - 2 * space.lg;
  const [chosen, setChosen] = useState(loadFeedTab);
  // Built the first time it is opened, and kept from then on.
  const [opened, setOpened] = useState(chosen === "following");
  const all = useFeed(active && chosen === "all", "all");
  const following = useFeed(active && chosen === "following", "following");
  const { signedIn } = all;
  // Without an account there is only «All»; the choice waits for the next one.
  const tab = signedIn ? chosen : "all";
  const { open, openProblem } = useDrawingsDoor();
  const { open: findPeople } = usePeopleDoor();
  const contest = useContest(active);
  const onChoose = useCallback((next: FeedFilter) => {
    setChosen(next);
    saveFeedTab(next);
    if (next === "following") {
      setOpened(true);
    }
  }, []);
  const onRefreshAll = useCallback(() => {
    all.refresh();
    contest.refresh();
  }, [all, contest]);
  const problem =
    openProblem !== null ? (
      <Text style={styles.problem} accessibilityRole="alert">
        {openProblem}
      </Text>
    ) : null;
  const shared = { active, ads, cardWidth, insetBottom: insets.bottom, open, onOpen };
  return (
    <View style={StyleSheet.absoluteFill}>
      <FeedMapShooter width={cardWidth} height={drawingHeight(cardWidth)} />
      <View style={[StyleSheet.absoluteFill, styles.screen]}>
        <View style={[styles.bar, { paddingTop: insets.top + space.lg }]}>
          {signedIn && <FeedTabs tab={tab} onChoose={onChoose} />}
          <View style={styles.lens}>
            <FindFriendsButton />
          </View>
        </View>
        <FeedList
          {...shared}
          tab="all"
          feed={all}
          visible={tab === "all"}
          onRefresh={onRefreshAll}
          header={
            <View style={styles.header}>
              {contest.contest !== null && (
                <FeedContest
                  contest={contest.contest}
                  mine={contest.mine}
                  width={cardWidth}
                  onOpen={signedIn ? open : undefined}
                />
              )}
              {problem}
            </View>
          }
          empty={null}
        />
        {signedIn && opened && (
          <FeedList
            {...shared}
            tab="following"
            feed={following}
            visible={tab === "following"}
            onRefresh={following.refresh}
            header={
              <View style={styles.header}>
                {following.shown.kind === "ready" &&
                  following.shown.followsAnyone === false &&
                  following.shown.posts.length > 0 && (
                    <View style={styles.nudge} testID="feed-follow-nudge">
                      <Text style={styles.nudgeText}>
                        {t("Follow people to see their drawings here.")}
                      </Text>
                      <Tap
                        style={styles.quietButton}
                        onPress={findPeople}
                        accessibilityRole="button"
                      >
                        <Text style={styles.quietButtonText}>
                          {t("Find people to follow")}
                        </Text>
                      </Tap>
                    </View>
                  )}
                {problem}
              </View>
            }
            empty={
              following.shown.kind === "ready" ? (
                following.shown.followsAnyone === false ? (
                  <EmptyState
                    outline={HEART}
                    title={feedTabName("following")}
                    message={t("Follow people to see their drawings here.")}
                    action={{ label: t("Find people to follow"), onPress: findPeople }}
                    testID="feed-no-follows"
                  />
                ) : (
                  <EmptyState
                    outline={HEART}
                    title={feedTabName("following")}
                    message={t(
                      "The people you follow have not published anything yet.",
                    )}
                    testID="feed-no-posts"
                  />
                )
              ) : null
            }
          />
        )}
      </View>
    </View>
  );
}

type ListProps = {
  tab: FeedFilter;
  feed: Feed;
  /** This tab is the one on the screen: hidden, the list keeps its place. */
  visible: boolean;
  active: boolean;
  ads: FeedAds;
  cardWidth: number;
  insetBottom: number;
  header: ReactElement;
  /** What a tab shows when it has read that it has nothing. */
  empty: ReactElement | null;
  onRefresh: () => void;
  open: (drawing: ShownPost["drawing"]) => void;
  onOpen: (post: SamplePost) => void;
};

/** The list of one tab, with its own ads. */
function FeedList({
  tab,
  feed,
  visible,
  active,
  ads,
  cardWidth,
  insetBottom,
  header,
  empty,
  onRefresh,
  open,
  onOpen,
}: ListProps) {
  const { shown, signedIn, refreshing, refresh, more } = feed;
  const posts = useMemo(() => postsOf(tab, shown), [tab, shown]);
  const { ads: placed, see } = useFeedAds(posts.length, active && visible, ads);
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
    <View style={visible ? styles.list : styles.hidden}>
      <FlatList<Item>
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insetBottom + space.xl },
        ]}
        ListHeaderComponent={header}
        ListEmptyComponent={
          shown.kind === "loading" ? (
            <ActivityIndicator
              color={color.textMuted}
              style={styles.loading}
              testID="feed-loading"
            />
          ) : shown.kind === "failed" ? (
            <EmptyState
              outline={HEART}
              title={feedTabName(tab)}
              message={t("Couldn't load the Feed.")}
              action={{ label: t("Try again"), onPress: refresh }}
              testID="feed-failed"
            />
          ) : (
            empty
          )
        }
        ListFooterComponent={
          shown.kind === "ready" && shown.moreFailed === true ? (
            <View style={styles.moreFailed} testID="feed-more-failed">
              <Text style={styles.nudgeText}>{t("Couldn't load the Feed.")}</Text>
              <Tap style={styles.quietButton} onPress={more} accessibilityRole="button">
                <Text style={styles.quietButtonText}>{t("Try again")}</Text>
              </Tap>
            </View>
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
        onEndReached={visible ? more : undefined}
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
        testID={tab === "all" ? "feed-list" : "feed-list-following"}
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
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  // The lens at the right, under the button of «Profile».
  lens: {
    marginLeft: "auto",
  },
  list: {
    flex: 1,
  },
  hidden: {
    display: "none",
  },
  header: {
    gap: space.md,
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
  nudge: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: color.surface,
  },
  nudgeText: {
    ...font.body,
    color: color.textMuted,
  },
  moreFailed: {
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.lg,
  },
  quietButton: {
    alignSelf: "flex-start",
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  quietButtonText: {
    ...font.label,
    color: color.text,
  },
});
