import list from "@shaperoute/shared-types/fixtures/recommended-routes.json";
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { forgetFeedMaps } from "../feed/FeedMaps";
import { shapeLabel } from "../feed/FeedPost";
import type { Place } from "../places/photon";
import {
  DRAW_ORDER,
  EXAMPLE_SHAPES,
  EXAMPLE_WORDS,
  forgetExamples,
  MORE_SHAPES,
  wordOrder,
} from "./exampleRoutes";
import { ExploreScreen, ownCityName } from "./ExploreScreen";
import type { RecommendedRoute } from "./recommendedRoutes";

// The shapes «Explore» draws besides a city's first three (TASK-176): after
// them where the city has no routes, and added to its routes where it has.
// Apart from ExploreScreen.test.tsx, which stays as large as it was: with
// no cache jest runs the largest files first, and the first render of a
// file started while React Native was still being loaded for the others
// took its first test past five seconds in CI.

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

const fetchMock = jest.spyOn(globalThis, "fetch");
const routes = list.routes as RecommendedRoute[];
/** The last shape drawn for a city: when its card is there, all are. */
const LAST = MORE_SHAPES[MORE_SHAPES.length - 1];
/** The last word written after them (TASK-279): the same for the words. */
const LAST_WORD = wordOrder(EXAMPLE_WORDS).at(-1);

beforeEach(() => {
  fetchMock.mockReset();
  forgetExamples();
  forgetFeedMaps();
});

afterAll(() => {
  forgetExamples();
  fetchMock.mockRestore();
});

const vercelli: Place = {
  label: "Vercelli, Piedmont, Italy",
  point: [45.3252, 8.4228],
};

/** The API: an empty catalog here, and every route done at once. */
function emptyCatalog(input: RequestInfo | URL): Promise<Response> {
  return Promise.resolve(
    String(input).includes("/recommended-routes")
      ? Response.json({ routes: [] })
      : Response.json(jobDone, { status: 202 }),
  );
}

/** The shapes asked, and the words after them (TASK-279). */
function routeJobShapes(): (string | undefined)[] {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).endsWith("/route-jobs"))
    .map(([, init]) => {
      const body = JSON.parse(String(init?.body));
      return body.shape ?? body.word;
    });
}

/** Every text on the screen, top to bottom. */
function texts(): string[] {
  return screen.getAllByText(/./).map((node) => String(node.props.children));
}

test("after the first three examples, other shapes while they are looked at", async () => {
  fetchMock.mockImplementation(emptyCatalog);
  const onOpen = jest.fn();
  await render(
    <ExploreScreen
      apiUrl="http://api"
      near={null}
      onOpen={onOpen}
      city={vercelli}
      onCity={jest.fn()}
    />,
  );
  const card = await screen.findByLabelText(new RegExp(`^${shapeLabel(LAST)}, `));
  // Then the words, in their row (TASK-279).
  expect(await screen.findByLabelText(new RegExp(`^${LAST_WORD}, `))).toBeOnTheScreen();
  expect(routeJobShapes()).toEqual([...DRAW_ORDER, ...wordOrder(EXAMPLE_WORDS)]);
  expect(screen.getByText("WORDS")).toBeOnTheScreen();
  expect(screen.getAllByTestId("route-card")).toHaveLength(
    EXAMPLE_SHAPES.length + MORE_SHAPES.length + EXAMPLE_WORDS.length,
  );
  await fireEvent.press(card);
  expect(onOpen.mock.calls[0][0]).toMatchObject({ shape: LAST, city: "Vercelli" });
});

/** The fixture's routes in `vercelli`: the phone measures how far they are. */
const atVercelli = {
  routes: routes.map((r) => ({
    ...r,
    start: [vercelli.point[0] + r.away_m / 111_195, vercelli.point[1]],
  })),
};

/** The API with the catalog of the fixture, and every route done at once. */
function catalog(input: RequestInfo | URL): Promise<Response> {
  return Promise.resolve(
    String(input).includes("/recommended-routes")
      ? Response.json(atVercelli)
      : Response.json(jobDone, { status: 202 }),
  );
}

