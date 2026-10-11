import type { LatLon } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";

import { setPocketOn } from "../navigation/pocketOn";
import { cumulative } from "../navigation/progress";
import { MapView } from "./MapView";

jest.mock("react-native-webview");
const { injectJavaScript } =
  jest.requireMock<typeof import("../../__mocks__/react-native-webview")>(
    "react-native-webview",
  );

const TRENTO: LatLon = [46.0671, 11.1214];
const LEVICO: LatLon = [46.0122, 11.2986];

function pagePosts(data: string) {
  return fireEvent(screen.getByTestId("map"), "message", { nativeEvent: { data } });
}

beforeEach(() => {
  injectJavaScript.mockClear();
});

test("sends the start only once the page is ready", async () => {
  await render(<MapView start={TRENTO} route={null} onError={jest.fn()} />);
  expect(injectJavaScript).not.toHaveBeenCalled();

  await pagePosts('{"type":"ready"}');
  expect(injectJavaScript).toHaveBeenCalledTimes(1);
  expect(injectJavaScript.mock.calls[0][0]).toContain("[11.1214,46.0671]");
});

test("sends every new start", async () => {
  const { rerender } = await render(
    <MapView start={TRENTO} route={null} onError={jest.fn()} />,
  );
  await pagePosts('{"type":"ready"}');
  await rerender(<MapView start={LEVICO} route={null} onError={jest.fn()} />);
  expect(injectJavaScript).toHaveBeenCalledTimes(2);
  expect(injectJavaScript.mock.calls[1][0]).toContain("[11.2986,46.0122]");
});

test("sends nothing without a start", async () => {
  await render(<MapView start={null} route={null} onError={jest.fn()} />);
  await pagePosts('{"type":"ready"}');
  expect(injectJavaScript).not.toHaveBeenCalled();
});

test("draws a route in MapLibre order, then clears it", async () => {
  const route: LatLon[] = [TRENTO, LEVICO, TRENTO];
  const { rerender } = await render(
    <MapView start={TRENTO} route={null} onError={jest.fn()} />,
  );
  await pagePosts('{"type":"ready"}');
  await rerender(<MapView start={TRENTO} route={route} onError={jest.fn()} />);
  expect(injectJavaScript.mock.calls.at(-1)?.[0]).toContain(
    '{"type":"showRoute","coordinates":[[11.1214,46.0671],[11.2986,46.0122],[11.1214,46.0671]],"startHere":null}',
  );

  await rerender(<MapView start={TRENTO} route={null} onError={jest.fn()} />);
  expect(injectJavaScript.mock.calls.at(-1)?.[0]).toContain('{"type":"clearRoute"}');
  expect(injectJavaScript).toHaveBeenCalledTimes(3);
});

test("marks where a route begins when it is away from the start", async () => {
  const route: LatLon[] = [LEVICO, TRENTO, LEVICO];
  const { rerender } = await render(
    <MapView start={TRENTO} route={null} onError={jest.fn()} />,
  );
  await pagePosts('{"type":"ready"}');
  await rerender(<MapView start={TRENTO} route={route} onError={jest.fn()} />);
  expect(injectJavaScript.mock.calls.at(-1)?.[0]).toContain(
    '"startHere":[11.2986,46.0122]',
  );
});

test("clears nothing that was never drawn", async () => {
  const { rerender } = await render(
    <MapView start={null} route={null} onError={jest.fn()} />,
  );
  await pagePosts('{"type":"ready"}');
  await rerender(<MapView start={null} route={null} onError={jest.fn()} />);
  expect(injectJavaScript).not.toHaveBeenCalled();
});

test("passes on the errors of the page", async () => {
  const onError = jest.fn();
  await render(<MapView start={null} route={null} onError={onError} />);
  await pagePosts('{"type":"error","message":"MapLibre GL JS did not load"}');
  expect(onError).toHaveBeenCalledWith("MapLibre GL JS did not load");
});

