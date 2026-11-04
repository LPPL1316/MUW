/**
 * The form of a day on the snow (TASK-375): «Activity» says Ski or
 * Cross-country ski, never a run, a ride or a paddle, which have a route.
 */
import { fireEvent, render, screen } from "@testing-library/react-native";

import { ActivityChips, activityName } from "./PublicParts";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

test("a day of skiing is one of the two days on the snow", async () => {
  const onActivity = jest.fn();
  await render(<ActivityChips value="skiing" onChange={onActivity} />);
  expect(screen.getByRole("radio", { name: "Ski", checked: true })).toBeTruthy();
  expect(
    screen.getByRole("radio", { name: "Cross-country ski", checked: false }),
  ).toBeTruthy();
  expect(screen.queryByRole("radio", { name: "Run" })).toBeNull();
  expect(screen.queryByRole("radio", { name: "Bike" })).toBeNull();
  expect(screen.getAllByRole("radio")).toHaveLength(2);
  await fireEvent.press(screen.getByRole("radio", { name: "Cross-country ski" }));
  expect(onActivity).toHaveBeenCalledWith("xc_skiing");
});

test("a run keeps its chips, with no snow among them", async () => {
  await render(<ActivityChips value="running" onChange={jest.fn()} />);
  expect(screen.getByRole("radio", { name: "Run", checked: true })).toBeTruthy();
  expect(screen.queryByRole("radio", { name: "Ski" })).toBeNull();
});

test("a day on the snow has its name", () => {
  expect(activityName("skiing")).toBe("Ski");
  expect(activityName("xc_skiing")).toBe("Cross-country ski");
  expect(activityName("cycling")).toBe("Bike");
});
