import feed from "@shaperoute/shared-types/fixtures/feed.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { FeedPost as Post, Session } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { type ImageStyle, type StyleProp, StyleSheet, Text } from "react-native";

import type { AccountState } from "../account/useAccount";
import { Pager } from "../screens/Pager";
import { forgetBlocked } from "../social/blockedNow";
import { FollowsContext } from "../social/followsDoor";
import { color, font } from "../theme/tokens";
import { FeedPost, postFacts, SCRIM_HEIGHT } from "./FeedPost";
import { forgetFeedMaps } from "./FeedMaps";
import { shownPost } from "./feedPosts";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

// The photos of a post in «Feed» (TASK-315): after the drawing, to swipe
// sideways in the card, a dot for each and the one shown lit.

const URL = "http://api";
const WIDTH = 358;
const signedIn: AccountState = { status: "signedIn", session: session as Session };
// The fixture's first post has one photo, its second none.
const WITH_PHOTO = feed.posts[0] as Post;
const WITHOUT = feed.posts[1] as Post;
const TWO_PHOTOS: Post = {
  ...WITH_PHOTO,
  photos: [
    ...(WITH_PHOTO.photos ?? []),
    { n: 3, url: `/drawings/${WITH_PHOTO.id}/photos/3?v=1`, width: 810, height: 1080 },
  ],
};

async function show(post: Post, state: AccountState = signedIn, onOpen = jest.fn()) {
  await render(
    <FollowsContext.Provider
      value={{
        apiUrl: URL,
        account: { state, sessionEnded: jest.fn() },
        openProfile: jest.fn(),
      }}
    >
      <FeedPost post={shownPost(post)} width={WIDTH} onOpen={onOpen} />
    </FollowsContext.Provider>,
  );
}

beforeEach(() => {
  forgetFeedMaps();
  forgetBlocked();
});

/** The rendered tree as JSON, and every node in it `where` says. */
type Json = { props: Record<string, unknown>; children: (Json | string)[] | null };
function nodes(
  node: Json | string | null | undefined,
  where: (node: Json) => boolean,
): Json[] {
  if (node == null || typeof node === "string") {
    return [];
  }
  const own = where(node) ? [node] : [];
  return [...own, ...(node.children ?? []).flatMap((child) => nodes(child, where))];
}

async function swipeTo(page: number) {
  await act(() =>
    fireEvent(screen.getByTestId("feed-pages"), "momentumScrollEnd", {
      nativeEvent: { contentOffset: { x: WIDTH * page, y: 0 } },
    }),
  );
}

const sources = () =>
  screen.queryAllByTestId("feed-photo").map((photo) => photo.props.source);

const SOURCES = (TWO_PHOTOS.photos ?? []).map((photo) => ({
  uri: `${URL}${photo.url}`,
  headers: { Authorization: `Bearer ${session.token}` },
}));

test("a drawing with photos shows them after it, read with the token", async () => {
  await show(TWO_PHOTOS);
  expect(screen.getByTestId("feed-pages")).toBeOnTheScreen();
  expect(screen.getByTestId("feed-drawing")).toBeOnTheScreen();
  expect(sources()).toEqual([SOURCES[0]]);
  // A page as wide as the card, the photo filling it.
  const pages = within(screen.getByTestId("feed-pages")).getAllByTestId(
    "feed-page-tap",
  );
  expect(pages[1]).toHaveStyle({ width: WIDTH });
  expect(screen.getByTestId("feed-photo")).toHaveStyle({
    position: "absolute",
    left: 0,
    top: 0,
  });
});

