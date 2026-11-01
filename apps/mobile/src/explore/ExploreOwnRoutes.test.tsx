import list from "@shaperoute/shared-types/fixtures/recommended-routes.json";
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { forgetFeedMaps } from "../feed/FeedMaps";
import type { Place } from "../places/photon";
import { forgetExamples, MORE_SHAPES } from "./exampleRoutes";
import { ExploreScreen } from "./ExploreScreen";
import type { RecommendedRoute } from "./recommendedRoutes";
import { cardMapsCredit } from "./RouteCard";

// A chosen place's own routes and its neighbours' (TASK-192): Caldonazzo has
// Levico's catalog within "near you", and none of it starts in Caldonazzo.
// In a file of its own, as ExploreMoreShapes.test.tsx says why.

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

const fetchMock = jest.spyOn(globalThis, "fetch");
const routes = list.routes as RecommendedRoute[];
/** The last shape drawn for a city: when its card is there, all are. */
const LAST = MORE_SHAPES[MORE_SHAPES.length - 1];

beforeEach(() => {
  fetchMock.mockReset();
  forgetExamples();
  forgetFeedMaps();
});

afterAll(() => {
  forgetExamples();
  fetchMock.mockRestore();
});

const caldonazzo: Place = {
  label: "Caldonazzo, Trentino-Alto Adige, Italy",
  point: [45.9944, 11.2639],
};
/** Levico's catalog as Caldonazzo sees it: every start in the other town. */
const levico = routes.map((r) => ({ ...r, city: "levico", away_m: r.away_m + 3336 }));

/** The API with `catalog` near the place, and every route done at once. */
function withCatalog(catalog: RecommendedRoute[]) {
  return (input: RequestInfo | URL): Promise<Response> =>
    Promise.resolve(
      String(input).includes("/recommended-routes")
        ? Response.json({ routes: catalog })
        : Response.json(jobDone, { status: 202 }),
    );
}

function routeJobShapes(): (string | undefined)[] {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).endsWith("/route-jobs"))
    .map(([, init]) => JSON.parse(String(init?.body)).shape);
}

/** Every text on the screen, top to bottom. */
function texts(): string[] {
  return screen.getAllByText(/./).map((node) => String(node.props.children));
}

test("a town beside another: its own examples first, the neighbour's routes under them", async () => {
  fetchMock.mockImplementation(withCatalog(levico));
  const onOpen = jest.fn();
  await render(
    <ExploreScreen
      apiUrl="http://api"
      near={null}
      onOpen={onOpen}
      city={caldonazzo}
      onCity={jest.fn()}
    />,
  );
  // The town's own: heart, circle and star from its centre, though the
  // neighbour has a star and hearts.
  expect(await screen.findByText("EXAMPLES IN CALDONAZZO")).toBeOnTheScreen();
  const heart = await screen.findByLabelText(/^Heart, /);
  await screen.findByLabelText(/^Star, /);
  expect(routeJobShapes().slice(0, 3)).toEqual(["circle", "heart", "star"]);
  await fireEvent.press(heart);
  expect(onOpen.mock.calls[0][0]).toMatchObject({ shape: "heart", city: "Caldonazzo" });
  // The neighbour's, every one, under a label of their own.
  expect(screen.getAllByText(/^Levico · .* km away$/)).toHaveLength(levico.length);
  const order = texts();
  expect(order.indexOf("NEAR CALDONAZZO")).toBeGreaterThan(
    order.indexOf("EXAMPLES IN CALDONAZZO"),
  );
  expect(order.indexOf("CIAO · 15.2 km")).toBeGreaterThan(
    order.indexOf("NEAR CALDONAZZO"),
  );
  // Something to look at is already there: no feed, and the credit once.
  expect(screen.queryByText("MEANWHILE, FROM THE FEED")).toBeNull();
  expect(screen.getAllByText(cardMapsCredit())).toHaveLength(1);
});

