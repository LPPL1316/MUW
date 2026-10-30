import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { loadSport, saveSport, SPORTS, type SportOption } from "./sport";
import { SportButton } from "./SportButton";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-file-system");
// The sport kept on the phone, as each test says; saving, and telling the
// button, are the real ones.
jest.mock("./sport", () => {
  const actual = jest.requireActual<typeof import("./sport")>("./sport");
  return { ...actual, loadSport: jest.fn(), saveSport: jest.fn(actual.saveSport) };
});

/** As before TASK-190: only run ready. */
const RUN_ONLY: SportOption[] = SPORTS.map((option) =>
  option.id === "run" ? option : { ...option, ready: false },
);

/** Three sports, the last not ready: the menu whatever `SPORTS` turns on. */
const SOME: SportOption[] = [
  { id: "run", emoji: "🏃‍♂️", name: "Run", ready: true },
  { id: "bike", emoji: "🚴", name: "Bike", ready: true },
  { id: "paddle", emoji: "🛶", name: "Paddle", ready: false },
];

beforeEach(() => {
  jest.mocked(loadSport).mockReturnValue("run");
  jest.mocked(saveSport).mockClear();
});

test("the button shows the sport chosen, and no menu until it is touched", async () => {
  await render(<SportButton sports={SOME} />);
  expect(screen.getByRole("button", { name: "Sport, Run" })).toBeOnTheScreen();
  expect(screen.getByText("🏃‍♂️")).toBeOnTheScreen();
  expect(screen.queryByRole("radio")).toBeNull();
});

test("touched, it shows the sports of «Settings»: the chosen one ticked, «Paddle» «Soon»", async () => {
  await render(<SportButton sports={SOME} />);
  await fireEvent.press(screen.getByRole("button", { name: "Sport, Run" }));
  expect(screen.getByRole("radio", { name: "Run" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Bike" })).not.toBeChecked();
  expect(screen.getAllByRole("radio")).toHaveLength(2);
  expect(screen.getByLabelText("Paddle, coming soon")).toBeOnTheScreen();
  expect(screen.getAllByText("Soon")).toHaveLength(1);
  expect(screen.getAllByText("✓")).toHaveLength(1);
});

test("a sport chosen is saved as in «Settings», closes the menu and shows on the button", async () => {
  await render(<SportButton sports={SOME} />);
  await fireEvent.press(screen.getByRole("button", { name: "Sport, Run" }));
  await fireEvent.press(screen.getByRole("radio", { name: "Bike" }));
  expect(saveSport).toHaveBeenCalledWith("bike");
  expect(screen.queryByRole("radio")).toBeNull();
  expect(screen.getByRole("button", { name: "Sport, Bike" })).toBeOnTheScreen();
  expect(screen.getByText("🚴")).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole("button", { name: "Sport, Bike" }));
  expect(screen.getByRole("radio", { name: "Bike" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Run" })).not.toBeChecked();
});

test("«Paddle» takes no tap; a tap outside closes the menu and changes nothing", async () => {
  await render(<SportButton sports={SOME} />);
  await fireEvent.press(screen.getByRole("button", { name: "Sport, Run" }));
  await fireEvent.press(screen.getByLabelText("Paddle, coming soon"));
  expect(screen.getAllByRole("radio")).toHaveLength(2);
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("radio")).toBeNull();
  expect(saveSport).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Sport, Run" })).toBeOnTheScreen();
});

test("a sport not ready is not a choice in the menu", async () => {
  await render(<SportButton sports={RUN_ONLY} />);
  await fireEvent.press(screen.getByRole("button", { name: "Sport, Run" }));
  expect(screen.getAllByRole("radio")).toHaveLength(1);
  expect(screen.getByLabelText("Bike, coming soon")).toBeOnTheScreen();
  // Bike, Paddle, Open water swim (TASK-323 C) and Paragliding (TASK-305 D0).
  expect(screen.getAllByText("Soon")).toHaveLength(4);
});

test("in the menu «Open water swim» says «Soon» and takes no tap (TASK-323 C)", async () => {
  await render(<SportButton />);
  await fireEvent.press(screen.getByRole("button", { name: "Sport, Run" }));
  await fireEvent.press(screen.getByLabelText("Open water swim, coming soon"));
  expect(saveSport).not.toHaveBeenCalled();
  expect(screen.getByRole("radio", { name: "Run" })).toBeChecked();
});

test("the app's menu ends with «Paragliding» «Soon», as «Settings» (TASK-305 D0)", async () => {
  await render(<SportButton />);
  await fireEvent.press(screen.getByRole("button", { name: "Sport, Run" }));
  expect(screen.getAllByRole("radio")).toHaveLength(3);
  await fireEvent.press(screen.getByLabelText("Paragliding, coming soon"));
  expect(saveSport).not.toHaveBeenCalled();
  expect(screen.getByRole("radio", { name: "Run" })).toBeChecked();
});

test("the sport on the phone, and one chosen in «Settings» later, show at once", async () => {
  jest.mocked(loadSport).mockReturnValue("bike");
  await render(<SportButton sports={SOME} />);
  expect(screen.getByRole("button", { name: "Sport, Bike" })).toBeOnTheScreen();
  await act(async () => saveSport("run"));
  expect(screen.getByRole("button", { name: "Sport, Run" })).toBeOnTheScreen();
});
