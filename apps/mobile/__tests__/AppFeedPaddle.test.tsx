/**
 * A drawing on the water of «Feed» opened on the map (TASK-228, ADR-0190):
 * its route is paddled whatever the sport, came with the app, and starts
 * through the safety notice. The drawings of the runs are in
 * AppFeed.test.tsx; «Paddle» in AppPaddle.test.tsx.
 */
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { forgetExamples } from "../src/explore/exampleRoutes";
import { paddleDetail } from "../src/feed/paddlePosts";
import { SAMPLE_FEED } from "../src/feed/sampleFeed";
import { NOTICE_TITLE } from "../src/paddle/PaddleNotice";
import { forgetNoticeSeen } from "../src/paddle/safetyNotice";

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
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3, BestForNavigation: 6 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));
jest.mock("expo-speech", () => ({ speak: jest.fn(), stop: jest.fn() }));
jest.mock("expo-brightness", () => ({
  getBrightnessAsync: jest.fn(() => Promise.resolve(0.6)),
  setBrightnessAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));

const { injectJavaScript } =
  jest.requireMock<typeof import("../__mocks__/react-native-webview")>(
    "react-native-webview",
  );
const API = "http://192.168.1.23:8000";

// The first drawing on the water: the third of the feed.
const POST = SAMPLE_FEED[2];

let fetchSpy: jest.SpiedFunction<typeof fetch>;

function asked(): string[] {
  return fetchSpy.mock.calls.map(([url]) => String(url).replace(API, ""));
}

/**
 * «Feed», with the first drawing on the water drawn: the list draws two
 * drawings at first, and the others once it knows how tall it is.
 */
async function onFeed() {
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
  await fireEvent.press(screen.getByRole("tab", { name: "Feed" }));
  let list = screen.getAllByTestId("feed-post")[0].parent;
  while (list !== null && list.props.onContentSizeChange === undefined) {
    list = list.parent;
  }
  if (list === null) {
    throw new Error("the drawings are not in a list");
  }
  await fireEvent(list, "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } },
  });
  await fireEvent(list, "contentSizeChange", 390, 6000);
  await act(() => jest.advanceTimersByTimeAsync(100));
}

beforeEach(() => {
  jest.useFakeTimers();
  injectJavaScript.mockClear();
  forgetNoticeSeen();
  forgetExamples();
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 46.067, longitude: 11.1215 },
  } as Location.LocationObject);
  jest
    .mocked(Location.watchPositionAsync)
    .mockResolvedValue({ remove: jest.fn() } as Location.LocationSubscription);
  fetchSpy = jest
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) =>
      Response.json(
        { error: { code: "http_error", message: String(input) } },
        { status: 404 },
      ),
    );
});

afterEach(() => {
  forgetExamples();
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

test("with «Run», a drawing on the water opens its route on the water, asking nothing", async () => {
  await onFeed();
  expect(POST.user).toBe("greta_kayak");
  expect(
    screen.getByText(/^Paddle · Heart · 2\.0 km · 26 min · \d:\d\d \/500 m$/),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByText(POST.title));

  // The card of a route of "Explore", over the whole screen.
  expect(await screen.findByText("Start")).toBeOnTheScreen();
  expect(screen.getByText("2.0 km")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Add to favorites" })).toBeOnTheScreen();
  expect(screen.queryByRole("tab")).toBeNull();
  // The route came with the app: the map shows it whole, and nothing is asked.
  expect(asked().filter((path) => path.startsWith("/recommended-routes"))).toEqual([]);
  const shown = injectJavaScript.mock.calls
    .map(([script]) => String(script))
    .findLast((s) => s.includes('"type":"showRoute"'));
  const [lat, lon] = paddleDetail(POST)?.points[0] ?? [0, 0];
  expect(shown).toContain(`"coordinates":[[${lon},${lat}]`);
});

test("«Start» is a paddle's: the notice first, then the line without directions", async () => {
  await onFeed();
  await fireEvent.press(screen.getByText(POST.title));
  await fireEvent.press(await screen.findByRole("button", { name: "Start" }));
  expect(screen.getByText(NOTICE_TITLE)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "I understand" }));
  await act(() => jest.advanceTimersByTimeAsync(0));
  expect(screen.getByText("Stop")).toBeOnTheScreen();
  expect(asked().filter((path) => path.startsWith("/directions"))).toEqual([]);
});

test("back from its route, «Feed» is the page", async () => {
  await onFeed();
  await fireEvent.press(screen.getByText(POST.title));
  await fireEvent.press(await screen.findByText("Back to the list"));
  expect(screen.getByRole("tab", { name: "Feed", selected: true })).toBeOnTheScreen();
  // The list is new, with its first drawings.
  expect(screen.getByText(SAMPLE_FEED[0].title)).toBeOnTheScreen();
});
