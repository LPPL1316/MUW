import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import type { RouteResult } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../../App";
import type { MemorySecureStore } from "../account/testing";
import { requestRouteOnPhoneFirst } from "../engine/onPhone";
import { saveUnitsChoice } from "../units/units";

// «Choose on the map» in the app itself (TASK-292): under the search of
// «Draw», the map with the pin in its middle, «Start here», and the point
// under the pin as the start of the route. The setup is
// `DrawOnMapApp.test.tsx`'s: no GPS, so the search shows; no account; the
// route comes from a stand-in.

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
jest.mock("../engine/onPhone", () => ({
  ...jest.requireActual<typeof import("../engine/onPhone")>("../engine/onPhone"),
  requestRouteOnPhoneFirst: jest.fn(),
}));

const { injectJavaScript } =
  jest.requireMock<typeof import("../../__mocks__/react-native-webview")>(
    "react-native-webview",
  );
const store = jest.requireMock<MemorySecureStore>("expo-secure-store");
const ROUTE = jobDone.result as unknown as RouteResult;
let fetchSpy: jest.SpiedFunction<typeof fetch>;

beforeEach(() => {
  store.kept.clear();
  injectJavaScript.mockClear();
  jest.mocked(requestRouteOnPhoneFirst).mockReset();
  jest
    .mocked(requestRouteOnPhoneFirst)
    .mockResolvedValue({ kind: "route", result: ROUTE });
  fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    throw new Error(`Not in this test: ${String(input)}`);
  });
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: false } as never);
  saveUnitsChoice("km");
});

afterEach(async () => {
  fetchSpy.mockRestore();
  await act(async () => saveUnitsChoice("phone"));
});

function pagePosts(data: string) {
  return fireEvent(screen.getByTestId("map"), "message", { nativeEvent: { data } });
}

/** The messages of a type the map page was sent, in order. */
function sent(type: string): Record<string, unknown>[] {
  return injectJavaScript.mock.calls
    .map(([script]: [string]) => script.match(/receive\((.*)\); true;$/)?.[1])
    .filter((json): json is string => json !== undefined)
    .map((json) => JSON.parse(json) as Record<string, unknown>)
    .filter((message) => message.type === type);
}

/** The start of the last route asked for. */
function askedStart() {
  const [, asked] = jest.mocked(requestRouteOnPhoneFirst).mock.calls.at(-1) ?? [];
  return asked?.start;
}

test("the point under the pin is the start of the route", async () => {
  await render(<App />);
  await pagePosts('{"type":"ready"}');

  await fireEvent.press(screen.getByText("Choose on the map"));
  expect(
    screen.getByText("Move the map to put the pin where you want to start."),
  ).toBeOnTheScreen();
  expect(sent("setPick").at(-1)).toEqual({ type: "setPick", on: true });
  // Until the map says where its middle is, there is nothing to take.
  expect(screen.getByRole("button", { name: "Start here" })).toBeDisabled();

  const shownBefore = sent("setPosition").length;
  await pagePosts('{"type":"centre","lngLat":[11.12,46.07]}');
  // The fingers move the map; it stops further on.
  await pagePosts('{"type":"centre","lngLat":[11.125,46.072]}');
  // Nothing moves the map away while the pin is chosen.
  expect(sent("setPosition")).toHaveLength(shownBefore);
  await fireEvent.press(screen.getByRole("button", { name: "Start here" }));

  // Back on «Draw», with the point as the start and no name for it.
  expect(screen.getByText("Starting from a point on the map.")).toBeOnTheScreen();
  expect(sent("setPick").at(-1)).toEqual({ type: "setPick", on: false });
  expect(sent("setPosition").at(-1)).toEqual({
    type: "setPosition",
    lngLat: [11.125, 46.072],
  });

  await act(async () => fireEvent.press(screen.getByText("Draw route")));
  expect(requestRouteOnPhoneFirst).toHaveBeenCalledTimes(1);
  expect(askedStart()).toEqual([46.072, 11.125]);
});

test("«←» leaves the start as it was", async () => {
  await render(<App />);
  await pagePosts('{"type":"ready"}');
  await fireEvent.press(screen.getByText("Choose on the map"));
  await pagePosts('{"type":"centre","lngLat":[11.12,46.07]}');
  await fireEvent.press(screen.getByRole("button", { name: "Start here" }));

  // Chosen again, then left with «←»: the first point stays.
  await fireEvent.press(screen.getByText("Choose on the map"));
  await pagePosts('{"type":"centre","lngLat":[11.3,46.2]}');
  await fireEvent.press(screen.getByLabelText("Back"));
  expect(screen.getByText("Starting from a point on the map.")).toBeOnTheScreen();
  expect(sent("setPick").at(-1)).toEqual({ type: "setPick", on: false });

  await act(async () => fireEvent.press(screen.getByText("Draw route")));
  expect(askedStart()).toEqual([46.07, 11.12]);
});

test("with no start yet, «←» from the map leaves «Draw» without one", async () => {
  await render(<App />);
  await pagePosts('{"type":"ready"}');
  await fireEvent.press(screen.getByText("Choose on the map"));
  await pagePosts('{"type":"centre","lngLat":[11.12,46.07]}');
  await fireEvent.press(screen.getByLabelText("Back"));

  expect(screen.queryByText("Starting from a point on the map.")).toBeNull();
  expect(screen.getByText("Choose on the map")).toBeOnTheScreen();
});
