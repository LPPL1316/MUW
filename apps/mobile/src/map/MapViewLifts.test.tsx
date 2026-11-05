import type { LatLon } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { MapView } from "./MapView";

// A day of skiing (TASK-375 part C2): the map is told what was skied and the
// lifts, dashed, in place of the run's track; without lifts the track as a
// run's, and the dashes go with the day.

jest.mock("react-native-webview");
const { injectJavaScript } =
  jest.requireMock<typeof import("../../__mocks__/react-native-webview")>(
    "react-native-webview",
  );

const LINE: LatLon[] = Array.from({ length: 7 }, (_, i) => [46.4 + i / 1000, 11.8]);
const LIFTS = [{ from: 2, to: 4 }];
const lngLat = (line: LatLon[]) => line.map(([lat, lon]) => [lon, lat]);

function pagePosts(data: string) {
  return fireEvent(screen.getByTestId("map"), "message", { nativeEvent: { data } });
}

/** The messages of a type handed to the page, in order. */
function messages(type: string): Record<string, unknown>[] {
  return injectJavaScript.mock.calls
    .map(([script]: [string]) => /receive\((.*)\); true;$/.exec(script)?.[1])
    .filter((json: string | undefined): json is string => json !== undefined)
    .map((json: string) => JSON.parse(json) as Record<string, unknown>)
    .filter((message: Record<string, unknown>) => message.type === type);
}

beforeEach(() => {
  injectJavaScript.mockClear();
});

test("a day with lifts is drawn cut at them, not as one line", async () => {
  await render(
    <MapView
      start={null}
      route={null}
      track={LINE}
      lifts={LIFTS}
      onError={jest.fn()}
    />,
  );
  await pagePosts('{"type":"ready"}');
  expect(messages("showLifts")).toEqual([
    {
      type: "showLifts",
      skied: [lngLat(LINE.slice(0, 3)), lngLat(LINE.slice(4))],
      lifts: [lngLat(LINE.slice(2, 5))],
    },
  ]);
  expect(messages("showTrack")).toEqual([]);
});

test("without lifts the track is a run's", async () => {
  await render(<MapView start={null} route={null} track={LINE} onError={jest.fn()} />);
  await pagePosts('{"type":"ready"}');
  expect(messages("showTrack")).toHaveLength(1);
  expect(messages("showLifts")).toEqual([]);
  expect(messages("clearLifts")).toEqual([]);
});

test("leaving the day takes its line and its dashes away", async () => {
  const { rerender } = await render(
    <MapView
      start={null}
      route={null}
      track={LINE}
      lifts={LIFTS}
      onError={jest.fn()}
    />,
  );
  await pagePosts('{"type":"ready"}');
  await rerender(<MapView start={null} route={null} onError={jest.fn()} />);
  expect(messages("clearTrack")).toHaveLength(1);
  expect(messages("clearLifts")).toHaveLength(1);
});

test("a run after the day has its line whole, and no dashes", async () => {
  const { rerender } = await render(
    <MapView
      start={null}
      route={null}
      track={LINE}
      lifts={LIFTS}
      onError={jest.fn()}
    />,
  );
  await pagePosts('{"type":"ready"}');
  const run = LINE.slice(0, 4);
  await rerender(<MapView start={null} route={null} track={run} onError={jest.fn()} />);
  expect(messages("showTrack")).toEqual([
    { type: "showTrack", coordinates: lngLat(run) },
  ]);
  expect(messages("clearLifts")).toHaveLength(1);
});
