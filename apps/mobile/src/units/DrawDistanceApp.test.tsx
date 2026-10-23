import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../../App";
import type { MemorySecureStore } from "../account/testing";
import { saveUnitsChoice } from "./units";

// The distance of «Draw» in the app itself (TASK-182 part E): App.tsx keeps
// it and follows the units of «Settings». The setup is `Profile.test.tsx`'s:
// no GPS, no account, nothing asked of the API.

jest.mock("react-native-webview");
jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: "192.168.1.23:8081" } },
}));
jest.mock("expo-file-system");
jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock("expo-secure-store", () =>
  jest
    .requireActual<typeof import("../account/testing")>("../account/testing")
    .memorySecureStore(),
);

const store = jest.requireMock<MemorySecureStore>("expo-secure-store");
let fetchSpy: jest.SpiedFunction<typeof fetch>;

beforeEach(() => {
  store.kept.clear();
  fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    throw new Error(`Not in this test: ${String(input)}`);
  });
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: false } as never);
});

afterEach(async () => {
  fetchSpy.mockRestore();
  await act(async () => saveUnitsChoice("phone"));
});

test("in kilometres «Draw» starts at 5 km, as before", async () => {
  saveUnitsChoice("km");
  await render(<App />);
  expect(screen.getByLabelText("Distance in km").props.value).toBe("5");
  expect(screen.getByText("km")).toBeOnTheScreen();
});

test("with «Miles» «Draw» starts at 3 mi, and a new unit keeps the distance", async () => {
  saveUnitsChoice("mi");
  await render(<App />);
  expect(screen.getByLabelText("Distance in miles").props.value).toBe("3");
  expect(screen.getByText("mi")).toBeOnTheScreen();

  await fireEvent.changeText(screen.getByLabelText("Distance in miles"), "8");
  await act(async () => saveUnitsChoice("km"));
  expect(screen.getByLabelText("Distance in km").props.value).toBe("13");
  await act(async () => saveUnitsChoice("mi"));
  expect(screen.getByLabelText("Distance in miles").props.value).toBe("8");
  // Nothing but the shape game's catalog, asked as the app opens to know
  // whether to show «Play» (TASK-296).
  expect(
    fetchSpy.mock.calls.filter(([input]) => !String(input).endsWith("/game/catalog")),
  ).toEqual([]);
});
