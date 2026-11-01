import { fireEvent, render, screen } from "@testing-library/react-native";
import { Animated, StyleSheet } from "react-native";

import { color, font, fontWeight, motion, radius } from "../theme/tokens";
import { FeedMapShooter, forgetFeedMaps } from "./FeedMaps";
import { FeedPost, MAP_CREDIT, postFacts, shapeLabel } from "./FeedPost";
import type { SamplePost } from "./sampleFeed";

const POST: SamplePost = {
  id: "firenze-dog_head-10000-4",
  user: "fede_km",
  title: "Dog walk, without the dog",
  city: "firenze",
  shape: "dog_head",
  route_m: 10514,
  minutes: 64,
  score: 92,
  // A square: four stretches to draw.
  line: [
    [43.77, 11.25],
    [43.77, 11.26],
    [43.78, 11.26],
    [43.78, 11.25],
    [43.77, 11.25],
  ],
};

beforeEach(() => {
  forgetFeedMaps();
});

test("a shape is written as it is read", () => {
  expect(shapeLabel("dog_head")).toBe("Dog head");
  expect(shapeLabel("moon")).toBe("Moon");
});

test("the facts of a drawing: what, how far, how long", () => {
  expect(postFacts(POST)).toBe("Dog head · 10.5 km · 1 h 04 min · 6:05 /km · 762 kcal");
  expect(postFacts({ ...POST, shape: "moon", route_m: 4884, minutes: 27 })).toBe(
    "Moon · 4.9 km · 27 min · 5:32 /km · 354 kcal",
  );
});

test("shows who ran it and where, the title and the facts", async () => {
  await render(<FeedPost post={POST} width={358} />);
  expect(screen.getByText("fede_km")).toBeOnTheScreen();
  expect(screen.getByText("F")).toBeOnTheScreen();
  expect(screen.getByText("Firenze")).toBeOnTheScreen();
  expect(screen.getByText("Dog walk, without the dog")).toBeOnTheScreen();
  expect(
    screen.getByText("Dog head · 10.5 km · 1 h 04 min · 6:05 /km · 762 kcal"),
  ).toBeOnTheScreen();
});

test("writes no score over the drawing", async () => {
  await render(<FeedPost post={POST} width={358} />);
  expect(screen.queryByText("92")).toBeNull();
  expect(screen.queryByText("out of 100")).toBeNull();
});

test("draws the line, one view for each stretch, as wide as the card", async () => {
  await render(<FeedPost post={POST} width={358} />);
  const drawing = screen.getByTestId("feed-drawing");
  expect(drawing).toHaveStyle({ width: 358, height: 222 });
  // Four stretches, and nothing over them.
  expect(drawing.children).toHaveLength(4);
});

test("until its picture is taken there is no map, and no credit for one", async () => {
  await render(<FeedPost post={POST} width={358} />);
  expect(screen.queryByTestId("feed-map")).toBeNull();
  expect(screen.queryByText(MAP_CREDIT)).toBeNull();
});

test("lays the map under the line, and says whose it is", async () => {
  await render(
    <>
      <FeedMapShooter width={358} height={222} />
      <FeedPost post={POST} width={358} />
    </>,
  );
  const page = screen.getByTestId("feed-map-page", { includeHiddenElements: true });
  await fireEvent(page, "message", { nativeEvent: { data: '{"type":"ready"}' } });
  const picture = "data:image/jpeg;base64,AAAA";
  await fireEvent(page, "message", {
    nativeEvent: {
      data: JSON.stringify({
        type: "shot",
        key: "firenze-dog_head-10000-4:358x222",
        image: picture,
      }),
    },
  });

  const drawing = screen.getByTestId("feed-drawing");
  // The map, the four stretches, the credit: the map first, so that
  // everything else is over it.
  expect(drawing.children).toHaveLength(6);
  const map = screen.getByTestId("feed-map", { includeHiddenElements: true });
  expect(drawing.children[0]).toBe(map);
  expect(map).toHaveProp("source", { uri: picture });
  expect(map).toHaveStyle({ position: "absolute", left: 0, top: 0 });
  // The makers of the map, named as they ask.
  expect(MAP_CREDIT).toContain("OpenFreeMap");
  expect(MAP_CREDIT).toContain("© OpenMapTiles");
  expect(MAP_CREDIT).toContain("OpenStreetMap");
  expect(screen.getByText(MAP_CREDIT)).toBeOnTheScreen();
});

