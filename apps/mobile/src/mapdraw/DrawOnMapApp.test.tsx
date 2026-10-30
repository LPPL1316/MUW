import jobDone from "@shaperoute/shared-types/fixtures/route-job-done.json";
import type { RouteResult } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Location from "expo-location";
import { Alert } from "react-native";

import App from "../../App";
import type { MemorySecureStore } from "../account/testing";
import { requestRouteOnPhoneFirst } from "../engine/onPhone";
import { RouteChoice } from "../route/RoutePanel";
import { checkWord } from "../route/wordInput";
import { saveUnitsChoice } from "../units/units";

// «Draw on the map» in the app itself (TASK-281): «Freehand», first in the
// switch of «Draw» (TASK-340), the figure on the map, its route shown as one of
// «Draw», and «←» back to the figure as it was. The setup is
// `Profile.test.tsx`'s: no GPS, no account; the route comes from a stand-in.

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
jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock("expo-secure-store", () =>
  jest
    .requireActual<typeof import("../account/testing")>("../account/testing")
    .memorySecureStore(),
);
jest.mock("../engine/onPhone", () => ({
  ...jest.requireActual<typeof import("../engine/onPhone")>("../engine/onPhone"),
  requestRouteOnPhoneFirst: jest.fn(),
}));

const { injectJavaScript } =
  jest.requireMock<typeof import("../../__mocks__/react-native-webview")>(
    "react-native-webview",
  );
const store = jest.requireMock<MemorySecureStore>("expo-secure-store");
const ROUTE = jobDone.result as unknown as RouteResult;
let fetchSpy: jest.SpiedFunction<typeof fetch>;

beforeEach(() => {
  store.kept.clear();
  injectJavaScript.mockClear();
  jest.mocked(requestRouteOnPhoneFirst).mockReset();
  jest
    .mocked(requestRouteOnPhoneFirst)
    .mockResolvedValue({ kind: "route", result: ROUTE });
  fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    throw new Error(`Not in this test: ${String(input)}`);
  });
  jest
    .mocked(Location.requestForegroundPermissionsAsync)
    .mockResolvedValue({ granted: false } as never);
  saveUnitsChoice("km");
});

afterEach(async () => {
  fetchSpy.mockRestore();
  await act(async () => saveUnitsChoice("phone"));
});

function pagePosts(data: string) {
  return fireEvent(screen.getByTestId("map"), "message", { nativeEvent: { data } });
}

/** The messages of a type the map page was sent, in order. */
function sent(type: string): Record<string, unknown>[] {
  return injectJavaScript.mock.calls
    .map(([script]: [string]) => script.match(/receive\((.*)\); true;$/)?.[1])
    .filter((json): json is string => json !== undefined)
    .map((json) => JSON.parse(json) as Record<string, unknown>)
    .filter((message) => message.type === type);
}

test("the figure's route opens as one of «Draw», and «←» comes back to the figure", async () => {
  await render(<App />);
  await pagePosts('{"type":"ready"}');
  // Where the map is: the figure goes there.
  await pagePosts('{"type":"centre","lngLat":[11.13,46.07]}');

  await fireEvent.press(screen.getByText("Freehand"));
  expect(screen.getByText("Undo")).toBeOnTheScreen();
  // Framed as it opens, with no figure yet.
  expect(sent("setCanvas").at(-1)).toMatchObject({
    mode: "draw",
    lines: [],
    frame: true,
  });

  await fireEvent.press(screen.getByLabelText("heart"));
  expect(screen.getByText("≈ 5.0 km")).toBeOnTheScreen();
  const shown = sent("setCanvas").at(-1);
  expect(shown).toMatchObject({ mode: "move", frame: true, centre: [11.13, 46.07] });
  expect((shown?.lines as unknown[]).length).toBe(1);

  await act(async () => fireEvent.press(screen.getByText("Draw route")));
  expect(requestRouteOnPhoneFirst).toHaveBeenCalledTimes(1);
  const [, asked] = jest.mocked(requestRouteOnPhoneFirst).mock.calls[0];
  expect(asked).toMatchObject({
    shape: "heart",
    distance_m: 5000,
    activity: "running",
  });
  // The result, as for «Draw»: the figure leaves the map for the route.
  expect(screen.getByText("Export GPX")).toBeOnTheScreen();
  expect(screen.queryByText("Undo")).toBeNull();
  expect(sent("clearCanvas")).toHaveLength(1);
  expect(sent("showRoute")).toHaveLength(1);

  // «←»: the figure as it was, the map framed on it again.
  await fireEvent.press(screen.getByLabelText("Back"));
  expect(screen.getByText("Undo")).toBeOnTheScreen();
  expect(screen.getByText("≈ 5.0 km")).toBeOnTheScreen();
  const back = sent("setCanvas").at(-1);
  expect(back).toMatchObject({
    frame: true,
    lines: shown?.lines,
    centre: shown?.centre,
  });

  // The same figure is shown again, not asked for again.
  await act(async () => fireEvent.press(screen.getByText("Draw route")));
  expect(requestRouteOnPhoneFirst).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Export GPX")).toBeOnTheScreen();

  // From the figure, «←» goes back to «Draw».
  await fireEvent.press(screen.getByLabelText("Back"));
  await fireEvent.press(screen.getByLabelText("Back"));
  expect(screen.getByText("Freehand")).toBeOnTheScreen();
});

