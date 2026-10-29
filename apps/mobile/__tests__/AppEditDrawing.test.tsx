/**
 * «Edit the drawing» on the cards (TASK-320 part B, ADR-0280): the figure
 * of a route of «Explore», or of a member's drawing, opens in the board at
 * once; «Save» shows «Draw» with «Freehand», the figure, the distance «Draw
 * it near me» would choose and «Draw»'s start, and nothing is asked before
 * «Draw route». What a drawing opens is in src/route/figureLines.test.ts.
 */
import drawing from "@shaperoute/shared-types/fixtures/drawing-details.json";
import imported from "@shaperoute/shared-types/fixtures/drawing-details-imported.json";
import feed from "@shaperoute/shared-types/fixtures/feed.json";
import detail from "@shaperoute/shared-types/fixtures/recommended-route.json";
import list from "@shaperoute/shared-types/fixtures/recommended-routes.json";
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import * as Location from "expo-location";

import App from "../App";
import { apiError, type MemorySecureStore } from "../src/account/testing";
import { forgetFeed } from "../src/feed/useFeed";
import { SAMPLE_FEED } from "../src/feed/sampleFeed";
import { loadSport } from "../src/settings/sport";

// Every test renders the whole app, and the first one loads it cold.
jest.setTimeout(20_000);

jest.mock("react-native-webview");
jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: "192.168.1.23:8081" } },
}));
jest.mock("expo-file-system");
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock("expo-secure-store", () =>
  jest
    .requireActual<typeof import("../src/account/testing")>("../src/account/testing")
    .memorySecureStore(),
);
// The sport kept on the phone, as each test says.
jest.mock("../src/settings/sport", () => ({
  ...jest.requireActual<typeof import("../src/settings/sport")>(
    "../src/settings/sport",
  ),
  loadSport: jest.fn(),
}));

const store = jest.requireMock<MemorySecureStore>("expo-secure-store");
const API = "http://192.168.1.23:8000";
const SESSION_KEY = "shaperoute.session";
const HERE: [number, number] = [46.067, 11.1215];
// Asked from where «Draw» starts: the position of the phone.
const FEED = "/feed?lat=46.067&lon=11.1215";

// The second drawing of the sample feed, opened as a route of «Explore».
const POST = SAMPLE_FEED[1];
const ROUTE = { ...detail, id: POST.id, route_m: POST.route_m };

/** The route of a drawing: the engine says neither a shape nor a word. */
const DRAWING_DONE = {
  ...jobDone,
  result: { ...jobDone.result, shape: null, word: null },
};

/** A loop of 50 points around Trento, as a run of a picture leaves it. */
const RING: [number, number][] = Array.from({ length: 50 }, (_, i) => {
  const a = (2 * Math.PI * i) / 50;
  return [46.0671 + 0.004 * Math.sin(a), 11.1214 + 0.006 * Math.cos(a)];
});

let fetchSpy: jest.SpiedFunction<typeof fetch>;
/** What the API has under the id of the sample post. */
let underItsId: () => Response;
/** What the API has under the id of the member's drawing. */
let theDrawing: () => Response;

/** The calls to the API since the card was on screen, by method and path. */
function asked(method: string, prefix: string) {
  return fetchSpy.mock.calls.filter(
    ([input, init]) =>
      String(input).startsWith(`${API}${prefix}`) && (init?.method ?? "GET") === method,
  );
}

function posted() {
  return fetchSpy.mock.calls.filter(([, init]) => (init?.method ?? "GET") === "POST");
}

async function onFeed() {
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
  await fireEvent.press(screen.getByRole("tab", { name: "Feed" }));
}

/** The member's drawing of the feed, open on the map. */
async function onDrawing() {
  store.kept.set(SESSION_KEY, JSON.stringify(session));
  await onFeed();
  await fireEvent.press(await screen.findByText(String(feed.posts[0].title)));
  await screen.findByRole("button", { name: "Back to the profile" });
}

/** The board on a 400 × 700 screen, and the sides of its outline. */
async function boardSides(): Promise<number> {
  const area = screen.getByTestId("freehand-board");
  await fireEvent(area, "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 700 } },
  });
  return within(area).getAllByTestId("outline-side").length;
}

