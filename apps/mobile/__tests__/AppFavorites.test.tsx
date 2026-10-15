/**
 * Favorites (TASK-171): the heart over a route on the map, «Favorites» in
 * «Profile», and a favorite opened from there. The hook alone is in
 * src/favorites/useFavorites.test.ts.
 */
import favorite from "@shaperoute/shared-types/fixtures/favorite.json";
import favorites from "@shaperoute/shared-types/fixtures/favorites.json";
import detail from "@shaperoute/shared-types/fixtures/recommended-route.json";
import list from "@shaperoute/shared-types/fixtures/recommended-routes.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import signUpRequest from "@shaperoute/shared-types/fixtures/sign-up-request.json";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { apiError, type MemorySecureStore } from "../src/account/testing";
import { favoriteKey } from "../src/favorites/favoriteKey";
import { SIGN_IN_TO_KEEP } from "../src/favorites/favoritesDoor";

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
/** The key of the route of «Explore» of the tests: made from its line. */
const STAR = favoriteKey(detail.points as [number, number][]);
const [KEPT_STAR, KEPT_WORD] = favorites.favorites;

let fetchSpy: jest.SpiedFunction<typeof fetch>;

type Answers = Record<string, () => Response>;

/** The fake API, by method and path; «Explore» answers as in AppPages. */
function api(answers: Answers) {
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

function calls(method: string, path: string) {
  return fetchSpy.mock.calls.filter(
    ([input, init]) =>
      String(input) === `${API}${path}` && (init?.method ?? "GET") === method,
  );
}

function signedIn() {
  store.kept.set(SESSION_KEY, JSON.stringify(session));
}

const ACCOUNT: Answers = {
  "GET /me": () => Response.json(session.user),
};

async function open() {
  await render(<App />);
  await screen.findByText("Starting from your position.");
}

/** The star of «Explore» in Trento, on the map. */
async function openStar() {
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  await fireEvent.press(await screen.findByText("Star · 5.1 km"));
  await screen.findByText("Back to the list");
}

async function openFavorites() {
  await fireEvent.press(screen.getByRole("button", { name: /^Profile/ }));
  await fireEvent.press(await screen.findByRole("button", { name: /^Favorites/ }));
}

beforeEach(() => {
  store.kept.clear();
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 46.067, longitude: 11.1215 },
  } as Location.LocationObject);
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  fetchSpy.mockRestore();
});

test("the heart keeps the route on the map, and removes it", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    "GET /me/favorites": () => Response.json({ favorites: [] }),
    [`PUT /me/favorites/${STAR}`]: () =>
      Response.json({ ...KEPT_STAR, id: STAR }, { status: 201 }),
    [`DELETE /me/favorites/${STAR}`]: () => new Response(null, { status: 204 }),
  });
  await open();
  // No route on the map, no heart.
  expect(screen.queryByRole("button", { name: "Add to favorites" })).toBeNull();
  await openStar();
  await fireEvent.press(screen.getByRole("button", { name: "Add to favorites" }));
  // Full at once, before the API answers.
  expect(
    screen.getByRole("button", { name: "Remove from favorites", selected: true }),
  ).toBeOnTheScreen();
  await waitFor(() => expect(calls("PUT", `/me/favorites/${STAR}`)).toHaveLength(1));
  const [, init] = calls("PUT", `/me/favorites/${STAR}`)[0];
  expect(init?.headers).toMatchObject({ Authorization: `Bearer ${session.token}` });
  expect(JSON.parse(String(init?.body))).toEqual({
    city: "trento",
    shape: "star",
    word: null,
    style: null,
    title: null,
    distance_m: detail.distance_m,
    route_m: detail.route_m,
    similarity: detail.similarity,
    points: detail.points,
    // The star of the example is turned (TASK-232): kept with its turn.
    rotation_deg: detail.rotation_deg,
  });

  await fireEvent.press(screen.getByRole("button", { name: "Remove from favorites" }));
  expect(screen.getByRole("button", { name: "Add to favorites" })).toBeOnTheScreen();
  await waitFor(() => expect(calls("DELETE", `/me/favorites/${STAR}`)).toHaveLength(1));
});

