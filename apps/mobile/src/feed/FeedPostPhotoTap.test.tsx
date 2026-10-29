import feed from "@shaperoute/shared-types/fixtures/feed.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { FeedPost as Post, Session } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";

import { forgetBlocked } from "../social/blockedNow";
import { FollowsContext } from "../social/followsDoor";
import { FeedPost } from "./FeedPost";
import { forgetFeedMaps } from "./FeedMaps";
import { shownPost } from "./feedPosts";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

// The photos of a post in «Feed» scroll on the phone (TASK-330): with the
// whole card the one touched, iOS kept them still and the swipe turned the
// app's page to «Draw». So each page of the photos takes a tap itself.

const WIDTH = 358;
// The fixture's first post has one photo.
const WITH_PHOTO = feed.posts[0] as Post;

async function show(onOpen?: () => void) {
  await render(
    <FollowsContext.Provider
      value={{
        apiUrl: "http://api",
        account: {
          state: { status: "signedIn", session: session as Session },
          sessionEnded: jest.fn(),
        },
        openProfile: jest.fn(),
      }}
    >
      <FeedPost post={shownPost(WITH_PHOTO)} width={WIDTH} onOpen={onOpen} />
    </FollowsContext.Provider>,
  );
}

beforeEach(() => {
  forgetFeedMaps();
  forgetBlocked();
});

const pages = () =>
  within(screen.getByTestId("feed-pages")).getAllByTestId("feed-page-tap");
const at = (pageX: number, pageY: number) => ({ nativeEvent: { pageX, pageY } });

test("the drawing and each photo take a tap themselves", async () => {
  await show(jest.fn());
  expect(pages()).toHaveLength(2);
  expect(within(pages()[0]).getByTestId("feed-drawing")).toBeOnTheScreen();
  expect(within(pages()[1]).getByTestId("feed-photo")).toBeOnTheScreen();
});

test("a tap on a photo opens the drawing, as one on the card", async () => {
  const onOpen = jest.fn();
  await show(onOpen);
  await act(() =>
    fireEvent(screen.getByTestId("feed-pages"), "momentumScrollEnd", {
      nativeEvent: { contentOffset: { x: WIDTH, y: 0 } },
    }),
  );
  await fireEvent(pages()[1], "pressIn", at(200, 300));
  await fireEvent.press(pages()[1], at(204, 302));
  expect(onOpen).toHaveBeenCalledTimes(1);
});

test("a finger that moved across a photo has not tapped", async () => {
  const onOpen = jest.fn();
  await show(onOpen);
  await fireEvent(pages()[0], "pressIn", at(80, 300));
  await fireEvent.press(pages()[0], at(340, 300));
  expect(onOpen).not.toHaveBeenCalled();
});

test("a card that opens nothing has no buttons in its photos", async () => {
  await show();
  expect(
    within(screen.getByTestId("feed-pages")).queryAllByTestId("feed-page-tap"),
  ).toHaveLength(0);
  expect(screen.getByTestId("feed-photo")).toBeOnTheScreen();
});