test("opens links in the phone's browser, not in the map", async () => {
  const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  await render(<MapView start={null} route={null} onError={jest.fn()} />);
  const shouldLoad = screen.getByTestId("map").props.onShouldStartLoadWithRequest;

  expect(shouldLoad({ url: "about:blank" })).toBe(true);
  expect(openURL).not.toHaveBeenCalled();

  expect(shouldLoad({ url: "https://www.openstreetmap.org/copyright" })).toBe(false);
  expect(openURL).toHaveBeenCalledWith("https://www.openstreetmap.org/copyright");
  openURL.mockRestore();
});

test("shows a bar over the map until the first tiles are drawn", async () => {
  await render(<MapView start={TRENTO} route={null} onError={jest.fn()} />);
  expect(screen.getByTestId("map-loading")).toBeTruthy();
  await pagePosts('{"type":"ready"}');
  expect(screen.getByTestId("map-loading")).toBeTruthy();

  await pagePosts('{"type":"loaded"}');
  expect(screen.queryByTestId("map-loading")).toBeNull();
});

test("a map that cannot load shows no bar, the error instead", async () => {
  const onError = jest.fn();
  await render(<MapView start={TRENTO} route={null} onError={onError} />);
  await pagePosts('{"type":"error","message":"style not found"}');
  expect(onError).toHaveBeenCalledWith("style not found");
  expect(screen.queryByTestId("map-loading")).toBeNull();
});

test("draws the run over the route, then clears it", async () => {
  const route: LatLon[] = [TRENTO, LEVICO, TRENTO];
  const run: LatLon[] = [TRENTO, LEVICO];
  const { rerender } = await render(
    <MapView start={null} route={route} onError={jest.fn()} />,
  );
  await pagePosts('{"type":"ready"}');
  const before = injectJavaScript.mock.calls.length;
  await rerender(
    <MapView start={null} route={route} track={run} onError={jest.fn()} />,
  );
  expect(injectJavaScript).toHaveBeenCalledTimes(before + 1);
  expect(injectJavaScript.mock.calls.at(-1)?.[0]).toContain(
    '{"type":"showTrack","coordinates":[[11.1214,46.0671],[11.2986,46.0122]]}',
  );

  await rerender(
    <MapView start={null} route={route} track={null} onError={jest.fn()} />,
  );
  expect(injectJavaScript.mock.calls.at(-1)?.[0]).toContain('{"type":"clearTrack"}');
});

test("draws the other routes, and takes them away when there are none", async () => {
  const others: LatLon[][] = [[TRENTO, LEVICO, TRENTO]];
  const { rerender } = await render(
    <MapView start={null} route={null} others={[]} onError={jest.fn()} />,
  );
  await pagePosts('{"type":"ready"}');
  expect(injectJavaScript).not.toHaveBeenCalled();
  await rerender(
    <MapView start={null} route={null} others={others} onError={jest.fn()} />,
  );
  expect(injectJavaScript.mock.calls.at(-1)?.[0]).toContain(
    '{"type":"showOthers","lines":[[[11.1214,46.0671],[11.2986,46.0122],[11.1214,46.0671]]]}',
  );
  await rerender(<MapView start={null} route={null} others={[]} onError={jest.fn()} />);
  expect(injectJavaScript.mock.calls.at(-1)?.[0]).toContain(
    '{"type":"showOthers","lines":[]}',
  );
  expect(injectJavaScript).toHaveBeenCalledTimes(2);
});

