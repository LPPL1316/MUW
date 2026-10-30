import { fireEvent, render, screen } from "@testing-library/react-native";

import { type PhotoButton, ProfileHeader } from "./ProfileHeader";

async function show(photoButton?: PhotoButton) {
  await render(
    <ProfileHeader
      username="runner_42"
      bio=""
      photo={null}
      detail="3 drawings"
      photoButton={photoButton}
    />,
  );
}

test("another's profile: the circle has no «+» and takes no tap", async () => {
  await show();
  expect(screen.getByText("R")).toBeOnTheScreen();
  expect(screen.queryByTestId("photo-plus")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});

test("one's own: the circle is «Profile picture» with a «+», and a tap asks for the ways", async () => {
  const onPress = jest.fn();
  await show({ open: false, busy: false, onPress });
  const circle = screen.getByRole("button", { name: "Profile picture" });
  expect(screen.getByTestId("photo-plus")).toHaveTextContent("+");
  expect(circle).not.toBeExpanded();
  expect(circle).toBeEnabled();
  await fireEvent.press(circle);
  expect(onPress).toHaveBeenCalledTimes(1);
});

test("open, the circle says so; busy, it takes no tap", async () => {
  const onPress = jest.fn();
  await show({ open: true, busy: false, onPress });
  expect(screen.getByRole("button", { name: "Profile picture" })).toBeExpanded();

  await show({ open: false, busy: true, onPress });
  const circle = screen.getByRole("button", { name: "Profile picture" });
  expect(circle).toBeDisabled();
  await fireEvent.press(circle);
  expect(onPress).not.toHaveBeenCalled();
});

test("who won a contest has the «Winner» badge under the name; the others none", async () => {
  await render(
    <ProfileHeader
      username="runner_42"
      bio=""
      photo={null}
      detail="3 drawings"
      winner
    />,
  );
  expect(screen.getByLabelText("Winner")).toBeOnTheScreen();
  expect(screen.getByTestId("winner-badge")).toHaveTextContent("🏆Winner");

  await show();
  expect(screen.queryByLabelText("Winner")).toBeNull();
});

test("the badges of the drawings follow «Winner»; on one's own, those to earn too", async () => {
  await render(
    <ProfileHeader
      username="runner_42"
      bio=""
      photo={null}
      detail="3 drawings"
      winner
      badges={["first_drawing"]}
    />,
  );
  expect(screen.getByTestId("badge-row")).toHaveTextContent("🏆Winner✏️First drawing");
  expect(screen.queryByTestId("badge-ten_drawings")).toBeNull();

  await render(
    <ProfileHeader
      username="runner_42"
      bio=""
      photo={null}
      detail="me@example.com"
      photoButton={{ open: false, busy: false, onPress: jest.fn() }}
      badges={["first_drawing"]}
    />,
  );
  expect(screen.getByLabelText("Not earned yet: 10 drawings")).toBeDisabled();
});
