/**
 * The notes under the route (TASK-337): two at first, things to watch for
 * first, the rest behind «Show more», so the map above stays in sight. Notes
 * about safety are never behind it. The words of each note are in
 * warnings.test.ts.
 */
import type { RouteRequest, RouteResult } from "@shaperoute/shared-types";
import request from "@shaperoute/shared-types/fixtures/route-request.json";
import result from "@shaperoute/shared-types/fixtures/route-result.json";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { saveLanguageChoice } from "../i18n/language";
import { RouteOutcome } from "./RoutePanel";

const ROUGHLY = "The roads here follow the shape only roughly.";
const SKIPPED = "A bit of the shape has no road to follow, so the route skips it.";
const TRAFFIC = "1.4 km runs along main roads, with traffic.";
const STEPS = "There are 120 m of steps along the way.";
const LONGER = "The route is 12% longer than asked.";

// Two things to watch for, one about safety, and one just to know.
const FOUR = [
  "distance on roads is +12% from the target after 18 attempts",
  "shape similarity 0.86 is below 0.90 after 18 attempts",
  "no road path to shape point 17; skipped",
  "120 m of the route on steps",
];

function route(warnings: string[]): RouteResult {
  return { ...(result as unknown as RouteResult), warnings };
}

function outcome(
  shown: RouteResult,
  choices: RouteResult[] = [],
  onChoose: (index: number) => void = jest.fn(),
  movedElsewhere = false,
) {
  return (
    <RouteOutcome
      view={{ status: "done", request: request as RouteRequest, result: shown }}
      onCancel={jest.fn()}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onTryDistance={jest.fn()}
      onPickShape={jest.fn()}
      onStart={jest.fn()}
      choices={choices}
      onChoose={onChoose}
      onSignal={jest.fn()}
      movedElsewhere={movedElsewhere}
    />
  );
}

afterEach(() => saveLanguageChoice("phone"));

test("two notes at first, the steps among them; «Show more» opens the rest", async () => {
  await render(outcome(route(FOUR)));
  expect(screen.getByText(ROUGHLY)).toBeTruthy();
  expect(screen.getByText(STEPS)).toBeTruthy();
  expect(screen.queryByText(SKIPPED)).toBeNull();
  expect(screen.queryByText(LONGER)).toBeNull();

  await fireEvent.press(screen.getByRole("button", { name: "Show more" }));
  expect(screen.getByText(SKIPPED)).toBeTruthy();
  expect(screen.getByText(LONGER)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
});

test("two notes or fewer are all shown, with no «Show more»", async () => {
  const { rerender } = await render(outcome(route(FOUR.slice(1, 3))));
  expect(screen.getByText(ROUGHLY)).toBeTruthy();
  expect(screen.getByText(SKIPPED)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();

  await rerender(outcome(route([])));
  expect(screen.queryByText(ROUGHLY)).toBeNull();
  expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
});

test("the same sentence twice counts once", async () => {
  await render(
    outcome(
      route([
        "no road path to shape point 3; skipped",
        "no road path to shape point 9; skipped",
        "120 m of the route on steps",
      ]),
    ),
  );
  expect(screen.getByText(SKIPPED)).toBeTruthy();
  expect(screen.getByText(STEPS)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
});

test("steps, traffic and tunnels are never behind «Show more», even three", async () => {
  await render(
    outcome(
      route([
        "shape similarity 0.86 is below 0.90 after 18 attempts",
        "120 m of the route on steps",
        "1400 m of the route on main roads",
        "60 m of the route in tunnels",
      ]),
    ),
  );
  expect(screen.getByText(STEPS)).toBeTruthy();
  expect(screen.getByText(TRAFFIC)).toBeTruthy();
  expect(screen.getByText("60 m runs through tunnels.")).toBeTruthy();
  expect(screen.queryByText(ROUGHLY)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Show more" }));
  expect(screen.getByText(ROUGHLY)).toBeTruthy();
});

test("the other of A and B shows the first two again", async () => {
  const a = route(FOUR);
  const b = route([...FOUR]);
  const { rerender } = await render(outcome(a, [a, b]));
  await fireEvent.press(screen.getByRole("button", { name: "Show more" }));
  expect(screen.getByText(LONGER)).toBeTruthy();

  await rerender(outcome(b, [a, b]));
  expect(screen.queryByText(LONGER)).toBeNull();
  expect(screen.getByText(STEPS)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Show more" })).toBeTruthy();
});

test("the moved shape's line is said apart, never behind «Show more»", async () => {
  await render(outcome(route(FOUR), [], jest.fn(), true));
  expect(
    screen.getByText("The shape does not fit there: this is the nearest place."),
  ).toBeTruthy();
  expect(screen.queryByText(LONGER)).toBeNull();
});

test("in Italian too, «Mostra altro»", async () => {
  saveLanguageChoice("it");
  await render(outcome(route(FOUR)));
  expect(screen.getByText("Lungo la strada ci sono 120 m di scale.")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Mostra altro" }));
  expect(
    screen.getByText("Il percorso è più lungo del 12% rispetto a quanto chiesto."),
  ).toBeTruthy();
});
