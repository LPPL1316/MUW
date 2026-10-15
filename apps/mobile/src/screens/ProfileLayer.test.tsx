/**
 * The account's own profile as the fourth page, after «Explore» (TASK-278,
 * ADR-0124): three names in the header and the circle, which has the mark
 * of the page on screen there; what the profile opens comes over the app,
 * and «←» comes back to the page. The lens of «Feed» without an account
 * goes to the page too (TASK-278 part B); the other ways there are in
 * ProfileEntryPoints.test.tsx. «Favorites» and «My activities» from the
 * page are in __tests__/AppFavorites.test.tsx and AppActivities.test.tsx.
 */
import drawing from "@shaperoute/shared-types/fixtures/drawing.json";
import drawings from "@shaperoute/shared-types/fixtures/drawings.json";
import people from "@shaperoute/shared-types/fixtures/people.json";
import publicProfile from "@shaperoute/shared-types/fixtures/public-profile.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../../App";
import { apiError, type MemorySecureStore } from "../account/testing";

// Every test renders the whole app, and the first one loads it cold.
jest.setTimeout(20_000);

jest.mock("react-native-webview");
jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
// The Expo dev server as the phone sees it: the API is on the same PC.
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
const API = "http://192.168.1.23:8000";
const KEY = "shaperoute.session";
// The window of the tests (react-native's jest setup).
const WIDTH = 750;
const NO_RUNS = { activities: [], next: null, total: 0 };
const NOBODY = { people: [], next: null, total: 0 };
const [, adam] = people.people;
const ADAM = {
  ...publicProfile,
  public_id: adam.public_id,
  username: adam.username,
  photo: null,
  followers: 0,
  following: 3,
  follow: "none",
};

type Answers = Record<string, () => Response>;

const ACCOUNT: Answers = {
  "GET /me": () => Response.json(session.user),
  "GET /me/favorites": () => Response.json({ favorites: [] }),
  "GET /me/activities": () => Response.json(NO_RUNS),
};

let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** The fake API, by method and path; anything else is a 404. */
function api(answers: Answers = {}) {
  fetchSpy.mockImplementation(async (input, init) => {
    const path = String(input).replace(API, "");
    const answer = answers[`${init?.method ?? "GET"} ${path}`];
    return answer !== undefined
      ? answer()
      : Response.json(apiError("http_error", path), { status: 404 });
  });
}

function calls(method: string, path: string) {
  return fetchSpy.mock.calls.filter(
    ([input, init]) =>
      String(input) === `${API}${path}` && (init?.method ?? "GET") === method,
  );
}

function signedIn() {
  store.kept.set(KEY, JSON.stringify(session));
}

async function open() {
  await render(<App />);
  await screen.findByText(/^Location is off for MuW/);
}

/** The circle at the right of the names. */
function circle() {
  return screen.getByRole("button", { name: /^Profile/ });
}

/** The profile is the page on screen: the circle has the page's mark, no
 * name has it, and nothing of «Profile» is over the app. */
function onProfilePage() {
  expect(
    screen.getByRole("button", { name: /^Profile/, selected: true }),
  ).toBeOnTheScreen();
  expect(screen.getByTestId("profile-page-mark")).toBeOnTheScreen();
  expect(screen.getAllByRole("tab")).toHaveLength(3);
  expect(screen.queryByRole("tab", { selected: true })).toBeNull();
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
}

beforeEach(() => {
  store.kept.clear();
  fetchSpy = jest.spyOn(globalThis, "fetch");
  // No GPS: «Draw» asks for a place.
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: false } as Location.LocationPermissionResponse);
  api();
});

afterEach(() => {
  fetchSpy.mockRestore();
});

test("a swipe to the left from «Explore» shows the profile, one to the right goes back", async () => {
  await open();
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  // Not built before someone goes there.
  expect(
    screen.queryByTestId("account-submit", { includeHiddenElements: true }),
  ).toBeNull();
  expect(screen.queryByTestId("profile-page-mark")).toBeNull();

  await fireEvent.scroll(screen.getByTestId("pager"), {
    nativeEvent: { contentOffset: { x: 2 * WIDTH + 12, y: 0 } },
  });
  await fireEvent(screen.getByTestId("pager"), "momentumScrollEnd", {
    nativeEvent: { contentOffset: { x: 3 * WIDTH, y: 0 } },
  });
  onProfilePage();
  // Without an account, «Sign up» and «Log in» as before.
  expect(
    screen.getByRole("button", { name: "Sign up", selected: true }),
  ).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Log in" })).toBeOnTheScreen();
  expect(screen.getByTestId("account-submit")).toBeOnTheScreen();

  await fireEvent(screen.getByTestId("pager"), "momentumScrollEnd", {
    nativeEvent: { contentOffset: { x: 2 * WIDTH, y: 0 } },
  });
  expect(
    screen.getByRole("tab", { name: "Explore", selected: true }),
  ).toBeOnTheScreen();
  expect(screen.queryByTestId("profile-page-mark")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Profile", selected: false }),
  ).toBeOnTheScreen();
  // Out of sight, out of the screen reader's too.
  expect(screen.queryByTestId("account-submit")).toBeNull();
  expect(
    screen.getByTestId("account-submit", { includeHiddenElements: true }),
  ).toBeTruthy();
});

