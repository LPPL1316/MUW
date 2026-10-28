import { fireEvent, render, screen } from "@testing-library/react-native";

import type { FreehandFigure } from "./freehand";
import { FreehandBoard } from "./FreehandBoard";

/**
 * The board to draw a figure by hand (TASK-320): one finger draws, two
 * zoom and move the square, «Erase» makes a tap erase, «Undo» and «Save».
 * What the lines become is in freehand.test.ts.
 */

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

// A square figure with one detail, as the board's shares.
const FIGURE: FreehandFigure = {
  outline: [
    [0.2, 0.2],
    [0.8, 0.2],
    [0.8, 0.8],
    [0.2, 0.8],
    [0.2, 0.2],
  ],
  details: [
    [
      [0.5, 0.8],
      [0.5, 0.5],
    ],
  ],
};

function fingers(...points: [number, number][]) {
  const [x, y] = points[0];
  return {
    nativeEvent: {
      locationX: x,
      locationY: y,
      touches: points.map(([locationX, locationY]) => ({ locationX, locationY })),
    },
  };
}

type Handlers = {
  onLine: jest.Mock;
  onErase: jest.Mock;
  onUndo: jest.Mock;
  onClose: jest.Mock;
};

function handlers(): Handlers {
  return {
    onLine: jest.fn(),
    onErase: jest.fn(),
    onUndo: jest.fn(),
    onClose: jest.fn(),
  };
}

/** The board on a 400 × 700 screen: its square is 400 wide, 150 down. */
async function board(
  figure: FreehandFigure | null,
  given: Handlers = handlers(),
  problem: "open" | "crosses" | "too_much" | null = null,
  canUndo = figure !== null,
) {
  await render(
    <FreehandBoard
      visible
      figure={figure}
      problem={problem}
      canUndo={canUndo}
      {...given}
    />,
  );
  const area = screen.getByTestId("freehand-board");
  await fireEvent(area, "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 700 } },
  });
  return area;
}

function transformOf() {
  const style = [screen.getByTestId("board-square").props.style].flat(Infinity);
  const transform = Object.assign({}, ...style).transform as Record<string, number>[];
  return Object.assign({}, ...transform) as {
    translateX: number;
    translateY: number;
    scale: number;
  };
}

