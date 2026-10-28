import { fireEvent, render, screen } from "@testing-library/react-native";

import { ALL_SPORTS, isStoreBuild, loadSport, shownSports, SPORTS } from "./sport";
import { SportButton } from "./SportButton";
import { SportSetting } from "./SportSetting";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-file-system");
jest.mock("./sport", () => ({
  ...jest.requireActual<typeof import("./sport")>("./sport"),
  loadSport: jest.fn(),
  saveSport: jest.fn(),
}));

/** What a store build shows (TASK-318, ADR-0278). */
const STORE = shownSports(ALL_SPORTS, true);

beforeEach(() => {
  jest.mocked(loadSport).mockReturnValue("run");
});

test("a store build is told by its runtime version, Expo Go and preview by «exposdk:»", () => {
  expect(isStoreBuild({ runtimeVersion: { policy: "fingerprint" } })).toBe(true);
  expect(
    isStoreBuild({ runtimeVersion: "83793e26fc0da7cdc7d8c7f7b1b7ad09e6f823b3" }),
  ).toBe(true);
  expect(isStoreBuild({ runtimeVersion: "exposdk:57.0.0" })).toBe(false);
  expect(isStoreBuild({})).toBe(false);
  expect(isStoreBuild(null)).toBe(false);
  expect(isStoreBuild(undefined)).toBe(false);
});

test("the tests run as Expo Go: every sport, «Paragliding» included", () => {
  expect(isStoreBuild()).toBe(false);
  expect(SPORTS).toEqual(ALL_SPORTS);
  expect(SPORTS.map((option) => option.id)).toContain("paragliding");
});

test("a store build leaves out the sports not ready, and keeps the order", () => {
  expect(STORE.map((option) => option.id)).toEqual(["run", "bike", "paddle"]);
  expect(STORE.every((option) => option.ready)).toBe(true);
  expect(shownSports(ALL_SPORTS, false)).toBe(ALL_SPORTS);
});

test("in a store build `SPORTS` itself has no «Paragliding»", () => {
  jest.isolateModules(() => {
    jest.doMock("expo-constants", () => ({
      __esModule: true,
      default: { expoConfig: { runtimeVersion: { policy: "fingerprint" } } },
    }));
    const store = jest.requireActual<typeof import("./sport")>("./sport");
    expect(store.isStoreBuild()).toBe(true);
    expect(store.SPORTS.map((option) => option.id)).toEqual(["run", "bike", "paddle"]);
  });
});

test("«Settings» of a store build has no «Soon» row", async () => {
  await render(<SportSetting sports={STORE} />);
  expect(screen.getAllByRole("radio")).toHaveLength(3);
  expect(screen.queryByText("Soon")).toBeNull();
  expect(screen.queryByLabelText("Paragliding, coming soon")).toBeNull();
  expect(screen.queryByText("🪂")).toBeNull();
});

test("the sport menu of «Draw» in a store build has no «Soon» row", async () => {
  await render(<SportButton sports={STORE} />);
  await fireEvent.press(screen.getByRole("button", { name: "Sport, Run" }));
  expect(screen.getAllByRole("radio")).toHaveLength(3);
  expect(screen.queryByText("Soon")).toBeNull();
  expect(screen.queryByLabelText("Paragliding, coming soon")).toBeNull();
});