test.each(["Feed", "Draw", "Explore"])(
  "from «%s» the circle goes to the page of the profile, not over the app",
  async (from) => {
    await open();
    await fireEvent.press(screen.getByRole("tab", { name: from }));
    expect(screen.queryByTestId("profile-page-mark")).toBeNull();
    await fireEvent.press(circle());
    onProfilePage();
    expect(screen.queryByRole("header", { name: "Profile" })).toBeNull();
    expect(screen.getByTestId("account-submit")).toBeOnTheScreen();
    // The pages are there, one swipe apart, as they were left.
    expect(
      screen.getByText("Draw route", { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(screen.queryByText("Draw route")).toBeNull();
    // Touched again, it stays there.
    await fireEvent.press(circle());
    onProfilePage();
  },
);

test("«Settings» and «Edit profile» open over the app, and «←» comes back to the page", async () => {
  signedIn();
  api(ACCOUNT);
  await open();
  await fireEvent.press(circle());
  onProfilePage();
  expect(await screen.findByText(session.user.username)).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
  expect(screen.getByRole("header", { name: "Settings" })).toBeOnTheScreen();
  // The app is under it, out of the screen reader's reach.
  expect(screen.queryByRole("tab")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.queryByRole("header", { name: "Settings" })).toBeNull();
  onProfilePage();

  await fireEvent.press(screen.getByRole("button", { name: "Edit profile" }));
  expect(screen.getByRole("header", { name: "Edit profile" })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.queryByRole("header", { name: "Edit profile" })).toBeNull();
  onProfilePage();
});

test("«Guide» opens over the app, and «←» comes back to the page, not to «Settings»", async () => {
  signedIn();
  api(ACCOUNT);
  await open();
  await fireEvent.press(circle());
  await fireEvent.press(await screen.findByRole("button", { name: "Guide" }));
  expect(screen.getByRole("header", { name: "Guide" })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Watch the tour" })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.queryByRole("header", { name: "Guide" })).toBeNull();
  expect(screen.queryByRole("header", { name: "Settings" })).toBeNull();
  onProfilePage();
});

test("«Guide» without an account comes back to the page too", async () => {
  await open();
  await fireEvent.press(circle());
  await fireEvent.press(screen.getByRole("button", { name: "Guide" }));
  expect(screen.getByRole("header", { name: "Guide" })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  onProfilePage();
  expect(screen.getByTestId("account-submit")).toBeOnTheScreen();
});

test("a member of the lists opens over the app; back, the page reads its lists again", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    "GET /me/follow-requests": () =>
      Response.json({ people: [adam], next: null, total: 1 }),
    "GET /me/followers": () => Response.json(NOBODY),
    "GET /me/following": () => Response.json(NOBODY),
    [`GET /users/${adam.public_id}`]: () => Response.json(ADAM),
  });
  await open();
  await fireEvent.press(circle());
  await fireEvent.press(await screen.findByRole("button", { name: "Requests, 1" }));
  await fireEvent.press(screen.getByRole("button", { name: "adam.trento" }));
  expect(await screen.findByText(/0 followers/)).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Requests, 1" })).toBeNull();
  expect(calls("GET", "/me/follow-requests")).toHaveLength(1);

  // Back once: the page, not «Profile» over the app.
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  onProfilePage();
  expect(await screen.findByRole("button", { name: "Requests, 1" })).toBeOnTheScreen();
  expect(calls("GET", "/me/follow-requests")).toHaveLength(2);
});

test("a drawing opened from the page goes back to it", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    [`GET /users/${session.user.public_id}/drawings`]: () => Response.json(drawings),
    [`GET /drawings/${drawing.id}`]: () => Response.json(drawing),
  });
  await open();
  await fireEvent.press(circle());
  await fireEvent.press(
    await screen.findByRole("button", {
      name: "Sunday heart by the river, open on the map",
    }),
  );
  // The map takes the whole screen: no pages, no circle.
  expect(await screen.findByText("Back to the profile")).toBeOnTheScreen();
  expect(screen.queryByRole("tab")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Back to the profile" }));
  onProfilePage();
  expect(await screen.findByText("Drawings")).toBeOnTheScreen();
});

test("from «Feed» without an account «Find friends» goes to the page, saying why", async () => {
  await open();
  await fireEvent.press(screen.getByRole("tab", { name: "Feed" }));
  await fireEvent.press(screen.getByRole("button", { name: "Find friends" }));
  // The page, as from the circle (TASK-278 part B): no «←», no title.
  onProfilePage();
  expect(screen.queryByRole("header", { name: "Profile" })).toBeNull();
  expect(screen.getByText("Log in to find your friends.")).toBeOnTheScreen();
  expect(screen.getByTestId("account-submit")).toBeOnTheScreen();
  // Back to «Feed» by its name; the line goes with the page.
  await fireEvent.press(screen.getByRole("tab", { name: "Feed" }));
  expect(screen.getByRole("tab", { name: "Feed", selected: true })).toBeOnTheScreen();
  await fireEvent.press(circle());
  expect(screen.queryByText("Log in to find your friends.")).toBeNull();
});
