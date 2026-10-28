/**
 * «Lift the pen» under a word in one line that did not come out (TASK-311
 * B): what the app asks for when it is pressed. The rule is in
 * src/route/penUpHint.test.ts, the line in
 * src/route/RoutePanelPenUpHint.test.tsx; the switch in AppPenUp.test.tsx.
 */
import penUpResult from "@shaperoute/shared-types/fixtures/route-result-pen-up.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
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
const PEN_SWITCH = "Lift the pen between letters";
const HINT = "This word may come out better with the pen up: each letter on its own.";

/** The word in one line, drawn only roughly: below a good route's 0.90. */
const ROUGH_LINE = { ...penUpResult, walks: [], similarity: 0.81, distance_m: 6000 };

let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** The API accepts each route job and has it done at the first poll: the
 * word in one line as `oneLine`, with the pen up as the contract's
 * example. */
function apiAnswers(oneLine: unknown) {
  let lifted = false;
  fetchSpy.mockImplementation(async (input, init) => {
    if ((init?.method ?? "GET") === "POST") {
      lifted = (JSON.parse(String(init?.body)) as { pen_up?: boolean }).pen_up === true;
      return Response.json(
        { job_id: "4f2c9e1a", status: "queued", result: null, error: null },
        { status: 202 },
      );
    }
    const result = lifted ? penUpResult : oneLine;
    return Response.json({ job_id: "4f2c9e1a", status: "done", result, error: null });
  });
}

/** What the app sent to the API in its route requests, in order. */
function routeRequests(): unknown[] {
  return fetchSpy.mock.calls
    .filter(
      ([input, init]) =>
        String(input) === `${API}/route-jobs` && (init?.method ?? "GET") === "POST",
    )
    .map(([, init]) => JSON.parse(String(init?.body)));
}

async function atTrento() {
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 46.0671, longitude: 11.1214 },
  } as Location.LocationObject);
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
}

async function drawWord(word: string, km: string) {
  await fireEvent.press(screen.getByRole("button", { name: "Word" }));
  await fireEvent.changeText(screen.getByLabelText("Word"), word);
  await fireEvent.changeText(screen.getByLabelText("Distance in km"), km);
}

/** The first poll comes after 500 ms. */
async function firstPoll() {
  await act(() => jest.advanceTimersByTimeAsync(500));
}

beforeEach(() => {
  jest.useFakeTimers();
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

test("a word switched to one line that came out roughly is drawn again with the pen up", async () => {
  apiAnswers(ROUGH_LINE);
  await atTrento();
  await drawWord("io", "6");
  await fireEvent.press(screen.getByRole("switch", { name: PEN_SWITCH }));
  await fireEvent.press(screen.getByText("Draw route"));
  await firstPoll();
  expect(screen.getByText(HINT)).toBeTruthy();

  await fireEvent.press(screen.getByRole("button", { name: "Lift the pen" }));
  await firstPoll();
  const one = {
    start: [46.0671, 11.1214],
    word: "IO",
    style: "round",
    distance_m: 6000,
    activity: "running",
  };
  expect(routeRequests()).toEqual([one, { ...one, pen_up: true }]);
  // The route with its walk, and no line any more.
  expect(screen.getByText(/km of letters \+ .* km walking between them$/)).toBeTruthy();
  expect(screen.queryByText(HINT)).toBeNull();
  // Back in «Draw» the switch is on: the word is asked so from now on.
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("switch", { name: PEN_SWITCH, checked: true })).toBeTruthy();
});

test("a word that does not fit in one line is offered the pen up under the problem", async () => {
  let lifted = false;
  fetchSpy.mockImplementation(async (_input, init) => {
    if ((init?.method ?? "GET") === "POST") {
      lifted = (JSON.parse(String(init?.body)) as { pen_up?: boolean }).pen_up === true;
      return Response.json(
        { job_id: "4f2c9e1a", status: "queued", result: null, error: null },
        { status: 202 },
      );
    }
    return lifted
      ? Response.json({
          job_id: "4f2c9e1a",
          status: "done",
          result: penUpResult,
          error: null,
        })
      : Response.json({
          job_id: "4f2c9e1a",
          status: "failed",
          result: null,
          error: {
            code: "shape_not_drawable",
            message: "word does not fit the road network here",
            suggested_distance_m: null,
          },
        });
  });
  await atTrento();
  await drawWord("io", "6");
  await fireEvent.press(screen.getByRole("switch", { name: PEN_SWITCH }));
  await fireEvent.press(screen.getByText("Draw route"));
  await firstPoll();
  expect(
    screen.getByText(
      "This word does not fit the roads here. Try a shorter word, or another start.",
    ),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Lift the pen" }));
  await firstPoll();
  expect(routeRequests().at(-1)).toMatchObject({ word: "IO", pen_up: true });
  expect(screen.getByText(/km of letters \+ .* km walking between them$/)).toBeTruthy();
});

test("with the switch left on the word is asked with the pen up, and no line is offered", async () => {
  apiAnswers(ROUGH_LINE);
  await atTrento();
  await drawWord("io", "6");
  await fireEvent.press(screen.getByText("Draw route"));
  await firstPoll();
  expect(routeRequests()).toEqual([expect.objectContaining({ pen_up: true })]);
  expect(screen.queryByText(HINT)).toBeNull();
});
