/**
 * The sport next to «Profile» (TASK-205, ADR-0165): chosen there, «Draw»
 * follows as from «Settings». The button alone is in
 * src/settings/SportButton.test.tsx; «Draw» by bike in AppBike.test.tsx.
 */
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { loadSport, saveSport } from "../src/settings/sport";

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
// The sport kept on the phone, as each test says; saving and telling the
// app are the real ones.
jest.mock("../src/settings/sport", () => {
  const actual = jest.requireActual<typeof import("../src/settings/sport")>(
    "../src/settings/sport",
  );
  return { ...actual, loadSport: jest.fn(), saveSport: jest.fn(actual.saveSport) };
});

let fetchSpy: jest.SpiedFunction<typeof fetch>;

async function atTrento() {
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 46.0671, longitude: 11.1214 },
  } as Location.LocationObject);
  await render(<App />);
  await screen.findByText("Starting from your position.");
}

beforeEach(() => {
  jest.mocked(loadSport).mockReturnValue("run");
  jest.mocked(saveSport).mockClear();
  // Nothing in these tests needs an answer from the API.
  fetchSpy = jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json({}, { status: 503 }));
});

afterEach(() => {
  fetchSpy.mockRestore();
});

test("the sport sits next to «Profile», and «Bike» chosen there takes «Draw»", async () => {
  await atTrento();
  expect(screen.getByRole("tab", { name: "Profile" })).toBeOnTheScreen();
  expect(screen.getByLabelText("Distance in km")).toHaveDisplayValue("5");

  await fireEvent.press(screen.getByRole("button", { name: "Sport, Run" }));
  await fireEvent.press(screen.getByRole("radio", { name: "Bike" }));

  expect(saveSport).toHaveBeenCalledWith("bike");
  expect(screen.getByRole("button", { name: "Sport, Bike" })).toBeOnTheScreen();
  // 5 km of a run are 10 by bike, as from «Settings».
  expect(screen.getByLabelText("Distance in km")).toHaveDisplayValue("10");
  expect(
    screen.getByRole("button", { name: "Ride without a route" }),
  ).toBeOnTheScreen();
});

test("on every page the sport is next to «Profile»", async () => {
  await atTrento();
  for (const page of ["Feed", "Explore", "Draw"]) {
    await fireEvent.press(screen.getByRole("tab", { name: page }));
    expect(screen.getByRole("button", { name: "Sport, Run" })).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Profile" })).toBeOnTheScreen();
  }
});
