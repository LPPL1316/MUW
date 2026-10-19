/**
 * Choosing the start on the map (TASK-292): the page is asked for the pin
 * in the middle only while the app chooses, and where the middle is goes
 * to the chooser, not to «Draw on the map».
 */
import type { LatLon } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { MapView } from "./MapView";

jest.mock("react-native-webview");
const { injectJavaScript } =
  jest.requireMock<typeof import("../../__mocks__/react-native-webview")>(
    "react-native-webview",
  );

const START: LatLon = [46.07, 11.12];
const ASKED = '{"type":"setPick","on":true}';
const NOT_ASKED = '{"type":"setPick","on":false}';

function pagePosts(data: string) {
  return fireEvent(screen.getByTestId("map"), "message", { nativeEvent: { data } });
}

function sent(): string[] {
  return injectJavaScript.mock.calls.map(([script]: [string]) => script);
}

beforeEach(() => {
  injectJavaScript.mockClear();
});

test("without `picking` the page is never asked for the pin", async () => {
  await render(<MapView start={START} route={null} onError={jest.fn()} />);
  await pagePosts('{"type":"ready"}');
  expect(sent().some((script) => script.includes("setPick"))).toBe(false);
});

test("while picking the page is asked once, and told once when it ends", async () => {
  const onError = jest.fn();
  const { rerender } = await render(
    <MapView start={null} route={null} picking onError={onError} />,
  );
  await pagePosts('{"type":"ready"}');
  expect(sent().filter((script) => script.includes(ASKED))).toHaveLength(1);

  await rerender(<MapView start={START} route={null} onError={onError} />);
  expect(sent().filter((script) => script.includes(NOT_ASKED))).toHaveLength(1);
  await rerender(<MapView start={START} route={null} onError={onError} />);
  expect(sent().filter((script) => script.includes(NOT_ASKED))).toHaveLength(1);
});

test("while picking, the middle of the map goes to the chooser", async () => {
  const onCentre = jest.fn();
  const onCanvas = jest.fn();
  const onError = jest.fn();
  const { rerender } = await render(
    <MapView
      start={null}
      route={null}
      picking
      onCentre={onCentre}
      onCanvas={onCanvas}
      onError={onError}
    />,
  );
  await pagePosts('{"type":"ready"}');
  await pagePosts('{"type":"centre","lngLat":[11.12,46.07]}');
  expect(onCentre).toHaveBeenCalledWith([46.07, 11.12]);
  expect(onCanvas).not.toHaveBeenCalled();

  // Not picking, it is «Draw on the map»'s, as before.
  await rerender(
    <MapView
      start={null}
      route={null}
      onCentre={onCentre}
      onCanvas={onCanvas}
      onError={onError}
    />,
  );
  await pagePosts('{"type":"centre","lngLat":[11.13,46.08]}');
  expect(onCanvas).toHaveBeenCalledWith({ type: "centre", point: [46.08, 11.13] });
  expect(onCentre).toHaveBeenCalledTimes(1);
});

test("a page loaded again while picking is asked again", async () => {
  await render(<MapView start={null} route={null} picking onError={jest.fn()} />);
  await pagePosts('{"type":"ready"}');
  await fireEvent(screen.getByTestId("map"), "loadStart");
  await pagePosts('{"type":"ready"}');
  expect(sent().filter((script) => script.includes(ASKED))).toHaveLength(2);
});