test("a city with recommended routes: the shapes it lacks join its cards", async () => {
  fetchMock.mockImplementation(catalog);
  const onOpen = jest.fn();
  await render(
    <ExploreScreen
      apiUrl="http://api"
      near={null}
      onBack={jest.fn()}
      onOpen={onOpen}
      city={vercelli}
      onCity={jest.fn()}
    />,
  );
  expect(await screen.findByText("Star · 5.1 km")).toBeOnTheScreen();
  const card = await screen.findByLabelText(
    new RegExp(`^${LAST.replace(/_/g, " ")}, `),
  );
  expect(await screen.findByLabelText(new RegExp(`^${LAST_WORD}, `))).toBeOnTheScreen();
  // The catalog has a star and hearts: asked are the circle, then the others;
  // and it has CIAO, so the words but that one (TASK-279).
  const written = wordOrder(EXAMPLE_WORDS).filter((word) => word !== "CIAO");
  expect(routeJobShapes()).toEqual(["circle", ...MORE_SHAPES, ...written]);
  // One grid: the city's routes first, then what was drawn now; under it
  // the row of the words.
  expect(screen.getAllByTestId("route-card")).toHaveLength(
    routes.length + 1 + MORE_SHAPES.length + written.length,
  );
  expect(texts().indexOf("WORDS")).toBeGreaterThan(
    texts().findIndex((text) => text.startsWith("Circle · ")),
  );
  const order = texts();
  expect(order.findIndex((text) => text.startsWith("Circle · "))).toBeGreaterThan(
    order.indexOf("CIAO · 15.2 km"),
  );
  // As the city's own cards: the shape and the km, the city and how far,
  // and the city named as its own routes name it (the fixture's are Trento's).
  expect(screen.queryByText(/^Vercelli · /)).toBeNull();
  expect(screen.getAllByText(/^Trento · .* away$/)).toHaveLength(
    routes.length + 1 + MORE_SHAPES.length,
  );
  // No section of examples, and nothing to wait for with the feed.
  expect(screen.queryByText("EXAMPLES IN VERCELLI")).toBeNull();
  expect(screen.queryByText("MEANWHILE, FROM THE FEED")).toBeNull();
  await fireEvent.press(card);
  expect(onOpen.mock.calls[0][0]).toMatchObject({ shape: LAST, city: "trento" });
});

test("the name of a city for the shapes added to its routes", () => {
  // The route starting nearest the centre names the city...
  expect(ownCityName(routes)).toBe("trento");
  // ...unless even that one starts in another town: then the search's name.
  expect(ownCityName(routes.map((r) => ({ ...r, away_m: r.away_m + 2500 })))).toBe(
    undefined,
  );
  expect(ownCityName([])).toBe(undefined);
});

test("a city with recommended routes: the shape being drawn is the next card", async () => {
  // The catalog answers; the first route never does.
  fetchMock.mockImplementation((input) =>
    String(input).includes("/recommended-routes")
      ? Promise.resolve(Response.json(atVercelli))
      : new Promise<Response>(() => {}),
  );
  await render(
    <ExploreScreen
      apiUrl="http://api"
      near={null}
      onOpen={jest.fn()}
      city={vercelli}
      onCity={jest.fn()}
    />,
  );
  expect(await screen.findByText("Circle")).toBeOnTheScreen();
  expect(screen.getByText("Drawing…")).toBeOnTheScreen();
  // Only that one: the shapes after it are not announced.
  expect(screen.getAllByTestId("route-card")).toHaveLength(routes.length + 1);
  expect(routeJobShapes()).toEqual(["circle"]);
});

test("a city's shapes that fail say nothing when it has routes of its own", async () => {
  fetchMock.mockImplementation((input) =>
    Promise.resolve(
      String(input).includes("/recommended-routes")
        ? Response.json(atVercelli)
        : Response.json(
            {
              error: {
                code: "shape_not_drawable",
                message: "no",
                suggested_distance_m: null,
              },
            },
            { status: 422 },
          ),
    ),
  );
  await render(
    <ExploreScreen
      apiUrl="http://api"
      near={null}
      onOpen={jest.fn()}
      city={vercelli}
      onCity={jest.fn()}
    />,
  );
  await screen.findByText("Star · 5.1 km");
  // The words too, but CIAO, the catalog's (TASK-279): none, and no row.
  const words = wordOrder(EXAMPLE_WORDS).filter((word) => word !== "CIAO");
  await waitFor(() =>
    expect(routeJobShapes()).toEqual(["circle", ...MORE_SHAPES, ...words]),
  );
  expect(screen.getAllByTestId("route-card")).toHaveLength(routes.length);
  expect(screen.queryByText("WORDS")).toBeNull();
  expect(screen.queryByText("Try again")).toBeNull();
  expect(screen.queryByText("Not drawn")).toBeNull();
});

test("near the start, with no city chosen, nothing is drawn", async () => {
  fetchMock.mockImplementation(catalog);
  await render(
    <ExploreScreen
      apiUrl="http://api"
      near={[46.067, 11.1215]}
      onOpen={jest.fn()}
      onCity={jest.fn()}
    />,
  );
  await screen.findByText("Star · 5.1 km");
  expect(routeJobShapes()).toEqual([]);
  expect(screen.getAllByTestId("route-card")).toHaveLength(routes.length);
});