/** «Draw» on screen with «Freehand» and the figure, ready to ask for it. */
function expectFreehandDraw(distance: string) {
  expect(screen.queryByTestId("freehand-board")).toBeNull();
  expect(screen.getByRole("tab", { name: "Draw", selected: true })).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Freehand" })).toBeSelected();
  expect(screen.getByTestId("freehand-preview")).toBeOnTheScreen();
  expect(screen.getByLabelText("Distance in km")).toHaveDisplayValue(distance);
  // From where «Draw» starts, as before.
  expect(screen.getByText("Starting from your position.")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Draw route" })).toBeEnabled();
}

/** What the API checks of an outline sent (ADR-0069), as a drawing's. */
function expectDrawingRequest(body: Record<string, unknown>, distanceM: number) {
  expect(body).toMatchObject({
    start: HERE,
    distance_m: distanceM,
    activity: "running",
  });
  expect(body).not.toHaveProperty("shape");
  const outline = body.outline as [number, number][];
  expect(outline.length).toBeGreaterThanOrEqual(4);
  expect(outline.length).toBeLessThanOrEqual(101);
  expect(outline[outline.length - 1]).toEqual(outline[0]);
  for (const [x, y] of outline) {
    expect(Math.abs(x)).toBeLessThanOrEqual(1);
    expect(Math.abs(y)).toBeLessThanOrEqual(1);
  }
}

beforeEach(() => {
  store.kept.clear();
  forgetFeed();
  jest.mocked(loadSport).mockReturnValue("run");
  underItsId = () => Response.json(ROUTE);
  theDrawing = () => Response.json(drawing);
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: HERE[0], longitude: HERE[1] },
  } as Location.LocationObject);
  fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const path = String(input).replace(API, "");
    const method = init?.method ?? "GET";
    if (method === "GET" && path.startsWith("/recommended-routes/")) {
      return underItsId();
    }
    if (method === "GET" && path.startsWith("/recommended-routes")) {
      return Response.json(list);
    }
    // A figure's route: accepted, and done at the first poll, read as any
    // job.
    if (method === "POST" && path === "/image-route-jobs") {
      return Response.json(
        { job_id: "4f2c9e1a", status: "queued", result: null, error: null },
        { status: 202 },
      );
    }
    if (method === "GET" && path === "/route-jobs/4f2c9e1a") {
      return Response.json(DRAWING_DONE);
    }
    const answers: Record<string, () => Response> = {
      "GET /me": () => Response.json(session.user),
      "GET /me/favorites": () => Response.json({ favorites: [] }),
      "GET /me/activities": () =>
        Response.json({ activities: [], next: null, total: 0 }),
      [`GET ${FEED}`]: () => Response.json(feed),
      [`GET /drawings/${drawing.id}`]: () => theDrawing(),
    };
    const answer = answers[`${method} ${path}`];
    return answer !== undefined
      ? answer()
      : Response.json(apiError("http_error", path), { status: 404 });
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("a route of «Explore» opens its shape in the board, and «Save» shows «Draw» with it, asking for nothing", async () => {
  await onFeed();
  await fireEvent.press(screen.getByText(POST.title));
  await screen.findByText("Start");
  // Where it goes: after «Start», «Draw it near me» and «Export GPX».
  const buttons = screen.getAllByRole("button");
  const named = (name: string) => buttons.indexOf(screen.getByRole("button", { name }));
  expect(named("Start")).toBeGreaterThanOrEqual(0);
  expect(named("Edit the drawing")).toBeGreaterThan(named("Start"));
  expect(named("Edit the drawing")).toBeGreaterThan(named("Draw it near me"));
  expect(named("Edit the drawing")).toBeGreaterThan(named("Export GPX"));
  const before = fetchSpy.mock.calls.length;

  await fireEvent.press(screen.getByRole("button", { name: "Edit the drawing" }));

  // The board at once, on the star of the route: its outline and nothing
  // asked for.
  expect(await boardSides()).toBeGreaterThan(4);
  await fireEvent.press(screen.getByRole("button", { name: "Save" }));

  expectFreehandDraw("5");
  // The route is left: no card of it.
  expect(screen.queryByText("Back to the list")).toBeNull();
  expect(fetchSpy.mock.calls.length).toBe(before);

  // «Draw route»: the figure goes as a drawing, from «Draw»'s start.
  await fireEvent.press(screen.getByRole("button", { name: "Draw route" }));
  expect(
    await screen.findByText("Drawing · on roads · target 5 km", {}, { timeout: 3000 }),
  ).toBeOnTheScreen();
  const sent = posted();
  expect(sent).toHaveLength(1);
  expect(String(sent[0][0])).toBe(`${API}/image-route-jobs`);
  expectDrawingRequest(JSON.parse(String(sent[0][1]?.body)), 5000);
});

