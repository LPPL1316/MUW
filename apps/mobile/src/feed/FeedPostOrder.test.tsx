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

// The pages of a post in the order its owner chose (TASK-348, ADR-0301):
// the drawing among the photos, and which page of how many is shown.

const URL = "http://api";
const WIDTH = 358;
const signedIn: AccountState = { status: "signedIn", session: session as Session };
const WITH_PHOTO = feed.posts[0] as Post;
const photo = (n: number) => ({
  n,
  url: `/drawings/${WITH_PHOTO.id}/photos/${n}?v=1`,
  width: 810,
  height: 1080,
});
// The API answers `photos` in the order too; the app reads `order`.
const ORDERED: Post = {
  ...WITH_PHOTO,
  photos: [photo(2), photo(1)],
  order: ["photo:2", "drawing", "photo:1"],
};

async function show(post: Post) {
  await render(
    <FollowsContext.Provider
      value={{
        apiUrl: URL,
        account: { state: signedIn, sessionEnded: jest.fn() },
        openProfile: jest.fn(),
      }}
    >
      <FeedPost post={shownPost(post)} width={WIDTH} onOpen={jest.fn()} />
    </FollowsContext.Provider>,
  );
}

async function swipeTo(page: number) {
  await act(() =>
    fireEvent(screen.getByTestId("feed-pages"), "momentumScrollEnd", {
      nativeEvent: { contentOffset: { x: WIDTH * page, y: 0 } },
    }),
  );
}

const shownUrls = () =>
  screen
    .queryAllByTestId("feed-photo")
    .map((one) => String((one.props.source as { uri: string }).uri).replace(URL, ""));

beforeEach(() => {
  forgetFeedMaps();
  forgetBlocked();
});

test("a photo first is the cover: shown at once, the drawing a swipe after", async () => {
  await show(ORDERED);
  expect(screen.getByText("1/3", { includeHiddenElements: true })).toBeTruthy();
  // The first page is the photo of place 2, and the one after it is loaded.
  expect(shownUrls()).toEqual([photo(2).url]);
  expect(screen.getAllByTestId("feed-photo-later")).toHaveLength(1);
  expect(screen.getAllByTestId(/^feed-dot(-on)?$/)).toHaveLength(3);
  await swipeTo(1);
  expect(screen.getByText("2/3", { includeHiddenElements: true })).toBeTruthy();
  expect(shownUrls()).toEqual([photo(2).url, photo(1).url]);
  expect(screen.getAllByTestId(/^feed-dot(-on)?$/)[1]?.props.testID).toBe(
    "feed-dot-on",
  );
});

test("never ordered: the drawing first, as every post before", async () => {
  await show({ ...ORDERED, order: null, photos: [photo(1), photo(2)] });
  expect(screen.getByText("1/3", { includeHiddenElements: true })).toBeTruthy();
  expect(shownUrls()).toEqual([photo(1).url]);
});

test("a post without photos has no counter", async () => {
  await show({ ...WITH_PHOTO, photos: [] });
  expect(screen.queryByTestId("feed-counter")).toBeNull();
});
