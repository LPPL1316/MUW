import { fireEvent, render, screen } from "@testing-library/react-native";
import { Animated, type StyleProp, StyleSheet, type ViewStyle } from "react-native";

import { color, motion } from "../theme/tokens";
import { UnitsSetting } from "./UnitsSetting";

// The premium look, part C2 (TASK-339, ADR-0293), on a page of «Settings»:
// the division between the row and its choices is a `Hairline`, one physical
// pixel of `color.hairline`, and the row answers the finger through `Tap`.

jest.mock("../units/units", () => {
  const actual = jest.requireActual<typeof import("../units/units")>("../units/units");
  return { ...actual, loadUnitsChoice: jest.fn(() => "phone") };
});
jest.mock("../units/phoneUnits", () => ({ phoneUnits: jest.fn(() => "km") }));

/** The rendered tree as JSON, and every node in it `where` says. */
type Json = {
  type: string;
  props: Record<string, unknown>;
  children: (Json | string)[] | null;
};
function nodes(
  node: Json | string | null | undefined,
  where: (node: Json) => boolean,
): Json[] {
  if (node == null || typeof node === "string") {
    return [];
  }
  const own = where(node) ? [node] : [];
  return [...own, ...(node.children ?? []).flatMap((child) => nodes(child, where))];
}

function isHairline(node: Json): boolean {
  const style = StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>) ?? {};
  return (
    node.type === "View" &&
    style.height === StyleSheet.hairlineWidth &&
    style.backgroundColor === color.hairline
  );
}

test("a hairline above each choice, in color.hairline", async () => {
  await render(<UnitsSetting />);
  await fireEvent.press(screen.getAllByRole("button")[0]);
  const tree = screen.toJSON() as unknown as Json | null;
  expect(nodes(tree, isHairline)).toHaveLength(screen.getAllByRole("radio").length);
  expect(
    nodes(tree, (node) => {
      const style = StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>) ?? {};
      return (
        style.backgroundColor === color.border &&
        style.height === StyleSheet.hairlineWidth
      );
    }),
  ).toHaveLength(0);
});

test("the row answers the finger in motion.pressMs", async () => {
  const timing = jest.spyOn(Animated, "timing");
  await render(<UnitsSetting />);
  await fireEvent(screen.getAllByRole("button")[0], "pressIn");
  expect(timing).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ toValue: 1, duration: motion.pressMs }),
  );
  timing.mockRestore();
});
