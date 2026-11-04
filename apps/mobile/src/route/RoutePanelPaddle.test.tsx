/**
 * «Draw» on the water (TASK-191): a shape of the catalogue only, 1–5 km, a
 * route that says it is on the water and starts with «Start» though it has
 * no turns, and the texts of a shape that does not fit there. The whole app
 * with «Paddle» is in AppPaddle.test.tsx.
 */
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import type { RouteRequest, RouteResult } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { toDistanceM } from "./distance";
import { RouteChoice, RouteOutcome } from "./RoutePanel";
import type { ChoiceKind } from "./problems";
import { checkWord } from "./wordInput";

function choice(
  distanceText: string,
  onDistanceText: jest.Mock,
  {
    kind = "shape",
    onKind = jest.fn(),
  }: { kind?: ChoiceKind; onKind?: jest.Mock } = {},
) {
  const distanceM = toDistanceM(distanceText, "paddling");
  return (
    <RouteChoice
      kind={kind}
      onKind={onKind}
      shapeText="heart"
      shape="heart"
      onShapeText={jest.fn()}
      reading={null}
      onShapeDone={jest.fn()}
      wordText=""
      onWordText={jest.fn()}
      wordCheck={checkWord("", distanceM, "paddling")}
      letterStyle="round"
      onLetterStyle={jest.fn()}
      distanceText={distanceText}
      distanceM={distanceM}
      image={{ status: "none" }}
      onChooseImage={jest.fn()}
      onDistanceText={onDistanceText}
      activity="paddling"
    />
  );
}

test("on the water there is no word nor picture to choose: the shapes only", async () => {
  await render(choice("2", jest.fn()));
  expect(screen.getByText("On the water, a shape of the catalogue.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Word" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Image" })).toBeNull();
  expect(screen.getByTestId("shape-grid")).toBeTruthy();
  expect(screen.getByTestId("other-shape-link")).toBeTruthy();
});

test("a word chosen before «Paddle» shows the shapes, not the word", async () => {
  await render(choice("2", jest.fn(), { kind: "word" }));
  expect(screen.queryByLabelText("Word")).toBeNull();
  expect(screen.getByTestId("shape-grid")).toBeTruthy();
});

test("the distance keeps to 1–5 km, in half km too", async () => {
  const onDistanceText = jest.fn();
  const { rerender } = await render(choice("6", onDistanceText));
  expect(screen.getByText("Enter a distance between 1 and 5 km.")).toBeTruthy();
  await rerender(choice("2,5", onDistanceText));
  expect(screen.queryByText(/Enter a distance/)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Longer" }));
  // Half a km a step (TASK-361).
  expect(onDistanceText).toHaveBeenLastCalledWith("3");
  await rerender(choice("5", onDistanceText));
  await fireEvent.press(screen.getByRole("button", { name: "Longer" }));
  // At the limit nothing moves.
  expect(onDistanceText).toHaveBeenCalledTimes(1);
});

const paddleHeart: RouteRequest = {
  start: [44.00355, 12.66338],
  shape: "heart",
  distance_m: 2000,
  activity: "paddling",
};

/** A route on the water as the API sends it (ADR-0164): no turns, no
 * alternatives, no warnings, similarity 1. */
const onWater: RouteResult = {
  ...(jobDone.result as unknown as RouteResult),
  similarity: 1,
  distance_m: 2040,
  directions: [],
  alternatives: [],
  warnings: [],
};

function done(request: RouteRequest, result: RouteResult, onStart: jest.Mock) {
  return (
    <RouteOutcome
      view={{ status: "done", request, result }}
      onCancel={jest.fn()}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onTryDistance={jest.fn()}
      onPickShape={jest.fn()}
      onStart={onStart}
      onSignal={jest.fn()}
    />
  );
}

test("a route on the water says so, and has «Start» without turns", async () => {
  const onStart = jest.fn();
  await render(done(paddleHeart, onWater, onStart));
  expect(screen.getByText("2.0 km")).toBeTruthy();
  expect(screen.getByText("heart · on the water · target 2 km")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Start" }));
  expect(onStart).toHaveBeenCalledTimes(1);
});

test("a run without turns still has no «Start», as before", async () => {
  await render(done({ ...paddleHeart, activity: "running" }, onWater, jest.fn()));
  expect(screen.getByText("heart · on roads · target 2 km")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
});

test("a shape too big for the water is offered the half km it fits at", async () => {
  const onTryDistance = jest.fn();
  await render(
    <RouteOutcome
      view={{
        status: "failed",
        request: { ...paddleHeart, distance_m: 4000 },
        problem: {
          kind: "api_error",
          code: "shape_not_drawable",
          message:
            "the heart does not fit at 4 km on the water within 1 km of the shore here: it fits at 2.8 km",
          suggested_distance_m: 2500,
        },
      }}
      onCancel={jest.fn()}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onTryDistance={onTryDistance}
      onPickShape={jest.fn()}
      onStart={jest.fn()}
      onSignal={jest.fn()}
    />,
  );
  expect(
    screen.getByText(
      "This shape does not fit on the water here at this distance. It fits at about 2.5 km.",
    ),
  ).toBeTruthy();
  await fireEvent.press(screen.getByText("Try 2.5 km"));
  expect(onTryDistance).toHaveBeenCalledWith(2500);
});
