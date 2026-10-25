import apiError from "@shaperoute/shared-types/fixtures/api-error.json";
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import jobFailed from "@shaperoute/shared-types/fixtures/route-job-failed.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";
import * as Sharing from "expo-sharing";

import response from "../src/places/fixtures/photon-via-belenzani-trento.json";
import App from "../App";

jest.mock("react-native-webview");
jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
// The Expo dev server as the phone sees it: the API is on the same PC.
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

const { injectJavaScript } =
  jest.requireMock<typeof import("../__mocks__/react-native-webview")>(
    "react-native-webview",
  );
const { written } =
  jest.requireMock<typeof import("../__mocks__/expo-file-system")>("expo-file-system");
const sharingAvailable = jest.mocked(Sharing.isAvailableAsync);
const share = jest.mocked(Sharing.shareAsync);
const requestPermission = jest.mocked(Location.requestForegroundPermissionsAsync);
const getPosition = jest.mocked(Location.getCurrentPositionAsync);

// Only the fields the app reads; the rest of the shapes does not matter here.
function permission(granted: boolean) {
  return { granted } as Location.LocationPermissionResponse;
}

function positionAt(latitude: number, longitude: number) {
  return { coords: { latitude, longitude } } as Location.LocationObject;
}

async function mapIsReady() {
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
}

function lastScript(): string | undefined {
  return injectJavaScript.mock.calls.at(-1)?.[0];
}

const API = "http://192.168.1.23:8000";
const GPX = '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1"></gpx>';
const GPX_FILE = "sgrava-heart-5km-2026-09-23.gpx";

let fetchSpy: jest.SpiedFunction<typeof fetch>;
/** How the AI on the PC answers POST /shape-readings in the next test. */
let readShape: (text: string) => Response;

function job(status: string) {
  return { job_id: "4f2c9e1a", status, result: null, error: null };
}

/**
 * The API accepts the route job, then answers each poll with the next body
 * (the last one repeats); Photon answers as usual.
 */
