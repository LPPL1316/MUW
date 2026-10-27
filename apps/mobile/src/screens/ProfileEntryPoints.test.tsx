/**
 * The other ways to the profile (TASK-278 part B, the user's choices of
 * 2026-10-13): the heart without an account goes to the fourth page, with
 * «←» back to the map until somebody signs in; another member's profile,
 * from a tagged name or a notification, opens over the app and «←» shows
 * the app as it was; the account's own name goes to the fourth page. The
 * heart signing up is in __tests__/AppFavorites.test.tsx, «Save» at the
 * end of a run in __tests__/AppActivities.test.tsx, the lens of «Feed» in
 * ProfileLayer.test.tsx.
 */
import drawing from "@shaperoute/shared-types/fixtures/drawing.json";
import drawings from "@shaperoute/shared-types/fixtures/drawings.json";
import people from "@shaperoute/shared-types/fixtures/people.json";
import publicProfile from "@shaperoute/shared-types/fixtures/public-profile.json";
import detail from "@shaperoute/shared-types/fixtures/recommended-route.json";
import list from "@shaperoute/shared-types/fixtures/recommended-routes.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../../App";
import { apiError, type MemorySecureStore } from "../account/testing";
import { SIGN_IN_TO_KEEP } from "../favorites/favoritesDoor";

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
jest.mock("expo-notifications");
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

type Phone = typeof import("../../__mocks__/expo-notifications");
const phone = jest.requireMock<Phone>("expo-notifications");
const store = jest.requireMock<MemorySecureStore>("expo-secure-store");
const API = "http://192.168.1.23:8000";
const KEY = "shaperoute.session";
const NO_RUNS = { activities: [], next: null, total: 0 };
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
const ME = session.user.public_id;
/** The drawing of the tests with two names tagged: a member, and the
 * account itself. */
const TAGGED = {
  ...drawing,
  tags: [
    { public_id: adam.public_id, username: adam.username },
    { public_id: ME, username: session.user.username },
  ],
};

type Answers = Record<string, () => Response>;

const ACCOUNT: Answers = {
  "GET /me": () => Response.json(session.user),
  "GET /me/favorites": () => Response.json({ favorites: [] }),
  "GET /me/activities": () => Response.json(NO_RUNS),
  [`GET /users/${ME}/drawings`]: () => Response.json(drawings),
  [`GET /drawings/${drawing.id}`]: () => Response.json(TAGGED),
  [`GET /users/${adam.public_id}`]: () => Response.json(ADAM),
};

let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** The fake API, by method and path; «Explore» answers as in AppPages;
 * anything else is a 404. */
function api(answers: Answers = {}) {
  fetchSpy.mockImplementation(async (input, init) => {
    const path = String(input).replace(API, "");
    const answer = answers[`${init?.method ?? "GET"} ${path}`];
    if (answer !== undefined) {
      return answer();
    }
    if (path.startsWith("/recommended-routes/")) {
      return Response.json(detail);
    }
    if (path.startsWith("/recommended-routes")) {
      return Response.json(list);
    }
    return Response.json(apiError("http_error", path), { status: 404 });
  });
}

function signedIn() {
  store.kept.set(KEY, JSON.stringify(session));
}

async function open() {
  await render(<App />);
  await screen.findByText("Starting from your position.");
}

/** The circle at the right of the names. */
function circle() {
  return screen.getByRole("button", { name: /^Profile/ });
}

/** The profile is the page on screen, with the three names over it. */
function onProfilePage() {
  expect(
    screen.getByRole("button", { name: /^Profile/, selected: true }),
  ).toBeOnTheScreen();
  expect(screen.getByTestId("profile-page-mark")).toBeOnTheScreen();
  expect(screen.getAllByRole("tab")).toHaveLength(3);
}

/** The drawing of the tests, opened on the map from the fourth page. */
async function openTagged() {
  await fireEvent.press(circle());
  await fireEvent.press(
    await screen.findByRole("button", {
      name: "Sunday heart by the river, open on the map",
    }),
  );
  await screen.findByText("Back to the profile");
}

beforeEach(() => {
  store.kept.clear();
  phone.resetPhone();
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 46.067, longitude: 11.1215 },
  } as Location.LocationObject);
  fetchSpy = jest.spyOn(globalThis, "fetch");
  api();
});

afterEach(() => {
  fetchSpy.mockRestore();
});

