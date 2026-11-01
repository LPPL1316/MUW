import type { RouteResult } from "@shaperoute/shared-types";
import detail from "@shaperoute/shared-types/fixtures/recommended-route.json";
import listed from "@shaperoute/shared-types/fixtures/recommended-routes.json";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Animated, type StyleProp, StyleSheet, type ViewStyle } from "react-native";

import { color, font, motion } from "../theme/tokens";
import { type Explored, optionsOf } from "./explored";
import { ExploredCard } from "./ExploredCard";
import { isRecommendedList, type RecommendedRouteDetail } from "./recommendedRoutes";
import type { MoveExample } from "../paddle/useMoveExample";
import type { StartView } from "./useStartDirections";

const [route] = isRecommendedList(listed) ? listed.routes : [];

/** The rendered tree as JSON, and every node in it `where` says. */
type Json = { props: Record<string, unknown>; children: (Json | string)[] | null };
function nodes(
  node: Json | string | null | undefined,
  where: (node: Json) => boolean,
): Json[] {
  if (node == null || typeof node === "string") {
    return [];
  }
  const own = where(node) ? [node] : [];
  return [...own, ...(node.children ?? []).flatMap((child) => nodes(child, where))];
}
const whole = detail as RecommendedRouteDetail;
const shorter: RecommendedRouteDetail = {
  ...whole,
  id: `${whole.id}:1`,
  route_m: 4630,
  similarity: 0.81,
};

/** A route open on the map, with `others` to choose from besides it. */
function opened(others: RecommendedRouteDetail[], chosen = 0) {
  const options = optionsOf(route, whole, others);
  const choose = jest.fn();
  const explored: Explored = {
    status: "done",
    ...options[chosen],
    choices: options.map((option): RouteResult => option.result),
    chosen,
    choose,
    others: [],
  };
  return { explored, choose };
}

async function card(
  explored: Explored,
  start: StartView = { status: "idle" },
  move?: MoveExample,
) {
  await render(
    <ExploredCard
      explored={explored}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onList={jest.fn()}
      start={start}
      onStart={jest.fn()}
      move={move}
    />,
  );
}

test("an example with alternatives has the tiles A · B, above Start", async () => {
  const { explored, choose } = opened([shorter]);
  await card(explored);
  expect(screen.getByTestId("route-A")).toBeSelected();
  expect(screen.getByText("4.6 km · 81%")).toBeOnTheScreen();
  expect(screen.getByText("Start")).toBeOnTheScreen();

  await fireEvent.press(screen.getByTestId("route-B"));
  expect(choose).toHaveBeenCalledWith(1);
});

test("the card is about the route chosen", async () => {
  const { explored } = opened([shorter], 1);
  await card(explored);
  expect(screen.getByTestId("route-B")).toBeSelected();
  expect(screen.getByText("4.6 km")).toBeOnTheScreen();
  expect(screen.getByText(/looks 81% like it/)).toBeOnTheScreen();
});

test("a route alone has no tiles", async () => {
  const { explored } = opened([]);
  await card(explored);
  expect(screen.queryByTestId("route-A")).toBeNull();
  expect(screen.getByText("Start")).toBeOnTheScreen();
});

test("the GPX is the one way out of the app: no Run with Strava", async () => {
  const { explored } = opened([]);
  await card(explored);
  expect(screen.getByText("Export GPX")).toBeOnTheScreen();
  expect(screen.queryByText("Run with Strava")).toBeNull();
});

test("while the directions come, the route chosen stays", async () => {
  const { explored, choose } = opened([shorter]);
  await card(explored, { status: "loading" });
  await fireEvent.press(screen.getByTestId("route-B"));
  expect(choose).not.toHaveBeenCalled();
});

/** The shape of the example on the map, as useMoveExample tells the card. */
function moveOf(now: Partial<MoveExample> = {}): MoveExample {
  return {
    available: true,
    moving: false,
    begin: jest.fn(),
    cancel: jest.fn(),
    onMoved: jest.fn(),
    waiting: false,
    elsewhere: false,
    problem: null,
    ...now,
  };
}

const MOVE = { name: "Move the shape" };

test("an example that says where its shape is has «Move the shape», under Start (TASK-244)", async () => {
  const move = moveOf();
  await card(opened([]).explored, { status: "idle" }, move);
  // Start, «Move the shape», the GPX and the way back.
  expect(screen.getAllByRole("button")).toHaveLength(4);
  expect(screen.getByRole("button", { name: "Start" })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", MOVE));
  expect(move.begin).toHaveBeenCalledTimes(1);
});

test("a route that cannot be moved has no «Move the shape»", async () => {
  await card(opened([]).explored, { status: "idle" }, moveOf({ available: false }));
  expect(screen.queryByRole("button", MOVE)).toBeNull();
  expect(screen.getByRole("button", { name: "Start" })).toBeOnTheScreen();
});

test("while the finger has the shape: what to do, and «Cancel»", async () => {
  const move = moveOf({ moving: true });
  await card(opened([]).explored, { status: "idle" }, move);
  expect(
    screen.getByText("Drag the shape where you want it, then let go."),
  ).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  expect(screen.queryByText("Back to the list")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
  expect(move.cancel).toHaveBeenCalledTimes(1);
});

test("while the moved route is drawn there is nothing to start, only the way back", async () => {
  await card(opened([]).explored, { status: "idle" }, moveOf({ waiting: true }));
  expect(screen.getByText(/^Drawing a 5(\.0)? km star…$/)).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  expect(screen.queryByRole("button", MOVE)).toBeNull();
  expect(screen.queryByText("Export GPX")).toBeNull();
  expect(screen.getByText("Back to the list")).toBeOnTheScreen();
});

test("a shape that did not fit, or a move that failed, says so above Start", async () => {
  const { rerender } = await render(
    <ExploredCard
      explored={opened([]).explored}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onList={jest.fn()}
      start={{ status: "idle" }}
      onStart={jest.fn()}
      move={moveOf({ elsewhere: true })}
    />,
  );
  expect(
    screen.getByText("The shape does not fit there: this is the nearest place."),
  ).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Start" })).toBeOnTheScreen();

  await rerender(
    <ExploredCard
      explored={opened([]).explored}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onList={jest.fn()}
      start={{ status: "idle" }}
      onStart={jest.fn()}
      move={moveOf({ problem: "The API did not answer." })}
    />,
  );
  expect(screen.getByText("The API did not answer.")).toBeOnTheScreen();
  expect(screen.getByRole("button", MOVE)).toBeOnTheScreen();
});

test("the distance large and light; the actions after a hairline, answering through Tap (TASK-339)", async () => {
  // Seen, not run: an animation left running would spill into the next test.
  const timing = jest
    .spyOn(Animated, "timing")
    .mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  const { explored } = opened([]);
  await card(explored);
  expect(screen.getByText("5.1 km")).toHaveStyle({
    fontSize: font.display.fontSize,
    fontWeight: font.display.fontWeight,
  });
  // One hairline, before the actions.
  expect(
    nodes(
      screen.toJSON() as unknown as Json | null,
      (node) =>
        (
          StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>) as {
            backgroundColor?: string;
          }
        )?.backgroundColor === color.hairline,
    ),
  ).toHaveLength(1);
  await fireEvent(screen.getByText("Export GPX"), "pressIn");
  expect(timing).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ toValue: 1, duration: motion.pressMs }),
  );
  timing.mockRestore();
});