function apiAnswers(...polls: unknown[]) {
  fetchSpy.mockImplementation(async (input, init) => {
    if (!String(input).startsWith(API)) {
      return Response.json(response);
    }
    const method = init?.method ?? "GET";
    if (method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    if (String(input) === `${API}/game/catalog`) {
      // An API without the shape game (TASK-296): no «Play» page.
      return Response.json(
        { error: { code: "http_error", message: "no game" } },
        { status: 404 },
      );
    }
    if (String(input) === `${API}/gpx`) {
      return new Response(GPX, {
        headers: { "Content-Disposition": `attachment; filename="${GPX_FILE}"` },
      });
    }
    if (String(input) === `${API}/shape-readings`) {
      return readShape((JSON.parse(String(init?.body)) as { text: string }).text);
    }
    if (method === "POST") {
      return Response.json(job("queued"), { status: 202 });
    }
    return Response.json(polls.length > 1 ? polls.shift() : polls[0]);
  });
}

function apiCalls(method: string) {
  return fetchSpy.mock.calls.filter(
    ([input, init]) =>
      String(input).startsWith(API) && (init?.method ?? "GET") === method,
  );
}

/** What the app sent to the API in its last route request. */
function lastRouteRequest(): unknown {
  const posts = apiCalls("POST").filter(([input]) =>
    String(input).endsWith("/route-jobs"),
  );
  return JSON.parse(String(posts.at(-1)?.[1]?.body));
}

/** Lets the app poll the API once: the first asks come every 500 ms. */
async function nextPoll() {
  await act(() => jest.advanceTimersByTimeAsync(500));
}

async function atTrento() {
  requestPermission.mockResolvedValue(permission(true));
  getPosition.mockResolvedValue(positionAt(46.0671, 11.1214));
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await mapIsReady();
}

beforeEach(() => {
  requestPermission.mockReset();
  getPosition.mockReset();
  injectJavaScript.mockClear();
  fetchSpy = jest.spyOn(globalThis, "fetch");
  written.clear();
  sharingAvailable.mockReset().mockResolvedValue(true);
  share.mockReset().mockResolvedValue();
  readShape = (text) => Response.json({ text, shape: null });
});

afterEach(() => {
  fetchSpy.mockRestore();
});

test("opens on the choice, with the app name and a heart", async () => {
  requestPermission.mockReturnValue(new Promise(() => {}));
  await render(<App />);
  expect(screen.getByText("MuW")).toBeOnTheScreen();
  expect(
    screen.getByRole("button", { name: "heart", selected: true }),
  ).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Back" })).not.toBeOnTheScreen();
  expect(screen.getByText("Finding your position…")).toBeOnTheScreen();
  expect(screen.getByLabelText("Shape")).toHaveDisplayValue("heart");
  expect(screen.queryByText(/Unknown shape/)).not.toBeOnTheScreen();
});

test("with the position, the map centres on it and there is no search", async () => {
  requestPermission.mockResolvedValue(permission(true));
  getPosition.mockResolvedValue(positionAt(46.0671, 11.1214));
  await render(<App />);
  expect(await screen.findByText("Starting from your position.")).toBeOnTheScreen();

  await mapIsReady();
  expect(lastScript()).toContain('"lngLat":[11.1214,46.0671]');
  expect(screen.queryByPlaceholderText("City or street")).not.toBeOnTheScreen();
});

test("without permission, a searched place becomes the start", async () => {
  requestPermission.mockResolvedValue(permission(false));
  fetchSpy.mockImplementation(async () => Response.json(response));
  await render(<App />);
  await mapIsReady();
  // By the name under the icon: that is what Settings lists (TASK-160).
  expect(
    await screen.findByText(
      "Location is off for MuW. Allow it in Settings, or search for a place to start from.",
    ),
  ).toBeOnTheScreen();
  expect(screen.getByText("Open Settings")).toBeOnTheScreen();
  expect(injectJavaScript).not.toHaveBeenCalled();

  await fireEvent.changeText(
    screen.getByPlaceholderText("City or street"),
    "Belenzani",
  );
  await fireEvent.press(screen.getByText("Search"));
  await fireEvent.press(await screen.findByText("Via Rodolfo Belenzani, Trento"));

  expect(
    screen.getByText("Starting from Via Rodolfo Belenzani, Trento."),
  ).toBeOnTheScreen();
  expect(lastScript()).toContain('"lngLat":[11.1211947,46.0692621]');
});

test("once the GPS answers, it takes over from the searched place", async () => {
  requestPermission.mockResolvedValue(permission(false));
  fetchSpy.mockImplementation(async () => Response.json(response));
  await render(<App />);
  await mapIsReady();
  await fireEvent.changeText(
    await screen.findByPlaceholderText("City or street"),
    "Belenzani",
  );
  await fireEvent.press(screen.getByText("Search"));
  await fireEvent.press(await screen.findByText("Via Rodolfo Belenzani, Trento"));

  requestPermission.mockResolvedValue(permission(true));
  getPosition.mockResolvedValue(positionAt(46.0122, 11.2986));
  await fireEvent.press(screen.getByText("My position"));

  expect(await screen.findByText("Starting from your position.")).toBeOnTheScreen();
  expect(lastScript()).toContain('"lngLat":[11.2986,46.0122]');
  expect(screen.queryByPlaceholderText("City or street")).not.toBeOnTheScreen();
});

test("a GPS without an answer offers the search too", async () => {
  requestPermission.mockResolvedValue(permission(true));
  getPosition.mockRejectedValue(new Error("Location services are disabled"));
  await render(<App />);
  expect(await screen.findByText(/not available right now/)).toBeOnTheScreen();
  expect(screen.getByPlaceholderText("City or street")).toBeOnTheScreen();
  expect(screen.queryByText("Open Settings")).not.toBeOnTheScreen();
});

test("a map that cannot load says so", async () => {
  requestPermission.mockReturnValue(new Promise(() => {}));
  await render(<App />);
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"error","message":"MapLibre GL JS did not load"}' },
  });
  // On the map, and in the line under «Draw», where the map is hidden: the
  // same words, without the reason (TASK-259).
  const words = "The map could not be loaded. Check the network.";
  expect(screen.getAllByText(words)).toHaveLength(2);
  expect(screen.queryByText(/MapLibre/)).toBeNull();
  // The «Retry» of «Draw», the last on the screen, mounts the map again.
  const retries = screen.getAllByRole("button", { name: "Retry" });
  await fireEvent.press(retries[retries.length - 1]);
  expect(screen.queryByText(words)).toBeNull();
  expect(screen.getByTestId("map")).toBeOnTheScreen();
});

