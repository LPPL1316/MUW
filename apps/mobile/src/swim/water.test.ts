import { shapeAsked } from "../route/penUpShapes";

import { isOnWater } from "./water";

test("paddling and a swim are on the water, a run and a ride are not", () => {
  expect(isOnWater("paddling")).toBe(true);
  expect(isOnWater("swimming")).toBe(true);
  expect(isOnWater("running")).toBe(false);
  expect(isOnWater("cycling")).toBe(false);
  expect(isOnWater(undefined)).toBe(false);
});

test("a shape in pieces is swum piece by piece, the switch or not (TASK-323 C2)", () => {
  expect(shapeAsked("cat", false, "swimming")).toEqual({ shape: "cat", pen_up: true });
  expect(shapeAsked("heart", true, "swimming")).toEqual({ shape: "heart" });
  // As paddled (TASK-226).
  expect(shapeAsked("cat", false, "paddling")).toEqual(
    shapeAsked("cat", false, "swimming"),
  );
});