test("a screen reader hears the drawing as one thing", async () => {
  await render(<FeedPost post={POST} width={358} />);
  expect(
    screen.getByLabelText(
      "fede_km in Firenze: Dog walk, without the dog. Dog head · 10.5 km · 1 h 04 min · 6:05 /km · 762 kcal.",
    ),
  ).toBeOnTheScreen();
});

test("with nowhere to open it, the drawing is not a button", async () => {
  await render(<FeedPost post={POST} width={358} />);
  expect(screen.queryByRole("button")).toBeNull();
});

test("a tap opens its route, and a screen reader hears where it leads", async () => {
  const onOpen = jest.fn();
  await render(<FeedPost post={POST} width={358} onOpen={onOpen} />);
  const card = screen.getByRole("button", {
    name: "fede_km in Firenze: Dog walk, without the dog. Dog head · 10.5 km · 1 h 04 min · 6:05 /km · 762 kcal.",
  });
  expect(card).toHaveProp("accessibilityHint", "Opens the route on the map");
  await fireEvent.press(card);
  expect(onOpen).toHaveBeenCalledTimes(1);
});

test("the large radius and no border; the names medium; the finger answered through Tap (TASK-339)", async () => {
  // Seen, not run: an animation left running would spill into the next test.
  const timing = jest
    .spyOn(Animated, "timing")
    .mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  await render(<FeedPost post={POST} width={358} onOpen={jest.fn()} />);
  const card = screen.getByTestId("feed-post");
  expect(card).toHaveStyle({ borderRadius: radius.xl, backgroundColor: color.surface });
  expect(
    (StyleSheet.flatten(card.props.style) as { borderWidth?: number }).borderWidth,
  ).toBeUndefined();
  expect(screen.getByText("F")).toHaveStyle({ fontWeight: fontWeight.medium });
  expect(screen.getByText("fede_km")).toHaveStyle({ fontWeight: fontWeight.medium });
  expect(screen.getByText("Dog walk, without the dog")).toHaveStyle({
    fontSize: font.cardTitle.fontSize,
    fontWeight: font.cardTitle.fontWeight,
  });
  // Pressed, the card shrinks and dims in `motion.pressMs`, on the native driver.
  await fireEvent(card, "pressIn", { nativeEvent: { pageX: 80, pageY: 300 } });
  expect(timing).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      toValue: 1,
      duration: motion.pressMs,
      useNativeDriver: true,
    }),
  );
  timing.mockRestore();
});

test("a swipe that ends on the card is not a tap", async () => {
  const onOpen = jest.fn();
  await render(<FeedPost post={POST} width={358} onOpen={onOpen} />);
  const card = screen.getByRole("button");
  const at = (pageX: number, pageY: number) => ({ nativeEvent: { pageX, pageY } });

  // Across the card, on the first page: no page moves, the touch ends here.
  await fireEvent(card, "pressIn", at(80, 300));
  await fireEvent.press(card, at(340, 300));
  expect(onOpen).not.toHaveBeenCalled();

  // A finger that trembles has tapped.
  await fireEvent(card, "pressIn", at(80, 300));
  await fireEvent.press(card, at(86, 304));
  expect(onOpen).toHaveBeenCalledTimes(1);
});

describe("a drawing on the water (TASK-228)", () => {
  const PADDLED: SamplePost = {
    ...POST,
    id: "example:dog_head:paddling:44.0035,12.6634",
    user: "ale.paddle",
    title: "Dog paddle off Riccione",
    city: "Riccione",
    route_m: 2000,
    minutes: 30,
    score: 89,
    activity: "paddling",
  };

  test("says its sport before the facts, on the card and to who listens", async () => {
    expect(postFacts(PADDLED)).toBe(
      "Paddle · Dog head · 2.0 km · 30 min · 7:30 /500 m",
    );
    await render(<FeedPost post={PADDLED} width={358} onOpen={() => {}} />);
    expect(screen.getByText("Riccione")).toBeOnTheScreen();
    expect(
      screen.getByText("Paddle · Dog head · 2.0 km · 30 min · 7:30 /500 m"),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button")).toHaveAccessibleName(
      "ale.paddle in Riccione: Dog paddle off Riccione. Paddle · Dog head · 2.0 km · 30 min · 7:30 /500 m.",
    );
  });

  test("a shape in pieces: no line where the pen is up", async () => {
    // The pen comes to the third point without drawing.
    await render(<FeedPost post={{ ...PADDLED, gaps: [2] }} width={358} />);
    // Three stretches of the four.
    expect(screen.getByTestId("feed-drawing").children).toHaveLength(3);
  });
});