test("Draw route is off until there is a start", async () => {
  requestPermission.mockReturnValue(new Promise(() => {}));
  await render(<App />);
  expect(screen.getByRole("button", { name: "Draw route" })).toBeDisabled();
});

/** The result card: the distance on roads, and the target under it. */
function expectRoute(km: string, target: string) {
  expect(screen.getByText(`${km} km`)).toBeOnTheScreen();
  // After the route's name: the shape, or the word (TASK-057).
  const line = ` · on roads · target ${target} km`.replace(".", "\\.");
  expect(screen.getByText(new RegExp(`${line}$`))).toBeOnTheScreen();
}

/** From the map back to the choice. */
async function goBack() {
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
}

function distanceField() {
  return screen.getByLabelText("Distance in km");
}

test("the distance starts at 5 km", async () => {
  requestPermission.mockReturnValue(new Promise(() => {}));
  await render(<App />);
  expect(distanceField()).toHaveDisplayValue("5");
  expect(screen.queryByText(/Enter a distance/)).not.toBeOnTheScreen();
});

test("draws the route for the chosen shape and the distance typed", async () => {
  jest.useFakeTimers();
  apiAnswers(job("computing"), jobDone);
  await atTrento();
  await fireEvent.changeText(screen.getByLabelText("Shape"), "cerchio");
  await fireEvent.changeText(distanceField(), "7,5");
  await fireEvent.press(screen.getByText("Draw route"));
  await nextPoll();
  await nextPoll();

  expectRoute("4.0", "7.5");
  expect(screen.getByText("There are 120 m of steps along the way.")).toBeOnTheScreen();
  expect(lastRouteRequest()).toEqual({
    start: [46.0671, 11.1214],
    shape: "circle",
    distance_m: 7500,
    activity: "running",
  });
  expect(lastScript()).toContain('"type":"showRoute","coordinates":[[11.1214,46.0671]');
  jest.useRealTimers();
});

test("a distance that is not valid turns Draw route off and says why", async () => {
  apiAnswers(jobDone);
  await atTrento();
  for (const text of ["0,5", "22", "abc", ""]) {
    await fireEvent.changeText(distanceField(), text);
    expect(screen.getByText("Enter a distance between 1 and 21 km.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Draw route" })).toBeDisabled();
    await fireEvent.press(screen.getByText("Draw route"));
  }
  expect(apiCalls("POST")).toEqual([]);

  await fireEvent.changeText(distanceField(), "21");
  expect(screen.queryByText(/Enter a distance/)).not.toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Draw route" })).toBeEnabled();
});

test("above 15 km the panel warns that the route takes longer", async () => {
  requestPermission.mockReturnValue(new Promise(() => {}));
  await render(<App />);
  const warning = "Long routes take longer: up to a few minutes.";
  await fireEvent.changeText(distanceField(), "15");
  expect(screen.queryByText(warning)).not.toBeOnTheScreen();
  await fireEvent.changeText(distanceField(), "15,5");
  expect(screen.getByText(warning)).toBeOnTheScreen();
});

test("while waiting it says what the API is doing, with a spinner", async () => {
  jest.useFakeTimers();
  apiAnswers(job("downloading_map"), job("computing"));
  await atTrento();
  await fireEvent.press(screen.getByText("Draw route"));
  expect(screen.getByText(/Waiting for the API…/)).toBeOnTheScreen();

  await nextPoll();
  expect(screen.getByText(/Downloading map data for this area…/)).toBeOnTheScreen();
  expect(screen.getByTestId("loading")).toBeOnTheScreen();
  expect(screen.queryByText(/\d s$/)).not.toBeOnTheScreen();

  await nextPoll();
  expect(screen.getByText(/Drawing a 5 km heart…/)).toBeOnTheScreen();
  jest.useRealTimers();
});

