import { render, screen } from "@testing-library/react-native";

import { StepTitle } from "./StepTitle";

test("a step is a header with its number", async () => {
  await render(<StepTitle number={2} label="WHAT YOU DRAW" />);
  expect(screen.getByRole("header", { name: "2. WHAT YOU DRAW" })).toBeOnTheScreen();
  expect(screen.getByText("2")).toBeOnTheScreen();
});