test("following sends the position with the heading, and ends with stopFollow", async () => {
  const route: LatLon[] = [TRENTO, LEVICO, TRENTO];
  const onError = jest.fn();
  const { rerender } = await render(
    <MapView start={TRENTO} route={route} onError={onError} />,
  );
  await pagePosts('{"type":"ready"}');
  injectJavaScript.mockClear();

  // The first fix has no heading yet: the pin.
  await rerender(
    <MapView start={TRENTO} route={route} following={TRENTO} onError={onError} />,
  );
  expect(injectJavaScript.mock.calls.at(-1)?.[0]).toContain(
    '{"type":"follow","lngLat":[11.1214,46.0671],"heading":null}',
  );
  await rerender(
    <MapView
      start={TRENTO}
      route={route}
      following={LEVICO}
      heading={113.4}
      onError={onError}
    />,
  );
  expect(injectJavaScript.mock.calls.at(-1)?.[0]).toContain(
    '{"type":"follow","lngLat":[11.2986,46.0122],"heading":113}',
  );

  // The run ends: the arrow goes, then the whole route is framed again.
  injectJavaScript.mockClear();
  await rerender(<MapView start={TRENTO} route={route} onError={onError} />);
  expect(injectJavaScript.mock.calls.map(([script]) => script)).toEqual([
    expect.stringContaining('{"type":"stopFollow"}'),
    expect.stringContaining('"type":"showRoute"'),
  ]);
});

test("draws the walks of a word with the pen up apart, and again after a run (TASK-198)", async () => {
  const route: LatLon[] = [TRENTO, LEVICO, TRENTO, LEVICO];
  const onError = jest.fn();
  const { rerender } = await render(
    <MapView start={TRENTO} route={route} walks={[[1, 2]]} onError={onError} />,
  );
  await pagePosts('{"type":"ready"}');
  expect(injectJavaScript.mock.calls.at(-1)?.[0]).toContain(
    '"walks":[[[11.2986,46.0122],[11.1214,46.0671]]]',
  );
  await rerender(
    <MapView
      start={TRENTO}
      route={route}
      walks={[[1, 2]]}
      following={LEVICO}
      onError={onError}
    />,
  );
  injectJavaScript.mockClear();
  await rerender(
    <MapView start={TRENTO} route={route} walks={[[1, 2]]} onError={onError} />,
  );
  expect(injectJavaScript.mock.calls.at(-1)?.[0]).toContain('"walks":[[[11.2986');
});

test("marks a bike route's stretches with the bike on foot, and again after a run (TASK-206)", async () => {
  const route: LatLon[] = [TRENTO, LEVICO, TRENTO, LEVICO];
  const onError = jest.fn();
  const { rerender } = await render(
    <MapView start={TRENTO} route={route} onFoot={[[1, 2]]} onError={onError} />,
  );
  await pagePosts('{"type":"ready"}');
  expect(injectJavaScript.mock.calls.at(-1)?.[0]).toContain(
    '"onFoot":[[[11.2986,46.0122],[11.1214,46.0671]]]',
  );
  await rerender(
    <MapView
      start={TRENTO}
      route={route}
      onFoot={[[1, 2]]}
      following={LEVICO}
      onError={onError}
    />,
  );
  injectJavaScript.mockClear();
  await rerender(
    <MapView start={TRENTO} route={route} onFoot={[[1, 2]]} onError={onError} />,
  );
  expect(injectJavaScript.mock.calls.at(-1)?.[0]).toContain('"onFoot":[[[11.2986');
});

