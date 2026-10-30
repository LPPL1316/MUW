/**
 * The app with «Open water swim» (TASK-323 C2), the sport set as if it were
 * ready: «Draw» asks for `activity: "swimming"` at 0.5–3 km by half a km,
 * from 1 km, a shape or a drawing but no word; the swim says its laps, offers
 * «Bigger shape» and «Smaller shape», the line under every swim and its
 * turns; «Start» follows it without directions, through the swim's notice
 * the first time. The parts are in src/swim/ and src/route/swimDistance.test.ts;
 * «Paddle» is in AppPaddle.test.tsx.
 */
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import swimResult from "@shaperoute/shared-types/fixtures/route-result-swimming.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { forgetExamples } from "../src/explore/exampleRoutes";
import { forgetWaterChoice } from "../src/paddle/PaddleExplore";
import { NOTICE_TITLE } from "../src/paddle/PaddleNotice";
import { forgetNoticeSeen } from "../src/paddle/safetyNotice";
import { loadSport } from "../src/settings/sport";
import { forgetSwimNoticeSeen } from "../src/swim/safetyNotice";
import { SWIM_NOTICE_TITLE } from "../src/swim/SwimNotice";

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
  Accuracy: { Balanced: 3, BestForNavigation: 6 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));
jest.mock("expo-speech", () => ({ speak: jest.fn(), stop: jest.fn() }));
jest.mock("expo-brightness", () => ({
  getBrightnessAsync: jest.fn(() => Promise.resolve(0.6)),
  setBrightnessAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
// The sport kept on the phone, as each test says: «Open water swim», which
// no phone can choose yet («Soon»).
jest.mock("../src/settings/sport", () => ({
  ...jest.requireActual<typeof import("../src/settings/sport")>(
    "../src/settings/sport",
  ),
  loadSport: jest.fn(),
}));

const API = "http://192.168.1.23:8000";
const RICCIONE: [number, number] = [44.00355, 12.66338];

/** The heart of the contract, three laps of 317 m, its turns opposite
 * «Hotel Miramare» (TASK-323 B). */
const swimDone = { ...jobDone, result: swimResult };

let fetchSpy: jest.SpiedFunction<typeof fetch>;

function job(status: string) {
  return { job_id: "4f2c9e1a", status, result: null, error: null };
}

/** The API accepts each route job, then answers each poll with the next
 * body (the last one repeats). */
function apiAnswers(...polls: unknown[]) {
  fetchSpy.mockImplementation(async (input, init) => {
    if ((init?.method ?? "GET") === "POST") {
      return Response.json(job("queued"), { status: 202 });
    }
    if (init?.method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    if (String(input) === `${API}/game/catalog`) {
      // An API without the shape game (TASK-296): no «Play» page.
      return Response.json(
        { error: { code: "http_error", message: "no game" } },
        { status: 404 },
      );
    }
    return Response.json(polls.length > 1 ? polls.shift() : polls[0]);
  });
}

/** The bodies the app sent to POST /route-jobs, read back. */
function routeBodies(): unknown[] {
  return fetchSpy.mock.calls
    .filter(
      ([input, init]) =>
        String(input) === `${API}/route-jobs` && (init?.method ?? "GET") === "POST",
    )
    .map(([, init]) => JSON.parse(String(init?.body)));
}

function directionCalls(): unknown[] {
  return fetchSpy.mock.calls.filter(
    ([input]) => String(input) === `${API}/route-directions`,
  );
}

async function atRiccione() {
  await render(<App />);
  await act(() => jest.advanceTimersByTimeAsync(0));
  expect(screen.getByText("Starting from your position.")).toBeOnTheScreen();
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

beforeEach(() => {
  jest.useFakeTimers();
  forgetNoticeSeen();
  forgetSwimNoticeSeen();
  forgetExamples();
  forgetWaterChoice();
  jest.mocked(loadSport).mockReturnValue("swim");
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: RICCIONE[0], longitude: RICCIONE[1] },
  } as Location.LocationObject);
  jest
    .mocked(Location.watchPositionAsync)
    .mockResolvedValue({ remove: jest.fn() } as Location.LocationSubscription);
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  forgetExamples();
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

test("a swim starts at 1 km, a shape or a drawing but no word, and asks for swimming", async () => {
  apiAnswers(swimDone);
  await atRiccione();
  expect(distanceField()).toHaveDisplayValue("1");
  expect(
    screen.getByRole("button", { name: "Swim without a route" }),
  ).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Word" })).toBeNull();
  expect(screen.getByRole("button", { name: "Image" })).toBeOnTheScreen();
  await draw();
  expect(routeBodies()).toEqual([
    { start: RICCIONE, shape: "heart", distance_m: 1000, activity: "swimming" },
  ]);
  expect(screen.getByText("heart · on the water · target 1 km")).toBeOnTheScreen();
});

test("− and + go by half a km, from 0.5 to 3", async () => {
  apiAnswers(swimDone);
  await atRiccione();
  await fireEvent.press(screen.getByRole("button", { name: "Longer" }));
  expect(distanceField()).toHaveDisplayValue("1.5");
  await fireEvent.press(screen.getByRole("button", { name: "Shorter" }));
  await fireEvent.press(screen.getByRole("button", { name: "Shorter" }));
  expect(distanceField()).toHaveDisplayValue("0.5");
  await fireEvent.changeText(distanceField(), "3,5");
  expect(screen.getByText("Enter a distance between 0.5 and 3 km.")).toBeOnTheScreen();
  await fireEvent.changeText(distanceField(), "2,5");
  await draw();
  expect(routeBodies()[0]).toMatchObject({ distance_m: 2500, activity: "swimming" });
});

test("the swim says its laps, the line under it and its turns before «Start»", async () => {
  apiAnswers(swimDone);
  await atRiccione();
  await draw();
  expect(screen.getByText("3 laps of 320 m")).toBeOnTheScreen();
  expect(
    screen.getByText("Within 150 m of the shore. Never swim alone."),
  ).toBeOnTheScreen();
  expect(screen.getByText("TURNS")).toBeOnTheScreen();
  expect(screen.getAllByText("Turn left · Hotel Miramare")).toHaveLength(2);
});

test("«Bigger shape» asks a lap fewer, «Smaller shape» a lap more, at the same distance", async () => {
  apiAnswers(swimDone);
  await atRiccione();
  await draw();
  await fireEvent.press(screen.getByRole("button", { name: "Bigger shape" }));
  await act(() => jest.advanceTimersByTimeAsync(500));
  await fireEvent.press(screen.getByRole("button", { name: "Smaller shape" }));
  await act(() => jest.advanceTimersByTimeAsync(500));
  const asked = {
    start: RICCIONE,
    shape: "heart",
    distance_m: 1000,
    activity: "swimming",
  };
  // The answer is the fixture's three laps each time: a lap fewer and a lap
  // more than three.
  expect(routeBodies()).toEqual([asked, { ...asked, laps: 2 }, { ...asked, laps: 4 }]);
  // Back in «Draw», «Draw route» shows the same swim again, its laps kept:
  // nothing more is asked.
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await draw();
  expect(routeBodies()).toHaveLength(3);
  expect(screen.getByText("3 laps of 320 m")).toBeOnTheScreen();
});

test("the first «Start» shows the swim's notice, not the paddle's", async () => {
  apiAnswers(swimDone);
  await atRiccione();
  await draw();
  await fireEvent.press(screen.getByRole("button", { name: "Start" }));
  expect(screen.getByText(SWIM_NOTICE_TITLE)).toBeOnTheScreen();
  expect(screen.queryByText(NOTICE_TITLE)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Not now" }));
  expect(screen.queryByText(SWIM_NOTICE_TITLE)).toBeNull();
  expect(screen.queryByText("Stop")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Start" }));
  await fireEvent.press(screen.getByRole("button", { name: "I understand" }));
  await act(() => jest.advanceTimersByTimeAsync(0));
  expect(screen.getByText("Stop")).toBeOnTheScreen();
  // No turns to follow in the water, and none asked for.
  expect(directionCalls()).toHaveLength(0);
});

test("a shape too big for the band offers the half km it fits at, in the water's words", async () => {
  apiAnswers(
    {
      job_id: "4f2c9e1a",
      status: "failed",
      result: null,
      error: {
        code: "shape_not_drawable",
        message:
          "the heart does not fit at 3 km in the water 20-150 m from the shore here, even in 5 laps: it fits at 1.7 km",
        suggested_distance_m: 1500,
        reason: null,
      },
    },
    swimDone,
  );
  await atRiccione();
  await fireEvent.changeText(distanceField(), "3");
  await draw();
  expect(
    screen.getByText(
      "This shape does not fit on the water here at this distance. It fits at about 1.5 km.",
    ),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("Try 1.5 km"));
  await act(() => jest.advanceTimersByTimeAsync(500));
  expect(
    routeBodies().map((body) => (body as { distance_m: number }).distance_m),
  ).toEqual([3000, 1500]);
});

test("«Explore» has the lakes and the beaches to swim; a swim of theirs starts through the notice", async () => {
  apiAnswers(swimDone);
  await atRiccione();
  await fireEvent.press(screen.getByText("Explore"));
  expect(
    screen.getByText("Shapes to swim, within 150 m of the shore"),
  ).toBeOnTheScreen();
  expect(screen.getByText("RICCIONE · FROM THE BEACH")).toBeOnTheScreen();
  // None come with the app: the API swims them, 1 km from the beach.
  for (let i = 0; i < 10; i += 1) {
    await act(() => jest.advanceTimersByTimeAsync(500));
  }
  expect(routeBodies().length).toBeGreaterThan(0);
  for (const body of routeBodies()) {
    expect(body).toMatchObject({ activity: "swimming", distance_m: 1000 });
  }
  await fireEvent.press(screen.getByLabelText("Heart, 1.0 km, on the water"));
  await fireEvent.press(screen.getByRole("button", { name: "Start" }));
  expect(screen.getByText(SWIM_NOTICE_TITLE)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "I understand" }));
  await act(() => jest.advanceTimersByTimeAsync(0));
  expect(screen.getByText("Stop")).toBeOnTheScreen();
  expect(directionCalls()).toHaveLength(0);
});
