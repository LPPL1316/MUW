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
