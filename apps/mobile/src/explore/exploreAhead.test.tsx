import type { LatLon } from "@shaperoute/shared-types";
import list from "@shaperoute/shared-types/fixtures/recommended-routes.json";
import { act, render, screen } from "@testing-library/react-native";

import { type BackgroundPriority, routeQueue } from "../api/routeQueue";
import type { RouteOutcome } from "../api/routes";
import { forgetFeedMaps } from "../feed/FeedMaps";
import type { Place } from "../places/photon";
import { forgetExamples } from "./exampleRoutes";
import {
  forgetExploreAhead,
  LIST_FRESH_MS,
  listAhead,
  listKey,
  prepareExplore,
} from "./exploreAhead";
import { ExploreScreen } from "./ExploreScreen";
import { forgetNearby, type NearbyCity } from "./nearbyCities";
import type { ListOutcome, RecommendedRoute } from "./recommendedRoutes";

/**
 * «Explore» prepared as the app opens (TASK-306): the list near the start,
 * the towns near it and their examples, before the page is opened.
 */

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

const API = "http://api.test";
const trento: LatLon = [46.0702, 11.1265];
const routes = list.routes as RecommendedRoute[];
const levico: NearbyCity = {
  label: "Levico Terme, Trentino, Italy",
  point: [46.0091, 11.3018],
  away_m: 15_000,
};

beforeEach(() => {
  forgetExploreAhead();
  forgetExamples();
  forgetNearby();
  forgetFeedMaps();
});

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function fakes(listOutcome: ListOutcome = { kind: "routes", routes }) {
  const fetchList = jest.fn(() => Promise.resolve(listOutcome));
  const fetchTowns = jest.fn(() => Promise.resolve<NearbyCity[] | null>([levico]));
  const stopped = jest.fn();
  const draw = jest.fn(
    (
      _api: string,
      _towns: readonly Place[],
      _options?: { queue?: { background: unknown } },
    ) => stopped,
  );
  return { fetchList, fetchTowns, draw, stopped };
}

test("the list near the start, the towns near it, then their examples", async () => {
  const { fetchList, fetchTowns, draw } = fakes();
  prepareExplore(API, trento, {
    fetchList: fetchList as never,
    fetchTowns: fetchTowns as never,
    draw: draw as never,
  });
  await settle();
  expect(fetchList).toHaveBeenCalledWith(API, trento, expect.anything());
  expect(fetchTowns).toHaveBeenCalledWith(API, trento, expect.anything());
  expect(draw).toHaveBeenCalledWith(API, [levico], expect.anything());
  expect(listAhead(listKey(API, trento))).toEqual(routes);
});

test("the towns' examples wait behind the page's in the app's queue", async () => {
  const { fetchList, fetchTowns, draw } = fakes();
  prepareExplore(API, trento, {
    fetchList: fetchList as never,
    fetchTowns: fetchTowns as never,
    draw: draw as never,
  });
  await settle();
  const queue = draw.mock.calls[0][2]?.queue as {
    background: (
      priority: BackgroundPriority,
      run: () => Promise<RouteOutcome>,
    ) => Promise<RouteOutcome>;
  };
  const background = jest.spyOn(routeQueue, "background");
  const run = jest.fn(() => Promise.resolve<RouteOutcome>({ kind: "cancelled" }));
  await queue.background("visible", run);
  // Asked as "visible" by the samples, sent as "prefetch".
  expect(background).toHaveBeenCalledWith("prefetch", run, undefined);
  expect(run).toHaveBeenCalled();
  background.mockRestore();
});

test("a list fetched ahead stands in for ten minutes, then the page asks", async () => {
  const { fetchList, fetchTowns, draw } = fakes();
  prepareExplore(API, trento, {
    fetchList: fetchList as never,
    fetchTowns: fetchTowns as never,
    draw: draw as never,
    now: () => 1000,
  });
  await settle();
  const key = listKey(API, trento);
  expect(listAhead(key, 1000 + LIST_FRESH_MS - 1)).toEqual(routes);
  expect(listAhead(key, 1000 + LIST_FRESH_MS)).toBeUndefined();
});

test("prepared twice: the list is not asked again while fresh", async () => {
  const { fetchList, fetchTowns, draw } = fakes();
  const options = {
    fetchList: fetchList as never,
    fetchTowns: fetchTowns as never,
    draw: draw as never,
  };
  prepareExplore(API, trento, options);
  await settle();
  prepareExplore(API, trento, options);
  await settle();
  expect(fetchList).toHaveBeenCalledTimes(1);
});

test("stopped before the towns come: nothing is drawn; after, the examples stop", async () => {
  const early = fakes();
  const stop = prepareExplore(API, trento, {
    fetchList: early.fetchList as never,
    fetchTowns: early.fetchTowns as never,
    draw: early.draw as never,
  });
  stop();
  await settle();
  expect(early.draw).not.toHaveBeenCalled();

  const late = fakes();
  const stopLate = prepareExplore(API, trento, {
    fetchList: late.fetchList as never,
    fetchTowns: late.fetchTowns as never,
    draw: late.draw as never,
  });
  await settle();
  stopLate();
  expect(late.stopped).toHaveBeenCalled();
});

test("a list that failed is not kept: the page asks for it", async () => {
  const { fetchList, fetchTowns, draw } = fakes({ kind: "failed" });
  prepareExplore(API, trento, {
    fetchList: fetchList as never,
    fetchTowns: fetchTowns as never,
    draw: draw as never,
  });
  await settle();
  expect(listAhead(listKey(API, trento))).toBeUndefined();
});

test("«Explore» opened after: its routes at once, the list not asked again", async () => {
  const fetchMock = jest.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);
    return Promise.resolve(
      url.includes("/recommended-routes")
        ? Response.json({ routes })
        : url.includes("/nearby-cities")
          ? Response.json({ places: [] })
          : Response.json({}, { status: 404 }),
    );
  });
  prepareExplore(API, trento, { draw: jest.fn(() => () => {}) as never });
  await settle();
  const asked = () =>
    fetchMock.mock.calls.filter(([url]) => String(url).includes("/recommended-routes"))
      .length;
  expect(asked()).toBe(1);
  await render(
    <ExploreScreen apiUrl={API} near={trento} onBack={jest.fn()} onOpen={jest.fn()} />,
  );
  await act(async () => {});
  expect(screen.queryByText("Loading routes…")).toBeNull();
  expect(screen.getAllByText(new RegExp(routes[0].city, "i")).length).toBeGreaterThan(
    0,
  );
  expect(asked()).toBe(1);
  fetchMock.mockRestore();
});
