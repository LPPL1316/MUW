import type { LatLon } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

import { controlRun, type RunSession } from "../navigation/runControl";
import type { RunRecorder } from "../navigation/trackStore";
import { MapView } from "./MapView";

// A run behind another app, the camera for a photo, has no map page
// (TASK-304, ADR-0264): MuW asks less of the phone, so iOS keeps it and its
// GPS more readily. Back in front the page loads again, told everything.

jest.mock("react-native-webview");
const { injectJavaScript } =
  jest.requireMock<typeof import("../../__mocks__/react-native-webview")>(
    "react-native-webview",
  );

const TRENTO: LatLon = [46.0671, 11.1214];
const ROUTE: LatLon[] = [TRENTO, [46.068, 11.1214], [46.068, 11.123]];
const TRACK: LatLon[] = [TRENTO, [46.0675, 11.1214]];

/** A run under the controls, its first metres done: no countdown. */
function runOn(): RunSession {
  const recorder: RunRecorder = {
    onFix: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    liftPen: jest.fn(),
    lowerPen: jest.fn(),
    leave: jest.fn(),
    stop: jest.fn(),
    track: () => ({
      fixes: [{ point: TRENTO, timeMs: Date.now(), accuracyM: 5 }],
      distanceM: 0,
    }),
  };
  return controlRun(recorder, { onChange: jest.fn(), say: jest.fn() });
}

let listeners: ((next: AppStateStatus) => void)[] = [];
let listen: jest.SpyInstance;

let state: AppStateStatus = "active";
function goTo(next: AppStateStatus) {
  state = next;
  return act(() => listeners.forEach((listener) => listener(next)));
}

function pageReady() {
  return fireEvent(screen.getByTestId("map"), "message", {
    nativeEvent: { data: '{"type":"ready"}' },
  });
}

function told(type: string): number {
  return injectJavaScript.mock.calls.filter(([script]) =>
    script.includes(`"type":"${type}"`),
  ).length;
}

beforeEach(() => {
  jest.useFakeTimers();
  injectJavaScript.mockClear();
  listeners = [];
  state = "active";
  Object.defineProperty(AppState, "currentState", {
    configurable: true,
    get: () => state,
  });
  listen = jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_type, listener) => {
      listeners.push(listener as (next: AppStateStatus) => void);
      return {
        remove: () => {
          listeners = listeners.filter((other) => other !== listener);
        },
      } as ReturnType<typeof AppState.addEventListener>;
    });
});

afterEach(() => {
  listen.mockRestore();
  jest.useRealTimers();
});

test("a run behind another app has no page; back in front it has route and track again", async () => {
  await render(
    <MapView
      start={TRENTO}
      route={ROUTE}
      track={TRACK}
      following={TRENTO}
      onError={jest.fn()}
    />,
  );
  await pageReady();
  const session = await act(() => runOn());
  expect(told("showRoute")).toBe(1);

  await goTo("background");
  expect(screen.queryByTestId("map")).toBeNull();

  await goTo("active");
  injectJavaScript.mockClear();
  await pageReady();
  // The page that loads again is told what the one before showed.
  expect(told("showRoute")).toBe(1);
  expect(told("showTrack")).toBe(1);
  expect(told("follow")).toBe(1);
  await act(() => session.end());
});

test("nothing is told to a page that is not there", async () => {
  await render(
    <MapView start={TRENTO} route={ROUTE} track={TRACK} onError={jest.fn()} />,
  );
  await pageReady();
  const session = await act(() => runOn());
  await goTo("background");
  injectJavaScript.mockClear();
  // The run goes on behind: a longer line.
  await screen.rerender(
    <MapView
      start={TRENTO}
      route={ROUTE}
      track={[...TRACK, [46.068, 11.1214]]}
      onError={jest.fn()}
    />,
  );
  expect(injectJavaScript).not.toHaveBeenCalled();
  await act(() => session.end());
});

test("«inactive» keeps the page: Control Center, a notification pulled down", async () => {
  await render(<MapView start={TRENTO} route={ROUTE} onError={jest.fn()} />);
  const session = await act(() => runOn());
  await goTo("inactive");
  expect(screen.getByTestId("map")).toBeOnTheScreen();
  await act(() => session.end());
});

test("the run ending behind brings the page back", async () => {
  await render(<MapView start={TRENTO} route={ROUTE} onError={jest.fn()} />);
  const session = await act(() => runOn());
  await goTo("background");
  expect(screen.queryByTestId("map")).toBeNull();
  await act(() => session.end());
  expect(screen.getByTestId("map")).toBeOnTheScreen();
});

test("without a run, in the background the map stays", async () => {
  await render(<MapView start={TRENTO} route={ROUTE} onError={jest.fn()} />);
  await goTo("background");
  expect(screen.getByTestId("map")).toBeOnTheScreen();
});
