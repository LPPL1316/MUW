import type { LatLon } from "@shaperoute/shared-types";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { Animated, StyleSheet } from "react-native";

import { lineCamera } from "../feed/feedMapPage";
import { color, font, motion, radius } from "../theme/tokens";
import { FeedMapShooter, forgetFeedMaps } from "../feed/FeedMaps";
import {
  cardMapsCredit,
  cardDrawingHeight,
  CardMapsCredit,
  cardWidth,
  creditParts,
  framingName,
  RouteCard,
} from "./RouteCard";
import { TAP_SLOP } from "./useTapNotSwipe";

// A square: four stretches to draw.
const SQUARE: LatLon[] = [
  [46.06, 11.12],
  [46.06, 11.13],
  [46.07, 11.13],
  [46.07, 11.12],
  [46.06, 11.12],
];

beforeEach(() => {
  forgetFeedMaps();
});

test("two cards stand side by side in the width they are given", () => {
  // 390 wide less the page's margins, 12 between the two.
  expect(cardWidth(358)).toBe(173);
  expect(cardWidth(358, 8)).toBe(175);
  expect(2 * cardWidth(343) + 12).toBeLessThanOrEqual(343);
  expect(cardWidth(0)).toBe(0);
  expect(cardDrawingHeight(173)).toBe(114);
});

test("a swipe moves the lit dot to the photo", async () => {
  await render(
    <RouteCard
      width={173}
      line={SQUARE}
      photo={{ source: { uri: "http://api.test/city-photos/Q1.jpg" }, credit: null }}
      title="Viana"
    />,
  );
  expect(screen.getByTestId("route-card-dot-1")).toHaveStyle({ opacity: 0.4 });
  await fireEvent.scroll(screen.getByTestId("route-card-pages"), {
    nativeEvent: { contentOffset: { x: 173, y: 0 } },
  });
  expect(screen.getByTestId("route-card-dot-0")).toHaveStyle({ opacity: 0.4 });
  expect(screen.getByTestId("route-card-dot-1")).not.toHaveStyle({ opacity: 0.4 });
});

test("a tap on either page opens the route, a slide does not", async () => {
  const onPress = jest.fn();
  await render(
    <RouteCard
      width={173}
      line={SQUARE}
      photo={{ source: { uri: "http://api.test/city-photos/Q1.jpg" }, credit: null }}
      title="Viana"
      onPress={onPress}
    />,
  );
  await fireEvent.press(screen.getByTestId("route-card-first-page"));
  await fireEvent.press(screen.getByTestId("route-card-second-page"));
  expect(onPress).toHaveBeenCalledTimes(2);
  const page = screen.getByTestId("route-card-second-page");
  await fireEvent(page, "pressIn", { nativeEvent: { pageX: 100, pageY: 10 } });
  await fireEvent.press(page, {
    nativeEvent: { pageX: 100 + TAP_SLOP + 1, pageY: 10 },
  });
  expect(onPress).toHaveBeenCalledTimes(2);
});

test("with no line the photo is alone, with no pages", async () => {
  await render(
    <RouteCard
      width={173}
      line={null}
      photo={{ source: { uri: "http://api.test/city-photos/Q1.jpg" }, credit: null }}
      title="Viana"
    />,
  );
  expect(screen.getByTestId("route-card-photo")).toBeOnTheScreen();
  expect(screen.queryByTestId("route-card-pages")).toBeNull();
  expect(screen.queryByTestId("route-card-dots")).toBeNull();
});

test("the photo comes a swipe after the drawing, its credit in two (TASK-350)", async () => {
  await render(
    <RouteCard
      width={173}
      line={SQUARE}
      map
      photo={{ source: { uri: "http://api.test/city-photos/Q1.jpg" }, credit: null }}
      title="Viana"
      detail="4.0 km away"
    />,
  );
  expect(screen.getByTestId("route-card-photo").props.source).toEqual({
    uri: "http://api.test/city-photos/Q1.jpg",
  });
  // The line first, the photo on the second page, two dots to say so; a
  // licence that asks for nothing, nothing written.
  const first = screen.getByTestId("route-card-first-page");
  const second = screen.getByTestId("route-card-second-page");
  expect(first.children.length).toBeGreaterThan(0);
  expect(within(first).queryByTestId("route-card-photo")).toBeNull();
  expect(within(second).getByTestId("route-card-photo")).toBeOnTheScreen();
  expect(second.children).toHaveLength(1);
  expect(screen.getByTestId("route-card-dots")).toBeOnTheScreen();
  expect(creditParts("© LBM1948 · CC BY-SA 4.0")).toEqual([
    "© LBM1948 ·",
    "CC BY-SA 4.0",
  ]);
  expect(creditParts("© A · B · CC BY 4.0")).toEqual(["© A · B ·", "CC BY 4.0"]);
  expect(creditParts("Public domain")).toEqual(["Public domain"]);
});

