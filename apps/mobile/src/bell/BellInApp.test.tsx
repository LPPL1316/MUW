/**
 * The bell in the whole app (TASK-367 part C, ADR-0311): in the header of
 * the pages, beside the sport, with the account's unread lines; a line
 * opens what its push opens, as «Profile» hands the doors. A server
 * without the list: no bell. The list itself is in Bell.test.tsx.
 */
import drawing from "@shaperoute/shared-types/fixtures/drawing.json";
import example from "@shaperoute/shared-types/fixtures/notifications.json";
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

// The fixture's comment, on the drawing the API has.
const [comment, request] = example.notifications;
const PAGE = {
  ...example,
  notifications: [
    { ...comment, opens: { kind: "comment", drawing_id: drawing.id } },
    request,
  ],
};

type Answers = Record<string, () => Response>;
const ACCOUNT: Answers = {
  "GET /me": () => Response.json(session.user),
  "GET /me/favorites": () => Response.json({ favorites: [] }),
  "GET /me/activities": () => Response.json({ activities: [], next: null, total: 0 }),
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

async function open() {
  store.kept.set(KEY, JSON.stringify(session));
  await render(<App />);
  await screen.findByText(/^Location is off for MuW/);
}

beforeEach(() => {
  store.kept.clear();
  fetchSpy = jest.spyOn(globalThis, "fetch");
  // No GPS: «Draw» asks for a place.
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: false } as Location.LocationPermissionResponse);
});

afterEach(() => {
  fetchSpy.mockRestore();
});

test("the bell in the header opens the list, and a line its drawing", async () => {
  api({
    ...ACCOUNT,
    "GET /notifications": () => Response.json(PAGE),
    "POST /notifications/read": () => new Response(null, { status: 204 }),
    [`GET /drawings/${drawing.id}`]: () => Response.json(drawing),
  });
  await open();
  const bell = await screen.findByRole("button", { name: "Notifications, 1 new" });
  await fireEvent.press(bell);
  expect(await screen.findByText(/commented on your post/)).toBeOnTheScreen();
  expect(calls("POST", "/notifications/read")).toHaveLength(1);

  await fireEvent.press(screen.getByTestId(`bell-line-${comment.id}`));
  expect(screen.queryByTestId("bell-list")).toBeNull();
  // The drawing on the map, over the whole screen: no tab bar.
  await screen.findByText(drawing.title);
  expect(calls("GET", `/drawings/${drawing.id}`)).toHaveLength(1);
  expect(screen.queryByRole("tab")).toBeNull();
});

test("a server without the list: no bell in the header", async () => {
  api(ACCOUNT);
  await open();
  await screen.findByRole("tab", { name: "Draw", selected: true });
  expect(calls("GET", "/notifications")).toHaveLength(1);
  expect(screen.queryByTestId("bell")).toBeNull();
});
