import type { LatLon } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { lineCamera } from "../feed/feedMapPage";
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

test("a photo takes the drawing's place, with its credit in two (TASK-283)", async () => {
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
  // No line, no map; a licence that asks for nothing, nothing written.
  const drawing = screen.getByTestId("route-card-drawing");
  expect(drawing.children).toHaveLength(1);
  expect(screen.queryByTestId("route-card-map")).toBeNull();
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
