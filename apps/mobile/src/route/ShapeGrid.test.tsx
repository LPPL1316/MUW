import { SHAPES } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { gridShapes, ShapeGrid, SHOWN_CLOSED } from "./ShapeGrid";

jest.mock("../haptics/haptics", () => ({ selectionFeel: jest.fn() }));

test("closed: two rows, seven shapes and «See all»; nothing cut at the edge", async () => {
  await render(<ShapeGrid chosen={null} onPick={() => {}} />);
  expect(screen.getByTestId("shape-grid")).not.toHaveProp("horizontal", true);
  // Seven shapes and «See all».
  expect(screen.getAllByRole("button")).toHaveLength(SHOWN_CLOSED + 1);
  expect(
    screen.getByRole("button", { name: `See all ${SHAPES.length} shapes` }),
  ).toBeOnTheScreen();
});

test("«See all» opens every shape, «Show fewer» closes", async () => {
  await render(<ShapeGrid chosen={null} onPick={() => {}} />);
  await fireEvent.press(screen.getByTestId("shape-grid-more"));
  expect(screen.getAllByRole("button")).toHaveLength(SHAPES.length + 1);
  expect(screen.getByRole("button", { name: "Show fewer shapes" })).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("shape-grid-more"));
  expect(screen.getAllByRole("button")).toHaveLength(SHOWN_CLOSED + 1);
});

test("a tile writes the name the runner reads, and is felt", async () => {
  const onPick = jest.fn();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { selectionFeel } = require("../haptics/haptics") as {
    selectionFeel: jest.Mock;
  };
  await render(<ShapeGrid chosen={null} onPick={onPick} />);
  await fireEvent.press(screen.getByRole("button", { name: "heart" }));
  expect(onPick).toHaveBeenCalledWith("heart");
  expect(selectionFeel).toHaveBeenCalledTimes(1);
});

test("the shape chosen is always in sight, closed too", () => {
  const first = SHAPES.slice(0, SHOWN_CLOSED);
  expect(gridShapes(null, false)).toEqual(first);
  expect(gridShapes(first[2], false)).toEqual(first);
  const last = SHAPES[SHAPES.length - 1];
  const shown = gridShapes(last, false);
  expect(shown).toHaveLength(SHOWN_CLOSED);
  expect(shown[SHOWN_CLOSED - 1]).toBe(last);
  expect(gridShapes(null, true)).toEqual([...SHAPES]);
});

test("the chosen tile says so", async () => {
  await render(<ShapeGrid chosen="star" onPick={() => {}} />);
  expect(screen.getByRole("button", { name: "star" })).toBeSelected();
  expect(screen.getByRole("button", { name: "heart" })).not.toBeSelected();
});