test("drawing by hand is on the map only: an open line stays open, and its route is a «Drawing» (TASK-331)", async () => {
  await render(<App />);
  await pagePosts('{"type":"ready"}');
  await pagePosts('{"type":"centre","lngLat":[11.13,46.07]}');
  // «Draw» has no board of its own, and no «Edit the drawing» (TASK-340).
  await fireEvent.press(screen.getByLabelText("heart"));
  expect(screen.queryByText("Edit the drawing")).toBeNull();

  await fireEvent.press(screen.getByText("Freehand"));
  expect(
    screen.getByText(
      "Draw with one finger. End where you started to close it. Two fingers move the map.",
    ),
  ).toBeOnTheScreen();
  // An arch, its ends far apart, as a finger draws it.
  const arch = Array.from({ length: 20 }, (_, i) => {
    const a = (Math.PI * i) / 19;
    return [11.13 + 0.01 * Math.cos(a), 46.07 + 0.007 * Math.sin(a)];
  });
  await pagePosts(JSON.stringify({ type: "drawn", line: arch, metresPerPx: 2 }));
  expect(
    screen.getByText("Each new line joins the drawing. Two fingers move the map."),
  ).toBeOnTheScreen();
  // On the page, the line as drawn and the ring too small to see at its start.
  const lines = sent("setCanvas").at(-1)?.lines as [number, number][][];
  expect(lines).toHaveLength(2);
  expect(lines[0]).toHaveLength(4);
  const [first] = lines[1];
  const last = lines[1][lines[1].length - 1];
  expect(Math.abs(first[0] - last[0])).toBeGreaterThan(0.015);

  await act(async () => fireEvent.press(screen.getByText("Draw route")));
  const [, asked] = jest.mocked(requestRouteOnPhoneFirst).mock.calls[0];
  expect(asked).toMatchObject({ activity: "running" });
  expect("outline" in asked && asked.outline).toHaveLength(4);
  expect("strokes" in asked && asked.strokes).toHaveLength(1);
  expect(screen.getByText(/^Drawing · on roads · target/)).toBeOnTheScreen();
});

test("the tools under the map: «Line» taps a line, «Clear all» asks first, «Redo» undoes «Undo» (TASK-331 B)", async () => {
  const alert = jest
    .spyOn(Alert, "alert")
    .mockImplementation((_title, _message, buttons) =>
      buttons?.find((button) => button.style === "destructive")?.onPress?.(),
    );
  await render(<App />);
  await pagePosts('{"type":"ready"}');
  await pagePosts('{"type":"centre","lngLat":[11.13,46.07]}');
  await fireEvent.press(screen.getByText("Freehand"));
  for (const label of ["Draw", "Line", "Erase", "Move", "Undo", "Redo", "Clear all"]) {
    expect(screen.getByRole("button", { name: label })).toBeOnTheScreen();
  }
  await fireEvent.press(screen.getByRole("button", { name: "Line" }));
  expect(
    screen.getByText(
      "Tap point after point. Tap the first point to close it, the last one to finish.",
    ),
  ).toBeOnTheScreen();
  expect(sent("setCanvas").at(-1)).toMatchObject({ mode: "line", marks: [] });
  const tap = (lngLat: [number, number]) =>
    pagePosts(JSON.stringify({ type: "drawn", line: [lngLat], metresPerPx: 2 }));
  await tap([11.13, 46.07]);
  expect(sent("setCanvas").at(-1)).toMatchObject({
    marks: [[11.13, 46.07]],
    lines: [],
  });
  await tap([11.14, 46.07]);
  // The line, on the small ring at its start.
  expect(sent("setCanvas").at(-1)?.lines).toHaveLength(2);
  expect(screen.getByText(/^≈ /)).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole("button", { name: "Clear all" }));
  expect(alert).toHaveBeenCalledWith(
    "Clear the whole drawing?",
    undefined,
    expect.any(Array),
  );
  expect(sent("setCanvas").at(-1)?.lines).toEqual([]);
  await fireEvent.press(screen.getByRole("button", { name: "Undo" }));
  expect(sent("setCanvas").at(-1)?.lines).toHaveLength(2);
  await fireEvent.press(screen.getByRole("button", { name: "Redo" }));
  expect(sent("setCanvas").at(-1)?.lines).toEqual([]);
  alert.mockRestore();
});

test("«Freehand» comes first and opens the map; on the water there is none", async () => {
  const props = {
    kind: "shape" as const,
    onKind: jest.fn(),
    shapeText: "heart",
    shape: "heart" as const,
    onShapeText: jest.fn(),
    reading: null,
    onShapeDone: jest.fn(),
    wordText: "",
    onWordText: jest.fn(),
    wordCheck: checkWord("", 2000, "paddling"),
    letterStyle: "round" as const,
    onLetterStyle: jest.fn(),
    distanceText: "2",
    distanceM: 2000,
    image: { status: "none" as const },
    onChooseImage: jest.fn(),
    onDistanceText: jest.fn(),
    onFreehand: jest.fn(),
  };
  const { rerender } = await render(<RouteChoice {...props} activity="paddling" />);
  expect(screen.queryByText("Freehand")).toBeNull();
  await rerender(<RouteChoice {...props} activity="running" />);
  expect(
    screen
      .getAllByText(/^(Freehand|Shape|Word|Image)$/)
      .map((text) => text.props.children as string),
  ).toEqual(["Freehand", "Shape", "Word", "Image"]);
  // A label on two lines, as «A mano libera» is, stays in the middle.
  expect(screen.getByText("Freehand")).toHaveStyle({ textAlign: "center" });

  // It opens the map; the switch stays on what was chosen.
  await fireEvent.press(screen.getByRole("button", { name: "Freehand" }));
  expect(props.onFreehand).toHaveBeenCalledTimes(1);
  expect(props.onKind).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Shape" })).toBeSelected();
  expect(screen.getByRole("button", { name: "Freehand" })).not.toBeSelected();
});
