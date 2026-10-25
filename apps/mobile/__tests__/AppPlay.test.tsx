/**
 * The «Play» page of the shape game (TASK-296 part B, ADR-0255): among the
 * pages only while the API has the game, which the app asks as it opens.
 * The page itself is in src/game/PlayScreen.test.tsx; an API without the
 * game in AppPages.test.tsx.
 */
import catalog from "@shaperoute/shared-types/fixtures/game-catalog.json";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { forgetGameCatalog } from "../src/game/gameCatalog";

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

function tabs(): string[] {
  return screen.getAllByRole("tab").map((tab) => String(tab.props.accessibilityLabel));
}

/** A swipe that comes to rest on the page at `index`. */
async function swipeTo(index: number) {
  const pager = screen.getByTestId("pager");
  await fireEvent.scroll(pager, {
    nativeEvent: { contentOffset: { x: index * WIDTH, y: 0 } },
  });
  await fireEvent(pager, "momentumScrollEnd", {
    nativeEvent: { contentOffset: { x: index * WIDTH, y: 0 } },
  });
}

beforeEach(() => {
  forgetGameCatalog();
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 46.067, longitude: 11.1215 },
  } as Location.LocationObject);
  fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url === `${API}/game/catalog`) {
      return Response.json(catalog);
    }
    return Response.json(
      { error: { code: "http_error", message: url } },
      { status: 404 },
    );
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
  forgetGameCatalog();
});

test("with the game on the API, «Play» joins the pages after «Explore»", async () => {
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await waitFor(() => expect(tabs()).toEqual(["Feed", "Draw", "Explore", "Play"]));
  // Asked once, as the app opened.
  expect(
    fetchSpy.mock.calls.filter(([url]) => String(url).endsWith("/game/catalog")),
  ).toHaveLength(1);
  // Still on «Draw».
  expect(screen.getByRole("tab", { name: "Draw", selected: true })).toBeOnTheScreen();
});

test("a swipe past «Explore» reaches «Play», with the shapes to collect", async () => {
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await waitFor(() => expect(tabs()).toContain("Play"));
  await swipeTo(3);
  expect(screen.getByRole("tab", { name: "Play", selected: true })).toBeOnTheScreen();
  expect(screen.getByTestId("play-screen")).toBeOnTheScreen();
  // Nobody signed in: the shapes as they are, and the way to sign in.
  expect(screen.getByTestId("shape-card-triangle")).toBeOnTheScreen();
  expect(screen.getByText("Sign in to collect shapes.")).toBeOnTheScreen();
  // The profile is one more swipe to the left.
  await swipeTo(4);
  expect(screen.getByRole("tab", { name: "Play", selected: false })).toBeOnTheScreen();
});
