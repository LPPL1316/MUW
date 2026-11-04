import type { RouteResult } from "@shaperoute/shared-types";
import swim from "@shaperoute/shared-types/fixtures/route-result-swimming.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { saveLanguageChoice } from "../i18n/language";
import { saveUnitsChoice } from "../units/units";

import { lapsLine, SwimResult } from "./SwimResult";

jest.mock("expo-file-system");

/** The heart of the contract: three laps of 317 m (TASK-323 part B). */
const HEART = swim as unknown as RouteResult;

afterEach(() => {
  saveLanguageChoice("phone");
  saveUnitsChoice("phone");
});

test("the laps and how long one is, in the app's units", () => {
  expect(lapsLine(HEART, "km")).toBe("3 laps of 320 m");
  // As the app writes a near distance: feet under 1000 ft, then miles.
  expect(lapsLine(HEART, "mi")).toBe("3 laps of 0.2 mi");
  expect(lapsLine({ ...HEART, lap_m: 250 }, "mi")).toBe("3 laps of 800 ft");
  expect(lapsLine({ ...HEART, laps: 1, lap_m: 1450 }, "km")).toBe("1 lap of 1.4 km");
  // An API before `lap_m`: no line.
  expect(lapsLine({ ...HEART, lap_m: undefined }, "km")).toBeNull();
});

test("«Bigger shape» is a lap fewer, «Smaller shape» a lap more", async () => {
  const onLaps = jest.fn();
  await render(<SwimResult result={HEART} onLaps={onLaps} />);
  expect(screen.getByText("3 laps of 320 m")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Bigger shape" }));
  await fireEvent.press(screen.getByRole("button", { name: "Smaller shape" }));
  expect(onLaps.mock.calls).toEqual([[2], [4]]);
  // The line under every swim and the turns, below.
  expect(
    screen.getByText("Within 150 m of the shore. Never swim alone."),
  ).toBeOnTheScreen();
  expect(screen.getByText("TURNS")).toBeOnTheScreen();
});

test("one lap cannot get bigger, five cannot get smaller", async () => {
  await render(<SwimResult result={{ ...HEART, laps: 1 }} onLaps={jest.fn()} />);
  expect(screen.queryByRole("button", { name: "Bigger shape" })).toBeNull();
  expect(screen.getByRole("button", { name: "Smaller shape" })).toBeOnTheScreen();
  await render(<SwimResult result={{ ...HEART, laps: 5 }} onLaps={jest.fn()} />);
  expect(screen.getByRole("button", { name: "Bigger shape" })).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Smaller shape" })).toBeNull();
});

test("without a way to draw it again, no buttons", async () => {
  await render(<SwimResult result={HEART} />);
  expect(screen.queryByRole("button", { name: "Bigger shape" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Smaller shape" })).toBeNull();
  expect(screen.getByText("3 laps of 320 m")).toBeOnTheScreen();
});

test("the laps and the buttons speak Italian", async () => {
  await act(async () => saveLanguageChoice("it"));
  await render(<SwimResult result={HEART} onLaps={jest.fn()} />);
  expect(screen.getByText("3 giri da 320 m")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Forma più grande" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Forma più piccola" })).toBeOnTheScreen();
});
