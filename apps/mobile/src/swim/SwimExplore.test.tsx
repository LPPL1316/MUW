/**
 * «Explore» with «Open water swim» (TASK-323 C4): the paddle's lakes and
 * beaches, their shapes swum at 1 km from each point, asked of the API (none
 * come with the app). The paddle's is in src/paddle/PaddleExplore.test.tsx.
 */
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import swimResult from "@shaperoute/shared-types/fixtures/route-result-swimming.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { forgetExamples, requestOf } from "../explore/exampleRoutes";
import { forgetWaterChoice, PaddleExplore } from "../paddle/PaddleExplore";
import { WATER_SPOTS } from "../paddle/waterSpots";

import { SWIM_EXAMPLES } from "./swimExamples";

jest.mock("react-native-webview");
jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-file-system");

const API = "http://api";
// The lake of Levico is 1 km away (TASK-233).
const LEVICO_TERME: [number, number] = [46.0122, 11.2986];

let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** The API accepts each route job and has it done at the first poll: the
 * swim of the contract each time. */
function apiSwims() {
  fetchSpy.mockImplementation(async (_input, init) =>
    (init?.method ?? "GET") === "POST"
      ? Response.json(
          { job_id: "4f2c9e1a", status: "queued", result: null, error: null },
          { status: 202 },
        )
      : Response.json({ ...jobDone, result: swimResult }),
  );
}

/** The bodies sent to POST /route-jobs, read back. */
function asked(): { activity: string; distance_m: number; shape: string }[] {
  return fetchSpy.mock.calls
    .filter(([, init]) => init?.method === "POST")
    .map(([, init]) => JSON.parse(String(init?.body)));
}

async function settle() {
  // Each example: the job, then its first poll after 500 ms; eight of them.
  for (let i = 0; i < 10; i += 1) {
    await act(() => jest.advanceTimersByTimeAsync(500));
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  forgetExamples();
  forgetWaterChoice();
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  forgetExamples();
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

test("the swim's examples are 1 km from the place's point, a shape in pieces swum in pieces", () => {
  expect(SWIM_EXAMPLES).toMatchObject({ activity: "swimming", distance_m: 1000 });
  expect(SWIM_EXAMPLES.bundled).toBeUndefined();
  const place = { label: "Riccione", point: [44.00355, 12.66338] as [number, number] };
  expect(requestOf(place, "heart", SWIM_EXAMPLES)).toEqual({
    shape: "heart",
    distance_m: 1000,
    start: place.point,
    activity: "swimming",
  });
  expect(requestOf(place, "cat", SWIM_EXAMPLES)).toMatchObject({ pen_up: true });
});

test("«Near me» shows the nearest lake, its eight shapes asked as swims", async () => {
  apiSwims();
  await render(
    <PaddleExplore apiUrl={API} near={LEVICO_TERME} onOpen={jest.fn()} swim />,
  );
  expect(screen.getByText("On the water")).toBeOnTheScreen();
  expect(
    screen.getByText("Shapes to swim, within 150 m of the shore"),
  ).toBeOnTheScreen();
  expect(screen.queryByText("Shapes to paddle, within 1 km of the shore")).toBeNull();
  expect(screen.getByText(/^LAGO DI LEVICO · \d\.\d KM AWAY$/)).toBeOnTheScreen();
  await settle();
  const levico = WATER_SPOTS.find((spot) => spot.name === "Lago di Levico");
  expect(asked()).toHaveLength(8);
  for (const body of asked()) {
    expect(body).toMatchObject({
      start: levico?.point,
      activity: "swimming",
      distance_m: 1000,
    });
  }
});

test("a place chosen by hand is swum too: none of the paddle's examples come with it", async () => {
  apiSwims();
  const onOpen = jest.fn();
  await render(<PaddleExplore apiUrl={API} near={null} onOpen={onOpen} swim />);
  await fireEvent.press(screen.getByRole("button", { name: "Lago di Garda" }));
  await settle();
  expect(asked()).toHaveLength(8);
  expect(new Set(asked().map((body) => body.activity))).toEqual(new Set(["swimming"]));
  // The swim of the contract, 1 km.
  await fireEvent.press(screen.getByLabelText("Heart, 1.0 km, on the water"));
  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(onOpen.mock.calls[0][0]).toMatchObject({ activity: "swimming" });
});
