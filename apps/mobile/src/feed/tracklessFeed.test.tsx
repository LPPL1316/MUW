/**
 * A workout at the gym in the Feed, on its card and on a profile (TASK-385
 * B0, ADR-0327, the user's choices of 2026-11-04): a post without a line,
 * its tile in place of the map, its sport and time without a distance, and
 * none of what is done with a route.
 */
import drawing from "@shaperoute/shared-types/fixtures/drawing.json";
import type { DrawingDetail, FeedPost as ApiFeedPost } from "@shaperoute/shared-types";
import { render, screen } from "@testing-library/react-native";

import { isTrackless, routeActivity } from "../activities/snow";
import { isDrawing, isDrawingDetail } from "../api/drawings";
import { drawingOfDrawing } from "../messages/messageDrawing";
import { DrawingResultCard } from "../search/DrawingResultCard";
import { DrawingCard } from "../social/DrawingCard";
import { FollowsContext, type FollowsDoor } from "../social/followsDoor";
import { followable, runnable } from "../social/drawingRoute";
import { FeedPost, postFacts } from "./FeedPost";
import { shownPost } from "./feedPosts";
import { postEnergy } from "./postEnergy";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-file-system");
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

function post(): ApiFeedPost {
  return {
    id: "g1",
    title: "Push day",
    started_at: "2026-11-05T17:00:00Z",
    published_at: "2026-11-05T18:10:00Z",
    place: null,
    shape: null,
    word: null,
    style: null,
    route_title: null,
    distance_m: 0,
    duration_s: 3_600,
    score: null,
    fidelity: null,
    activity: "gym",
    track_preview: [],
    author: { public_id: "ada", username: "ada_lifts" },
  } as ApiFeedPost;
}

const GYM_DRAWING = {
  ...(drawing as DrawingDetail),
  activity: "gym",
  distance_m: 0,
  duration_s: 3_600,
  track: [],
} as DrawingDetail;

function door(): FollowsDoor {
  return {
    apiUrl: null,
    account: { state: { status: "signedOut", notice: null }, sessionEnded: () => {} },
    openProfile: () => {},
  } as FollowsDoor;
}

test("a workout at the gym is told apart, and has no route's activity", () => {
  expect(isTrackless("gym")).toBe(true);
  expect(isTrackless("skiing")).toBe(false);
  expect(isTrackless(undefined)).toBe(false);
  expect(routeActivity("gym")).toBeUndefined();
});

test("the app reads a post and a drawing without a line, keeping its sport", () => {
  const body = { ...post() };
  expect(isDrawing(body)).toBe(true);
  expect(body.activity).toBe("gym");
  expect(isDrawingDetail({ ...GYM_DRAWING })).toBe(true);
});

test("its facts are its sport and its time, with no distance nor energy", () => {
  const shown = shownPost(post());
  expect(postFacts(shown)).toBe("Gym · 1 h 00 min");
  expect(postEnergy(shown)).toBeNull();
});

test("the Feed's card shows the tile, not a map", async () => {
  await render(
    <FollowsContext.Provider value={door()}>
      <FeedPost post={shownPost(post())} width={320} onOpen={jest.fn()} />
    </FollowsContext.Provider>,
  );
  expect(screen.getByTestId("gym-tile", { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByText("Push day")).toBeOnTheScreen();
});

test("its drawing opened: no Start, GPX, Send, Draw it near me, Edit", async () => {
  await render(
    <DrawingCard
      drawing={GYM_DRAWING}
      onBack={jest.fn()}
      onStart={jest.fn()}
      onDrawAgain={jest.fn()}
      onEditDrawing={jest.fn()}
    />,
  );
  expect(screen.getByText("Gym · 1 h 00 min")).toBeOnTheScreen();
  for (const name of [
    "Start",
    "Export GPX",
    "Send to a friend",
    "Draw it near me",
    "Edit the drawing",
  ]) {
    expect(screen.queryByRole("button", { name })).toBeNull();
  }
  expect(runnable(GYM_DRAWING)).toBe(false);
  expect(followable(GYM_DRAWING)).toBe(false);
  expect(drawingOfDrawing(GYM_DRAWING)).toBeNull();
});

test("a search result shows the tile and who, not a distance", async () => {
  await render(
    <DrawingResultCard
      title="Push day"
      author="ada_lifts"
      distanceM={0}
      line={[]}
      activity="gym"
      width={160}
      onPress={jest.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "Push day, ada_lifts" })).toBeOnTheScreen();
  expect(screen.getByTestId("gym-tile", { includeHiddenElements: true })).toBeTruthy();
});
