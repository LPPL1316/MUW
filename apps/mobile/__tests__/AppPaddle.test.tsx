/**
 * The app with «Paddle» (TASK-191): «Draw» asks for `activity: "paddling"`
 * at 1–5 km, from 2 km, a shape only; the route says it is on the water and
 * «Start» follows it without directions, through the safety notice the
 * first time; «Explore» has the lakes and the beaches. The panel is in
 * src/route/RoutePanelPaddle.test.tsx, «Explore» on the water in
 * src/paddle/PaddleExplore.test.tsx; «Run» is in AppBike.test.tsx.
 */
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { forgetExamples } from "../src/explore/exampleRoutes";
import { forgetWaterChoice } from "../src/paddle/PaddleExplore";
import { NOTICE_TITLE } from "../src/paddle/PaddleNotice";
import { forgetNoticeSeen } from "../src/paddle/safetyNotice";
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
// The sport kept on the phone, as each test says; saving and telling the
// app are the real ones.
jest.mock("../src/settings/sport", () => ({
  ...jest.requireActual<typeof import("../src/settings/sport")>(
    "../src/settings/sport",
  ),
  loadSport: jest.fn(),
}));

const API = "http://192.168.1.23:8000";
const RICCIONE: [number, number] = [44.00355, 12.66338];

/** A route on the water as the API sends it (ADR-0164): no turns. */
const waterDone = {
  ...jobDone,
  result: {
    ...jobDone.result,
    similarity: 1,
    directions: [],
    alternatives: [],
    warnings: [],
  },
};

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

/** A sport chosen in «Settings», while the app is open. */
async function choose(sport: "run" | "bike" | "paddle") {
  await act(async () => saveSport(sport));
}

beforeEach(() => {
  jest.useFakeTimers();
  forgetNoticeSeen();
  forgetExamples();
  forgetWaterChoice();
  jest.mocked(loadSport).mockReturnValue("paddle");
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

test("with «Paddle», «Draw» starts at 2 km, a shape only, and asks for paddling", async () => {
  apiAnswers(waterDone);
  await atRiccione();
  expect(distanceField()).toHaveDisplayValue("2");
  expect(
    screen.getByRole("button", { name: "Paddle without a route" }),
  ).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Word" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Image" })).toBeNull();
  await draw();
  expect(routeBodies()).toEqual([
    { start: RICCIONE, shape: "heart", distance_m: 2000, activity: "paddling" },
  ]);
  expect(screen.getByText("heart · on the water · target 2 km")).toBeOnTheScreen();
});

test("on the water the distances are 1 to 5 km", async () => {
  apiAnswers(waterDone);
  await atRiccione();
  for (const text of ["0,5", "5,5", "10"]) {
    await fireEvent.changeText(distanceField(), text);
    expect(screen.getByText("Enter a distance between 1 and 5 km.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Draw route" })).toBeDisabled();
  }
  await fireEvent.changeText(distanceField(), "3,5");
  await draw();
  expect(routeBodies()[0]).toMatchObject({ distance_m: 3500, activity: "paddling" });
});

