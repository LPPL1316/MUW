import { fireEvent, render, screen } from "@testing-library/react-native";

import { FindFriendsButton } from "./FindFriendsButton";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

test("only a lens: «Search» is for VoiceOver, and opens the search (TASK-344)", async () => {
  await render(<FindFriendsButton onOpenExample={jest.fn()} />);
  // Nothing written on the screen (the user's choice): the name is the button's.
  expect(screen.queryByText("Search")).toBeNull();
  expect(screen.queryByTestId("search-page")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Search" }));
  expect(screen.getByTestId("search-page")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("search-cancel"));
  expect(screen.queryByTestId("search-page")).toBeNull();
});
