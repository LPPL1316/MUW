/**
 * A picture with the pen up (TASK-297 part C2, ADR-0258): the switch under
 * a picture with pieces, on to start; the pieces over the picture; what the
 * request says; the route drawn with its walks, as a shape in pieces. The
 * run along the walks is the one of the words (src/navigation/penUpRun.test.ts).
 */
import penUpResult from "@shaperoute/shared-types/fixtures/route-result-pen-up.json";
import traced from "@shaperoute/shared-types/fixtures/image-outline-pieces.json";
import tracedAlone from "@shaperoute/shared-types/fixtures/image-outline.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import App from "../App";

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
jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
}));

const { injectJavaScript } =
  jest.requireMock<typeof import("../__mocks__/react-native-webview")>(
    "react-native-webview",
  );

const API = "http://192.168.1.23:8000";
const TRENTO: [number, number] = [46.0671, 11.1214];
const SWITCH = "Lift the pen between parts";
const NOTE_APART =
  "The yellow lines are what the route will draw: each part on its own, going from one to the next without drawing. If they do not look like the subject, the route will not either: try another picture.";
// An image's route names no word (images._unnamed), and walks to its piece.
const RESULT = { ...penUpResult, word: null };

let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** The API traces `outline`, accepts the route job, and the job is done
 * at the first poll. */
function apiAnswers(outline: unknown) {
  fetchSpy.mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === `${API}/image-outlines`) {
      return Response.json(outline);
    }
    if (method === "POST") {
      return Response.json(
        { job_id: "4f2c9e1a", status: "queued", result: null, error: null },
        { status: 202 },
      );
    }
    return Response.json({
      job_id: "4f2c9e1a",
      status: "done",
      result: RESULT,
      error: null,
    });
  });
}

/** The bodies the app sent to `path` with POST, read back. */
function posted(path: string): unknown[] {
  return fetchSpy.mock.calls
    .filter(
      ([input, init]) =>
        String(input) === `${API}${path}` && (init?.method ?? "GET") === "POST",
    )
    .map(([, init]) => JSON.parse(String(init?.body)));
}

async function pictureAtTrento() {
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
  await fireEvent.press(screen.getByRole("button", { name: "Image" }));
  await fireEvent.changeText(screen.getByLabelText("Distance in km"), "6");
  await fireEvent.press(screen.getByText("Choose picture"));
  await act(() => jest.advanceTimersByTimeAsync(0));
  expect(screen.getByTestId("image-preview")).toBeOnTheScreen();
}

async function draw() {
  await fireEvent.press(screen.getByText("Draw route"));
  // The first poll comes after 500 ms.
  await act(() => jest.advanceTimersByTimeAsync(500));
}

beforeEach(() => {
  jest.useFakeTimers();
  injectJavaScript.mockClear();
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: TRENTO[0], longitude: TRENTO[1] },
  } as Location.LocationObject);
  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockReset()
    .mockResolvedValue({
      canceled: false,
      assets: [
        { uri: "file:///logo.jpg", width: 800, height: 800, base64: "/9j/4AAQ" },
      ],
    } as ImagePicker.ImagePickerResult);
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

test("a picture with pieces has the switch on: its pieces are asked with the pen up and walked between", async () => {
  apiAnswers(traced);
  await pictureAtTrento();
  // On to start, as for a word (TASK-202): the pieces over the picture, and
  // no editing of a line drawn apart.
  expect(screen.getByRole("switch", { name: SWITCH, checked: true })).toBeTruthy();
  expect(screen.getByText(NOTE_APART)).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Edit the outline" })).toBeNull();

  await draw();
  expect(posted("/image-route-jobs")).toEqual([
    {
      start: TRENTO,
      outline: traced.points,
      pieces: traced.pieces,
      pen_up: true,
      distance_m: 6000,
      activity: "running",
    },
  ]);
  // The drawing and the walk, apart, on the map; the walk dashed.
  const shown = injectJavaScript.mock.calls
    .map(([script]) => String(script))
    .findLast((script) => script.includes('"type":"showRoute"'));
  expect(shown).toContain('"letters":[[');
  expect(shown).toContain('"walks":[[');
  // The km of the drawing apart from the walk, as for a shape in pieces.
  expect(
    screen.getByText(/km of drawing \+ .* km walking between the parts$/),
  ).toBeTruthy();
});

test("switched off, the picture is drawn as before, with its strokes", async () => {
  apiAnswers(traced);
  await pictureAtTrento();
  await fireEvent.press(screen.getByRole("switch", { name: SWITCH }));
  expect(screen.getByRole("switch", { name: SWITCH, checked: false })).toBeTruthy();
  expect(screen.queryByText(NOTE_APART)).toBeNull();
  expect(screen.getByRole("button", { name: "Edit the outline" })).toBeOnTheScreen();
  await draw();
  expect(posted("/image-route-jobs")).toEqual([
    {
      start: TRENTO,
      outline: traced.points,
      strokes: [],
      distance_m: 6000,
      activity: "running",
    },
  ]);
});

test("a picture without pieces has no switch, and no pen up is sent", async () => {
  // An API older than TASK-297, or a picture of one subject without holes.
  apiAnswers(tracedAlone);
  await pictureAtTrento();
  expect(screen.queryByRole("switch", { name: SWITCH })).toBeNull();
  await draw();
  expect(posted("/image-route-jobs")).toEqual([
    {
      start: TRENTO,
      outline: tracedAlone.points,
      distance_m: 6000,
      activity: "running",
    },
  ]);
});