test("a member's drawing with a shape opens the shape; «Save» leaves the drawing for «Draw»", async () => {
  await onDrawing();
  const before = fetchSpy.mock.calls.length;

  await fireEvent.press(screen.getByRole("button", { name: "Edit the drawing" }));
  expect(await boardSides()).toBeGreaterThan(4);
  await fireEvent.press(screen.getByRole("button", { name: "Save" }));

  // The star of the drawing at the km it was run: 4004 m are 4 km.
  expect(drawing.distance_m).toBe(4004);
  expectFreehandDraw("4");
  expect(screen.queryByText(String(drawing.description))).toBeNull();
  expect(screen.queryByRole("button", { name: "Back to the profile" })).toBeNull();
  // Nothing of the other's route travels, and nothing is drawn yet.
  expect(posted()).toHaveLength(0);
  expect(fetchSpy.mock.calls.length).toBe(before);

  // Nothing of the drawing is waiting behind «Feed».
  await fireEvent.press(screen.getByRole("tab", { name: "Feed" }));
  expect(screen.queryByText(String(drawing.description))).toBeNull();
});

test("a member's drawing of a picture opens the track it ran, closed", async () => {
  theDrawing = () =>
    Response.json({
      ...drawing,
      shape: null,
      word: null,
      style: null,
      route_title: "Drawing",
      distance_m: 6260,
      track: RING,
    });
  await onDrawing();
  expect(screen.queryByRole("button", { name: "Draw it near me" })).toBeNull();

  await fireEvent.press(screen.getByRole("button", { name: "Edit the drawing" }));
  expect(await boardSides()).toBeGreaterThan(4);
  await fireEvent.press(screen.getByRole("button", { name: "Save" }));

  // 6260 m to the tenth of a km.
  expectFreehandDraw("6.3");
  expect(posted()).toHaveLength(0);
  expect(asked("POST", "/route-directions")).toHaveLength(0);
});

test("a word of «Explore» has «Draw it near me» but no «Edit the drawing»", async () => {
  underItsId = () =>
    Response.json({ ...detail, shape: null, word: "CIAO", style: "block" });
  await onFeed();
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  await fireEvent.press(await screen.findByText("Star · 5.1 km"));
  await screen.findByText("Start");
  expect(screen.getByRole("button", { name: "Draw it near me" })).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Edit the drawing" })).toBeNull();
});

test.each([
  ["a word", { shape: null, word: "ciao", style: "round" }],
  ["a run without a planned route", { shape: null, word: null, route_title: null }],
  ["a run imported from another app", imported],
  [
    "a post of photos alone",
    { shape: null, word: null, route_title: "Image", track: [] },
  ],
])("a member's drawing of %s has no «Edit the drawing»", async (_what, fields) => {
  theDrawing = () => Response.json({ ...drawing, ...fields, id: drawing.id });
  await onDrawing();
  expect(screen.queryByRole("button", { name: "Edit the drawing" })).toBeNull();
});

test("with «Paddle» a drawing's card has no «Edit the drawing»", async () => {
  jest.mocked(loadSport).mockReturnValue("paddle");
  await onDrawing();
  // Its star is still drawn near: on the water, as a shape of the catalogue.
  expect(screen.getByRole("button", { name: "Draw it near me" })).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Edit the drawing" })).toBeNull();
});
