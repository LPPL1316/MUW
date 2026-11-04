import { act, renderHook } from "@testing-library/react-native";
import type { Activity } from "@shaperoute/shared-types";

import type { DrawAgain, DrawnFigure } from "../route/drawAgain";
import { useDrawAgainOf } from "./drawAgainDoor";

const MOON: DrawnFigure = { shape: "moon", word: null, style: null, distance_m: 5000 };
const WORD: DrawnFigure = {
  shape: null,
  word: "CIAO",
  style: "round",
  distance_m: 5000,
};
const NOTHING: DrawnFigure = { shape: null, word: null, style: null, distance_m: 5000 };

type Props = { activity: Activity; onDrawAgain: (again: DrawAgain) => void };

async function door(activity: Activity, onDrawAgain: Props["onDrawAgain"] = () => {}) {
  return renderHook(
    (props: Props) => useDrawAgainOf(props.activity, props.onDrawAgain),
    { initialProps: { activity, onDrawAgain } },
  );
}

test("stays the same door when the app is drawn again, and the app's action is the last one", async () => {
  const first = jest.fn();
  const last = jest.fn();
  const { result, rerender } = await door("running", first);
  const before = result.current;

  await rerender({ activity: "running", onDrawAgain: last });
  expect(result.current).toBe(before);

  await act(async () => before(MOON)?.());
  expect(first).not.toHaveBeenCalled();
  expect(last).toHaveBeenCalledWith({ kind: "shape", shape: "moon", distance_m: 5000 });
});

test("a new sport in «Draw» is a new door", async () => {
  const onDrawAgain = jest.fn();
  const { result, rerender } = await door("running", onDrawAgain);
  const before = result.current;
  await rerender({ activity: "paddling", onDrawAgain });
  expect(result.current).not.toBe(before);
});

test("the sport that counts is the one of «Draw», as on the opened drawing", async () => {
  // A shape can be drawn in every sport.
  const running = (await door("running")).result.current;
  const paddling = (await door("paddling")).result.current;
  expect(running(MOON)).toBeDefined();
  expect(paddling(MOON)).toBeDefined();
  // A word never on the water.
  expect(running(WORD)).toBeDefined();
  expect(paddling(WORD)).toBeUndefined();
});

test("a run without a figure «Draw» can choose has no button", async () => {
  const { result } = await door("running");
  expect(result.current(NOTHING)).toBeUndefined();
});
