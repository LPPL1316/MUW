import type { FeedPost as ApiFeedPost } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { FollowsContext, type FollowsDoor } from "../social/followsDoor";
import { color, MIN_TAP_SIZE } from "../theme/tokens";
import { ActionBar, postOfDrawing } from "./ActionBar";
import { DrawAgainContext } from "./drawAgainDoor";
import { shownPost } from "./feedPosts";

const DRAWING: ApiFeedPost = {
  id: "d1",
  title: "Morning",
  started_at: "2026-10-30T08:00:00Z",
  published_at: "2026-10-30T10:00:00Z",
  place: "Caldonazzo",
  shape: "moon",
  word: null,
  style: null,
  route_title: null,
  distance_m: 5000,
  duration_s: 1800,
  score: null,
  fidelity: null,
  rotation_deg: 45,
  activity: "running",
  track_preview: [
    [46.0, 11.2],
    [46.01, 11.21],
  ],
  author: { public_id: "ada", username: "ada_runs" },
} as ApiFeedPost;

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

async function bar(publicId: string, onOpen = jest.fn(), again?: () => void) {
  await render(
    <FollowsContext.Provider value={door(publicId)}>
      <DrawAgainContext.Provider value={() => again}>
        <ActionBar post={shownPost(DRAWING)} onOpen={onOpen} />
      </DrawAgainContext.Provider>
    </FollowsContext.Provider>,
  );
  return onOpen;
}

test("comments and reactions open the drawing", async () => {
  const onOpen = await bar("other");
  await fireEvent.press(screen.getByRole("button", { name: "Comments" }));
  await fireEvent.press(screen.getByRole("button", { name: "Reactions" }));
  expect(onOpen).toHaveBeenCalledTimes(2);
});

test("«Share» only on one's own drawings", async () => {
  await bar("other");
  expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
  await bar("ada");
  expect(screen.getByRole("button", { name: "Share" })).toBeOnTheScreen();
});

test("«Draw it near me» is yellow, and only when «Draw» can draw it", async () => {
  await bar("other");
  expect(screen.queryByRole("button", { name: "Draw it near me" })).toBeNull();

  const again = jest.fn();
  await bar("other", jest.fn(), again);
  const button = screen.getByRole("button", { name: "Draw it near me" });
  expect(button).toHaveStyle({ backgroundColor: color.accent });
  await fireEvent.press(button);
  expect(again).toHaveBeenCalledTimes(1);
});

test("every button is big enough to touch", async () => {
  await bar("ada", jest.fn(), () => {});
  for (const button of screen.getAllByRole("button")) {
    const { minHeight } = StyleSheet.flatten(button.props.style);
    expect(minHeight).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
  }
});

test("a drawing's post sends only the cut track, and keeps nothing", () => {
  const post = postOfDrawing(shownPost(DRAWING));
  expect(post.key).toBeNull();
  expect(post.track).toEqual(DRAWING.track_preview);
  expect(post.durationMs).toBe(1_800_000);
  expect(post.rotationDeg).toBe(45);
});
