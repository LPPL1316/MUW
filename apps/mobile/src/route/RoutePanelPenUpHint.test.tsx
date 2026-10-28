/**
 * «Lift the pen» under a word drawn in one line that did not come out
 * (TASK-311 B): the rule is in penUpHint.test.ts, the request it sends in
 * __tests__/AppPenUpHint.test.tsx.
 */
import type { RouteRequest, RouteResult } from "@shaperoute/shared-types";
import word from "@shaperoute/shared-types/fixtures/route-result-word.json";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { saveLanguageChoice } from "../i18n/language";
import { RouteOutcome } from "./RoutePanel";
import type { RouteProblem, RouteState } from "./useRouteRequest";

const HINT = "This word may come out better with the pen up: each letter on its own.";

const oneLine: RouteRequest = {
  start: [46.0671, 11.1214],
  word: "SMILE",
  style: "round",
  distance_m: 15000,
  activity: "running",
};

function route(similarity: number): RouteResult {
  return {
    ...(word as unknown as RouteResult),
    word: "SMILE",
    similarity,
    distance_m: 15000,
  };
}

function outcome(
  view: RouteState,
  onLiftPen: (() => void) | null = jest.fn(),
  choices: RouteResult[] = [],
) {
  return (
    <RouteOutcome
      view={view}
      onCancel={jest.fn()}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onTryDistance={jest.fn()}
      onPickShape={jest.fn()}
      onStart={jest.fn()}
      choices={choices}
      onSignal={jest.fn()}
      onLiftPen={onLiftPen ?? undefined}
    />
  );
}

const notDrawable: RouteProblem = {
  kind: "api_error",
  code: "shape_not_drawable",
  message: "word does not fit the road network here",
  suggested_distance_m: 18000,
};

afterEach(() => saveLanguageChoice("phone"));

test("under a word in one line that did not come out, «Lift the pen» draws it so", async () => {
  const onLiftPen = jest.fn();
  await render(
    outcome({ status: "done", request: oneLine, result: route(0.81) }, onLiftPen),
  );
  expect(screen.getByText(HINT)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Lift the pen" }));
  expect(onLiftPen).toHaveBeenCalledTimes(1);
});

test("a word in one line that came out has no line", async () => {
  await render(outcome({ status: "done", request: oneLine, result: route(0.93) }));
  expect(screen.queryByText(HINT)).toBeNull();
  expect(screen.queryByRole("button", { name: "Lift the pen" })).toBeNull();
});

test("the engine's choice decides, whichever route is on screen", async () => {
  const good = route(0.93);
  const poor = route(0.8);
  const view: RouteState = { status: "done", request: oneLine, result: good };
  await render(outcome(view, jest.fn(), [poor, good]));
  expect(screen.getByText(HINT)).toBeTruthy();
});

test("a word asked with the pen up has no line, however it came out", async () => {
  const lifted: RouteRequest = { ...oneLine, pen_up: true };
  await render(
    outcome({
      status: "done",
      request: lifted,
      result: { ...route(0.7), walks: [[1, 2]] },
    }),
  );
  expect(screen.queryByText(HINT)).toBeNull();
});

test("under «does not fit», the line comes after the problem and its «Try»", async () => {
  const onLiftPen = jest.fn();
  await render(
    outcome({ status: "failed", request: oneLine, problem: notDrawable }, onLiftPen),
  );
  expect(screen.getByText("Try 18 km")).toBeTruthy();
  expect(screen.getByText(HINT)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Lift the pen" }));
  expect(onLiftPen).toHaveBeenCalledTimes(1);
});

test("other errors have no line", async () => {
  await render(
    outcome({ status: "failed", request: oneLine, problem: { kind: "timeout" } }),
  );
  expect(screen.queryByText(HINT)).toBeNull();
});

test("without a way to lift the pen nothing is offered", async () => {
  await render(outcome({ status: "done", request: oneLine, result: route(0.7) }, null));
  expect(screen.queryByText(HINT)).toBeNull();
});

test("in Italian", async () => {
  saveLanguageChoice("it");
  await render(outcome({ status: "done", request: oneLine, result: route(0.7) }));
  expect(
    screen.getByText(
      "Questa parola può venire meglio con la penna alzata: ogni lettera da sola.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Alza la penna" })).toBeTruthy();
});
