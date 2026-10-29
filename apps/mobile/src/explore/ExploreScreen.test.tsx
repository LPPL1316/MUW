import list from "@shaperoute/shared-types/fixtures/recommended-routes.json";
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { FeedMapShooter, forgetFeedMaps } from "../feed/FeedMaps";
import { shapeLabel } from "../feed/FeedPost";
import type { Place } from "../places/photon";
import { EXAMPLE_SHAPES, forgetExamples, MORE_SHAPES } from "./exampleRoutes";
import { awayText, ExploreScreen, kmLabel } from "./ExploreScreen";
import type { RecommendedRoute } from "./recommendedRoutes";
import { cardMapsCredit } from "./RouteCard";
import { THEMED_IDEAS } from "./themedIdeas";
import { POSTS_SHOWN } from "./WhileDrawing";

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

const vercelli: Place = {
  label: "Vercelli, Piedmont, Italy",
  point: [45.3252, 8.4228],
};

/** The API: an empty catalog here, and every route done at once. */
function emptyCatalog(input: RequestInfo | URL): Promise<Response> {
  const url = String(input);
  return Promise.resolve(
    url.includes("/recommended-routes")
      ? Response.json({ routes: [] })
      : Response.json(jobDone, { status: 202 }),
  );
}

/**
 * As `emptyCatalog`, but only the first three shapes are done at once: the
 * others never answer. The shapes after the first three have their tests
 * in ExploreMoreShapes.test.tsx.
 */
function firstThreeDone(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (String(input).includes("/recommended-routes")) {
    return Promise.resolve(Response.json({ routes: [] }));
  }
  const { shape } = JSON.parse(String(init?.body));
  return (EXAMPLE_SHAPES as readonly string[]).includes(shape)
    ? Promise.resolve(Response.json(jobDone, { status: 202 }))
    : new Promise<Response>(() => {});
}

function routeJobShapes(): (string | undefined)[] {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).endsWith("/route-jobs"))
    .map(([, init]) => JSON.parse(String(init?.body)).shape);
}

test("a city without recommended routes: three examples at once (TASK-143)", async () => {
  fetchMock.mockImplementation(firstThreeDone);
  const onOpen = jest.fn();
  await render(
    <ExploreScreen
      apiUrl="http://api"
      near={[46.067, 11.1215]}
      onBack={jest.fn()}
      onOpen={onOpen}
      city={vercelli}
      onCity={jest.fn()}
    />,
  );
  expect(await screen.findByText("EXAMPLES IN VERCELLI")).toBeOnTheScreen();
  const heart = await screen.findByLabelText(/^Heart, /);
  await screen.findByLabelText(/^Star, /);
  // The circle is asked first: its zone holds the others'. Then the next
  // shape is on its way, a card of its own.
  expect(routeJobShapes()).toEqual(["circle", "heart", "star", MORE_SHAPES[0]]);
  expect(screen.getByText(shapeLabel(MORE_SHAPES[0]))).toBeOnTheScreen();
  expect(screen.getByText("Drawing…")).toBeOnTheScreen();
  expect(screen.queryByText(/No recommended routes near this start yet/)).toBeNull();
  await fireEvent.press(heart);
  expect(onOpen.mock.calls[0][0]).toMatchObject({ shape: "heart", city: "Vercelli" });
});

