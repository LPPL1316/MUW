import type { RouteResult } from "@shaperoute/shared-types";
import activities from "@shaperoute/shared-types/fixtures/activities.json";
import favorites from "@shaperoute/shared-types/fixtures/favorites.json";
import detail from "@shaperoute/shared-types/fixtures/recommended-route.json";
import listed from "@shaperoute/shared-types/fixtures/recommended-routes.json";
import { act, render, screen } from "@testing-library/react-native";

import { runFacts } from "../activities/activityText";
import type { Favorite } from "../api/favorites";
import type { RouteOutcome } from "../api/routes";
import { type Explored, optionsOf } from "../explore/explored";
import { ExploredCard } from "../explore/ExploredCard";
import { awayText, kmLabel } from "../explore/ExploreScreen";
import { forgetNearby } from "../explore/nearbyCities";
import { forgetSamples } from "../explore/nearbySamples";
import { NearbyTowns } from "../explore/NearbyTowns";
import {
  isRecommendedList,
  type RecommendedRouteDetail,
} from "../explore/recommendedRoutes";
import { favoriteHeading } from "../favorites/favoriteRoute";
import { forgetFeedMaps } from "../feed/FeedMaps";
import { saveLanguageChoice } from "../i18n/language";
import { saveUnitsChoice } from "./units";

/**
 * What the app's free pages write once «Settings» says miles (TASK-182,
 * part A): «My activities», «Favorites» and the cards of «Explore». Their
 * own tests say what they write in kilometres, unchanged.
 */

const [STAR, FREE] = activities.activities;
const [KEPT_STAR, KEPT_WORD] = favorites.favorites as Favorite[];
const [route] = isRecommendedList(listed) ? listed.routes : [];
const whole = detail as RecommendedRouteDetail;

const API = "http://api.test";
const CALDONAZZO: [number, number] = [46.0036, 11.2647];
const TOWNS = [
  {
    label: "Levico Terme, Trentino – Alto Adige/Südtirol, Italy",
    point: [46.0091259, 11.3017774],
    away_m: 2929,
  },
  {
    label: "Trento, Trentino – Alto Adige/Südtirol, Italy",
    // 20 km north of the start: the phone measures the distance (TASK-254).
    point: [46.18347, 11.2647],
    away_m: 20_000,
  },
];
const townsApi = jest.fn(() =>
  Promise.resolve(Response.json({ places: TOWNS })),
) as never as typeof fetch;
/** A request that never answers: the cards stay as they start. */
const never = jest.fn(() => new Promise<RouteOutcome>(() => {})) as never;

beforeEach(() => {
  forgetNearby();
  forgetSamples();
  forgetFeedMaps();
});

afterEach(async () => {
  await act(async () => {
    saveUnitsChoice("phone");
    saveLanguageChoice("phone");
  });
});

test("a run of «My activities» says miles and minutes a mile", () => {
  expect(runFacts(STAR)).toBe("4.01 km · 19:00 · 4:45 /km");
  saveUnitsChoice("mi");
  expect(runFacts(STAR)).toBe("2.49 mi · 19:00 · 7:38 /mi");
  expect(runFacts(FREE)).toBe("1.44 mi · 13:35 · 9:28 /mi");
  // Too short for a pace: the first strides say nothing.
  expect(runFacts({ distance_m: 77, duration_s: 30 })).toBe("0.05 mi · 0:30");
});

test("a favorite's card says miles", () => {
  saveUnitsChoice("mi");
  expect(favoriteHeading(KEPT_STAR)).toBe("Star · 3.2 mi");
  expect(favoriteHeading(KEPT_WORD)).toBe("CIAO · 7.8 mi");
  saveLanguageChoice("it");
  expect(favoriteHeading(KEPT_STAR)).toBe("Stella · 3,2 mi");
});

test("a route of «Explore» says how long it is and how far in miles, or feet", () => {
  saveUnitsChoice("mi");
  expect(kmLabel(21_000)).toBe("13 mi");
  expect(awayText(200)).toBe("650 ft away");
  expect(awayText(640)).toBe("0.4 mi away");
  expect(awayText(3372)).toBe("2.1 mi away");
});

test("in kilometres every page reads as before the units, in Italian too", () => {
  saveLanguageChoice("it");
  // A run's distance has a point in every language, as on the run's screen.
  expect(runFacts(STAR)).toBe("4.01 km · 19:00 · 4:45 /km");
  // The favorites already wrote the comma.
  expect(favoriteHeading(KEPT_STAR)).toBe("Stella · 5,1 km");
  // «Explore» is in Italian, with the comma, in miles too (TASK-210, part H).
  expect(awayText(1440)).toBe("a 1,4 km");
  expect(awayText(640)).toBe("a 640 m");
  expect(kmLabel(21_000)).toBe("21 km");
  saveUnitsChoice("mi");
  expect(awayText(1440)).toBe("a 0,9 mi");
});

test("the towns nearby turn to miles at once, and back", async () => {
  await render(
    <NearbyTowns
      apiUrl={API}
      near={CALDONAZZO}
      width={360}
      onCity={jest.fn()}
      fetchFn={townsApi}
      request={never}
    />,
  );
  await act(async () => {});
  expect(await screen.findByText("2.9 km away · Drawing…")).toBeOnTheScreen();
  expect(screen.getByLabelText("Trento, 20 km away")).toBeOnTheScreen();

  await act(async () => saveUnitsChoice("mi"));
  expect(screen.getByText("1.8 mi away · Drawing…")).toBeOnTheScreen();
  expect(screen.getByLabelText("Levico Terme, 1.8 mi away")).toBeOnTheScreen();
  expect(screen.getByLabelText("Trento, 12 mi away")).toBeOnTheScreen();
  expect(screen.queryByText(/km away/)).toBeNull();

  // In Italian (the app's root follows the language; here the units do).
  saveLanguageChoice("it");
  await act(async () => saveUnitsChoice("km"));
  expect(screen.getByLabelText("Levico Terme, a 2,9 km")).toBeOnTheScreen();
  await act(async () => saveUnitsChoice("mi"));
  expect(screen.getByLabelText("Levico Terme, a 1,8 mi")).toBeOnTheScreen();
  expect(screen.getByText("a 12 mi · Disegno in corso…")).toBeOnTheScreen();
});

test("a route of «Explore» open on the map says its miles at once", async () => {
  const [option] = optionsOf(route, whole, []);
  const explored: Explored = {
    status: "done",
    ...option,
    choices: [option.result as RouteResult],
    chosen: 0,
    choose: jest.fn(),
    others: [],
  };
  await render(
    <ExploredCard
      explored={explored}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onList={jest.fn()}
      start={{ status: "idle" }}
      onStart={jest.fn()}
    />,
  );
  expect(screen.getByText("5.1 km")).toBeOnTheScreen();
  await act(async () => saveUnitsChoice("mi"));
  expect(screen.getByText("3.2 mi")).toBeOnTheScreen();
  expect(screen.queryByText("5.1 km")).toBeNull();
});