test("the heart without an account goes to the page, with «←» back to the map", async () => {
  await open();
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  await fireEvent.press(await screen.findByText("Star · 5.1 km"));
  await screen.findByText("Back to the list");
  await fireEvent.press(screen.getByRole("button", { name: "Add to favorites" }));

  // The fourth page, not «Profile» over the map: the circle lit, the names
  // over it, why over «Sign up», and «←» with the title.
  onProfilePage();
  expect(screen.getByText(SIGN_IN_TO_KEEP)).toBeOnTheScreen();
  expect(screen.getByRole("header", { name: "Profile" })).toBeOnTheScreen();
  expect(screen.queryByText("Back to the list")).toBeNull();

  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  // The map, with its route and its heart empty.
  expect(screen.getByText("Back to the list")).toBeOnTheScreen();
  expect(screen.queryByRole("tab")).toBeNull();
  expect(screen.getByRole("button", { name: "Add to favorites" })).toBeOnTheScreen();
});

test("left with a name, the page asked for by the heart says no more why", async () => {
  await open();
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  await fireEvent.press(await screen.findByText("Star · 5.1 km"));
  await screen.findByText("Back to the list");
  await fireEvent.press(screen.getByRole("button", { name: "Add to favorites" }));
  onProfilePage();

  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  expect(
    screen.getByRole("tab", { name: "Explore", selected: true }),
  ).toBeOnTheScreen();
  // Back by the circle: the page as the circle opens it, no line, no «←».
  await fireEvent.press(circle());
  onProfilePage();
  expect(screen.queryByText(SIGN_IN_TO_KEEP)).toBeNull();
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  expect(screen.getByTestId("account-submit")).toBeOnTheScreen();
});

test("a tagged member opens over the drawing, and «←» shows the drawing again", async () => {
  signedIn();
  api(ACCOUNT);
  await open();
  await openTagged();

  await fireEvent.press(screen.getByRole("button", { name: "adam.trento's profile" }));
  expect(await screen.findByText(/0 followers/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  // The drawing as it was, not «Profile» over the app.
  expect(screen.getByText("Back to the profile")).toBeOnTheScreen();
  expect(screen.queryByText(/0 followers/)).toBeNull();
  expect(screen.queryByRole("header", { name: "Profile" })).toBeNull();
});

test("the account's own tagged name goes to the page, and the drawing closes", async () => {
  signedIn();
  api(ACCOUNT);
  await open();
  await openTagged();

  await fireEvent.press(
    screen.getByRole("button", { name: `${session.user.username}'s profile` }),
  );
  onProfilePage();
  expect(screen.queryByText("Back to the profile")).toBeNull();
  expect(screen.queryByRole("header", { name: "Profile" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  expect(await screen.findByText("Drawings")).toBeOnTheScreen();
  // No member's page opened over it: the page asks its own profile only
  // for its totals (TASK-311), and never shows the line of another's.
  expect(screen.queryByText("Loading the profile…")).toBeNull();
  expect(screen.queryByText(/drawings? · /)).toBeNull();
});

test("a notification of a member opens over the page, and «←» shows the page again", async () => {
  signedIn();
  api(ACCOUNT);
  await open();
  expect(screen.getByRole("tab", { name: "Draw", selected: true })).toBeOnTheScreen();

  await act(async () =>
    phone.tap({
      kind: "follow_request",
      public_id: adam.public_id,
      username: adam.username,
    }),
  );
  expect(await screen.findByText(/0 followers/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  // «Draw», as it was: not «Profile», neither over the app nor the page.
  expect(screen.getByRole("tab", { name: "Draw", selected: true })).toBeOnTheScreen();
  expect(screen.queryByText(/0 followers/)).toBeNull();
  expect(screen.queryByRole("header", { name: "Profile" })).toBeNull();
  expect(screen.queryByTestId("profile-page-mark")).toBeNull();
});

test("a drawing of a notification over «Settings» goes back to the page", async () => {
  signedIn();
  api(ACCOUNT);
  await open();
  await fireEvent.press(circle());
  await fireEvent.press(await screen.findByRole("button", { name: "Settings" }));
  expect(screen.getByRole("header", { name: "Settings" })).toBeOnTheScreen();

  await act(async () => phone.tap({ kind: "reaction", drawing_id: drawing.id }));
  expect(await screen.findByText("Back to the profile")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Back to the profile" }));
  onProfilePage();
  expect(screen.queryByRole("header", { name: "Settings" })).toBeNull();
  expect(screen.queryByRole("header", { name: "Profile" })).toBeNull();
});