test("an empty board asks for the outline; one finger draws it, and the line goes out when it lifts", async () => {
  const given = handlers();
  const area = await board(null, given);
  expect(screen.getByTestId("board-square")).toHaveStyle({
    left: 0,
    top: 150,
    width: 400,
    height: 400,
  });
  expect(
    screen.getByText("Draw the outline with one finger: it closes by itself."),
  ).toBeOnTheScreen();
  expect(screen.queryAllByTestId("outline-side")).toHaveLength(0);
  // Nothing to erase or undo yet.
  expect(screen.getByRole("button", { name: "Erase" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  await fireEvent(area, "responderGrant", fingers([100, 250]));
  await fireEvent(area, "responderMove", fingers([300, 250]));
  // The line follows the finger before it is kept.
  expect(screen.getAllByTestId("drawn-side")).toHaveLength(1);
  await fireEvent(area, "responderMove", fingers([300, 450]));
  await fireEvent(area, "responderRelease", fingers([300, 450]));
  expect(given.onLine).toHaveBeenCalledWith([
    [0.25, 0.25],
    [0.75, 0.25],
    [0.75, 0.75],
  ]);
  expect(screen.queryAllByTestId("drawn-side")).toHaveLength(0);
  // A tap draws nothing.
  await fireEvent(area, "responderGrant", fingers([100, 250]));
  await fireEvent(area, "responderRelease", fingers([100, 250]));
  expect(given.onLine).toHaveBeenCalledTimes(1);
});

test("with a figure, the lines show, the next line is joined to it, and a problem is said in its place", async () => {
  const given = handlers();
  await board(FIGURE, given);
  expect(screen.getAllByTestId("outline-side")).toHaveLength(4);
  expect(screen.getAllByTestId("detail-side")).toHaveLength(1);
  expect(
    screen.getByText("Draw with one finger. Lines after the first are joined to it."),
  ).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Erase" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
  await fireEvent.press(screen.getByRole("button", { name: "Undo" }));
  expect(given.onUndo).toHaveBeenCalled();
  await render(
    <FreehandBoard
      visible
      figure={null}
      problem="open"
      canUndo={false}
      {...handlers()}
    />,
  );
  expect(
    screen.getByText("This line encloses nothing. Draw a closed shape."),
  ).toBeOnTheScreen();
});

test("with Erase on, a tap erases the line under it, and a finger that moves pans the square", async () => {
  const given = handlers();
  const area = await board(FIGURE, given);
  await fireEvent.press(screen.getByRole("button", { name: "Erase" }));
  expect(screen.getByRole("button", { name: "Erase" })).toBeSelected();
  expect(
    screen.getByText("Tap a line to erase it. The outline takes its details with it."),
  ).toBeOnTheScreen();
  await fireEvent(area, "responderGrant", fingers([200, 390]));
  await fireEvent(area, "responderRelease", fingers([200, 390]));
  expect(given.onErase).toHaveBeenCalledWith([0.5, 0.6], 0.05);
  expect(given.onLine).not.toHaveBeenCalled();
  // Moved: no erasing, the square follows the finger.
  await fireEvent(area, "responderGrant", fingers([200, 350]));
  await fireEvent(area, "responderMove", fingers([230, 330]));
  await fireEvent(area, "responderRelease", fingers([230, 330]));
  expect(given.onErase).toHaveBeenCalledTimes(1);
  expect(transformOf()).toMatchObject({ translateX: 30, translateY: -20 });
  // Erase off again: a finger draws.
  await fireEvent.press(screen.getByRole("button", { name: "Erase" }));
  expect(screen.getByRole("button", { name: "Erase" })).not.toBeSelected();
});

test("two fingers zoom, drop the line, and Fit puts the square back", async () => {
  const given = handlers();
  const area = await board(FIGURE, given);
  await fireEvent(area, "responderGrant", fingers([150, 350]));
  await fireEvent(area, "responderMove", fingers([150, 350], [250, 350]));
  await fireEvent(area, "responderMove", fingers([100, 350], [300, 350]));
  expect(transformOf().scale).toBeCloseTo(2);
  // One finger lifted: the other does not start drawing.
  await fireEvent(area, "responderMove", fingers([120, 350]));
  await fireEvent(area, "responderRelease", fingers([120, 350]));
  expect(given.onLine).not.toHaveBeenCalled();
  // Zoomed, the same stroke on the screen is a shorter one on the square,
  // and Erase must come nearer.
  await fireEvent(area, "responderGrant", fingers([200, 350]));
  await fireEvent(area, "responderMove", fingers([300, 350]));
  await fireEvent(area, "responderRelease", fingers([300, 350]));
  expect(given.onLine).toHaveBeenCalledWith([
    [0.5, 0.5],
    [0.625, 0.5],
  ]);
  await fireEvent.press(screen.getByRole("button", { name: "Erase" }));
  await fireEvent(area, "responderGrant", fingers([200, 350]));
  await fireEvent(area, "responderRelease", fingers([200, 350]));
  expect(given.onErase).toHaveBeenCalledWith([0.5, 0.5], 0.025);
  await fireEvent.press(screen.getByText("Fit"));
  expect(transformOf()).toEqual({ translateX: 0, translateY: 0, scale: 1 });
  expect(screen.queryByText("Fit")).toBeNull();
});

test("Save closes the board; nothing is asked of the network", async () => {
  const fetchSpy = jest.spyOn(globalThis, "fetch");
  const given = handlers();
  const area = await board(FIGURE, given);
  await fireEvent(area, "responderGrant", fingers([200, 350]));
  await fireEvent(area, "responderMove", fingers([300, 350]));
  await fireEvent(area, "responderRelease", fingers([300, 350]));
  await fireEvent.press(screen.getByRole("button", { name: "Save" }));
  expect(given.onClose).toHaveBeenCalled();
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});
