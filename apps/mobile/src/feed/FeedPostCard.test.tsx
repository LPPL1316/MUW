import type { FeedPost as ApiFeedPost } from "@shaperoute/shared-types";
import { render, screen } from "@testing-library/react-native";

import { saveLanguageChoice } from "../i18n/language";
import { FollowsContext, type FollowsDoor } from "../social/followsDoor";
import { FeedPost, postFacts } from "./FeedPost";
import { shownPost } from "./feedPosts";
import type { SamplePost } from "./sampleFeed";

const NOW = Date.parse("2026-10-31T10:00:00Z");

const DRAWING = {
  id: "d1",
  title: "Moon",
  started_at: "2026-10-31T08:00:00Z",
  published_at: "2026-10-31T09:00:00Z",
  place: "Caldonazzo",
  shape: "moon",
  word: null,
  style: null,
  route_title: null,
  distance_m: 5000,
  duration_s: 1800,
  score: 87,
  fidelity: 0.9,
  activity: "running",
  track_preview: [
    [46.0, 11.2],
    [46.01, 11.21],
    [46.0, 11.22],
  ],
  author: { public_id: "ada", username: "ada_runs" },
} as ApiFeedPost;

const DOOR = {
  apiUrl: "http://api.test",
  account: {
    state: {
      status: "signedIn",
      session: { token: "t", user: { id: "u", public_id: "me" } },
    },
    sessionEnded: () => {},
  },
} as unknown as FollowsDoor;

async function card(post = shownPost(DRAWING)) {
  await render(
    <FollowsContext.Provider value={DOOR}>
      <FeedPost post={post} width={358} onOpen={() => {}} />
    </FollowsContext.Provider>,
  );
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate"] });
});

afterEach(() => {
  jest.useRealTimers();
  saveLanguageChoice("en");
});

test("a title equal to what was drawn is said once", async () => {
  await card();
  expect(screen.getByText("Moon")).toBeOnTheScreen();
  expect(postFacts(shownPost(DRAWING)).startsWith("Moon")).toBe(false);
  expect(postFacts(shownPost(DRAWING))).toContain("5.0 km");
  expect(postFacts(shownPost({ ...DRAWING, title: " moon " }))).not.toContain("Moon");
  // Different words stay.
  expect(postFacts(shownPost({ ...DRAWING, title: "Night run" }))).toContain("Moon");
});

test.each([
  ["en", "· 2 h ago"],
  ["it", "· 2 h fa"],
  ["de", "· vor 2 Std."],
  ["fr", "· il y a 2 h"],
  ["es", "· hace 2 h"],
] as const)("a member's card says where and when, in %s", async (language, shown) => {
  saveLanguageChoice(language);
  await card();
  expect(screen.getByText("Caldonazzo")).toBeOnTheScreen();
  expect(screen.getByText(shown)).toBeOnTheScreen();
});

test("without a place it says only when", async () => {
  await card(shownPost({ ...DRAWING, place: null }));
  expect(screen.getByText("2 h ago")).toBeOnTheScreen();
});

test("the marks are on a member's line, and an example has neither them nor a bar", async () => {
  await card();
  expect(screen.getByTestId("feed-line-dot")).toBeOnTheScreen();
  expect(screen.getByTestId("feed-line-flag")).toBeOnTheScreen();
  expect(screen.getByTestId("feed-actions")).toBeOnTheScreen();

  const example: SamplePost = {
    id: "e",
    user: "fede_km",
    title: "Dog walk",
    city: "firenze",
    shape: "dog_head",
    route_m: 10514,
    minutes: 64,
    score: 92,
    line: DRAWING.track_preview,
  };
  await card(example as ReturnType<typeof shownPost>);
  expect(screen.queryByTestId("feed-line-dot")).toBeNull();
  expect(screen.queryByTestId("feed-actions")).toBeNull();
});

test("no score, on screen or read out", async () => {
  await card();
  expect(screen.queryByText(/87|precision|precisione/i)).toBeNull();
  const label = screen.getByTestId("feed-post").props.accessibilityLabel as string;
  expect(label).not.toMatch(/87|score/i);
});

test("the date is read out, and the «…» stays out of the card's button", async () => {
  await card();
  const post = screen.getByTestId("feed-post");
  expect(post.props.accessibilityLabel).toContain("2 h ago");
  const more = screen.getByRole("button", { name: "More" });
  let up = more.parent;
  while (up !== null) {
    expect(up).not.toBe(post);
    up = up.parent;
  }
});
