/**
 * «Play», the shape game (TASK-296 part B, ADR-0255), in the app: only
 * while the API has the game, which the app asks as it opens. Since
 * TASK-327 (the user's choice of 2026-10-29) it is no page in the header
 * but a row right under the distance of «Draw», which opens the game over
 * the app; «←» goes back to «Draw». The game itself is in
 * src/game/PlayScreen.test.tsx; an API without the game in
 * AppPages.test.tsx.
 */
import catalog from "@shaperoute/shared-types/fixtures/game-catalog.json";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { forgetGameCatalog } from "../src/game/gameCatalog";
import { openPlay } from "../src/game/unlocks";

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

test("with the game on the API, «Play» is a row of «Draw» under the distance", async () => {
  await render(<App />);
  await screen.findByText("Starting from your position.");
  const row = await screen.findByTestId("play-row");
  expect(row).toHaveTextContent("PLAYCollect shapes by running›");
  // Asked once, as the app opened.
  expect(
    fetchSpy.mock.calls.filter(([url]) => String(url).endsWith("/game/catalog")),
  ).toHaveLength(1);
  // Three names in the header, as without the game, and still on «Draw».
  expect(tabs()).toEqual(["Feed", "Draw", "Explore"]);
  expect(screen.getByRole("tab", { name: "Draw", selected: true })).toBeOnTheScreen();
  // Right after «DISTANCE»: the queries find in the order of the screen.
  const labels = within(screen.getByTestId("pager"))
    .getAllByText(/^(DRAW|DISTANCE|PLAY|NEAR YOU|SHAPES TO TRY)$/)
    .map((node) => node.props.children);
  expect(labels.slice(0, 3)).toEqual(["DRAW", "DISTANCE", "PLAY"]);
});

test("the row opens the game over the app, and «←» goes back to «Draw»", async () => {
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent.press(await screen.findByTestId("play-row"));

  const game = screen.getByTestId("play-overlay");
  expect(within(game).getByRole("header")).toHaveTextContent("Play");
  expect(within(game).getByTestId("play-screen")).toBeOnTheScreen();
  // Nobody signed in: the shapes as they are, and the way to sign in.
  expect(within(game).getByTestId("shape-card-triangle")).toBeOnTheScreen();
  expect(within(game).getByText("Sign in to collect shapes.")).toBeOnTheScreen();
  // The pages are not under it: the game takes the whole screen.
  expect(screen.queryByTestId("pager")).toBeNull();

  await fireEvent.press(within(game).getByLabelText("Back"));
  expect(screen.queryByTestId("play-overlay")).toBeNull();
  expect(screen.getByRole("tab", { name: "Draw", selected: true })).toBeOnTheScreen();
  expect(screen.getByTestId("play-row")).toBeOnTheScreen();
});

test("«See collection» of a shape unlocked opens the game from a page", async () => {
  await render(<App />);
  await screen.findByTestId("play-row");
  await act(async () => openPlay());
  expect(screen.getByTestId("play-overlay")).toBeOnTheScreen();
});

test("an API without the game shows no row", async () => {
  fetchSpy.mockImplementation(async (input) =>
    Response.json(
      { error: { code: "http_error", message: String(input) } },
      { status: 404 },
    ),
  );
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await waitFor(() =>
    expect(
      fetchSpy.mock.calls.filter(([url]) => String(url).endsWith("/game/catalog")),
    ).toHaveLength(1),
  );
  expect(screen.getByText("DISTANCE")).toBeOnTheScreen();
  expect(screen.queryByTestId("play-row")).toBeNull();
});

test("the profile is one swipe past «Explore» again", async () => {
  await render(<App />);
  await screen.findByTestId("play-row");
  await swipeTo(3);
  expect(
    screen.getByRole("tab", { name: "Explore", selected: false }),
  ).toBeOnTheScreen();
  expect(screen.queryByTestId("play-screen")).toBeNull();
});
