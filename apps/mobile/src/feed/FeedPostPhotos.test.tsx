import feed from "@shaperoute/shared-types/fixtures/feed.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { FeedPost as Post, Session } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import type { AccountState } from "../account/useAccount";
import { forgetBlocked } from "../social/blockedNow";
import { FollowsContext } from "../social/followsDoor";
import { FeedPost } from "./FeedPost";
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
  // As wide as the card, as tall as the drawing.
  expect(screen.getByTestId("feed-photo")).toHaveStyle({ width: WIDTH, height: 222 });
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

test("a tap on a card with photos still opens the drawing", async () => {
  const onOpen = jest.fn();
  await show(WITH_PHOTO, signedIn, onOpen);
  await fireEvent.press(screen.getByTestId("feed-post"));
  expect(onOpen).toHaveBeenCalledTimes(1);
});