test("Cancel stops waiting and tells the API to drop the job", async () => {
  jest.useFakeTimers();
  apiAnswers(job("computing"));
  await atTrento();
  await fireEvent.press(screen.getByText("Draw route"));
  await nextPoll();
  await fireEvent.press(screen.getByText("Cancel"));
  await act(() => jest.advanceTimersByTimeAsync(0));

  expect(screen.getByText("Draw route")).toBeOnTheScreen();
  expect(screen.queryByText(/Drawing a/)).not.toBeOnTheScreen();
  expect(apiCalls("DELETE").map(([url]) => String(url))).toEqual([
    `${API}/route-jobs/4f2c9e1a`,
  ]);
  jest.useRealTimers();
});

test("an error from the API is explained, with the engine's reason", async () => {
  jest.useFakeTimers();
  apiAnswers(jobFailed);
  await atTrento();
  await fireEvent.press(screen.getByText("Draw route"));
  await nextPoll();
  expect(
    screen.getByText(
      "This shape does not fit the roads here at this distance. It fits at about 4 km.",
    ),
  ).toBeOnTheScreen();
  expect(screen.getByText(apiError.error.message)).toBeOnTheScreen();
  jest.useRealTimers();
});

test("Try N km draws again at the distance the shape fits", async () => {
  jest.useFakeTimers();
  apiAnswers(jobFailed, jobDone);
  await atTrento();
  await fireEvent.press(screen.getByText("Draw route"));
  await nextPoll();
  apiAnswers(jobDone);
  await fireEvent.press(screen.getByRole("button", { name: "Try 4 km" }));
  await nextPoll();
  expect(lastRouteRequest()).toMatchObject({ shape: "heart", distance_m: 4000 });
  expectRoute("4.0", "4");
  await goBack();
  expect(distanceField().props.value).toBe("4");
  jest.useRealTimers();
});

test("an API that does not answer says so for the runner, and where it was looked for underneath", async () => {
  requestPermission.mockResolvedValue(permission(true));
  getPosition.mockResolvedValue(positionAt(46.0671, 11.1214));
  fetchSpy.mockRejectedValue(new TypeError("Network request failed"));
  await render(<App />);
  await fireEvent.press(await screen.findByText("Draw route"));
  expect(
    await screen.findByText("No connection. Check the network and try again."),
  ).toBeOnTheScreen();
  // For the developer, under jest as in a development build (TASK-256).
  expect(screen.getByText(`Cannot reach the API at ${API}.`)).toBeOnTheScreen();
});

test("a new start takes the old route away", async () => {
  jest.useFakeTimers();
  apiAnswers(jobDone);
  await atTrento();
  await fireEvent.press(screen.getByText("Draw route"));
  await nextPoll();
  expectRoute("4.0", "5");

  await goBack();
  getPosition.mockResolvedValue(positionAt(46.0122, 11.2986));
  await fireEvent.press(screen.getByText("My position"));
  await screen.findByText("Starting from your position.");

  expect(screen.queryByText(/on roads · target/)).not.toBeOnTheScreen();
  const scripts = injectJavaScript.mock.calls.map(([script]) => script);
  const shown = scripts.findIndex((script) => script.includes('"showRoute"'));
  const cleared = scripts.findIndex((script) => script.includes('"clearRoute"'));
  expect(shown).toBeGreaterThan(-1);
  expect(cleared).toBeGreaterThan(shown);
  jest.useRealTimers();
});

test("a new distance takes the old route away", async () => {
  jest.useFakeTimers();
  apiAnswers(jobDone);
  await atTrento();
  await fireEvent.press(screen.getByText("Draw route"));
  await nextPoll();
  expectRoute("4.0", "5");

  await goBack();
  await fireEvent.changeText(distanceField(), "10");

  expect(screen.queryByText(/on roads · target/)).not.toBeOnTheScreen();
  expect(lastScript()).toContain('"clearRoute"');
  jest.useRealTimers();
});

