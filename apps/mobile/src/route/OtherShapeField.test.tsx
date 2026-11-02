import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { OtherShapeField, typedOtherShape } from "./OtherShapeField";

test("closed, a link; a tap opens the field, empty and focused", async () => {
  await render(
    <OtherShapeField text="" shape={null} onText={() => {}} onDone={() => {}} />,
  );
  expect(screen.queryByLabelText("Type another shape")).toBeNull();
  await fireEvent.press(screen.getByTestId("other-shape-link"));
  const field = screen.getByLabelText("Type another shape");
  expect(field).toHaveProp("value", "");
  expect(field).toHaveProp("autoFocus", true);
});

test("a tile picked keeps it closed: the field does not repeat the shape", async () => {
  await render(
    <OtherShapeField text="heart" shape="heart" onText={() => {}} onDone={() => {}} />,
  );
  expect(screen.getByTestId("other-shape-link")).toBeOnTheScreen();
});

test("words that are not a tile's open it by itself, with what is under it", async () => {
  const onText = jest.fn();
  const onDone = jest.fn();
  await render(
    <OtherShapeField
      text="prancing horse"
      shape="horse"
      onText={onText}
      onDone={onDone}
    >
      <Text>→ horse</Text>
    </OtherShapeField>,
  );
  const field = screen.getByLabelText("Type another shape");
  expect(field).toHaveProp("value", "prancing horse");
  expect(screen.getByText("→ horse")).toBeOnTheScreen();
  await fireEvent.changeText(field, "rocket");
  expect(onText).toHaveBeenCalledWith("rocket");
  await fireEvent(field, "endEditing");
  expect(onDone).toHaveBeenCalledTimes(1);
});

test("typed or picked", () => {
  expect(typedOtherShape("", null)).toBe(false);
  expect(typedOtherShape("  Heart ", "heart")).toBe(false);
  expect(typedOtherShape("rocket", null)).toBe(true);
  expect(typedOtherShape("prancing horse", "horse")).toBe(true);
});