test("while the examples are drawn, drawings of the feed to look at (TASK-163)", async () => {
  // The catalog answers; the first route never does: the map is downloading.
  fetchMock.mockImplementation((input) =>
    String(input).includes("/recommended-routes")
      ? Promise.resolve(Response.json({ routes: [] }))
      : new Promise<Response>(() => {}),
  );
  await render(
    <ExploreScreen
      apiUrl="http://api"
      near={null}
      onOpen={jest.fn()}
      city={vercelli}
      onCity={jest.fn()}
      onAsk={jest.fn()}
    />,
  );
  expect(await screen.findByText("MEANWHILE, FROM THE FEED")).toBeOnTheScreen();
  expect(screen.getByText("Drawing…")).toBeOnTheScreen();
  expect(screen.getAllByTestId("feed-post")).toHaveLength(POSTS_SHOWN);
  // Under the examples, over «Ask for a route».
  const order = texts();
  expect(order.indexOf("MEANWHILE, FROM THE FEED")).toBeGreaterThan(
    order.indexOf("EXAMPLES IN VERCELLI"),
  );
  expect(order.indexOf("ASK FOR A ROUTE")).toBeGreaterThan(
    order.indexOf("MEANWHILE, FROM THE FEED"),
  );
});

test("the drawings stay when the last example arrives", async () => {
  fetchMock.mockImplementation(emptyCatalog);
  await render(
    <ExploreScreen
      apiUrl="http://api"
      near={null}
      onOpen={jest.fn()}
      city={vercelli}
      onCity={jest.fn()}
    />,
  );
  await screen.findByLabelText(/^Star, /);
  // Ready above, though the other shapes are still coming.
  expect(
    screen.getByText("The shapes of this city are ready above."),
  ).toBeOnTheScreen();
  await screen.findByLabelText(new RegExp(`^${shapeLabel(LAST)}, `));
  expect(screen.queryByText("Drawing…")).toBeNull();
  expect(screen.getAllByTestId("feed-post")).toHaveLength(POSTS_SHOWN);
  expect(
    screen.getByText("The shapes of this city are ready above."),
  ).toBeOnTheScreen();
});

afterAll(() => {
  forgetExamples();
  fetchMock.mockRestore();
});

test("lists the routes near the start, the best first, and opens one", async () => {
  fetchMock.mockResolvedValue(Response.json(list));
  const onOpen = jest.fn();
  await render(
    <ExploreScreen
      apiUrl="http://api"
      near={[46.067, 11.1215]}
      onBack={jest.fn()}
      onOpen={onOpen}
    />,
  );
  expect(await screen.findByText("Star · 5.1 km")).toBeOnTheScreen();
  expect(screen.getByText("CIAO · 15.2 km")).toBeOnTheScreen();
  expect(screen.getByText("100%")).toBeOnTheScreen();
  expect(screen.getAllByText("Trento · 0 m away").length).toBeGreaterThan(0);
  await fireEvent.press(screen.getByText("Star · 5.1 km"));
  expect(onOpen).toHaveBeenCalledWith(routes[0]);
});

/** Every text on the screen, top to bottom. */
function texts(): string[] {
  return screen.getAllByText(/./).map((node) => String(node.props.children));
}

test("«Ask for a route» is open under the routes, our four categories in view", async () => {
  // An answer for each request: the towns near the start are asked too.
  fetchMock.mockImplementation(() => Promise.resolve(Response.json(list)));
  const onAsk = jest.fn();
  await render(
    <ExploreScreen
      apiUrl="http://api"
      near={[46.067, 11.1215]}
      onOpen={jest.fn()}
      onCity={jest.fn()}
      onAsk={onAsk}
    />,
  );
  await screen.findByText("Star · 5.1 km");
  // No line to open it: it is open, under the routes.
  expect(screen.queryByRole("button", { name: "Ask for a route" })).toBeNull();
  const order = texts();
  expect(order.indexOf("ASK FOR A ROUTE")).toBeGreaterThan(
    order.indexOf("CIAO · 15.2 km"),
  );
  expect(order.indexOf("ASK FOR A ROUTE")).toBeGreaterThan(order.indexOf("CITY"));
  for (const category of [
    "Famous Places",
    "Best Views",
    "Hidden Gems",
    "Photography",
  ]) {
    expect(screen.getByText(category)).toBeOnTheScreen();
  }
  expect(screen.queryByText("Food")).toBeNull();
  await fireEvent.press(screen.getByText("Hidden Gems"));
  expect(onAsk).toHaveBeenCalledWith({
    text: "Hidden Gems",
    centre: [46.067, 11.1215],
    city: null,
  });
});

