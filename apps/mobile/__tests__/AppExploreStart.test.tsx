/**
 * Start on a route of "Explore" (TASK-145, ADR-0117): its directions are
 * asked for, then turn-by-turn along its line, and Stop goes back to its
 * card. The rest of the app is in App.test.tsx.
 */
import detail from "@shaperoute/shared-types/fixtures/recommended-route.json";
import list from "@shaperoute/shared-types/fixtures/recommended-routes.json";
import answered from "@shaperoute/shared-types/fixtures/route-directions.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";
import * as Speech from "expo-speech";

import App from "../App";

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
  Accuracy: { Balanced: 3, BestForNavigation: 6 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));
jest.mock("expo-speech", () => ({ speak: jest.fn(), stop: jest.fn() }));
jest.mock("expo-brightness", () => ({
  getBrightnessAsync: jest.fn(() => Promise.resolve(0.6)),
  setBrightnessAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));

const { injectJavaScript } =
  jest.requireMock<typeof import("../__mocks__/react-native-webview")>(
    "react-native-webview",
  );
const API = "http://192.168.1.23:8000";
const mapMissing = {
  error: {
    code: "map_data_unavailable",
    message: "OpenStreetMap data for this area could not be downloaded.",
    suggested_distance_m: null,
    reason: null,
  },
};

let fetchSpy: jest.SpiedFunction<typeof fetch>;
let directionsAnswer: () => Response;

function directionCalls(): RequestInit[] {
  return fetchSpy.mock.calls
    .filter(([url]) => String(url) === `${API}/route-directions`)
    .map(([, init]) => init as RequestInit);
}

beforeEach(() => {
  injectJavaScript.mockClear();
  directionsAnswer = () => Response.json(answered);
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 46.067, longitude: 11.1215 },
  } as Location.LocationObject);
  jest
    .mocked(Location.watchPositionAsync)
    .mockResolvedValue({ remove: jest.fn() } as Location.LocationSubscription);
  fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url === `${API}/route-directions`) {
      return directionsAnswer();
    }
    if (url.startsWith(`${API}/recommended-routes/`)) {
      return Response.json(detail);
    }
    if (url.startsWith(`${API}/recommended-routes`)) {
      return Response.json(list);
    }
    return Response.json(
      { error: { code: "http_error", message: url } },
      { status: 404 },
    );
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
});

/** From the first screen to a route of "Explore" open on the map. */
async function openedFromExplore() {
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
  await fireEvent.press(screen.getByText("Explore"));
  await fireEvent.press(await screen.findByText("Star · 5.1 km"));
  await screen.findByText("Back to the list");
}

test("Start asks for the route's directions, then follows its line", async () => {
  let onPosition: (position: Location.LocationObject) => void = () => {};
  jest
    .mocked(Location.watchPositionAsync)
    .mockImplementation(async (_options, callback) => {
      onPosition = callback;
      return { remove: jest.fn() };
    });
  jest.mocked(Speech.speak).mockClear();
  await openedFromExplore();
  await fireEvent.press(screen.getByText("Start"));

  const [init] = directionCalls();
  expect(init.method).toBe("POST");
  expect(JSON.parse(String(init.body))).toEqual({ points: detail.points });
  // The banner has the next turn.
  expect(
    await screen.findByText("Continue straight onto Corso Italia"),
  ).toBeOnTheScreen();
  // The star is closed: the voice says where it heads out once the runner
  // is on it (TASK-273), here from its start.
  expect(Speech.speak).not.toHaveBeenCalledWith(
    expect.stringContaining("Head out"),
    expect.anything(),
  );
  const [[lat0, lon0], [lat1, lon1]] = detail.points;
  await act(async () => {
    for (let i = 0; i <= 4; i += 1) {
      const t = (i * 8) / 353;
      onPosition({
        coords: {
          latitude: lat0 + t * (lat1 - lat0),
          longitude: lon0 + t * (lon1 - lon0),
          accuracy: 5,
        },
        timestamp: Date.now() + i * 1000,
      } as Location.LocationObject);
    }
  });
  expect(Speech.speak).toHaveBeenCalledWith(
    expect.stringContaining("Head out on Via Roma"),
    expect.anything(),
  );
  expect(screen.getByText("Stop")).toBeOnTheScreen();
  expect(Location.watchPositionAsync).toHaveBeenCalled();
  // The map shows the line of the route of "Explore", not a drawn one.
  const shown = injectJavaScript.mock.calls
    .map(([script]) => String(script))
    .findLast((s) => s.includes('"type":"showRoute"'));
  const [lat, lon] = detail.points[0];
  expect(shown).toContain(`"coordinates":[[${lon},${lat}]`);

  // Stop: back to the route's card; Start again asks nothing new.
  await fireEvent.press(screen.getByText("Stop"));
  expect(await screen.findByText("Back to the list")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("Start"));
  expect(await screen.findByText("Stop")).toBeOnTheScreen();
  expect(directionCalls()).toHaveLength(1);
});

test("without directions the card says why and Start tries again", async () => {
  directionsAnswer = () => Response.json(mapMissing, { status: 503 });
  await openedFromExplore();
  await fireEvent.press(screen.getByText("Start"));
  expect(
    await screen.findByText(
      "The map of this area could not be loaded for directions. Try again later.",
    ),
  ).toBeOnTheScreen();
  expect(screen.queryByText("Stop")).toBeNull();

  directionsAnswer = () => Response.json(answered);
  await fireEvent.press(screen.getByText("Start"));
  expect(await screen.findByText("Stop")).toBeOnTheScreen();
  expect(directionCalls()).toHaveLength(2);
});

test("back to the list drops the wait: the directions start nothing", async () => {
  let answer: (response: Response) => void = () => {};
  fetchSpy.mockImplementation(async (input) => {
    const url = String(input);
    if (url === `${API}/route-directions`) {
      return new Promise<Response>((resolve) => {
        answer = resolve;
      });
    }
    return Response.json(url.includes("/recommended-routes/") ? detail : list);
  });
  await openedFromExplore();
  await fireEvent.press(screen.getByText("Start"));
  expect(screen.getByText("Getting directions…")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("Back to the list"));
  await act(async () => answer(Response.json(answered)));
  expect(screen.queryByText("Stop")).toBeNull();
  expect(screen.getByText("Star · 5.1 km")).toBeOnTheScreen();
});
