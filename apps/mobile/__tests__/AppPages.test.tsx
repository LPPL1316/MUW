/**
 * The pages side by side (TASK-154, ADR-0124): «Feed», «Draw», «Explore»,
 * one swipe apart or a touch on their names. The pager alone is in
 * src/screens/Pager.test.tsx; the rest of the app in App.test.tsx.
 */
import detail from "@shaperoute/shared-types/fixtures/recommended-route.json";
import list from "@shaperoute/shared-types/fixtures/recommended-routes.json";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";

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
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const API = "http://192.168.1.23:8000";
// The window of the tests (react-native's jest setup): a page is this wide.
const WIDTH = 750;

let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** How many times «Explore» asked the API for the routes near the start. */
function listCalls(): number {
  return fetchSpy.mock.calls.filter(([url]) =>
    String(url).startsWith(`${API}/recommended-routes?`),
  ).length;
}

/** What the app asked the API, but for the shape game's catalog, which it
 * asks as it opens to know whether to show «Play» (TASK-296), and the
 * contest, which «Feed» asks to know whether to show its card (TASK-299). */
function askedBesidesTheGame(): string[] {
  return fetchSpy.mock.calls
    .map(([url]) => String(url).replace(API, ""))
    .filter((path) => path !== "/game/catalog" && path !== "/contests/current");
}

/** A swipe that comes to rest on the page at `index`. */
async function swipeTo(index: number) {
  const pager = screen.getByTestId("pager");
  // On the way the next page comes into view, then the scroll rests.
  await fireEvent.scroll(pager, {
    nativeEvent: { contentOffset: { x: index * WIDTH, y: 0 } },
  });
  await fireEvent(pager, "momentumScrollEnd", {
    nativeEvent: { contentOffset: { x: index * WIDTH, y: 0 } },
  });
}

async function atTrento() {
  await render(<App />);
  await screen.findByText("Starting from your position.");
}

beforeEach(() => {
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 46.067, longitude: 11.1215 },
  } as Location.LocationObject);
  fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith(`${API}/recommended-routes/`)) {
      return Response.json(detail);
    }
    if (url.startsWith(`${API}/recommended-routes`)) {
      return Response.json(list);
    }
    return Response.json(
      { error: { code: "http_error", message: url } },
      { status: 404 },
    );
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
});

test("opens on «Draw», between «Feed» and «Explore», and asks the API nothing", async () => {
  await atTrento();
  expect(screen.getAllByRole("tab").map((tab) => tab.props.accessibilityLabel)).toEqual(
    ["Feed", "Draw", "Explore"],
  );
  expect(screen.getByRole("tab", { name: "Draw", selected: true })).toBeOnTheScreen();
  expect(screen.getByText("Draw route")).toBeOnTheScreen();
  // «Explore» is one swipe away, and has not asked for its routes yet.
  expect(screen.queryByText("Best near you")).toBeNull();
  expect(askedBesidesTheGame()).toEqual([]);
  // An API without the shape game: no «Play» page (TASK-296).
  expect(screen.queryByRole("tab", { name: "Play" })).toBeNull();
});

test("a swipe to the left goes to «Explore», which asks for its routes then", async () => {
  await atTrento();
  await swipeTo(2);
  expect(
    screen.getByRole("tab", { name: "Explore", selected: true }),
  ).toBeOnTheScreen();
  expect(screen.getByText("Best near you")).toBeOnTheScreen();
  expect(await screen.findByText("Star · 5.1 km")).toBeOnTheScreen();
  expect(listCalls()).toBe(1);
  // «Draw» is the page beside it now: out of sight, as it was left.
  expect(screen.queryByText("Draw route")).toBeNull();
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();

  await swipeTo(1);
  expect(screen.getByText("Draw route")).toBeOnTheScreen();
  expect(screen.queryByText("Best near you")).toBeNull();
  // Back on «Explore» the list is still there: it is not asked for again.
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  expect(screen.getByText("Star · 5.1 km")).toBeOnTheScreen();
  expect(listCalls()).toBe(1);
});

test("a swipe to the right goes to «Feed», with its example drawings", async () => {
  await atTrento();
  await swipeTo(0);
  expect(screen.getByRole("tab", { name: "Feed", selected: true })).toBeOnTheScreen();
  expect(screen.getByText("A horse through Levico")).toBeOnTheScreen();
  expect(screen.getAllByTestId("feed-post").length).toBeGreaterThanOrEqual(2);
  expect(screen.queryByText("Draw route")).toBeNull();
  // «Explore» was never in view: it asked nothing.
  expect(askedBesidesTheGame()).toEqual([]);
  await fireEvent.press(screen.getByRole("tab", { name: "Draw" }));
  expect(screen.getByText("Draw route")).toBeOnTheScreen();
});

test("what was chosen on «Draw» is still there after a look at the other pages", async () => {
  await atTrento();
  await fireEvent.press(screen.getByRole("button", { name: "star" }));
  await fireEvent.changeText(screen.getByLabelText("Distance in km"), "12");
  await swipeTo(2);
  await swipeTo(0);
  await swipeTo(1);
  expect(
    screen.getByRole("button", { name: "star", selected: true }),
  ).toBeOnTheScreen();
  expect(screen.getByLabelText("Distance in km").props.value).toBe("12");
});

test("a route of «Explore» takes the whole screen; back, «Explore» is the page", async () => {
  await atTrento();
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  await fireEvent.press(await screen.findByText("Star · 5.1 km"));
  await screen.findByText("Back to the list");
  // Over the map there are no pages to swipe between.
  expect(screen.queryByRole("tab")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(
    screen.getByRole("tab", { name: "Explore", selected: true }),
  ).toBeOnTheScreen();
  expect(screen.getByText("Best near you")).toBeOnTheScreen();
  expect(screen.queryByText("Draw route")).toBeNull();
});
