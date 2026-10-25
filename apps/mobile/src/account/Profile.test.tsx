import session from "@shaperoute/shared-types/fixtures/session.json";
import signUpRequest from "@shaperoute/shared-types/fixtures/sign-up-request.json";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../../App";
import { apiError, type MemorySecureStore } from "./testing";

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
  jest.requireActual<typeof import("./testing")>("./testing").memorySecureStore(),
);

const store = jest.requireMock<MemorySecureStore>("expo-secure-store");
const requestPermission = jest.mocked(Location.requestForegroundPermissionsAsync);
const getPosition = jest.mocked(Location.getCurrentPositionAsync);
const API = "http://192.168.1.23:8000";
const KEY = "shaperoute.session";

let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** The account endpoints of the fake API, by method and path. */
function accountApi(answers: Record<string, () => Response>) {
  fetchSpy.mockImplementation(async (input, init) => {
    const path = String(input).replace(API, "");
    const answer = answers[`${init?.method ?? "GET"} ${path}`];
    if (answer === undefined) {
      throw new Error(`Not in this test: ${init?.method ?? "GET"} ${path}`);
    }
    return answer();
  });
}

function calls(method: string, path: string) {
  return fetchSpy.mock.calls.filter(
    ([input, init]) =>
      String(input) === `${API}${path}` && (init?.method ?? "GET") === method,
  );
}

/** «Profile» is the page after «Explore», where the circle in the header of
 * the pages goes (TASK-154, TASK-278). */
async function openProfile() {
  await fireEvent.press(screen.getByRole("button", { name: /^Profile/ }));
}

/** The profile is the page on screen: its circle has the page's mark. */
function onProfilePage() {
  expect(screen.getByRole("button", { name: /^Profile/, selected: true })).toBeTruthy();
  expect(screen.getByTestId("profile-page-mark")).toBeTruthy();
}

beforeEach(() => {
  store.kept.clear();
  fetchSpy = jest.spyOn(globalThis, "fetch");
  // No GPS: the first screen asks for a place, and nothing goes to the API.
  requestPermission.mockReset().mockResolvedValue({ granted: false } as never);
  getPosition.mockReset();
});

afterEach(() => {
  fetchSpy.mockRestore();
});

