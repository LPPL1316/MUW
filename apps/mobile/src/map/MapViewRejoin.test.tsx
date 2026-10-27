import type { LatLon } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { MapView } from "./MapView";

// Off the route (TASK-303): the map is told the dotted line from the runner
// to where the route goes on, at each fix, and to take it away after.

jest.mock("react-native-webview");
const { injectJavaScript } =
  jest.requireMock<typeof import("../../__mocks__/react-native-webview")>(
    "react-native-webview",
  );

const ROUTE: LatLon[] = [
  [46.0, 11.0],
  [46.002, 11.0],
  [46.004, 11.0],
];
const HERE: LatLon = [46.0012, 11.0013];
const THERE: LatLon = [46.0012, 11.0];

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

function progress(rejoin: { from: LatLon; to: LatLon } | null) {
  return { alongM: 300, arrived: false, rejoin };
}

beforeEach(() => {
  injectJavaScript.mockClear();
});

test("off the route the map draws the way back, and moves it with the runner", async () => {
  const { rerender } = await render(
    <MapView
      start={null}
      route={ROUTE}
      following={HERE}
      progress={progress({ from: HERE, to: THERE })}
      onError={jest.fn()}
    />,
  );
  await pagePosts('{"type":"ready"}');
  expect(messages("showRejoin")).toEqual([
    {
      type: "showRejoin",
      line: [
        [HERE[1], HERE[0]],
        [THERE[1], THERE[0]],
      ],
    },
  ]);
  const further: LatLon = [46.0015, 11.0013];
  await rerender(
    <MapView
      start={null}
      route={ROUTE}
      following={further}
      progress={progress({ from: further, to: [46.0015, 11.0] })}
      onError={jest.fn()}
    />,
  );
  expect(messages("showRejoin")).toHaveLength(2);
  expect(messages("clearRejoin")).toEqual([]);
  // Back on the route: the dots go.
  await rerender(
    <MapView
      start={null}
      route={ROUTE}
      following={THERE}
      progress={progress(null)}
      onError={jest.fn()}
    />,
  );
  expect(messages("clearRejoin")).toHaveLength(1);
});

test("on the route, and with no run, the map is told nothing of a way back", async () => {
  const { rerender } = await render(
    <MapView
      start={null}
      route={ROUTE}
      following={THERE}
      progress={progress(null)}
      onError={jest.fn()}
    />,
  );
  await pagePosts('{"type":"ready"}');
  await rerender(<MapView start={null} route={ROUTE} onError={jest.fn()} />);
  expect(messages("showRejoin")).toEqual([]);
  expect(messages("clearRejoin")).toEqual([]);
});

test("the run over while off the route: the dots go with it", async () => {
  const { rerender } = await render(
    <MapView
      start={null}
      route={ROUTE}
      following={HERE}
      progress={progress({ from: HERE, to: THERE })}
      onError={jest.fn()}
    />,
  );
  await pagePosts('{"type":"ready"}');
  await rerender(<MapView start={null} route={ROUTE} onError={jest.fn()} />);
  expect(messages("clearRejoin")).toHaveLength(1);
});
