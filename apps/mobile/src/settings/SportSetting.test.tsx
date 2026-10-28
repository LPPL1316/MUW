import { fireEvent, render, screen } from "@testing-library/react-native";

import { loadSport, saveSport, SPORTS, type SportOption } from "./sport";
import { SportSetting } from "./SportSetting";

jest.mock("./sport", () => ({
  ...jest.requireActual<typeof import("./sport")>("./sport"),
  loadSport: jest.fn(),
  saveSport: jest.fn(),
}));

/** As before TASK-190: only run ready. */
const RUN_ONLY: SportOption[] = SPORTS.map((option) =>
  option.id === "run" ? option : { ...option, ready: false },
);

beforeEach(() => {
  jest.mocked(loadSport).mockReturnValue("run");
  jest.mocked(saveSport).mockClear();
});

test("«Run» is chosen, «Bike» (TASK-190) and «Paddle» (TASK-191) can be", async () => {
  await render(<SportSetting />);
  expect(screen.getByText("SPORT")).toBeOnTheScreen();
  expect(screen.getByRole("radio", { name: "Run" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Bike" })).not.toBeChecked();
  expect(screen.getByRole("radio", { name: "Paddle" })).not.toBeChecked();
  expect(screen.getAllByRole("radio")).toHaveLength(3);
  // Only «Paragliding» says «Soon» (TASK-305 D0).
  expect(screen.getAllByText("Soon")).toHaveLength(1);
});

test("«Paragliding» 🪂 is the last row, says «Soon» and a tap changes nothing (TASK-305 D0)", async () => {
  await render(<SportSetting />);
  const row = screen.getByLabelText("Paragliding, coming soon");
  expect(row).toBeOnTheScreen();
  expect(screen.getByText("🪂")).toBeOnTheScreen();
  expect(screen.queryByRole("radio", { name: "Paragliding" })).toBeNull();
  await fireEvent.press(row);
  expect(saveSport).not.toHaveBeenCalled();
  expect(screen.getByRole("radio", { name: "Run" })).toBeChecked();
});

test("a sport not ready says «Soon» and takes no tap", async () => {
  await render(<SportSetting sports={RUN_ONLY} />);
  expect(screen.getAllByRole("radio")).toHaveLength(1);
  expect(screen.getByLabelText("Bike, coming soon")).toBeOnTheScreen();
  // Bike, Paddle and Paragliding (TASK-305 D0).
  expect(screen.getAllByText("Soon")).toHaveLength(3);
});

test("a sport that is ready is chosen with a tap, and kept", async () => {
  await render(<SportSetting />);
  expect(screen.getByRole("radio", { name: "Bike" })).not.toBeChecked();
  await fireEvent.press(screen.getByRole("radio", { name: "Bike" }));
  expect(screen.getByRole("radio", { name: "Bike" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Run" })).not.toBeChecked();
  expect(saveSport).toHaveBeenCalledWith("bike");
  await fireEvent.press(screen.getByRole("radio", { name: "Paddle" }));
  expect(screen.getByRole("radio", { name: "Paddle" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Bike" })).not.toBeChecked();
  expect(saveSport).toHaveBeenLastCalledWith("paddle");
});

test("the sport kept on the phone is the one chosen at the next opening", async () => {
  jest.mocked(loadSport).mockReturnValue("bike");
  await render(<SportSetting />);
  expect(loadSport).toHaveBeenCalledWith(SPORTS);
  expect(screen.getByRole("radio", { name: "Bike" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Run" })).not.toBeChecked();
});