test("the first «Start» shows the notice; «Not now» stays, «I understand» starts", async () => {
  apiAnswers(waterDone);
  await atRiccione();
  await draw();
  await fireEvent.press(screen.getByRole("button", { name: "Start" }));
  expect(screen.getByText(NOTICE_TITLE)).toBeOnTheScreen();
  expect(screen.getByText("Wear a life jacket.")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Not now" }));
  expect(screen.queryByText(NOTICE_TITLE)).toBeNull();
  expect(screen.queryByText("Stop")).toBeNull();

  await fireEvent.press(screen.getByRole("button", { name: "Start" }));
  await fireEvent.press(screen.getByRole("button", { name: "I understand" }));
  expect(screen.queryByText(NOTICE_TITLE)).toBeNull();
  await act(() => jest.advanceTimersByTimeAsync(0));
  expect(screen.getByText("Stop")).toBeOnTheScreen();
  // No turns on the water, and none asked for.
  expect(directionCalls()).toHaveLength(0);

  // Stopped before moving: back to the route; the next «Start» goes at once.
  await fireEvent.press(screen.getByText("Stop"));
  await act(() => jest.advanceTimersByTimeAsync(0));
  await fireEvent.press(screen.getByRole("button", { name: "Start" }));
  expect(screen.queryByText(NOTICE_TITLE)).toBeNull();
  await act(() => jest.advanceTimersByTimeAsync(0));
  expect(screen.getByText("Stop")).toBeOnTheScreen();
});

test("a word chosen before «Paddle» is not sent: the shape is, at 2 km", async () => {
  jest.mocked(loadSport).mockReturnValue("run");
  apiAnswers(waterDone);
  await atRiccione();
  await fireEvent.press(screen.getByRole("button", { name: "Word" }));
  await fireEvent.changeText(screen.getByLabelText("Word"), "ciao");
  await choose("paddle");
  expect(distanceField()).toHaveDisplayValue("2");
  expect(screen.queryByLabelText("Word")).toBeNull();
  await draw();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await choose("run");
  // Back to «Run»: the word is there again.
  expect(screen.getByLabelText("Word")).toHaveDisplayValue("ciao");
  expect(routeBodies()).toEqual([
    { start: RICCIONE, shape: "heart", distance_m: 2000, activity: "paddling" },
  ]);
});

test("a shape in pieces is asked piece by piece on the water, by itself", async () => {
  apiAnswers(waterDone);
  await atRiccione();
  await fireEvent.changeText(screen.getByLabelText("Shape"), "cat");
  // The pen goes up by itself on the water (TASK-226): nothing to switch.
  expect(screen.queryByRole("switch")).toBeNull();
  await draw();
  expect(routeBodies()).toEqual([
    {
      start: RICCIONE,
      shape: "cat",
      pen_up: true,
      distance_m: 2000,
      activity: "paddling",
    },
  ]);
});

test("no water near the start says so, in the water's words", async () => {
  apiAnswers({
    job_id: "4f2c9e1a",
    status: "failed",
    result: null,
    error: {
      code: "shape_not_drawable",
      message: "there is no lake or sea to paddle on within 2 km of here",
      suggested_distance_m: null,
      reason: null,
    },
  });
  await atRiccione();
  await draw();
  expect(
    screen.getByText(
      "There is no lake or sea near this start. Start from the shore, within 2 km of the water.",
    ),
  ).toBeOnTheScreen();
});

test("a shape too big for the water offers the half km it fits at", async () => {
  apiAnswers(
    {
      job_id: "4f2c9e1a",
      status: "failed",
      result: null,
      error: {
        code: "shape_not_drawable",
        message:
          "the heart does not fit at 4 km on the water within 1 km of the shore here: it fits at 2.8 km",
        suggested_distance_m: 2500,
        reason: null,
      },
    },
    waterDone,
  );
  await atRiccione();
  await fireEvent.changeText(distanceField(), "4");
  await draw();
  await fireEvent.press(screen.getByText("Try 2.5 km"));
  await act(() => jest.advanceTimersByTimeAsync(500));
  expect(
    routeBodies().map((body) => (body as { distance_m: number }).distance_m),
  ).toEqual([4000, 2500]);
  expect(screen.getByText("heart · on the water · target 2.5 km")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(distanceField()).toHaveDisplayValue("2.5");
});

test("«Explore» has the lakes and the beaches; their routes start without directions", async () => {
  apiAnswers(waterDone);
  await atRiccione();
  await fireEvent.press(screen.getByText("Explore"));
  expect(
    screen.getByText("Shapes to paddle, within 1 km of the shore"),
  ).toBeOnTheScreen();
  expect(screen.queryByText("Best near you")).toBeNull();
  // «Near me» is on at once, and the start is on Riccione's beach (TASK-233).
  expect(screen.getByRole("button", { name: "Near me" })).toBeSelected();
  expect(screen.getByText("RICCIONE · FROM THE BEACH")).toBeOnTheScreen();
  // Its eight come with the app (TASK-227): nothing is asked.
  expect(routeBodies()).toHaveLength(0);
  expect(screen.getByLabelText("Rabbit head, 2.0 km, on the water")).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText("Heart, 2.0 km, on the water"));
  await fireEvent.press(screen.getByRole("button", { name: "Start" }));
  await fireEvent.press(screen.getByRole("button", { name: "I understand" }));
  await act(() => jest.advanceTimersByTimeAsync(0));
  expect(screen.getByText("Stop")).toBeOnTheScreen();
  expect(directionCalls()).toHaveLength(0);
});

test("with «Run», «Explore» is the one of before", async () => {
  jest.mocked(loadSport).mockReturnValue("run");
  fetchSpy.mockImplementation(async () => Response.json({ routes: [] }));
  await atRiccione();
  await fireEvent.press(screen.getByText("Explore"));
  expect(screen.getByText("Best near you")).toBeOnTheScreen();
  expect(screen.queryByText("On the water")).toBeNull();
});