test("shows the drawing, what the route is, where, and how much it looks like the shape", async () => {
  await render(
    <RouteCard
      width={173}
      line={SQUARE}
      title="Star · 5.1 km"
      detail="Trento · 450 m away"
      match={0.996}
      onPress={jest.fn()}
    />,
  );
  expect(screen.getByText("Star · 5.1 km")).toBeOnTheScreen();
  expect(screen.getByText("Trento · 450 m away")).toBeOnTheScreen();
  expect(screen.getByText("100%")).toBeOnTheScreen();
  const drawing = screen.getByTestId("route-card-drawing");
  expect(drawing).toHaveStyle({ width: 173, height: 114 });
  // Four stretches, and the likeness over them.
  expect(drawing.children).toHaveLength(5);
  expect(screen.getByTestId("route-card")).toHaveStyle({ width: 173 });
});

test("a touch opens the route, and a screen reader hears what it is told", async () => {
  const onPress = jest.fn();
  await render(
    <RouteCard
      width={173}
      line={SQUARE}
      title="Star · 5.1 km"
      onPress={onPress}
      accessibilityLabel="star, 5 km, 450 m away"
    />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "star, 5 km, 450 m away" }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test("a swipe that ends on the card is not a touch", async () => {
  const onPress = jest.fn();
  await render(
    <RouteCard width={173} line={SQUARE} title="Star · 5.1 km" onPress={onPress} />,
  );
  const card = screen.getByRole("button");
  const at = (pageX: number, pageY: number) => ({ nativeEvent: { pageX, pageY } });

  // To the left on the last page, within the card: no page moves, the touch
  // ends here.
  await fireEvent(card, "pressIn", at(160, 300));
  await fireEvent.press(card, at(40, 300));
  expect(onPress).not.toHaveBeenCalled();

  // Just past what a tap may move.
  await fireEvent(card, "pressIn", at(160, 300));
  await fireEvent.press(card, at(160 - TAP_SLOP - 1, 300));
  expect(onPress).not.toHaveBeenCalled();

  // A finger that trembles has touched.
  await fireEvent(card, "pressIn", at(160, 300));
  await fireEvent.press(card, at(154, 304));
  expect(onPress).toHaveBeenCalledTimes(1);

  // The swipe before is forgotten: a touch with no finger seen coming down.
  await fireEvent(card, "pressIn", at(160, 300));
  await fireEvent.press(card, at(40, 300));
  await fireEvent.press(card, at(40, 300));
  expect(onPress).toHaveBeenCalledTimes(2);
});

test("a route not drawn yet is a card to read, not to touch", async () => {
  await render(<RouteCard width={161} line={null} title="Circle" detail="Drawing…" />);
  expect(screen.getByText("Circle")).toBeOnTheScreen();
  expect(screen.getByText("Drawing…")).toBeOnTheScreen();
  expect(screen.queryByRole("button")).toBeNull();
  // The place of the drawing is kept, empty: the card does not jump later.
  const drawing = screen.getByTestId("route-card-drawing");
  expect(drawing).toHaveStyle({ width: 161, height: 106 });
  expect(drawing.children).toHaveLength(0);
});

test("a map is named by what it frames, not by its route", () => {
  const camera = lineCamera(SQUARE, 173, 114, 12);
  expect(camera).not.toBeNull();
  expect(framingName(camera)).toMatch(/^card:46\.06500,11\.12500@\d+\.\d\d$/);
  // The same line the other way round: the same streets, the same picture.
  expect(framingName(lineCamera([...SQUARE].reverse(), 173, 114, 12))).toBe(
    framingName(camera),
  );
  // A larger card frames more closely: another picture.
  expect(framingName(lineCamera(SQUARE, 358, 236, 12))).not.toBe(framingName(camera));
  expect(framingName(null)).toBe("card");
});

test("without `map` no picture is asked for", async () => {
  await render(
    <>
      <FeedMapShooter width={358} height={222} />
      <RouteCard width={173} line={SQUARE} title="Star · 5.1 km" />
    </>,
  );
  expect(
    screen.queryByTestId("feed-map-page", { includeHiddenElements: true }),
  ).toBeNull();
  expect(screen.queryByTestId("route-card-map")).toBeNull();
});

test("a card not drawn yet asks for no map", async () => {
  await render(
    <>
      <FeedMapShooter width={358} height={222} />
      <RouteCard width={173} line={null} title="Circle" detail="Drawing…" map />
    </>,
  );
  expect(
    screen.queryByTestId("feed-map-page", { includeHiddenElements: true }),
  ).toBeNull();
});

test("with `map`, until its picture is taken the card is the line on the dark", async () => {
  await render(<RouteCard width={173} line={SQUARE} title="Star · 5.1 km" map />);
  expect(screen.queryByTestId("route-card-map")).toBeNull();
  expect(screen.getByTestId("route-card-drawing").children).toHaveLength(4);
});

test("with `map`, lays the map under the line", async () => {
  await render(
    <>
      <FeedMapShooter width={358} height={222} />
      <RouteCard width={173} line={SQUARE} title="Star · 5.1 km" match={0.97} map />
    </>,
  );
  const page = screen.getByTestId("feed-map-page", { includeHiddenElements: true });
  await fireEvent(page, "message", { nativeEvent: { data: '{"type":"ready"}' } });
  const picture = "data:image/jpeg;base64,AAAA";
  await fireEvent(page, "message", {
    nativeEvent: {
      data: JSON.stringify({
        type: "shot",
        key: `${framingName(lineCamera(SQUARE, 173, 114, 12))}:173x114`,
        image: picture,
      }),
    },
  });

  const drawing = screen.getByTestId("route-card-drawing");
  // The map, the four stretches, the likeness: the map first, so that
  // everything else is over it. Nothing written on it: its towns are read.
  expect(drawing.children).toHaveLength(6);
  const map = screen.getByTestId("route-card-map", { includeHiddenElements: true });
  expect(drawing.children[0]).toBe(map);
  expect(map).toHaveProp("source", { uri: picture });
  expect(map).toHaveStyle({ position: "absolute", left: 0, top: 0 });
});

test("the makers of the maps are named as they ask, once for the cards", async () => {
  expect(cardMapsCredit()).toBe(
    "Maps: OpenFreeMap © OpenMapTiles · Data from OpenStreetMap",
  );
  await render(<CardMapsCredit />);
  expect(screen.getByText(cardMapsCredit())).toBeOnTheScreen();
});

test("the large radius and no border, the words in the card's title style (TASK-339)", async () => {
  await render(
    <RouteCard
      width={173}
      line={SQUARE}
      title="Star · 5.1 km"
      detail="Trento · 450 m away"
      onPress={jest.fn()}
    />,
  );
  const card = screen.getByTestId("route-card");
  expect(card).toHaveStyle({ borderRadius: radius.xl, backgroundColor: color.surface });
  expect(
    (StyleSheet.flatten(card.props.style) as { borderWidth?: number }).borderWidth,
  ).toBeUndefined();
  expect(screen.getByText("Star · 5.1 km")).toHaveStyle({
    fontSize: font.cardTitle.fontSize,
    fontWeight: font.cardTitle.fontWeight,
    color: color.text,
  });
  expect(screen.getByText("Trento · 450 m away")).toHaveStyle({
    fontSize: font.detail.fontSize,
    color: color.textMuted,
  });
});

test("the card and its pages answer the finger through Tap (TASK-339)", async () => {
  // Seen, not run: an animation left running would spill into the next test.
  const timing = jest
    .spyOn(Animated, "timing")
    .mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  const down = { nativeEvent: { pageX: 100, pageY: 10 } };
  await render(
    <RouteCard width={173} line={SQUARE} title="Star" onPress={jest.fn()} />,
  );
  await fireEvent(screen.getByTestId("route-card"), "pressIn", down);
  expect(timing).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      toValue: 1,
      duration: motion.pressMs,
      useNativeDriver: true,
    }),
  );
  timing.mockClear();
  await render(
    <RouteCard
      width={173}
      line={SQUARE}
      photo={{ source: { uri: "http://api.test/city-photos/Q1.jpg" }, credit: null }}
      title="Viana"
      onPress={jest.fn()}
    />,
  );
  await fireEvent(screen.getByTestId("route-card-second-page"), "pressIn", down);
  expect(timing).toHaveBeenCalledTimes(1);
  timing.mockRestore();
});
