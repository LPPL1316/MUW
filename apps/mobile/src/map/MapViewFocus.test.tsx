/**
 * A place of a themed route tapped under the map (TASK-329): the map goes
 * there, once for each tap, as the north arrow is asked (MapViewTurn).
 */
import type { LatLon } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { MapView } from "./MapView";
import { focus as focusMap } from "./messages";

jest.mock("react-native-webview");
const { injectJavaScript } =
  jest.requireMock<typeof import("../../__mocks__/react-native-webview")>(
    "react-native-webview",
  );

const ROUTE: LatLon[] = [
  [41.89, 12.49],
  [41.894, 12.495],
  [41.89, 12.49],
];
const COLOSSEO: LatLon = [41.8902, 12.4922];

function pagePosts(data: string) {
  return fireEvent(screen.getByTestId("map"), "message", { nativeEvent: { data } });
}

/** The messages of a type handed to the page, in order. */
function messages(type: string): Record<string, unknown>[] {
  return injectJavaScript.mock.calls
    .map(([script]: [string]) => /receive\((.*)\); true;$/.exec(script)?.[1])
    .filter((json): json is string => json !== undefined)
    .map((json) => JSON.parse(json) as Record<string, unknown>)
    .filter((message) => message.type === type);
}

beforeEach(() => {
  injectJavaScript.mockClear();
});

test("the message takes the map to the place, longitude first", () => {
  expect(focusMap(COLOSSEO)).toEqual({ type: "focus", lngLat: [12.4922, 41.8902] });
});

test("a tap on a place is asked of the map once, a new tap again", async () => {
  const onError = jest.fn();
  const tapped = { point: COLOSSEO };
  const { rerender } = await render(
    <MapView start={null} route={ROUTE} onError={onError} />,
  );
  await pagePosts('{"type":"ready"}');
  expect(messages("focus")).toEqual([]);

  await rerender(
    <MapView start={null} route={ROUTE} focus={tapped} onError={onError} />,
  );
  await rerender(
    <MapView start={null} route={ROUTE} focus={tapped} onError={onError} />,
  );
  expect(messages("focus")).toEqual([{ type: "focus", lngLat: [12.4922, 41.8902] }]);

  // The same place tapped again: the map goes back there.
  await rerender(
    <MapView
      start={null}
      route={ROUTE}
      focus={{ point: COLOSSEO }}
      onError={onError}
    />,
  );
  expect(messages("focus")).toHaveLength(2);
  // The page loaded again is not sent the old tap.
  await pagePosts('{"type":"ready"}');
  expect(messages("focus")).toHaveLength(2);
});
