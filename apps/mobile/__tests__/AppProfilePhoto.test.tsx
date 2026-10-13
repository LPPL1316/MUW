/**
 * The profile picture (TASK-178): chosen in «Settings», shown in the row, in
 * the circle of «Profile» and in the button of the header, there again when
 * the app opens, and removed. The hook alone is in
 * src/profile/useProfilePhoto.test.ts.
 */
import detail from "@shaperoute/shared-types/fixtures/recommended-route.json";
import list from "@shaperoute/shared-types/fixtures/recommended-routes.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import App from "../App";
import { apiError, type MemorySecureStore } from "../src/account/testing";
import { type ProfilePhoto, photoUri } from "../src/api/profilePhoto";
import { PHOTO_OPTIONS } from "../src/profile/pickPhoto";

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
jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
}));
jest.mock("expo-secure-store", () =>
  jest
    .requireActual<typeof import("../src/account/testing")>("../src/account/testing")
    .memorySecureStore(),
);

const store = jest.requireMock<MemorySecureStore>("expo-secure-store");
const API = "http://192.168.1.23:8000";
const SESSION_KEY = "shaperoute.session";
/** What the phone hands over, and the square the API makes of it. */
const CHOSEN = "Y2hvc2Vu";
const KEPT: ProfilePhoto = { image: "a2VwdA==", updated_at: "2026-10-02T16:30:00Z" };

let fetchSpy: jest.SpiedFunction<typeof fetch>;
/** The picture on the fake API; null without one. */
let onApi: ProfilePhoto | null;

/** The fake API: the account, its picture, and «Explore» as in AppPages. */
function api() {
  fetchSpy.mockImplementation(async (input, init) => {
    const path = String(input).replace(API, "");
    const method = init?.method ?? "GET";
    if (path === "/me") {
      return Response.json(session.user);
    }
    if (path === "/me/photo") {
      if (method === "PUT") {
        onApi = KEPT;
      } else if (method === "DELETE") {
        onApi = null;
        return new Response(null, { status: 204 });
      }
      return onApi === null
        ? Response.json(apiError("http_error", "No picture."), { status: 404 })
        : Response.json(onApi);
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

function calls(method: string) {
  return fetchSpy.mock.calls.filter(
    ([input, init]) =>
      String(input) === `${API}/me/photo` && (init?.method ?? "GET") === method,
  );
}

async function open() {
  await render(<App />);
  await screen.findByText("Starting from your position.");
}

async function openPhotoRow() {
  await fireEvent.press(screen.getByRole("button", { name: /^Profile/ }));
  await fireEvent.press(await screen.findByRole("button", { name: "Settings" }));
  await fireEvent.press(screen.getByRole("button", { name: /^Profile picture/ }));
}

async function back() {
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
}

/** From the page of the profile (TASK-278), to «Draw». */
async function toDraw() {
  await fireEvent.press(screen.getByRole("tab", { name: "Draw" }));
}

beforeEach(() => {
  store.kept.clear();
  store.kept.set(SESSION_KEY, JSON.stringify(session));
  onApi = null;
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 46.067, longitude: 11.1215 },
  } as Location.LocationObject);
  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockReset()
    .mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///me.jpg", width: 900, height: 900, base64: CHOSEN }],
    } as ImagePicker.ImagePickerResult);
  fetchSpy = jest.spyOn(globalThis, "fetch");
  api();
});

afterEach(() => {
  fetchSpy.mockRestore();
});

test("a picture chosen in «Settings» shows in the row, in «Profile» and in the header", async () => {
  await open();
  // No picture yet: the letter.
  expect(screen.getByRole("button", { name: /^Profile/ })).toHaveTextContent("R");
  expect(calls("GET")).toHaveLength(1);

  await openPhotoRow();
  await fireEvent.press(screen.getByRole("button", { name: "Choose a picture" }));
  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(PHOTO_OPTIONS);
  expect(await screen.findByTestId("avatar-photo")).toHaveProp("source", {
    uri: photoUri(KEPT),
  });
  expect(JSON.parse(String(calls("PUT")[0][1]?.body))).toEqual({ image: CHOSEN });

  await back();
  expect(screen.getByTestId("avatar-photo")).toHaveProp("source", {
    uri: photoUri(KEPT),
  });
  await toDraw();
  expect(screen.getByTestId("profile-button-photo")).toHaveProp("source", {
    uri: photoUri(KEPT),
  });
  expect(screen.getByRole("button", { name: /^Profile/ })).not.toHaveTextContent("R");
});

test("the picture is there again when the app opens, and can be removed", async () => {
  onApi = KEPT;
  await open();
  expect(await screen.findByTestId("profile-button-photo")).toHaveProp("source", {
    uri: photoUri(KEPT),
  });

  await openPhotoRow();
  await fireEvent.press(screen.getByRole("button", { name: "Remove picture" }));
  expect(await screen.findByText("R")).toBeOnTheScreen();
  expect(screen.queryByTestId("avatar-photo")).toBeNull();
  expect(calls("DELETE")).toHaveLength(1);
  expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();

  await back();
  await toDraw();
  expect(screen.queryByTestId("profile-button-photo")).toBeNull();
  expect(screen.getByRole("button", { name: /^Profile/ })).toHaveTextContent("R");
});

test("logged out, the header shows the figure, not the picture of who left", async () => {
  onApi = KEPT;
  await open();
  await screen.findByTestId("profile-button-photo");
  await fireEvent.press(screen.getByRole("button", { name: /^Profile/ }));
  await fireEvent.press(await screen.findByRole("button", { name: "Settings" }));
  await fireEvent.press(screen.getByRole("button", { name: "Log out" }));
  // Out of the account, back on the page of the profile (TASK-278).
  await toDraw();
  expect(screen.queryByTestId("profile-button-photo")).toBeNull();
  expect(screen.getByRole("button", { name: /^Profile/ })).not.toHaveTextContent("R");
});
