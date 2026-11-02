import { render, screen } from "@testing-library/react-native";

import { barLabel, ShapePreview, sizeLabel } from "./ShapePreview";

test("the shape drawn to scale, with its size and a scale bar", async () => {
  await render(<ShapePreview shape="circle" distanceM={2000 * Math.PI} />);
  expect(screen.getByTestId("shape-preview")).toBeOnTheScreen();
  expect(screen.getByText("≈ 2.0 × 2.0 km")).toBeOnTheScreen();
  expect(screen.getByText("500 m")).toBeOnTheScreen();
  expect(screen.getAllByTestId("outline-side").length).toBeGreaterThan(10);
  expect(
    screen.getByLabelText("circle, about 2.0 × 2.0 km on the map"),
  ).toBeOnTheScreen();
});

test("it follows the distance", async () => {
  const { rerender } = await render(
    <ShapePreview shape="circle" distanceM={1000 * Math.PI} />,
  );
  expect(screen.getByText("≈ 1.0 × 1.0 km")).toBeOnTheScreen();
  await rerender(<ShapePreview shape="circle" distanceM={4000 * Math.PI} />);
  expect(screen.getByText("≈ 4.0 × 4.0 km")).toBeOnTheScreen();
});

test("labels in km and in miles", () => {
  expect(barLabel(500, "km")).toBe("500 m");
  expect(barLabel(2000, "km")).toBe("2 km");
  expect(barLabel(1000, "mi")).toBe("0.6 mi");
  expect(sizeLabel(1609.344, 3218.688, "mi")).toBe("1.0 × 2.0 mi");
});