test("our ideas are in it, above the categories, and one opens as it is", async () => {
  fetchMock.mockImplementation(() => Promise.resolve(Response.json(list)));
  const onIdea = jest.fn();
  await render(
    <ExploreScreen
      apiUrl="http://api"
      near={[46.067, 11.1215]}
      onOpen={jest.fn()}
      onAsk={jest.fn()}
      onIdea={onIdea}
    />,
  );
  await screen.findByText("Star · 5.1 km");
  const order = texts();
  expect(order.indexOf("IDEAS FROM EUROPE")).toBeGreaterThan(
    order.indexOf("ASK FOR A ROUTE"),
  );
  expect(order.indexOf("IDEAS FROM EUROPE")).toBeLessThan(
    order.indexOf("Famous Places"),
  );
  const ideas = within(screen.getByTestId("themed-ideas"));
  expect(ideas.getAllByRole("button")).toHaveLength(THEMED_IDEAS.length);
  const first = THEMED_IDEAS[0];
  await fireEvent.press(ideas.getAllByRole("button")[0]);
  expect(onIdea).toHaveBeenCalledWith(first);
  // Nothing asked for it: it was planned already.
  expect(fetchMock.mock.calls.some(([url]) => String(url).includes("themed"))).toBe(
    false,
  );
});

test("«Ask for a route» is at the foot of the page also without routes", async () => {
  fetchMock.mockResolvedValue(Response.json({ routes: [] }));
  await render(
    <ExploreScreen
      apiUrl="http://api"
      near={[46.067, 11.1215]}
      onOpen={jest.fn()}
      onAsk={jest.fn()}
    />,
  );
  await screen.findByText(/No recommended routes near this start yet/);
  const order = texts();
  expect(order.indexOf("ASK FOR A ROUTE")).toBeGreaterThan(
    order.indexOf(
      "No recommended routes near this start yet. Draw one: the best ones will show up here.",
    ),
  );
  expect(order.at(-1)).toBe("Make my route");
});

test("without a way to ask there is no «Ask for a route»", async () => {
  fetchMock.mockResolvedValue(Response.json(list));
  await render(
    <ExploreScreen apiUrl="http://api" near={[46.067, 11.1215]} onOpen={jest.fn()} />,
  );
  await screen.findByText("Star · 5.1 km");
  expect(screen.queryByText("ASK FOR A ROUTE")).toBeNull();
  expect(screen.queryByTestId("themed-ideas")).toBeNull();
});

test("no filters: every route near the start is a card (TASK-176)", async () => {
  fetchMock.mockResolvedValue(Response.json(list));
  await render(
    <ExploreScreen apiUrl="http://api" near={[46.067, 11.1215]} onOpen={jest.fn()} />,
  );
  await screen.findByText("Star · 5.1 km");
  expect(screen.queryByText(/^Shape/)).toBeNull();
  expect(screen.queryByText(/^Distance/)).toBeNull();
  expect(screen.getAllByTestId("route-card")).toHaveLength(routes.length);
  // The cards are the only buttons of the page: nothing to set first.
  expect(screen.getAllByRole("button")).toHaveLength(routes.length);
});

test("the routes are cards, two side by side between the page's margins", async () => {
  fetchMock.mockResolvedValue(Response.json(list));
  await render(
    <ExploreScreen apiUrl="http://api" near={[46.067, 11.1215]} onOpen={jest.fn()} />,
  );
  await screen.findByText("Star · 5.1 km");
  const cards = screen.getAllByTestId("route-card");
  expect(cards).toHaveLength(routes.length);
  // The window of the tests is 750 wide: 16 of margin a side, 12 between.
  for (const card of cards) {
    expect(card).toHaveStyle({ width: 353 });
  }
  expect(screen.getAllByTestId("route-card-drawing")[0]).toHaveStyle({
    width: 353,
    height: 233,
  });
});