test("without an account the app opens on «Draw» as before, and asks the API nothing", async () => {
  accountApi({});
  await render(<App />);
  expect(screen.getByRole("tab", { name: "Draw", selected: true })).toBeTruthy();
  expect(screen.getByText("Draw route")).toBeTruthy();
  await openProfile();
  expect(screen.getByTestId("account-submit")).toBeTruthy();
  onProfilePage();
  // «Draw» is two pages away, as it was left, and out of reach.
  expect(screen.queryByText("Draw route")).toBeNull();
  expect(screen.getByText("Draw route", { includeHiddenElements: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole("tab", { name: "Draw" }));
  expect(screen.queryByTestId("account-submit")).toBeNull();
  expect(screen.getByText("Draw route")).toBeTruthy();
  // Nothing but the shape game's catalog, asked as the app opens to know
  // whether to show «Play» (TASK-296).
  expect(
    fetchSpy.mock.calls.filter(([input]) => !String(input).endsWith("/game/catalog")),
  ).toEqual([]);
});

test("sign up in «Profile», and the app remembers who when reopened", async () => {
  accountApi({
    "POST /accounts": () => Response.json(session, { status: 201 }),
    "GET /me": () => Response.json(session.user),
  });
  const first = await render(<App />);
  await openProfile();
  await fireEvent.changeText(screen.getByLabelText("email"), signUpRequest.email);
  await fireEvent.changeText(screen.getByLabelText("username"), signUpRequest.username);
  await fireEvent.changeText(screen.getByLabelText("password"), signUpRequest.password);
  await fireEvent.press(screen.getByRole("checkbox", { name: "I am at least 16" }));
  await fireEvent.press(screen.getByTestId("account-submit"));
  expect(await screen.findByRole("button", { name: "Settings" })).toBeTruthy();
  expect(screen.getByText("Runner_42")).toBeTruthy();
  expect(JSON.parse(String(calls("POST", "/accounts")[0][1]?.body))).toEqual(
    signUpRequest,
  );
  expect(JSON.parse(store.kept.get(KEY)!)).toEqual(session);

  // Closed and opened again: signed in at once, checked with the API.
  await first.unmount();
  await render(<App />);
  await openProfile();
  expect(screen.getByText("Runner_42")).toBeTruthy();
  expect(calls("GET", "/me")).toHaveLength(1);
  expect(calls("GET", "/me")[0][1]?.headers).toMatchObject({
    Authorization: `Bearer ${session.token}`,
  });
});

test("an expired token asks to log in again, without a crash", async () => {
  store.kept.set(KEY, JSON.stringify(session));
  accountApi({
    "GET /me": () => Response.json(apiError("session_expired"), { status: 401 }),
  });
  await render(<App />);
  // «Profile» shows it needs a look, from «Draw».
  expect(await screen.findByTestId("profile-attention")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Profile, log in again" })).toBeTruthy();
  expect(screen.getByText("Draw route")).toBeTruthy();
  await openProfile();
  expect(screen.getByText("Your session has ended. Log in again.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Log in", selected: true })).toBeTruthy();
  expect(store.kept.has(KEY)).toBe(false);
});

/** «Log out» and «Delete account» are in «Settings» (TASK-177). */
async function openSettings() {
  await openProfile();
  await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
  expect(screen.getByRole("header", { name: "Settings" })).toBeTruthy();
}

test("«Settings» opens from «Profile», and «←» goes back to it", async () => {
  store.kept.set(KEY, JSON.stringify(session));
  accountApi({ "GET /me": () => Response.json(session.user) });
  await render(<App />);
  await openProfile();
  // The first page has the ways to the pages, not the ways out.
  expect(screen.getByRole("button", { name: /^Favorites/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /^My activities/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Log out" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
  expect(screen.getByRole("header", { name: "Settings" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Log out" })).toBeTruthy();
  // Back on the page of the profile, under it.
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.queryByRole("header", { name: "Settings" })).toBeNull();
  onProfilePage();
  expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
});

test("log out, and the phone forgets the token", async () => {
  store.kept.set(KEY, JSON.stringify(session));
  accountApi({
    "GET /me": () => Response.json(session.user),
    "DELETE /session": () => new Response(null, { status: 204 }),
    "POST /session": () => Response.json(session),
  });
  await render(<App />);
  await openSettings();
  await fireEvent.press(screen.getByRole("button", { name: "Log out" }));
  expect(screen.getByText("You are logged out on this phone.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Log in", selected: true })).toBeTruthy();
  onProfilePage();
  expect(calls("DELETE", "/session")).toHaveLength(1);
  expect(store.kept.has(KEY)).toBe(false);

  // Back in: on «Profile», not on «Settings» where the account was left.
  await fireEvent.changeText(screen.getByLabelText("email"), signUpRequest.email);
  await fireEvent.changeText(screen.getByLabelText("password"), signUpRequest.password);
  await fireEvent.press(screen.getByTestId("account-submit"));
  expect(await screen.findByRole("button", { name: "Settings" })).toBeTruthy();
  onProfilePage();
  expect(screen.queryByRole("button", { name: "Log out" })).toBeNull();
});

test("«Delete account» asks first, then deletes", async () => {
  store.kept.set(KEY, JSON.stringify(session));
  accountApi({
    "GET /me": () => Response.json(session.user),
    "DELETE /me": () => new Response(null, { status: 204 }),
  });
  await render(<App />);
  await openSettings();
  await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
  expect(screen.getByText(/^Delete your account\?/)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Keep my account" }));
  expect(calls("DELETE", "/me")).toHaveLength(0);
  expect(screen.queryByText(/^Delete your account\?/)).toBeNull();

  await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
  await fireEvent.press(screen.getByRole("button", { name: "Delete my account" }));
  expect(
    await screen.findByText(
      "Your account and everything that was yours have been deleted.",
    ),
  ).toBeTruthy();
  expect(calls("DELETE", "/me")).toHaveLength(1);
  expect(store.kept.has(KEY)).toBe(false);
  // A deleted account starts again from «Sign up».
  expect(screen.getByRole("button", { name: "Sign up", selected: true })).toBeTruthy();
});

test("signed in, the button to «Profile» shows who with a letter", async () => {
  store.kept.set(KEY, JSON.stringify(session));
  accountApi({ "GET /me": () => Response.json(session.user) });
  await render(<App />);
  expect(screen.getByText("R")).toBeTruthy();
  await openProfile();
  expect(screen.getByText("Runner_42")).toBeTruthy();
});

test("drawing a route, the map takes the whole screen; back, the pages return", async () => {
  requestPermission.mockResolvedValue({ granted: true } as never);
  getPosition.mockResolvedValue({
    coords: { latitude: 46.0671, longitude: 11.1214 },
  } as never);
  const job = { job_id: "4f2c9e1a", status: "running", result: null, error: null };
  accountApi({
    "POST /route-jobs": () => Response.json(job, { status: 202 }),
    "GET /route-jobs/4f2c9e1a": () => Response.json(job),
    "DELETE /route-jobs/4f2c9e1a": () => new Response(null, { status: 204 }),
  });
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent.press(screen.getByText("Draw route"));
  expect(calls("POST", "/route-jobs")).toHaveLength(1);
  // Neither the names of the pages nor the way to «Profile» over the map.
  expect(screen.queryByRole("tab")).toBeNull();
  expect(screen.queryByRole("button", { name: /^Profile/ })).toBeNull();
  await fireEvent.press(screen.getByLabelText("Back"));
  expect(screen.getAllByRole("tab")).toHaveLength(3);
  expect(screen.getByRole("button", { name: "Profile" })).toBeTruthy();
});
