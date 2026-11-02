import examples from "@shaperoute/shared-types/fixtures/push-data.json";

import { tapTarget } from "./notificationTap";

test("the API's examples open a drawing and a profile", () => {
  const [drawing, profile] = examples;
  expect(tapTarget(drawing)).toEqual({ kind: "drawing", id: drawing.drawing_id });
  expect(tapTarget(profile)).toEqual({
    kind: "profile",
    person: { public_id: profile.public_id, username: "ada", photo: null },
  });
});

test("a shape of the game unlocked opens «Play», whoever the data names (TASK-296)", () => {
  const [, profile] = examples;
  expect(tapTarget({ ...profile, kind: "shape_unlocked" })).toEqual({ kind: "play" });
  expect(tapTarget({ kind: "shape_unlocked" })).toEqual({ kind: "play" });
});

test("a monthly challenge's three notifications open its page (TASK-343 part B)", () => {
  const contest = "c1a2b3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
  for (const kind of ["contest_open", "contest_last_days", "contest_results"]) {
    expect(tapTarget({ kind, contest_id: contest })).toEqual({
      kind: "contest",
      id: contest,
    });
    // Without a good id, nothing: not «Play», whose challenges are another thing.
    expect(tapTarget({ kind })).toBeNull();
    expect(tapTarget({ kind, contest_id: "nope" })).toBeNull();
  }
  // The winner's still opens the post.
  const drawing = "6d0e5c4a-2b1f-4a3e-9c8d-7e6f5a4b3c2d";
  expect(
    tapTarget({ kind: "contest_won", contest_id: contest, drawing_id: drawing }),
  ).toEqual({ kind: "drawing", id: drawing });
});

test("a challenge's notification opens the challenge it names (TASK-296 part D)", () => {
  const id = "6d0e5c4a-2b1f-4a3e-9c8d-7e6f5a4b3c2d";
  for (const kind of ["piece_done", "challenge_done", "challenge_ending"]) {
    expect(tapTarget({ kind, challenge_id: id })).toEqual({ kind: "challenge", id });
  }
  // Without a good id, «Play» on its «Challenges» tab.
  expect(tapTarget({ kind: "piece_done" })).toEqual({ kind: "play" });
  expect(tapTarget({ kind: "challenge_done", challenge_id: "not-an-id" })).toEqual({
    kind: "play",
  });
  // A challenge id with another kind is not a challenge.
  expect(tapTarget({ kind: "comment", challenge_id: id })).toBeNull();
});

test("anything else opens nothing", () => {
  for (const data of [
    null,
    "comment",
    {},
    { drawing_id: "not-an-id" },
    { drawing_id: 12 },
    { public_id: "5f0c2b8e-1d4a-4e6b-8c9f-3a2b1c0d9e8f" },
    { public_id: "5f0c2b8e-1d4a-4e6b-8c9f-3a2b1c0d9e8f", username: "" },
  ]) {
    expect(tapTarget(data)).toBeNull();
  }
});
