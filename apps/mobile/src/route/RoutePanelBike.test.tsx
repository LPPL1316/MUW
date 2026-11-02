/**
 * «Draw» by bike (TASK-190): the distance field keeps to 10–30 km, and a
 * shape that fits at another distance is offered it within them. A word
 * with the pen up says the km between the letters are ridden (TASK-216). A
 * run's panel is in RoutePanel.test.tsx; the whole app by bike in
 * AppBike.test.tsx.
 */
import type { Activity, LatLon, RouteRequest } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { appLanguage } from "../i18n/language";
import { toDistanceM } from "./distance";
import { RouteChoice, RouteOutcome } from "./RoutePanel";
import { checkWord } from "./wordInput";

// The app's language, English unless a test says otherwise.
jest.mock("../i18n/language", () => ({
  ...jest.requireActual<typeof import("../i18n/language")>("../i18n/language"),
  appLanguage: jest.fn(() => "en"),
}));

function choice(distanceText: string, onDistanceText: jest.Mock, activity?: Activity) {
  const distanceM = toDistanceM(distanceText, activity);
  return (
    <RouteChoice
      kind="shape"
      onKind={jest.fn()}
      shapeText="heart"
      shape="heart"
      onShapeText={jest.fn()}
      reading={null}
      onShapeDone={jest.fn()}
      wordText=""
      onWordText={jest.fn()}
      wordCheck={checkWord("", distanceM, activity)}
      letterStyle="round"
      onLetterStyle={jest.fn()}
      distanceText={distanceText}
      distanceM={distanceM}
      image={{ status: "none" }}
      onChooseImage={jest.fn()}
      onDistanceText={onDistanceText}
      activity={activity}
    />
  );
}

test("by bike a run's distance is out: the field says 10 to 30 km", async () => {
  const onDistanceText = jest.fn();
  await render(choice("5", onDistanceText, "cycling"));
  expect(screen.getByText("Enter a distance between 10 and 30 km.")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Longer" }));
  expect(onDistanceText).toHaveBeenLastCalledWith("10");
});

test("by bike − and + stay within 10 and 30 km, half a km a step", async () => {
  const onDistanceText = jest.fn();
  const { rerender } = await render(choice("30", onDistanceText, "cycling"));
  expect(screen.queryByText(/Enter a distance/)).toBeNull();
  // At the limit nothing moves (TASK-361): nothing is asked, nothing felt.
  await fireEvent.press(screen.getByRole("button", { name: "Longer" }));
  expect(onDistanceText).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Shorter" }));
  expect(onDistanceText).toHaveBeenLastCalledWith("29.5");
  await rerender(choice("10", onDistanceText, "cycling"));
  await fireEvent.press(screen.getByRole("button", { name: "Shorter" }));
  expect(onDistanceText).toHaveBeenCalledTimes(1);
});

test("without an activity the field is a run's, as before", async () => {
  const onDistanceText = jest.fn();
  await render(choice("25", onDistanceText));
  expect(screen.getByText("Enter a distance between 1 and 21 km.")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Shorter" }));
  expect(onDistanceText).toHaveBeenLastCalledWith("21");
});

const bikeHeart: RouteRequest = {
  start: [46.0671, 11.1214],
  shape: "heart",
  distance_m: 15_000,
  activity: "cycling",
};

function failed(request: RouteRequest, suggested: number, onTryDistance: jest.Mock) {
  return (
    <RouteOutcome
      view={{
        status: "failed",
        request,
        problem: {
          kind: "api_error",
          code: "shape_not_drawable",
          message: "no",
          suggested_distance_m: suggested,
        },
      }}
      onCancel={jest.fn()}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onTryDistance={onTryDistance}
      onPickShape={jest.fn()}
      onStart={jest.fn()}
      onSignal={jest.fn()}
    />
  );
}

test("by bike a shape that fits at 25 km is offered 25 km", async () => {
  const onTryDistance = jest.fn();
  await render(failed(bikeHeart, 25_000, onTryDistance));
  await fireEvent.press(screen.getByText("Try 25 km"));
  expect(onTryDistance).toHaveBeenCalledWith(25_000);
});

test("for a run the same 25 km is not offered: the shapes are", async () => {
  await render(failed({ ...bikeHeart, activity: "running" }, 25_000, jest.fn()));
  expect(screen.queryByText("Try 25 km")).toBeNull();
  expect(screen.getByText("star")).toBeTruthy();
});

// North in a line: letters 0–100 m and 1300–1400 m, a ride of 1.2 km between.
const METRE = 1 / 111_195;
const POINTS = [0, 100, 1300, 1400].map((m): LatLon => [46.0122 + m * METRE, 11.2986]);
const PEN_UP_RESULT = {
  points: POINTS,
  distance_m: 15_400,
  similarity: 0.9,
  shape: null,
  word: "IO",
  warnings: [],
  directions: [],
  walks: [[1, 2]] as [number, number][],
};

function penUp(activity: Activity) {
  const request = {
    start: POINTS[0],
    word: "IO",
    pen_up: true,
    distance_m: 15_000,
    activity,
  };
  return (
    <RouteOutcome
      view={{ status: "done", request, result: PEN_UP_RESULT }}
      onCancel={jest.fn()}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onTryDistance={jest.fn()}
      onPickShape={jest.fn()}
      onStart={jest.fn()}
    />
  );
}

test("by bike the km between the letters of a word are ridden (TASK-216)", async () => {
  await render(penUp("cycling"));
  expect(
    screen.getByText("14.2 km of letters + 1.2 km riding between them"),
  ).toBeOnTheScreen();
  expect(screen.queryByText(/walking between them/)).toBeNull();
});

test("in Italian, as the user chose it", async () => {
  jest.mocked(appLanguage).mockReturnValue("it");
  try {
    await render(penUp("cycling"));
    expect(
      screen.getByText("14,2 km di lettere + 1,2 km in bici fra una lettera e l'altra"),
    ).toBeOnTheScreen();
  } finally {
    jest.mocked(appLanguage).mockReturnValue("en");
  }
});

test("a word with the pen up on foot says what it said before", async () => {
  await render(penUp("running"));
  expect(
    screen.getByText("14.2 km of letters + 1.2 km walking between them"),
  ).toBeOnTheScreen();
  expect(screen.queryByText(/riding/)).toBeNull();
});
