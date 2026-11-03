/**
 * Choosing among several routes (TASK-093, ADR-0087): the tiles under the
 * route, the others grey on the map, and the chosen one exported. The rest
 * of the app is in App.test.tsx.
 */
import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";
import * as Sharing from "expo-sharing";

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
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const { injectJavaScript } =
  jest.requireMock<typeof import("../__mocks__/react-native-webview")>(
    "react-native-webview",
  );
const API = "http://192.168.1.23:8000";
const GPX = '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1"></gpx>';
const [other] = jobDone.result.alternatives;

let fetchSpy: jest.SpiedFunction<typeof fetch>;

beforeEach(() => {
  injectJavaScript.mockClear();
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(Sharing.shareAsync).mockResolvedValue();
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: true } as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 46.0671, longitude: 11.1214 },
  } as Location.LocationObject);
  fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (String(input) === `${API}/gpx`) {
      return new Response(GPX, {
        headers: { "Content-Disposition": 'attachment; filename="route.gpx"' },
      });
    }
    if ((init?.method ?? "GET") === "POST") {
      const queued = {
        job_id: "4f2c9e1a",
        status: "queued",
        result: null,
        error: null,
      };
      return Response.json(queued, { status: 202 });
    }
    return Response.json(jobDone);
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
  jest.useRealTimers();
});

function scripts(): string[] {
  return injectJavaScript.mock.calls.map(([script]) => String(script));
}

async function drawn() {
  jest.useFakeTimers();
  await render(<App />);
  await screen.findByText("Starting from your position.");
  await fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
  await fireEvent.press(screen.getByTestId("draw-route"));
  await act(() => jest.advanceTimersByTimeAsync(2000));
}

test("the routes to choose from are tiles, the engine's first and chosen", async () => {
  await drawn();
  const a = screen.getByRole("radio", { name: /^Route A, 4\.0 km, 91% like/ });
  const b = screen.getByRole("radio", { name: /^Route B, 4\.2 km, 88% like/ });
  expect(a).toBeSelected();
  expect(b).not.toBeSelected();
  expect(screen.getByText("4.0 km")).toBeOnTheScreen();
  // The other route, grey under the route, before the route frames the map.
  const others = scripts().findLast((s) => s.includes('"type":"showOthers"'));
  expect(others).toContain('"lines":[[[11.1214,46.0671],[11.135,46.0675]');
  expect(scripts().at(-1)).toContain(
    '"type":"showRoute","coordinates":[[11.1214,46.0671],[11.1344',
  );
});

test("a tile chosen is the route shown, and the one exported", async () => {
  await drawn();
  await fireEvent.press(screen.getByTestId("route-B"));

  expect(screen.getByRole("radio", { name: /^Route B/ })).toBeSelected();
  expect(screen.getByText("4.2 km")).toBeOnTheScreen();
  expect(scripts().at(-1)).toContain(
    '"type":"showRoute","coordinates":[[11.1214,46.0671],[11.135,46.0675]',
  );
  const others = scripts().findLast((s) => s.includes('"type":"showOthers"'));
  expect(others).toContain('"lines":[[[11.1214,46.0671],[11.1344,46.0671]');

  await fireEvent.press(screen.getByText("Export GPX"));
  await act(() => jest.advanceTimersByTimeAsync(0));
  const [[, init]] = fetchSpy.mock.calls.filter(([input]) =>
    String(input).endsWith("/gpx"),
  );
  expect(JSON.parse(String(init?.body)).result).toEqual(other);
});