test("the cards ask for the map under their lines (TASK-174)", async () => {
  fetchMock.mockResolvedValue(Response.json(list));
  await render(
    <>
      <FeedMapShooter width={718} height={445} />
      <ExploreScreen apiUrl="http://api" near={[46.067, 11.1215]} onOpen={jest.fn()} />
    </>,
  );
  await screen.findByText("Star · 5.1 km");
  const page = screen.getByTestId("feed-map-page", { includeHiddenElements: true });
  await fireEvent(page, "message", { nativeEvent: { data: '{"type":"ready"}' } });
  // Until a picture comes each card stays the line on the dark.
  expect(screen.queryByTestId("route-card-map")).toBeNull();
  // Whose the maps are, once, above the cards.
  expect(screen.getAllByText(cardMapsCredit())).toHaveLength(1);
});

test("without a start, nothing is asked", async () => {
  await render(
    <ExploreScreen
      apiUrl="http://api"
      near={null}
      onBack={jest.fn()}
      onOpen={jest.fn()}
    />,
  );
  expect(await screen.findByText(/Choose a start first/)).toBeOnTheScreen();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("no routes near: says so", async () => {
  fetchMock.mockResolvedValue(Response.json({ routes: [] }));
  await render(
    <ExploreScreen
      apiUrl="http://api"
      near={[40, 9]}
      onBack={jest.fn()}
      onOpen={jest.fn()}
    />,
  );
  expect(
    await screen.findByText(/No recommended routes near this start yet/),
  ).toBeOnTheScreen();
  // No cards, no maps, nobody to name.
  expect(screen.queryByText(cardMapsCredit())).toBeNull();
});

test("a failed list says so", async () => {
  fetchMock.mockRejectedValue(new TypeError("Network request failed"));
  await render(
    <ExploreScreen
      apiUrl="http://api"
      near={[46, 11]}
      onBack={jest.fn()}
      onOpen={jest.fn()}
    />,
  );
  expect(await screen.findByText(/could not load/)).toBeOnTheScreen();
});

test("labels", () => {
  expect(kmLabel(21000)).toBe("21 km");
  expect(awayText(640)).toBe("640 m away");
  expect(awayText(1440)).toBe("1.4 km away");
});

test("under «Near me», the towns around the start; a chosen city has none", async () => {
  const town = {
    label: "Pergine Valsugana, Trentino – Alto Adige/Südtirol, Italy",
    point: [46.0605291, 11.2406747],
    away_m: 9300,
  };
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    return url.includes("/nearby-cities")
      ? Promise.resolve(Response.json({ places: [town] }))
      : url.includes("/recommended-routes")
        ? Promise.resolve(Response.json(list))
        : new Promise<Response>(() => {});
  });
  const onCity = jest.fn();
  const page = (city: Place | null) => (
    <ExploreScreen
      apiUrl="http://api"
      near={[46.067, 11.1215]}
      onOpen={jest.fn()}
      city={city}
      onCity={onCity}
    />
  );
  const view = await render(page(null));
  expect(await screen.findByText("NEARBY TOWNS")).toBeOnTheScreen();
  expect(fetchMock).toHaveBeenCalledWith(
    "http://api/nearby-cities?lat=46.07&lon=11.12",
    expect.anything(),
  );
  // The page has routes: one credit for the maps, the page's.
  await screen.findByText("Star · 5.1 km");
  expect(screen.getAllByText(cardMapsCredit())).toHaveLength(1);
  // 9.3 km for the API, from the rounded start; 9.2 km from the start itself (TASK-254).
  await fireEvent.press(screen.getByLabelText("Pergine Valsugana, 9.2 km away"));
  expect(onCity).toHaveBeenCalledWith({ label: town.label, point: town.point });
  await view.rerender(page(vercelli));
  expect(screen.queryByText("NEARBY TOWNS")).toBeNull();
});