test("Export GPX shares the route as a file", async () => {
  jest.useFakeTimers();
  apiAnswers(jobDone);
  await atTrento();
  expect(screen.queryByText("Export GPX")).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByText("Draw route"));
  await nextPoll();

  await fireEvent.press(screen.getByText("Export GPX"));
  await act(() => jest.advanceTimersByTimeAsync(0));

  const [[url, init]] = apiCalls("POST").filter(([input]) =>
    String(input).endsWith("/gpx"),
  );
  expect(url).toBe(`${API}/gpx`);
  expect(JSON.parse(String(init?.body))).toEqual({
    request: {
      start: [46.0671, 11.1214],
      shape: "heart",
      distance_m: 5000,
      activity: "running",
    },
    result: jobDone.result,
  });
  expect(written.get(`file:///cache/${GPX_FILE}`)).toBe(GPX);
  expect(share).toHaveBeenCalledWith(`file:///cache/${GPX_FILE}`, expect.anything());
  expect(screen.getByText("Export GPX")).toBeOnTheScreen();
  jest.useRealTimers();
});

test("Export GPX says so when the phone cannot share", async () => {
  jest.useFakeTimers();
  sharingAvailable.mockResolvedValue(false);
  apiAnswers(jobDone);
  await atTrento();
  await fireEvent.press(screen.getByText("Draw route"));
  await nextPoll();
  await fireEvent.press(screen.getByText("Export GPX"));
  await act(() => jest.advanceTimersByTimeAsync(0));
  expect(screen.getByText("This phone cannot open the share sheet.")).toBeOnTheScreen();
  expect(share).not.toHaveBeenCalled();
  jest.useRealTimers();
});

test("a shape written in Italian is sent by its name", async () => {
  jest.useFakeTimers();
  apiAnswers(job("computing"));
  await atTrento();
  await fireEvent.changeText(screen.getByLabelText("Shape"), "Cavallo");
  expect(screen.getByText("→ horse")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("Draw route"));
  await nextPoll();

  expect(lastRouteRequest()).toEqual({
    start: [46.0671, 11.1214],
    shape: "horse",
    distance_m: 5000,
    activity: "running",
  });
  expect(screen.getByText(/Drawing a 5 km horse…/)).toBeOnTheScreen();
  jest.useRealTimers();
});

test("an unknown word turns Draw route off until the AI has read it", async () => {
  apiAnswers(jobDone);
  await atTrento();
  for (const text of ["drago", "casa"]) {
    await fireEvent.changeText(screen.getByLabelText("Shape"), text);
    expect(screen.getByText("Press Done and the AI will read it.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Draw route" })).toBeDisabled();
    await fireEvent.press(screen.getByText("Draw route"));
  }
  await fireEvent.changeText(screen.getByLabelText("Shape"), "");
  expect(
    screen.getByText(
      "Unknown shape. Try: circle, heart, star, horse, moon, cat, fish, butterfly, snail, dog head, rabbit head, pumpkin, christmas tree, smiley, ghost, donut or sun.",
    ),
  ).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Draw route" })).toBeDisabled();
  expect(apiCalls("POST")).toEqual([]);

  await fireEvent.changeText(screen.getByLabelText("Shape"), "star");
  expect(screen.queryByText(/Unknown shape|Press Done/)).not.toBeOnTheScreen();
  expect(screen.queryByText("→ star")).not.toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Draw route" })).toBeEnabled();
});

test("the AI reads the words the table does not know, once", async () => {
  jest.useFakeTimers();
  apiAnswers(job("computing"));
  readShape = (text) => Response.json({ text, shape: "horse" });
  await atTrento();
  const field = screen.getByLabelText("Shape");
  await fireEvent.changeText(field, "stemma della Ferrari");
  await fireEvent(field, "endEditing");
  expect(await screen.findByText("→ horse")).toBeOnTheScreen();
  await fireEvent(field, "endEditing");
  await fireEvent.press(screen.getByText("Draw route"));
  await nextPoll();

  const readings = apiCalls("POST").filter(([input]) =>
    String(input).endsWith("/shape-readings"),
  );
  expect(readings).toHaveLength(1);
  expect(JSON.parse(String(readings[0][1]?.body))).toEqual({
    text: "stemma della Ferrari",
  });
  expect(lastRouteRequest()).toMatchObject({ shape: "horse" });
  jest.useRealTimers();
});

