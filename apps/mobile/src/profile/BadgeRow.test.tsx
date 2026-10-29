import { render, screen } from "@testing-library/react-native";

import { BadgeRow, badgeText } from "./BadgeRow";

test("another's profile shows only the badges earned, «Winner» first", async () => {
  await render(<BadgeRow winner badges={["first_drawing", "long_drawing"]} />);
  expect(screen.getByTestId("badge-row")).toHaveTextContent(
    "🏆Winner✏️First drawing🛣️30 km drawing",
  );
  expect(screen.queryByTestId("badge-ten_drawings")).toBeNull();
});

test("one's own shows the badges still to earn too, said as not earned", async () => {
  await render(<BadgeRow winner={false} badges={["first_drawing"]} own />);
  expect(screen.getByLabelText("First drawing")).toBeEnabled();
  const ten = screen.getByLabelText("Not earned yet: 10 drawings");
  expect(ten).toBeDisabled();
  expect(screen.getByLabelText("Not earned yet: 30 km drawing")).toBeOnTheScreen();
});

test("nothing earned on another's profile: no row", async () => {
  await render(<BadgeRow winner={false} badges={[]} />);
  expect(screen.queryByTestId("badge-row")).toBeNull();
});

test("an API older than the badges: «Winner» alone, even on one's own", async () => {
  await render(<BadgeRow winner badges={null} own />);
  expect(screen.getByTestId("badge-row")).toHaveTextContent("🏆Winner");
  expect(screen.queryByTestId("badge-first_drawing")).toBeNull();
});

test("the 30 km drawing in miles is said in whole miles", () => {
  expect(badgeText("long_drawing", "mi")).toBe("19 mi drawing");
  expect(badgeText("long_drawing", "km")).toBe("30 km drawing");
});