test("the words stay under the drawing, and lie over a photo on a scrim (TASK-339)", async () => {
  await show(WITH_PHOTO);
  const post = shownPost(WITH_PHOTO);
  const [drawingPage, photoPage] = within(
    screen.getByTestId("feed-pages"),
  ).getAllByTestId("feed-page-tap");
  // Under the drawing, so as not to cover the figure: the card's title, the
  // facts muted.
  expect(within(drawingPage).queryByTestId("feed-photo-words")).toBeNull();
  expect(within(drawingPage).getByText(post.title)).toHaveStyle({
    fontSize: font.cardTitle.fontSize,
    fontWeight: font.cardTitle.fontWeight,
    color: color.text,
  });
  expect(within(drawingPage).getByText(postFacts(post))).toHaveStyle({
    color: color.textMuted,
  });
  // Over the photo: light in both tones, on the dark that rises from its
  // foot, out of the way of the finger, and not read twice (the card is
  // read as one thing).
  const hidden = { includeHiddenElements: true };
  const words = within(photoPage).getByTestId("feed-photo-words", hidden);
  expect(words).toHaveProp("pointerEvents", "none");
  expect(words).toHaveProp("accessibilityElementsHidden", true);
  expect(within(drawingPage).getByText(post.title)).toBeOnTheScreen();
  expect(screen.getAllByText(post.title)).toHaveLength(1);
  expect(within(words).getByText(post.title, hidden)).toHaveStyle({
    fontSize: font.heading.fontSize,
    fontWeight: font.heading.fontWeight,
    color: color.onScrim,
  });
  expect(within(words).getByText(postFacts(post), hidden)).toHaveStyle({
    color: color.onScrim,
  });
  // The scrim: an image stretched over the foot of the photo, and none
  // over the drawing.
  const [drawingJson, photoJson] = nodes(
    screen.toJSON() as unknown as Json | null,
    (node) => node.props.testID === "feed-page-tap",
  );
  const stretched = (page: Json) =>
    nodes(page, (node) => node.props.resizeMode === "stretch");
  expect(stretched(photoJson)).toHaveLength(1);
  expect(
    StyleSheet.flatten(stretched(photoJson)[0].props.style as StyleProp<ImageStyle>),
  ).toMatchObject({
    position: "absolute",
    bottom: 0,
    height: SCRIM_HEIGHT,
  });
  expect(stretched(drawingJson)).toHaveLength(0);
});

test("only the photo after the one shown is loaded, and those seen stay", async () => {
  await show(TWO_PHOTOS);
  expect(screen.getAllByTestId("feed-photo-later")).toHaveLength(1);
  await swipeTo(1);
  expect(sources()).toEqual(SOURCES);
  expect(screen.queryByTestId("feed-photo-later")).toBeNull();
  await swipeTo(0);
  expect(sources()).toEqual(SOURCES);
});

test("a dot for the drawing and one for each photo, the first lit", async () => {
  await show(TWO_PHOTOS);
  expect(screen.getAllByTestId("feed-dot-on")).toHaveLength(1);
  expect(screen.getAllByTestId("feed-dot")).toHaveLength(2);
});

test("swiped to a photo, its dot is lit", async () => {
  await show(TWO_PHOTOS);
  // The dots in their order, as lit or not.
  const dots = () =>
    screen.getAllByTestId(/^feed-dot(-on)?$/).map((dot) => dot.props.testID);
  await swipeTo(2);
  expect(dots()).toEqual(["feed-dot", "feed-dot", "feed-dot-on"]);
  await swipeTo(1);
  expect(dots()).toEqual(["feed-dot", "feed-dot-on", "feed-dot"]);
});

test("a drawing without photos, or nobody signed in: the drawing alone", async () => {
  await show(WITHOUT);
  expect(screen.getByTestId("feed-drawing")).toBeOnTheScreen();
  expect(screen.queryByTestId("feed-pages")).toBeNull();
  expect(screen.queryByTestId("feed-dots")).toBeNull();
  await show(WITH_PHOTO, { status: "signedOut", notice: null });
  expect(screen.queryByTestId("feed-photo")).toBeNull();
  expect(screen.queryByTestId("feed-dots")).toBeNull();
});

test("with no photos the card has no scroll of its own", async () => {
  await show({ ...WITH_PHOTO, photos: [] });
  expect(JSON.stringify(screen.toJSON())).not.toContain("RCTScrollView");
  expect(screen.queryByTestId("feed-photo-later")).toBeNull();
});

test("swiping the photos to the last never turns the app's page", async () => {
  const onPage = jest.fn();
  await render(
    <FollowsContext.Provider
      value={{
        apiUrl: URL,
        account: { state: signedIn, sessionEnded: jest.fn() },
        openProfile: jest.fn(),
      }}
    >
      <Pager
        pages={[
          {
            title: "Feed",
            render: () => <FeedPost post={shownPost(TWO_PHOTOS)} width={WIDTH} />,
          },
          { title: "Draw", render: () => <Text>Draw</Text> },
        ]}
        page={0}
        onPage={onPage}
      />
    </FollowsContext.Provider>,
  );
  await swipeTo(2);
  expect(onPage).not.toHaveBeenCalled();
  expect(screen.getAllByTestId(/^feed-dot(-on)?$/).at(-1)?.props.testID).toBe(
    "feed-dot-on",
  );
  // The photos bounce at their ends, where the pages do not: a swipe past
  // the last photo stays in the card.
  expect(screen.getByTestId("feed-pages").props.bounces).not.toBe(false);
  expect(screen.getByTestId("pager").props.bounces).toBe(false);
});

test("a tap on a card with photos still opens the drawing", async () => {
  const onOpen = jest.fn();
  await show(WITH_PHOTO, signedIn, onOpen);
  await fireEvent.press(screen.getByTestId("feed-post"));
  expect(onOpen).toHaveBeenCalledTimes(1);
});
