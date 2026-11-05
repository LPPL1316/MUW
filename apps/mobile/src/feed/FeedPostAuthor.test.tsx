import feed from "@shaperoute/shared-types/fixtures/feed.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { FeedPost as Post, Session } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import type { AccountState } from "../account/useAccount";
import { forgetBlocked } from "../social/blockedNow";
import { FollowsContext } from "../social/followsDoor";
import { FeedPost } from "./FeedPost";
import { forgetFeedMaps } from "./FeedMaps";
import { shownPost } from "./feedPosts";
import type { SamplePost } from "./sampleFeed";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

// The author's name in «Feed» (TASK-399): a tap opens their profile, as a
// tagged name does; the card's tap still opens the route.

const URL = "http://api";
const signedIn: AccountState = { status: "signedIn", session: session as Session };
const ADAM = {
  public_id: "3b9d2e10-7c4a-4f8e-a1d6-5e2f9c0b7a44",
  username: "adam.trento",
};
const OTHERS = { ...(feed.posts[0] as Post), author: ADAM } as Post;
const EXAMPLE: SamplePost = {
  id: "firenze-dog_head-10000-4",
  user: "fede_km",
  title: "Dog walk, without the dog",
  city: "firenze",
  shape: "dog_head",
  route_m: 10514,
  minutes: 64,
  score: 92,
  line: [
    [43.77, 11.25],
    [43.77, 11.26],
  ],
};

async function show(post: SamplePost) {
  const openProfile = jest.fn();
  const onOpen = jest.fn();
  await render(
    <FollowsContext.Provider
      value={{
        apiUrl: URL,
        account: { state: signedIn, sessionEnded: jest.fn() },
        openProfile,
      }}
    >
      <FeedPost post={post} width={358} onOpen={onOpen} />
    </FollowsContext.Provider>,
  );
  return { openProfile, onOpen };
}

const author = () => screen.queryByRole("button", { name: "adam.trento's profile" });

beforeEach(() => {
  forgetFeedMaps();
  forgetBlocked();
});

test("a tap on a member's name opens their profile, not the route", async () => {
  const { openProfile, onOpen } = await show(shownPost(OTHERS));
  expect(author()).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("adam.trento"));
  expect(openProfile).toHaveBeenCalledWith({ ...ADAM, photo: null });
  expect(onOpen).not.toHaveBeenCalled();
});

test("the initial opens the profile too", async () => {
  const { openProfile } = await show(shownPost(OTHERS));
  await fireEvent.press(screen.getByText("A"));
  expect(openProfile).toHaveBeenCalledTimes(1);
});

test("the end of a swipe across the name opens nothing", async () => {
  const { openProfile } = await show(shownPost(OTHERS));
  const name = screen.getByTestId("feed-author");
  await fireEvent(name, "pressIn", { nativeEvent: { pageX: 300, pageY: 40 } });
  await fireEvent(name, "press", { nativeEvent: { pageX: 40, pageY: 40 } });
  expect(openProfile).not.toHaveBeenCalled();
});

test("the rest of the card still opens the route", async () => {
  const { openProfile, onOpen } = await show(shownPost(OTHERS));
  await fireEvent.press(screen.getByTestId("feed-post"));
  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(openProfile).not.toHaveBeenCalled();
});

test("an example's name is only words", async () => {
  const { openProfile, onOpen } = await show(EXAMPLE);
  expect(screen.queryByTestId("feed-author")).toBeNull();
  await fireEvent.press(screen.getByText("fede_km"));
  expect(openProfile).not.toHaveBeenCalled();
  expect(onOpen).toHaveBeenCalledTimes(1);
});
