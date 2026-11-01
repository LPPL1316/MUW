import done from "@shaperoute/shared-types/fixtures/themed-route-job-done.json";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Animated, type StyleProp, StyleSheet, type ViewStyle } from "react-native";

import { color, font, motion } from "../theme/tokens";
import { passedText, ThemedCard, themedGpx } from "./ThemedCard";
import type { ThemedIdea } from "./themedIdeas";
import type { ThemedResult } from "./themedRoutes";

const result = done.result as ThemedResult;
const request = { text: "luoghi famosi a Milano", centre: null, city: null };

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

test("shows the route, the places it passes by, and exports", async () => {
  const onExport = jest.fn();
  await render(
    <ThemedCard
      state={{ status: "done", request, result }}
      exporting={{ status: "idle" }}
      onExport={onExport}
      onCancel={jest.fn()}
      start={{ status: "idle" }}
      onStart={jest.fn()}
    />,
  );
  expect(screen.getByText("10.1 km")).toBeOnTheScreen();
  expect(
    screen.getByText(/Passes by 2 of the 6 famous places found/),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("Export GPX"));
  expect(onExport).toHaveBeenCalled();
  expect(screen.queryByText("Run with Strava")).toBeNull();
});

test("waiting, it can be cancelled; failed, it says why", async () => {
  const onCancel = jest.fn();
  const { rerender } = await render(
    <ThemedCard
      state={{ status: "waiting", request }}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onCancel={onCancel}
      start={{ status: "idle" }}
      onStart={jest.fn()}
    />,
  );
  await fireEvent.press(screen.getByText("Cancel"));
  expect(onCancel).toHaveBeenCalled();
  await rerender(
    <ThemedCard
      state={{ status: "failed", request, message: "No places here." }}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onCancel={onCancel}
      start={{ status: "idle" }}
      onStart={jest.fn()}
    />,
  );
  expect(screen.getByText("No places here.")).toBeOnTheScreen();
});

test("no place passed is said; the GPX is a drawn route's", () => {
  const none = { ...result, stops: result.stops.map((s) => ({ ...s, passed: false })) };
  expect(passedText(none)).toMatch(/passes by none of the 6/);
  expect(themedGpx(result)?.request).toMatchObject({
    shape: "star",
    distance_m: 10000,
  });
  expect(themedGpx({ ...result, shape: "unicorn" })).toBeNull();
});

test("an idea far from the start has «Make it near me» in the place of «Start»", async () => {
  const onNearMe = jest.fn();
  const onStart = jest.fn();
  const idea: ThemedIdea = {
    id: "rome-famous-places-star",
    city: "Rome",
    category: "Famous Places",
    text: "Famous Places star 10 km",
    preview: [
      [41.89, 12.49],
      [41.891, 12.491],
    ],
    result: { ...result, city: "Rome" },
  };
  const card = (near?: () => void) => (
    <ThemedCard
      state={{ status: "done", request, result: idea.result, idea }}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onCancel={jest.fn()}
      start={{ status: "idle" }}
      onStart={onStart}
      onNearMe={near}
    />
  );
  const { rerender } = await render(card(onNearMe));
  expect(screen.getByText(/· Rome ·/)).toBeOnTheScreen();
  expect(screen.queryByText("Start")).toBeNull();
  expect(screen.getByText("Export GPX")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("Make it near me"));
  expect(onNearMe).toHaveBeenCalled();

  // In its city: «Start», as on every route.
  await rerender(card());
  expect(screen.queryByText("Make it near me")).toBeNull();
  await fireEvent.press(screen.getByText("Start"));
  expect(onStart).toHaveBeenCalled();
  expect(screen.getByText("Back to Explore")).toBeOnTheScreen();
});

test("under it, the places passed by with their photos; a tap takes the map there", async () => {
  const onPlace = jest.fn();
  await render(
    <ThemedCard
      state={{ status: "done", request, result }}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onCancel={jest.fn()}
      start={{ status: "idle" }}
      onStart={jest.fn()}
      apiUrl="http://192.168.1.23:8000"
      onPlace={onPlace}
    />,
  );
  expect(screen.getAllByTestId("stop-photo")).toHaveLength(2);
  expect(screen.getByTestId("stop-photo-image")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "1 Strada di Galliera" }));
  expect(onPlace).toHaveBeenCalledWith([44.511644, 11.3470742]);
});

test("the distance large and light; the actions after a hairline, answering through Tap (TASK-339)", async () => {
  // Seen, not run: an animation left running would spill into the next test.
  const timing = jest
    .spyOn(Animated, "timing")
    .mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  await render(
    <ThemedCard
      state={{ status: "done", request, result }}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onCancel={jest.fn()}
      start={{ status: "idle" }}
      onStart={jest.fn()}
    />,
  );
  expect(screen.getByText("10.1 km")).toHaveStyle({
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
