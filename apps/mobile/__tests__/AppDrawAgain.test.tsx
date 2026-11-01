/**
 * «Draw it near me» (TASK-313): the shape or the word of a route of
 * «Explore», or of a member's drawing, chosen in «Draw» at the same
 * distance; the start stays «Draw»'s, and nothing is asked before «Draw
 * route». What a route or a drawing gives is in src/route/drawAgain.test.ts.
 */
import drawing from "@shaperoute/shared-types/fixtures/drawing-details.json";
import feed from "@shaperoute/shared-types/fixtures/feed.json";
import detail from "@shaperoute/shared-types/fixtures/recommended-route.json";
import list from "@shaperoute/shared-types/fixtures/recommended-routes.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { apiError, type MemorySecureStore } from "../src/account/testing";
import { forgetFeed } from "../src/feed/useFeed";
import { SAMPLE_FEED } from "../src/feed/sampleFeed";

// Every test renders the whole app, and the first one loads it cold.
jest.setTimeout(20_000);

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
jest.mock("expo-secure-store", () =>
  jest
    .requireActual<typeof import("../src/account/testing")>("../src/account/testing")
    .memorySecureStore(),
);

const store = jest.requireMock<MemorySecureStore>("expo-secure-store");
const API = "http://192.168.1.23:8000";
const SESSION_KEY = "shaperoute.session";
// Asked from where «Draw» starts: the position of the phone.
const FEED = "/feed?lat=46.07&lon=11.12";

// The second drawing of the sample feed, opened as a route of «Explore».
const POST = SAMPLE_FEED[1];
const ROUTE = { ...detail, id: POST.id, route_m: POST.route_m };

let fetchSpy: jest.SpiedFunction<typeof fetch>;
/** What the API has under the id of the sample post. */
let underItsId: () => Response;

function asked(method: string, prefix: string) {
  return fetchSpy.mock.calls.filter(
    ([input, init]) =>
      String(input).startsWith(`${API}${prefix}`) && (init?.method ?? "GET") === method,
  );
}

async function onFeed() {
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
  await fireEvent.press(screen.getByRole("tab", { name: "Feed" }));
}

/** «Draw» on screen, with what it will ask for. */
function expectDraw(distance: string) {
  expect(screen.getByRole("tab", { name: "Draw", selected: true })).toBeOnTheScreen();
  expect(screen.getByLabelText("Distance in km")).toHaveDisplayValue(distance);
  // From where «Draw» starts, as before.
  expect(screen.getByText("Starting from your position.")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Draw route" })).toBeEnabled();
}

beforeEach(() => {
  store.kept.clear();
  forgetFeed();
  underItsId = () => Response.json(ROUTE);
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 46.067, longitude: 11.1215 },
  } as Location.LocationObject);
  fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const path = String(input).replace(API, "");
    const method = init?.method ?? "GET";
    if (method === "GET" && path.startsWith("/recommended-routes/")) {
      return underItsId();
    }
    if (method === "GET" && path.startsWith("/recommended-routes")) {
      return Response.json(list);
    }
    const answers: Record<string, () => Response> = {
      "GET /me": () => Response.json(session.user),
      "GET /me/favorites": () => Response.json({ favorites: [] }),
      "GET /me/activities": () =>
        Response.json({ activities: [], next: null, total: 0 }),
      [`GET ${FEED}`]: () => Response.json(feed),
      [`GET /drawings/${drawing.id}`]: () => Response.json(drawing),
    };
    const answer = answers[`${method} ${path}`];
    return answer !== undefined
      ? answer()
      : Response.json(apiError("http_error", path), { status: 404 });
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("a route of «Explore» gives «Draw» its shape and its distance, asking for nothing", async () => {
  await onFeed();
  await fireEvent.press(screen.getByText(POST.title));
  await screen.findByText("Start");
  const before = fetchSpy.mock.calls.length;

  await fireEvent.press(screen.getByRole("button", { name: "Draw it near me" }));

  expectDraw("5");
  expect(
    screen.getByRole("button", { name: "Shape", selected: true }),
  ).toBeOnTheScreen();
  expect(screen.getByLabelText("Shape")).toHaveDisplayValue("star");
  // The route is left: no card of it, and nothing drawn yet.
  expect(screen.queryByText("Back to the list")).toBeNull();
  expect(asked("POST", "/route-jobs")).toHaveLength(0);
  expect(fetchSpy.mock.calls.length).toBe(before);
});

test("a word of «Explore» gives «Draw» the word and its letters", async () => {
  underItsId = () =>
    Response.json({
      ...detail,
      shape: null,
      word: "CIAO",
      style: "block",
      distance_m: 12000,
    });
  await onFeed();
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  await fireEvent.press(await screen.findByText("Star · 5.1 km"));
  await screen.findByText("Start");

  await fireEvent.press(screen.getByRole("button", { name: "Draw it near me" }));

  expectDraw("12");
  expect(
    screen.getByRole("button", { name: "Word", selected: true }),
  ).toBeOnTheScreen();
  expect(screen.getByLabelText("Word")).toHaveDisplayValue("CIAO");
  expect(
    screen.getByRole("button", { name: "Square", selected: true }),
  ).toBeOnTheScreen();
});

test("a member's drawing gives «Draw» its shape, the drawing left for good", async () => {
  store.kept.set(SESSION_KEY, JSON.stringify(session));
  await onFeed();
  await fireEvent.press(await screen.findByText(String(feed.posts[0].title)));
  expect(await screen.findByText(String(drawing.description))).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole("button", { name: "Draw it near me" }));

  // The star of the drawing at the km it was run: 4004 m are 4 km.
  expect(drawing.shape).toBe("star");
  expect(drawing.distance_m).toBe(4004);
  expectDraw("4");
  expect(screen.getByLabelText("Shape")).toHaveDisplayValue("star");
  expect(screen.queryByText(String(drawing.description))).toBeNull();
  expect(screen.queryByRole("button", { name: "Back to the profile" })).toBeNull();
  // Nothing of the other's route travels, and nothing is drawn yet.
  expect(asked("POST", "/route-jobs")).toHaveLength(0);
  expect(asked("POST", "/route-directions")).toHaveLength(0);

  // Nothing of the drawing is waiting behind «Feed».
  await fireEvent.press(screen.getByRole("tab", { name: "Feed" }));
  expect(screen.getByRole("tab", { name: "Feed", selected: true })).toBeOnTheScreen();
  expect(screen.queryByText(String(drawing.description))).toBeNull();
});

test.each([
  ["a photo or a picture", { shape: null, word: null, route_title: "Photo" }],
  ["a shape the app does not know", { shape: "dragon", word: null }],
  ["a word «Draw» would refuse", { shape: null, word: "ÉTÉ", style: "round" }],
])("%s has no «Draw it near me»", async (_what, fields) => {
  store.kept.set(SESSION_KEY, JSON.stringify(session));
  const photo = { ...drawing, ...fields };
  fetchSpy.mockImplementation(async (input) => {
    const path = String(input).replace(API, "");
    if (path === "/me") {
      return Response.json(session.user);
    }
    if (path === FEED) {
      return Response.json(feed);
    }
    if (path === `/drawings/${drawing.id}`) {
      return Response.json(photo);
    }
    return Response.json(apiError("http_error", path), { status: 404 });
  });
  await onFeed();
  await fireEvent.press(await screen.findByText(String(feed.posts[0].title)));
  expect(await screen.findByText(String(drawing.description))).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Start" })).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Draw it near me" })).toBeNull();
});