test("a heart the API refuses goes back, and says why", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    "GET /me/favorites": () => Response.json({ favorites: [] }),
    [`PUT /me/favorites/${STAR}`]: () =>
      Response.json(
        apiError("invalid_request", "You have 200 favorites: remove one."),
        { status: 422 },
      ),
  });
  await open();
  await openStar();
  await fireEvent.press(screen.getByRole("button", { name: "Add to favorites" }));
  expect(
    await screen.findByText("You have 200 favorites: remove one."),
  ).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Add to favorites" })).toBeOnTheScreen();
});

test("without an account the heart goes to the page of the profile, and the route is kept once signed up", async () => {
  api({
    "POST /accounts": () => Response.json(session, { status: 201 }),
    "GET /me/favorites": () => Response.json({ favorites: [] }),
    [`PUT /me/favorites/${STAR}`]: () =>
      Response.json({ ...KEPT_STAR, id: STAR }, { status: 201 }),
  });
  await open();
  await openStar();
  await fireEvent.press(screen.getByRole("button", { name: "Add to favorites" }));
  // The fourth page (TASK-278 part B), saying why.
  expect(screen.getByTestId("profile-page-mark")).toBeOnTheScreen();
  expect(screen.getByText(SIGN_IN_TO_KEEP)).toBeOnTheScreen();
  expect(calls("PUT", `/me/favorites/${STAR}`)).toHaveLength(0);

  await fireEvent.changeText(screen.getByLabelText("email"), signUpRequest.email);
  await fireEvent.changeText(screen.getByLabelText("username"), signUpRequest.username);
  await fireEvent.changeText(screen.getByLabelText("password"), signUpRequest.password);
  await fireEvent.press(screen.getByRole("checkbox", { name: "I am at least 16" }));
  await fireEvent.press(screen.getByTestId("account-submit"));
  await waitFor(() => expect(calls("PUT", `/me/favorites/${STAR}`)).toHaveLength(1));
  // Back on the map by itself, the heart full.
  expect(screen.queryByRole("tab")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Remove from favorites" }),
  ).toBeOnTheScreen();
});

test("«Profile» closed without an account drops the route that waited", async () => {
  api({
    "POST /accounts": () => Response.json(session, { status: 201 }),
    "GET /me/favorites": () => Response.json({ favorites: [] }),
  });
  await open();
  await openStar();
  await fireEvent.press(screen.getByRole("button", { name: "Add to favorites" }));
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  // Back to «Explore», and an account made later from the header keeps nothing.
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await fireEvent.press(screen.getByRole("button", { name: /^Profile/ }));
  expect(screen.queryByText(SIGN_IN_TO_KEEP)).toBeNull();
  await fireEvent.changeText(screen.getByLabelText("email"), signUpRequest.email);
  await fireEvent.changeText(screen.getByLabelText("username"), signUpRequest.username);
  await fireEvent.changeText(screen.getByLabelText("password"), signUpRequest.password);
  await fireEvent.press(screen.getByRole("checkbox", { name: "I am at least 16" }));
  await fireEvent.press(screen.getByTestId("account-submit"));
  await waitFor(() => expect(calls("GET", "/me/favorites")).toHaveLength(1));
  expect(calls("PUT", `/me/favorites/${STAR}`)).toHaveLength(0);
});