test("words the table knows are not sent to the AI", async () => {
  apiAnswers(jobDone);
  await atTrento();
  const field = screen.getByLabelText("Shape");
  await fireEvent.changeText(field, "Cavallo");
  await fireEvent(field, "endEditing");
  expect(screen.getByText("→ horse")).toBeOnTheScreen();
  expect(apiCalls("POST")).toEqual([]);
});

test("words with no shape of the catalogue keep Draw route off", async () => {
  apiAnswers(jobDone);
  await atTrento();
  const field = screen.getByLabelText("Shape");
  await fireEvent.changeText(field, "Batman");
  await fireEvent(field, "endEditing");
  expect(
    await screen.findByText(/^No shape in the catalogue for “Batman”\. Describe/),
  ).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Draw route" })).toBeDisabled();

  await fireEvent.press(screen.getByRole("button", { name: "star" }));
  expect(field.props.value).toBe("star");
  expect(screen.getByRole("button", { name: "Draw route" })).toBeEnabled();
});

test("when the AI is off the app says so, and asks again next time", async () => {
  apiAnswers(jobDone);
  readShape = () =>
    Response.json(
      {
        error: {
          code: "ai_unavailable",
          message: "Ollama does not answer at http://127.0.0.1:11434/api/chat",
        },
      },
      { status: 503 },
    );
  await atTrento();
  const field = screen.getByLabelText("Shape");
  await fireEvent.changeText(field, "Garfield");
  await fireEvent(field, "endEditing");
  expect(
    await screen.findByText(
      "This word cannot be read right now. Try one of these: circle, heart, star, horse, moon, cat, fish, butterfly, snail, dog head, rabbit head, pumpkin, christmas tree, smiley, ghost, donut or sun.",
    ),
  ).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Draw route" })).toBeDisabled();

  readShape = (text) => Response.json({ text, shape: "cat" });
  await fireEvent(field, "endEditing");
  expect(await screen.findByText("→ cat")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Draw route" })).toBeEnabled();
});

test("a new shape takes the old route away", async () => {
  jest.useFakeTimers();
  apiAnswers(jobDone);
  await atTrento();
  await fireEvent.press(screen.getByText("Draw route"));
  await nextPoll();
  expectRoute("4.0", "5");

  await goBack();
  await fireEvent.changeText(screen.getByLabelText("Shape"), "stella");

  expect(screen.queryByText(/on roads · target/)).not.toBeOnTheScreen();
  expect(lastScript()).toContain('"clearRoute"');
  jest.useRealTimers();
});

test("Draw route opens the map, and Back returns to the same choice", async () => {
  jest.useFakeTimers();
  apiAnswers(jobDone);
  await atTrento();
  await fireEvent.press(screen.getByRole("button", { name: "star" }));
  await fireEvent.changeText(distanceField(), "8");
  await fireEvent.press(screen.getByText("Draw route"));
  await nextPoll();

  expectRoute("4.0", "8");
  expect(screen.queryByLabelText("Shape")).not.toBeOnTheScreen();

  await goBack();
  expect(screen.getByLabelText("Shape")).toHaveDisplayValue("star");
  expect(distanceField()).toHaveDisplayValue("8");
  expect(
    screen.getByRole("button", { name: "star", selected: true }),
  ).toBeOnTheScreen();

  // The same route again is shown, not asked for again.
  await fireEvent.press(screen.getByText("Draw route"));
  expectRoute("4.0", "8");
  expect(apiCalls("POST")).toHaveLength(1);
  jest.useRealTimers();
});

test("Back while waiting drops the job, as Cancel does", async () => {
  jest.useFakeTimers();
  apiAnswers(job("computing"));
  await atTrento();
  await fireEvent.press(screen.getByText("Draw route"));
  await nextPoll();
  await goBack();
  await act(() => jest.advanceTimersByTimeAsync(0));

  expect(screen.getByText("Draw route")).toBeOnTheScreen();
  expect(apiCalls("DELETE")).toHaveLength(1);
  jest.useRealTimers();
});

test("a shape picked after a failure goes back to the choice", async () => {
  jest.useFakeTimers();
  apiAnswers({
    ...jobFailed,
    error: { ...jobFailed.error, suggested_distance_m: null },
  });
  await atTrento();
  await fireEvent.press(screen.getByText("Draw route"));
  await nextPoll();
  await fireEvent.press(screen.getByRole("button", { name: "moon" }));

  expect(screen.getByLabelText("Shape")).toHaveDisplayValue("moon");
  expect(screen.getByRole("button", { name: "Draw route" })).toBeEnabled();
  jest.useRealTimers();
});

test("a shape picked after a failure is written as read: dog head", async () => {
  jest.useFakeTimers();
  apiAnswers({
    ...jobFailed,
    error: { ...jobFailed.error, suggested_distance_m: null },
  });
  await atTrento();
  await fireEvent.press(screen.getByText("Draw route"));
  await nextPoll();
  await fireEvent.press(screen.getByRole("button", { name: "dog head" }));

  expect(screen.getByLabelText("Shape")).toHaveDisplayValue("dog head");
  expect(screen.getByRole("button", { name: "Draw route" })).toBeEnabled();
  jest.useRealTimers();
});

test("− and + change the distance by a km, between 1 and 21", async () => {
  requestPermission.mockReturnValue(new Promise(() => {}));
  await render(<App />);
  await fireEvent.press(screen.getByRole("button", { name: "Longer" }));
  expect(distanceField()).toHaveDisplayValue("6");
  for (let i = 0; i < 10; i++) {
    await fireEvent.press(screen.getByRole("button", { name: "Shorter" }));
  }
  expect(distanceField()).toHaveDisplayValue("1");
});

test("touching a tile chooses that shape", async () => {
  requestPermission.mockReturnValue(new Promise(() => {}));
  await render(<App />);
  await fireEvent.press(screen.getByRole("button", { name: "fish" }));
  expect(screen.getByLabelText("Shape")).toHaveDisplayValue("fish");
  expect(
    screen.getByRole("button", { name: "fish", selected: true }),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole("button", { name: "heart", selected: false }),
  ).toBeOnTheScreen();
});

test("the dog's head tile writes the name the runner reads", async () => {
  requestPermission.mockReturnValue(new Promise(() => {}));
  await render(<App />);
  await fireEvent.press(screen.getByRole("button", { name: "dog head" }));
  expect(screen.getByLabelText("Shape")).toHaveDisplayValue("dog head");
  expect(
    screen.getByRole("button", { name: "dog head", selected: true }),
  ).toBeOnTheScreen();
  expect(screen.queryByText("→ dog head")).not.toBeOnTheScreen();

  await fireEvent.changeText(screen.getByLabelText("Shape"), "cane");
  expect(screen.getByText("→ dog head")).toBeOnTheScreen();
  expect(
    screen.getByRole("button", { name: "dog head", selected: true }),
  ).toBeOnTheScreen();
});

test("with the GPS on, another place can be the start, and stays so", async () => {
  jest.useFakeTimers();
  apiAnswers(job("computing"));
  await atTrento();
  expect(screen.queryByPlaceholderText("City or street")).not.toBeOnTheScreen();

  await fireEvent.press(screen.getByRole("button", { name: "Another place" }));
  expect(
    screen.getByText("Search for a city or street to start from."),
  ).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Draw route" })).toBeDisabled();
  await fireEvent.changeText(
    screen.getByPlaceholderText("City or street"),
    "Belenzani",
  );
  await fireEvent.press(screen.getByText("Search"));
  await fireEvent.press(await screen.findByText("Via Rodolfo Belenzani, Trento"));
  expect(
    screen.getByText("Starting from Via Rodolfo Belenzani, Trento."),
  ).toBeOnTheScreen();

  await fireEvent.press(screen.getByText("Draw route"));
  await nextPoll();
  expect(lastRouteRequest()).toMatchObject({ start: [46.0692621, 11.1211947] });
  jest.useRealTimers();
});

test("My position goes back to the GPS after another place", async () => {
  fetchSpy.mockImplementation(async () => Response.json(response));
  await atTrento();
  await fireEvent.press(screen.getByRole("button", { name: "Another place" }));
  await fireEvent.changeText(
    screen.getByPlaceholderText("City or street"),
    "Belenzani",
  );
  await fireEvent.press(screen.getByText("Search"));
  await fireEvent.press(await screen.findByText("Via Rodolfo Belenzani, Trento"));

  await fireEvent.press(screen.getByRole("button", { name: "My position" }));
  expect(await screen.findByText("Starting from your position.")).toBeOnTheScreen();
  expect(
    screen.getByRole("button", { name: "My position", selected: true }),
  ).toBeOnTheScreen();
  expect(screen.queryByPlaceholderText("City or street")).not.toBeOnTheScreen();
  expect(lastScript()).toContain('"lngLat":[11.1214,46.0671]');
});

/** The route of jobDone, drawn as a word (TASK-056): no shape, the word. */
function wordDone(word: string) {
  return {
    ...jobDone,
    result: { ...jobDone.result, shape: null, word },
  };
}

async function chooseWord(word: string) {
  await fireEvent.press(screen.getByRole("button", { name: "Word" }));
  await fireEvent.changeText(screen.getByLabelText("Word"), word);
}

test("a word is sent as `word`, and named while waiting and on the result", async () => {
  jest.useFakeTimers();
  apiAnswers(job("computing"), wordDone("CIAO"));
  await atTrento();
  await chooseWord("ciao");
  await fireEvent.changeText(distanceField(), "12");
  expect(
    screen.getByRole("button", { name: "Word", selected: true }),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("Draw route"));
  await nextPoll();
  expect(screen.getByText(/Drawing “CIAO”, 12 km…/)).toBeOnTheScreen();

  await nextPoll();
  expect(screen.getByText("“CIAO” · on roads · target 12 km")).toBeOnTheScreen();
  expect(lastRouteRequest()).toEqual({
    start: [46.0671, 11.1214],
    word: "CIAO",
    style: "round",
    // The pen is lifted between the letters unless switched off (TASK-202).
    pen_up: true,
    distance_m: 12000,
    activity: "running",
  });
  jest.useRealTimers();
});

test("square letters are sent as style block (TASK-080)", async () => {
  jest.useFakeTimers();
  apiAnswers(job("computing"), wordDone("CIAO"));
  await atTrento();
  await chooseWord("ciao");
  await fireEvent.changeText(distanceField(), "12");
  expect(
    screen.getByRole("button", { name: "Round", selected: true }),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Square" }));
  expect(
    screen.getByText("Square letters follow the street grid: best for short words."),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("Draw route"));
  await nextPoll();
  expect(lastRouteRequest()).toMatchObject({ word: "CIAO", style: "block" });
  jest.useRealTimers();
});

test("a distance short for the word keeps Draw route off, and Use N km fixes it", async () => {
  await atTrento();
  await chooseWord("ciao");
  expect(
    screen.getByText("“CIAO” needs at least 12 km: 3 km for each letter."),
  ).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Draw route" })).toBeDisabled();

  await fireEvent.press(screen.getByText("Use 12 km"));
  expect(distanceField()).toHaveDisplayValue("12");
  expect(screen.getByRole("button", { name: "Draw route" })).toBeEnabled();
});

test("a letter out of the alphabet keeps Draw route off and says which", async () => {
  await atTrento();
  await fireEvent.changeText(distanceField(), "15");
  await chooseWord("città");
  expect(
    screen.getByText(
      "No letter “À”: a word can use only the letters A to Z, without accents.",
    ),
  ).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Draw route" })).toBeDisabled();
  expect(apiCalls("POST")).toEqual([]);
});

test("Shape and Word each keep what was written in them", async () => {
  await atTrento();
  await chooseWord("kiwi");
  await fireEvent.press(screen.getByRole("button", { name: "Shape" }));
  expect(screen.queryByLabelText("Word")).not.toBeOnTheScreen();
  expect(screen.getByLabelText("Shape")).toHaveDisplayValue("heart");
  expect(
    screen.getByRole("button", { name: "heart", selected: true }),
  ).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole("button", { name: "Word" }));
  expect(screen.getByLabelText("Word")).toHaveDisplayValue("kiwi");
});