describe("running the route (TASK-224)", () => {
  // Five points 111 m apart along a meridian.
  const route: LatLon[] = Array.from({ length: 5 }, (_, i) => [46 + i * 0.001, 11]);
  const along = cumulative(route);
  const onError = jest.fn();

  function progressed(): { done: number[][][]; ahead: number[][][]; blink: boolean }[] {
    return injectJavaScript.mock.calls
      .map(([script]) => script as string)
      .filter((script) => script.includes('"type":"showProgress"'))
      .map((script) =>
        JSON.parse(script.slice(script.indexOf("{"), script.lastIndexOf("}") + 1)),
      );
  }

  afterEach(async () => {
    await act(async () => setPocketOn(false));
  });

  test("cuts the route where the runner is, after drawing it", async () => {
    await render(
      <MapView
        start={route[0]}
        route={route}
        // A step past the third point.
        progress={{ alongM: along[2] + 6, arrived: false }}
        onError={onError}
      />,
    );
    await pagePosts('{"type":"ready"}');
    const scripts = injectJavaScript.mock.calls.map(([script]) => script as string);
    const drawn = scripts.findIndex((script) => script.includes('"type":"showRoute"'));
    const cut = scripts.findIndex((script) => script.includes('"type":"showProgress"'));
    expect(drawn).toBeGreaterThanOrEqual(0);
    expect(cut).toBeGreaterThan(drawn);
    const [message] = progressed();
    expect(message.blink).toBe(true);
    expect(message.done).toHaveLength(1);
    expect(message.ahead).toHaveLength(1);
    expect(message.done[0].slice(0, 3)).toEqual(
      route.slice(0, 3).map(([lat, lon]) => [lon, lat]),
    );
    expect(message.ahead[0].at(-1)).toEqual([11, 46.004]);
  });

  test("tells the map in steps of 5 m, not at every metre", async () => {
    const { rerender } = await render(
      <MapView
        start={route[0]}
        route={route}
        progress={{ alongM: 11, arrived: false }}
        onError={onError}
      />,
    );
    await pagePosts('{"type":"ready"}');
    expect(progressed()).toHaveLength(1);
    await rerender(
      <MapView
        start={route[0]}
        route={route}
        progress={{ alongM: 14.9, arrived: false }}
        onError={onError}
      />,
    );
    expect(progressed()).toHaveLength(1);
    await rerender(
      <MapView
        start={route[0]}
        route={route}
        progress={{ alongM: 15, arrived: false }}
        onError={onError}
      />,
    );
    expect(progressed()).toHaveLength(2);
  });

  test("a route joined away from its start is cut on the navigator's line (TASK-273)", async () => {
    // The route from its third point round: the line run starts there.
    const turned = [...route.slice(2), ...route.slice(1, 3)];
    await render(
      <MapView
        start={route[0]}
        route={route}
        progress={{
          alongM: 120,
          arrived: false,
          points: turned,
          along: cumulative(turned),
        }}
        onError={onError}
      />,
    );
    await pagePosts('{"type":"ready"}');
    const [message] = progressed();
    expect(message.done[0][0]).toEqual([11, 46.002]);
    expect(message.ahead[0].at(-1)).toEqual([11, 46.002]);
  });

  test("arrived, the whole route is done", async () => {
    await render(
      <MapView
        start={route[0]}
        route={route}
        progress={{ alongM: along[4] - 20, arrived: true }}
        onError={onError}
      />,
    );
    await pagePosts('{"type":"ready"}');
    const [message] = progressed();
    expect(message.ahead).toEqual([]);
    expect(message.done).toEqual([route.map(([lat, lon]) => [lon, lat])]);
  });

  test("in pocket mode the dashes stop blinking, and blink again after", async () => {
    await render(
      <MapView
        start={route[0]}
        route={route}
        progress={{ alongM: 100, arrived: false }}
        onError={onError}
      />,
    );
    await pagePosts('{"type":"ready"}');
    expect(progressed().at(-1)?.blink).toBe(true);
    await act(async () => setPocketOn(true));
    expect(progressed().at(-1)?.blink).toBe(false);
    await act(async () => setPocketOn(false));
    expect(progressed().at(-1)?.blink).toBe(true);
  });

  test("after the run the route is whole again, once", async () => {
    const { rerender } = await render(
      <MapView
        start={route[0]}
        route={route}
        progress={{ alongM: 100, arrived: false }}
        onError={onError}
      />,
    );
    await pagePosts('{"type":"ready"}');
    injectJavaScript.mockClear();
    await rerender(<MapView start={route[0]} route={route} onError={onError} />);
    expect(injectJavaScript.mock.calls.map(([script]) => script)).toEqual([
      expect.stringContaining('{"type":"clearProgress"}'),
    ]);
    await rerender(<MapView start={route[0]} route={route} onError={onError} />);
    expect(injectJavaScript).toHaveBeenCalledTimes(1);
  });

  test("without a run nothing is cut", async () => {
    await render(<MapView start={route[0]} route={route} onError={onError} />);
    await pagePosts('{"type":"ready"}');
    expect(progressed()).toEqual([]);
    expect(
      injectJavaScript.mock.calls.some(([script]) =>
        (script as string).includes("Progress"),
      ),
    ).toBe(false);
  });
});
