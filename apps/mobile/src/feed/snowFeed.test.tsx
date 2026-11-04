/**
 * A day on the snow in the Feed and on a profile (TASK-375 part B2, the
 * user's choice of 2026-11-04): a post like the others, its sport named, with
 * comments, reactions and «Share» on one's own, and none of what is done with
 * a route: no «Draw it near me», no «Start», no «Edit the drawing», no
 * sending it in a message. The GPX stays.
 */
import drawing from "@shaperoute/shared-types/fixtures/drawing.json";
import type {
  DrawingDetail,
  FeedPost as ApiFeedPost,
  RunActivity,
} from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { isOnSnow, routeActivity } from "../activities/snow";
import { drawingOfDrawing, drawingOfRun } from "../messages/messageDrawing";
import { exampleMatches } from "../search/drawingMatch";
import { NO_FILTERS } from "../search/searchFilters";
import { FollowsContext, type FollowsDoor } from "../social/followsDoor";
import { DrawingCard } from "../social/DrawingCard";
import { followedOf, runnable } from "../social/drawingRoute";
import { ActionBar } from "./ActionBar";
import { DrawAgainContext } from "./drawAgainDoor";
import { postFacts } from "./FeedPost";
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

const SNOW: readonly RunActivity[] = ["skiing", "xc_skiing"];

function post(activity: RunActivity): ApiFeedPost {
  return {
    id: "d1",
    title: "Sella Ronda",
    started_at: "2027-01-10T09:00:00Z",
    published_at: "2027-01-10T16:00:00Z",
    place: "Canazei",
    shape: null,
    word: null,
    style: null,
    route_title: null,
    distance_m: 42_000,
    duration_s: 21_600,
    score: null,
    fidelity: null,
    activity,
    track_preview: [
      [46.47, 11.77],
      [46.5, 11.8],
    ],
    author: { public_id: "ada", username: "ada_skis" },
  } as ApiFeedPost;
}

function door(publicId: string): FollowsDoor {
  return {
    apiUrl: "http://api.test",
    account: {
      state: {
        status: "signedIn",
        session: { token: "t", user: { id: "u", public_id: publicId } },
      },
      sessionEnded: () => {},
    },
  } as unknown as FollowsDoor;
}

test("the snow is told apart, and has no route's activity", () => {
  expect(SNOW.every(isOnSnow)).toBe(true);
  expect(isOnSnow("running")).toBe(false);
  expect(isOnSnow(undefined)).toBe(false);
  expect(routeActivity("skiing")).toBeUndefined();
  expect(routeActivity("cycling")).toBe("cycling");
});

test.each([
  ["skiing", "Ski"],
  ["xc_skiing", "Cross-country ski"],
] as const)("a post of %s says its sport, with no energy guessed", (activity, name) => {
  const shown = shownPost(post(activity));
  expect(postFacts(shown).startsWith(`${name} · `)).toBe(true);
  expect(postEnergy(shown)).toBeNull();
  expect(postEnergy(shownPost(post("running")))).not.toBeNull();
});

test.each(SNOW)(
  "the Feed's card of %s: comments, reactions, Share, never «Draw it near me»",
  async (activity) => {
    const again = jest.fn();
    await render(
      <FollowsContext.Provider value={door("ada")}>
        <DrawAgainContext.Provider value={() => again}>
          <ActionBar post={shownPost(post(activity))} onOpen={jest.fn()} />
        </DrawAgainContext.Provider>
      </FollowsContext.Provider>,
    );
    expect(screen.getByRole("button", { name: "Comments" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Reactions" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Share" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Draw it near me" })).toBeNull();
  },
);

test("a run keeps its «Draw it near me»", async () => {
  await render(
    <FollowsContext.Provider value={door("other")}>
      <DrawAgainContext.Provider value={() => jest.fn()}>
        <ActionBar post={shownPost(post("running"))} onOpen={jest.fn()} />
      </DrawAgainContext.Provider>
    </FollowsContext.Provider>,
  );
  expect(screen.getByRole("button", { name: "Draw it near me" })).toBeOnTheScreen();
});

test.each(SNOW)(
  "the drawing of %s opened: no Start, no Send, no Edit, the GPX stays",
  async (activity) => {
    const snow = { ...(drawing as DrawingDetail), activity };
    await render(
      <DrawingCard
        drawing={snow}
        onBack={jest.fn()}
        onStart={jest.fn()}
        onDrawAgain={jest.fn()}
        onEditDrawing={jest.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Send to a friend" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Draw it near me" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit the drawing" })).toBeNull();
    expect(screen.getByRole("button", { name: "Export GPX" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Back to the profile" }));
  },
);

test("a run opened keeps all of them", async () => {
  await render(
    <DrawingCard
      drawing={drawing as DrawingDetail}
      onBack={jest.fn()}
      onStart={jest.fn()}
      onDrawAgain={jest.fn()}
      onEditDrawing={jest.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "Start" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Draw it near me" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Edit the drawing" })).toBeOnTheScreen();
});

test.each(SNOW)("a day of %s is no route to follow nor to send", (activity) => {
  const snow = { ...(drawing as DrawingDetail), activity };
  expect(runnable(snow)).toBe(false);
  expect(runnable(drawing as DrawingDetail)).toBe(true);
  expect(followedOf(snow)).not.toHaveProperty("activity");
  expect(drawingOfDrawing(snow)).toBeNull();
  expect(drawingOfDrawing(drawing as DrawingDetail)).not.toBeNull();
});

test("one's own day on the snow is not sent as a drawing either", () => {
  const run = {
    id: "r1",
    title: null,
    started_at: "2027-01-10T09:00:00Z",
    distance_m: 42_000,
    duration_s: 21_600,
    similarity: 0,
    points: null,
    shape: null,
    word: null,
    style: null,
    place: "Canazei",
    activity: "skiing" as const,
    track: Array.from({ length: 50 }, (_, i): [number, number] => [
      46.47 + i * 0.001,
      11.77,
    ]),
  };
  expect(drawingOfRun(run as Parameters<typeof drawingOfRun>[0])).toBeNull();
});

test("a filter of activities leaves the snow out; no filter keeps it", () => {
  const shown = shownPost(post("skiing"));
  expect(
    exampleMatches(shown, [], [], { ...NO_FILTERS, activities: ["running"] }),
  ).toBe(false);
  expect(exampleMatches(shown, [], [], NO_FILTERS)).toBe(true);
});