test("a town beside another: the neighbour's routes are there while its own are drawn", async () => {
  // The catalog answers; the first route never does.
  fetchMock.mockImplementation((input) =>
    String(input).includes("/recommended-routes")
      ? Promise.resolve(Response.json({ routes: levico }))
      : new Promise<Response>(() => {}),
  );
  await render(
    <ExploreScreen
      apiUrl="http://api"
      near={null}
      onOpen={jest.fn()}
      city={caldonazzo}
      onCity={jest.fn()}
    />,
  );
  expect(await screen.findByText("NEAR CALDONAZZO")).toBeOnTheScreen();
  expect(screen.getByText("EXAMPLES IN CALDONAZZO")).toBeOnTheScreen();
  expect(screen.getByText("Drawing…")).toBeOnTheScreen();
  expect(screen.getAllByText(/^Levico · .* km away$/)).toHaveLength(levico.length);
  // Their maps have the credit, before any example has it.
  expect(screen.getAllByText(cardMapsCredit())).toHaveLength(1);
  expect(screen.queryByText("MEANWHILE, FROM THE FEED")).toBeNull();
});

test("a hamlet of the neighbour is a place of its own too", async () => {
  // Barco, 2.8 km from Levico's centre: a place, as the suggestions give it.
  const barco: Place = {
    label: "Barco, Levico Terme, Italy",
    point: [46.0003, 11.3306],
    kind: "place",
  };
  fetchMock.mockImplementation(withCatalog(levico));
  await render(
    <ExploreScreen
      apiUrl="http://api"
      near={null}
      onOpen={jest.fn()}
      city={barco}
      onCity={jest.fn()}
    />,
  );
  expect(await screen.findByText("EXAMPLES IN BARCO")).toBeOnTheScreen();
  await screen.findByLabelText(/^Heart, /);
  expect(screen.getByText("NEAR BARCO")).toBeOnTheScreen();
  expect(screen.getAllByText(/^Levico · .* km away$/)).toHaveLength(levico.length);
});

test("a city with routes of its own: a neighbour's come after them, under the label", async () => {
  const vercelli: Place = {
    label: "Vercelli, Piedmont, Italy",
    point: [45.3252, 8.4228],
  };
  // The phone measures how far they are: the fixture's routes, in Vercelli.
  fetchMock.mockImplementation(
    withCatalog(
      routes.map((r) => ({
        ...r,
        start: [vercelli.point[0] + r.away_m / 111_195, vercelli.point[1]],
      })),
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
  await screen.findByLabelText(new RegExp(`^${LAST.replace(/_/g, " ")}, `));
  // The fixture's 21 km heart starts 3.4 km away: not the city's own. Its
  // own routes and the shapes added to them come first.
  const order = texts();
  const label = order.indexOf("NEAR VERCELLI");
  expect(label).toBeGreaterThan(
    order.findIndex((text) => text.startsWith("Circle · ")),
  );
  expect(order.indexOf("CIAO · 15.2 km")).toBeLessThan(label);
  expect(order.indexOf("Heart · 21.3 km")).toBeGreaterThan(label);
  expect(screen.queryByText("EXAMPLES IN VERCELLI")).toBeNull();
  // The hearts it has are its own 10 km one: none is drawn.
  expect(routeJobShapes()).not.toContain("heart");
});

test("near the start, with no city chosen: one list, no label", async () => {
  fetchMock.mockImplementation(withCatalog(levico));
  await render(
    <ExploreScreen
      apiUrl="http://api"
      near={[45.9944, 11.2639]}
      onOpen={jest.fn()}
      onCity={jest.fn()}
    />,
  );
  await screen.findByText("Star · 5.1 km");
  expect(screen.getAllByTestId("route-card")).toHaveLength(levico.length);
  expect(screen.queryByText(/^NEAR /)).toBeNull();
  expect(routeJobShapes()).toEqual([]);
});
