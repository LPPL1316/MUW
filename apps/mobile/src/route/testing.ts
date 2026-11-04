import { fireEvent, screen, within } from "@testing-library/react-native";

/**
 * «Draw»'s shapes for the tests of the whole app (TASK-361): the grid of two
 * rows with «See all», and the field for another shape behind «Type another
 * shape».
 */

/** The field for a shape out of the grid, opened if it is behind its link. */
export async function shapeField(): Promise<ReturnType<typeof screen.getByLabelText>> {
  const link = screen.queryByTestId("other-shape-link");
  if (link !== null) {
    await fireEvent.press(link);
  }
  return screen.getByLabelText("Type another shape");
}

/** Words typed in the field for another shape. */
export async function typeShape(text: string): Promise<void> {
  await fireEvent.changeText(await shapeField(), text);
}

/** A shape's tile pressed, after «See all» when it is not among the first. */
export async function pickShape(name: string): Promise<void> {
  const grid = () => within(screen.getByTestId("shape-grid"));
  if (grid().queryByRole("button", { name }) === null) {
    await fireEvent.press(screen.getByTestId("shape-grid-more"));
  }
  await fireEvent.press(grid().getByRole("button", { name }));
}

/** The name of the shape whose tile is chosen; null for none. */
export function chosenShape(): string | null {
  const chosen = within(screen.getByTestId("shape-grid"))
    .getAllByRole("button")
    .find((tile) => tile.props.accessibilityState?.selected === true);
  return (chosen?.props.accessibilityLabel as string | undefined) ?? null;
}