test("«Favorites» in «Profile» lists them, and one opens on the map", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    "GET /me/favorites": () => Response.json(favorites),
    [`GET /me/favorites/${KEPT_STAR.id}`]: () => Response.json(favorite),
  });
  await open();
  await fireEvent.press(screen.getByRole("button", { name: /^Profile/ }));
  await fireEvent.press(await screen.findByRole("button", { name: "Favorites, 2" }));
  expect(screen.getByRole("header", { name: "Favorites" })).toBeOnTheScreen();
  expect(screen.getByText("Star · 5.1 km")).toBeOnTheScreen();
  expect(screen.getByText("Trento")).toBeOnTheScreen();
  // A word drawn from the GPS has no city: the day it was kept.
  expect(screen.getByText("CIAO · 12.5 km")).toBeOnTheScreen();
  expect(screen.getByText("Kept 1 Oct 2026")).toBeOnTheScreen();

  await fireEvent.press(
    screen.getByRole("button", { name: "Star · 5.1 km, open on the map" }),
  );
  // On the map as a route of «Explore»: to start, to export, its heart full.
  expect(await screen.findByText("Back to the list")).toBeOnTheScreen();
  expect(screen.getByText("star · Trento · looks 100% like it")).toBeOnTheScreen();
  expect(screen.getByText("Start")).toBeOnTheScreen();
  expect(
    screen.getByRole("button", { name: "Remove from favorites", selected: true }),
  ).toBeOnTheScreen();
  expect(screen.queryByRole("tab")).toBeNull();

  // Back: the list it came from, over the page left under it.
  await fireEvent.press(screen.getByText("Back to the list"));
  expect(screen.getByRole("header", { name: "Favorites" })).toBeOnTheScreen();
  // Then the page of the profile, under it (TASK-278).
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.queryByRole("header", { name: "Favorites" })).toBeNull();
  expect(
    screen.getByRole("button", { name: /^Profile/, selected: true }),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("tab", { name: "Draw" }));
  expect(screen.getByRole("tab", { name: "Draw", selected: true })).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: /favorites/ })).toBeNull();
});

test("the heart of a card removes it; refused, the card comes back", async () => {
  signedIn();
  let refuse = true;
  api({
    ...ACCOUNT,
    "GET /me/favorites": () => Response.json(favorites),
    [`DELETE /me/favorites/${KEPT_WORD.id}`]: () =>
      refuse
        ? Response.json(apiError("engine_error", "…"), { status: 500 })
        : new Response(null, { status: 204 }),
  });
  await open();
  await openFavorites();
  await fireEvent.press(
    screen.getByRole("button", { name: "Remove CIAO from favorites" }),
  );
  expect(await screen.findByText("CIAO · 12.5 km")).toBeOnTheScreen();
  expect(screen.getByRole("alert")).toBeOnTheScreen();

  refuse = false;
  await fireEvent.press(
    screen.getByRole("button", { name: "Remove CIAO from favorites" }),
  );
  expect(screen.queryByText("CIAO · 12.5 km")).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText("Star · 5.1 km")).toBeOnTheScreen();
  await waitFor(() =>
    expect(calls("DELETE", `/me/favorites/${KEPT_WORD.id}`)).toHaveLength(2),
  );
});

test("no favorites yet, and a list that does not come", async () => {
  signedIn();
  let down = true;
  api({
    ...ACCOUNT,
    "GET /me/favorites": () =>
      down
        ? Response.json(apiError("engine_error", "…"), { status: 500 })
        : Response.json({ favorites: [] }),
  });
  await open();
  await openFavorites();
  expect(await screen.findByText("Your favorites could not load.")).toBeOnTheScreen();
  down = false;
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText(/^No favorites yet/)).toBeOnTheScreen();
});

test("a session that ended while keeping signs the app out", async () => {
  signedIn();
  api({
    ...ACCOUNT,
    "GET /me/favorites": () => Response.json({ favorites: [] }),
    [`PUT /me/favorites/${STAR}`]: () =>
      Response.json(apiError("session_expired"), { status: 401 }),
  });
  await open();
  await openStar();
  await fireEvent.press(screen.getByRole("button", { name: "Add to favorites" }));
  await waitFor(() => expect(store.kept.has(SESSION_KEY)).toBe(false));
  expect(screen.getByRole("button", { name: "Add to favorites" })).toBeOnTheScreen();
  // The next tap asks to log in again.
  await fireEvent.press(screen.getByRole("button", { name: "Add to favorites" }));
  expect(screen.getByText("Your session has ended. Log in again.")).toBeOnTheScreen();
});
