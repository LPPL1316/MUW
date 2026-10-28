/**
 * «Draw» with the sport of «Settings» (TASK-190): with «Run», the requests of
 * before byte for byte; with «Bike», `activity: "cycling"` at 10–30 km, and
 * the errors a bike request can meet, with the texts of before. The panel by
 * bike is in src/route/RoutePanelBike.test.tsx; the rest of the app in
 * App.test.tsx.
 */
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { loadSport, saveSport } from "../src/settings/sport";

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
// The sport kept on the phone, as each test says; saving and telling the
// app are the real ones.
jest.mock("../src/settings/sport", () => ({
  ...jest.requireActual<typeof import("../src/settings/sport")>(
    "../src/settings/sport",
  ),
  loadSport: jest.fn(),
}));

const API = "http://192.168.1.23:8000";
const OLD_API_REFUSAL =
  "body.activity: Input should be 'running' (the field may be, at most: running)";

let fetchSpy: jest.SpiedFunction<typeof fetch>;

function job(status: string) {
  return { job_id: "4f2c9e1a", status, result: null, error: null };
}

/** The API accepts the route job, then answers each poll with the next body
 * (the last one repeats). */
function apiAnswers(...polls: unknown[]) {
  fetchSpy.mockImplementation(async (_input, init) => {
    if ((init?.method ?? "GET") === "POST") {
      return Response.json(job("queued"), { status: 202 });
    }
    if (init?.method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    return Response.json(polls.length > 1 ? polls.shift() : polls[0]);
  });
}

/** The bodies the app sent to POST /route-jobs, as sent. */
function routeBodies(): string[] {
  return fetchSpy.mock.calls
    .filter(
      ([input, init]) =>
        String(input) === `${API}/route-jobs` && (init?.method ?? "GET") === "POST",
    )
    .map(([, init]) => String(init?.body));
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

function distanceField() {
  return screen.getByLabelText("Distance in km");
}

async function draw() {
  await fireEvent.press(screen.getByText("Draw route"));
  // The first poll comes after 500 ms.
  await act(() => jest.advanceTimersByTimeAsync(500));
}

/** A sport chosen in «Settings», while the app is open. */
async function choose(sport: "run" | "bike") {
  await act(async () => saveSport(sport));
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(loadSport).mockReturnValue("run");
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

test("with «Run» the request is the one of before, byte for byte", async () => {
  apiAnswers(jobDone);
  await atTrento();
  expect(distanceField()).toHaveDisplayValue("5");
  expect(screen.getByRole("button", { name: "Run without a route" })).toBeOnTheScreen();
  await draw();
  expect(routeBodies()).toEqual([
    '{"start":[46.0671,11.1214],"shape":"heart","distance_m":5000,"activity":"running"}',
  ]);
  expect(screen.getByText("4.0 km")).toBeOnTheScreen();
});

test("with «Run» the distances are still 1 to 21 km", async () => {
  apiAnswers(jobDone);
  await atTrento();
  await fireEvent.changeText(distanceField(), "22");
  expect(screen.getByText("Enter a distance between 1 and 21 km.")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Draw route" })).toBeDisabled();
});

test("with «Bike» on the phone, «Draw» starts at 10 km and asks for cycling", async () => {
  jest.mocked(loadSport).mockReturnValue("bike");
  apiAnswers(jobDone);
  await atTrento();
  expect(distanceField()).toHaveDisplayValue("10");
  expect(
    screen.getByRole("button", { name: "Ride without a route" }),
  ).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Run without a route" })).toBeNull();
  await draw();
  expect(routeBodies()).toEqual([
    '{"start":[46.0671,11.1214],"shape":"heart","distance_m":10000,"activity":"cycling"}',
  ]);
});

test("by bike the distances are 10 to 30 km", async () => {
  jest.mocked(loadSport).mockReturnValue("bike");
  apiAnswers(jobDone);
  await atTrento();
  for (const text of ["5", "9,9", "30,5", "50"]) {
    await fireEvent.changeText(distanceField(), text);
    expect(
      screen.getByText("Enter a distance between 10 and 30 km."),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Draw route" })).toBeDisabled();
  }
  await fireEvent.changeText(distanceField(), "30");
  expect(screen.queryByText(/Enter a distance/)).not.toBeOnTheScreen();
  await draw();
  expect(JSON.parse(routeBodies()[0])).toMatchObject({
    distance_m: 30_000,
    activity: "cycling",
  });
});

test("a sport chosen in «Settings» takes «Draw» at once, there and back", async () => {
  apiAnswers(jobDone);
  await atTrento();
  await choose("bike");
  // 5 km of a run are 10 by bike.
  expect(distanceField()).toHaveDisplayValue("10");
  expect(
    screen.getByRole("button", { name: "Ride without a route" }),
  ).toBeOnTheScreen();
  await fireEvent.changeText(distanceField(), "25");

  await choose("run");
  // 25 km by bike are 21 on foot; a distance within both stays.
  expect(distanceField()).toHaveDisplayValue("21");
  expect(screen.getByRole("button", { name: "Run without a route" })).toBeOnTheScreen();
  await fireEvent.changeText(distanceField(), "12");
  await choose("bike");
  expect(distanceField()).toHaveDisplayValue("12");
  await draw();
  await choose("run");
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await draw();
  expect(routeBodies().map((body) => JSON.parse(body))).toEqual([
    {
      start: [46.0671, 11.1214],
      shape: "heart",
      distance_m: 12_000,
      activity: "cycling",
    },
    {
      start: [46.0671, 11.1214],
      shape: "heart",
      distance_m: 12_000,
      activity: "running",
    },
  ]);
});

test("an API without the bike refuses it with the words of before", async () => {
  jest.mocked(loadSport).mockReturnValue("bike");
  fetchSpy.mockImplementation(async () =>
    Response.json(
      { error: { code: "invalid_request", message: OLD_API_REFUSAL } },
      { status: 422 },
    ),
  );
  await atTrento();
  await draw();
  expect(
    screen.getByText("Something went wrong on our side. Try again in a moment."),
  ).toBeOnTheScreen();
  // The API's words for the developer, under jest as in a development build.
  expect(screen.getByText(`invalid_request: ${OLD_API_REFUSAL}`)).toBeOnTheScreen();
});

test("a bike route past the 5 minutes the app waits says so, as before", async () => {
  jest.mocked(loadSport).mockReturnValue("bike");
  apiAnswers(job("downloading_map"));
  await atTrento();
  await fireEvent.changeText(distanceField(), "30");
  await draw();
  expect(screen.getByText(/First time here: studying the map…/)).toBeOnTheScreen();
  await act(() => jest.advanceTimersByTimeAsync(5 * 60_000));
  expect(
    screen.getByText(
      "Drawing this route is taking too long. Try again later, or a shorter distance.",
    ),
  ).toBeOnTheScreen();
});

test("by bike a word may have 8 letters", async () => {
  jest.mocked(loadSport).mockReturnValue("bike");
  apiAnswers(jobDone);
  await atTrento();
  await fireEvent.press(screen.getByRole("button", { name: "Word" }));
  await fireEvent.changeText(screen.getByLabelText("Word"), "sgravata");
  await fireEvent.changeText(distanceField(), "24");
  await draw();
  expect(JSON.parse(routeBodies()[0])).toEqual({
    start: [46.0671, 11.1214],
    word: "SGRAVATA",
    style: "round",
    // The pen is lifted between the letters unless switched off (TASK-202).
    pen_up: true,
    distance_m: 24_000,
    activity: "cycling",
  });
});
