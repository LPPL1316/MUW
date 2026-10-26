import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { forgetFeedMaps } from "../feed/FeedMaps";
import type { RecommendedRoute } from "../explore/recommendedRoutes";
import { cardMapsCredit } from "../explore/RouteCard";
import { saveLanguageChoice } from "../i18n/language";
import { NearYou } from "./NearYou";
import type { NearCard } from "./nearYouShapes";

/**
 * The row under the distance of «Draw» (TASK-306). What fills it is in
 * nearYouShapes.test.ts.
 */

function route(shape: string, city: string): RecommendedRoute {
  return {
    id: `${city || "near-you"}:${shape}`,
    city,
    shape,
    word: null,
    style: null,
    distance_m: 5000,
    route_m: 5200,
    similarity: 0.93,
    start: [46.07, 11.12],
    away_m: 0,
    preview: [
      [46.07, 11.12],
      [46.08, 11.13],
      [46.07, 11.14],
    ],
  };
}

const heartNear: NearCard = {
  shape: "heart",
  near: true,
  status: "ready",
  route: route("heart", ""),
};
const starDrawing: NearCard = { shape: "star", near: true, status: "drawing" };
const moonInRome: NearCard = {
  shape: "moon",
  near: false,
  status: "ready",
  route: route("moon", "Roma"),
};

beforeEach(() => {
  forgetFeedMaps();
});
afterEach(() => saveLanguageChoice("phone"));

/** Rendered, and the maps under the cards asked for. */
async function shown(element: React.ReactElement) {
  const view = await render(element);
  await act(async () => {});
  return view;
}

test("«NEAR YOU»: the shapes near, one still drawn, and one of another city", async () => {
  const onOpen = jest.fn();
  await shown(<NearYou cards={[heartNear, starDrawing, moonInRome]} onOpen={onOpen} />);
  expect(screen.getByText("NEAR YOU")).toBeOnTheScreen();
  expect(screen.getByText("Heart · 5.2 km")).toBeOnTheScreen();
  expect(screen.getByText("Star")).toBeOnTheScreen();
  expect(screen.getByText("Drawing…")).toBeOnTheScreen();
  // Another city's says which.
  expect(screen.getByText("Moon · 5.2 km")).toBeOnTheScreen();
  expect(screen.getByText("Roma")).toBeOnTheScreen();
  expect(screen.getByText(cardMapsCredit())).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText("Moon, 5.2 km, Roma"));
  expect(onOpen).toHaveBeenCalledWith(moonInRome.route);
  await fireEvent.press(screen.getByLabelText("Heart, 5.2 km"));
  expect(onOpen).toHaveBeenLastCalledWith(heartNear.route);
});

test("all of other cities: «SHAPES TO TRY»", async () => {
  await shown(<NearYou cards={[moonInRome]} onOpen={jest.fn()} />);
  expect(screen.getByText("SHAPES TO TRY")).toBeOnTheScreen();
  expect(screen.queryByText("NEAR YOU")).toBeNull();
});

test("still drawn, a card does not open and the maps are not credited", async () => {
  const onOpen = jest.fn();
  await shown(<NearYou cards={[starDrawing]} onOpen={onOpen} />);
  await fireEvent.press(screen.getByText("Star"));
  expect(onOpen).not.toHaveBeenCalled();
  expect(screen.queryByText(cardMapsCredit())).toBeNull();
});

test("no cards, no row", async () => {
  await shown(<NearYou cards={[]} onOpen={jest.fn()} />);
  expect(screen.queryByText("NEAR YOU")).toBeNull();
  expect(screen.queryByText("SHAPES TO TRY")).toBeNull();
});

test("in Italian", async () => {
  saveLanguageChoice("it");
  await shown(<NearYou cards={[heartNear]} onOpen={jest.fn()} />);
  expect(screen.getByText("VICINO A TE")).toBeOnTheScreen();
});
