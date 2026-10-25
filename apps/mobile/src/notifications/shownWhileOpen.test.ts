import { shownWhileOpen } from "./pushDevice";

// With the app open a notification shows as a banner, but for a shape of
// the game unlocked (TASK-296): the card after «Save» says it already.
test("every notification but a shape unlocked is shown while the app is open", () => {
  expect(shownWhileOpen({ kind: "comment", drawing_id: "x" })).toBe(true);
  expect(
    shownWhileOpen({ kind: "follow_request", public_id: "x", username: "ada" }),
  ).toBe(true);
  expect(
    shownWhileOpen({ kind: "shape_unlocked", public_id: "x", username: "ada" }),
  ).toBe(false);
  // Data the app does not know is shown: better once too many than lost.
  expect(shownWhileOpen(undefined)).toBe(true);
  expect(shownWhileOpen({})).toBe(true);
  expect(shownWhileOpen("shape_unlocked")).toBe(true);
});
