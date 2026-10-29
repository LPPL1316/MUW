import type { LatLon } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import {
  FeedMapShooter,
  forgetFeedMaps,
  SHOT_TIMEOUT_MS,
  useFeedMap,
} from "./FeedMaps";

jest.mock("react-native-webview");
const { injectJavaScript, reload } =
  jest.requireMock<typeof import("../../__mocks__/react-native-webview")>(
    "react-native-webview",
  );

// A square in Firenze.
const LINE: LatLon[] = [
  [43.77, 11.25],
  [43.77, 11.26],
  [43.78, 11.26],
  [43.78, 11.25],
  [43.77, 11.25],
];
const PICTURE = "data:image/jpeg;base64,AAAA";

/** Something that wants the map of a drawing, as a card of «Feed» does. */
function Drawing({ id }: { id: string }) {
  const map = useFeedMap(id, LINE, 358, 222, 24);
  return <Text>{`${id}: ${map ?? "no map"}`}</Text>;
}

function Feed({ ids }: { ids: string[] }) {
  return (
    <>
      <FeedMapShooter width={358} height={222} />
      {ids.map((id) => (
        <Drawing key={id} id={id} />
      ))}
    </>
  );
}

/** The page, which no query finds unless asked: it is hidden from readers. */
function mapPage() {
  return screen.queryByTestId("feed-map-page", { includeHiddenElements: true });
}

function pagePosts(message: object) {
  return fireEvent(mapPage()!, "message", {
    nativeEvent: { data: JSON.stringify(message) },
  });
}

beforeEach(() => {
  forgetFeedMaps();
  injectJavaScript.mockClear();
  reload.mockClear();
});

test("with nothing to take a picture of, there is no map page", async () => {
  await render(<FeedMapShooter width={358} height={222} />);
  expect(mapPage()).toBeNull();
});

test("asks the page for a picture once it is ready, and shows it", async () => {
  await render(<Feed ids={["a"]} />);
  expect(screen.getByText("a: no map")).toBeOnTheScreen();
  expect(injectJavaScript).not.toHaveBeenCalled();

  await pagePosts({ type: "ready" });
  expect(injectJavaScript).toHaveBeenCalledTimes(1);
  const asked = injectJavaScript.mock.calls[0][0];
  const shoot = JSON.parse(asked.slice(asked.indexOf("{"), asked.lastIndexOf("}") + 1));
  expect(shoot).toMatchObject({ type: "shoot", key: "a:358x222" });
  // The middle of the square, longitude first, and the size of the drawing.
  expect(shoot.center[0]).toBeCloseTo(11.255, 6);
  expect(shoot.center[1]).toBeCloseTo(43.775, 6);
  expect(shoot).toMatchObject({ width: 358, height: 222 });

  await pagePosts({ type: "shot", key: "a:358x222", image: PICTURE });
  expect(screen.getByText(`a: ${PICTURE}`)).toBeOnTheScreen();
  // Nothing left to take: the page goes away.
  expect(mapPage()).toBeNull();
});

test("takes the pictures one at a time, in the order they were asked", async () => {
  await render(<Feed ids={["a", "b"]} />);
  await pagePosts({ type: "ready" });
  expect(injectJavaScript).toHaveBeenCalledTimes(1);
  expect(injectJavaScript.mock.calls[0][0]).toContain('"key":"a:358x222"');

  await pagePosts({ type: "shot", key: "a:358x222", image: PICTURE });
  expect(injectJavaScript).toHaveBeenCalledTimes(2);
  expect(injectJavaScript.mock.calls[1][0]).toContain('"key":"b:358x222"');
  expect(screen.getByText("b: no map")).toBeOnTheScreen();
});

test("a picture taken is kept: the drawing that comes back has it at once", async () => {
  const first = await render(<Feed ids={["a"]} />);
  await pagePosts({ type: "ready" });
  await pagePosts({ type: "shot", key: "a:358x222", image: PICTURE });
  await first.unmount();
  injectJavaScript.mockClear();

  await render(<Feed ids={["a"]} />);
  expect(screen.getByText(`a: ${PICTURE}`)).toBeOnTheScreen();
  expect(mapPage()).toBeNull();
  expect(injectJavaScript).not.toHaveBeenCalled();
});

test("a tile that did not come leaves the drawing without a map", async () => {
  await render(<Feed ids={["a", "b"]} />);
  await pagePosts({ type: "ready" });
  await pagePosts({ type: "miss", key: "a:358x222" });
  expect(screen.getByText("a: no map")).toBeOnTheScreen();
  // The next one is asked all the same.
  expect(injectJavaScript.mock.calls.at(-1)?.[0]).toContain('"key":"b:358x222"');
});

test("a picture that does not come is given up on", async () => {
  jest.useFakeTimers();
  try {
    await render(<Feed ids={["a", "b"]} />);
    await pagePosts({ type: "ready" });
    await act(async () => {
      jest.advanceTimersByTime(SHOT_TIMEOUT_MS);
    });
    expect(screen.getByText("a: no map")).toBeOnTheScreen();
    expect(injectJavaScript).toHaveBeenCalledTimes(2);
    expect(injectJavaScript.mock.calls[1][0]).toContain('"key":"b:358x222"');
  } finally {
    jest.useRealTimers();
  }
});

test("a page that cannot draw maps goes away, and the drawings stay as they are", async () => {
  await render(<Feed ids={["a", "b"]} />);
  await pagePosts({ type: "error", message: "MapLibre GL JS did not load" });
  expect(mapPage()).toBeNull();
  expect(screen.getByText("a: no map")).toBeOnTheScreen();
  expect(screen.getByText("b: no map")).toBeOnTheScreen();
  expect(injectJavaScript).not.toHaveBeenCalled();
});

test("a page stopped by the phone is loaded again, and asked again", async () => {
  await render(<Feed ids={["a"]} />);
  await pagePosts({ type: "ready" });
  expect(injectJavaScript).toHaveBeenCalledTimes(1);

  const page = mapPage()!;
  await fireEvent(page, "contentProcessDidTerminate");
  expect(reload).toHaveBeenCalledTimes(1);
  await fireEvent(page, "loadStart");
  await pagePosts({ type: "ready" });
  expect(injectJavaScript).toHaveBeenCalledTimes(2);
  expect(injectJavaScript.mock.calls[1][0]).toContain('"key":"a:358x222"');
});

test("the page is out of reach of fingers and of the screen reader", async () => {
  await render(<Feed ids={["a"]} />);
  const page = mapPage()!;
  expect(screen.queryByTestId("feed-map-page")).toBeNull();
  expect(page.parent).toHaveProp("pointerEvents", "none");
  expect(page.parent).toHaveProp("accessibilityElementsHidden", true);
  expect(page.parent).toHaveStyle({ width: 358, height: 222 });
});

test("with two shooters on screen, the first takes the pictures; gone, the other", async () => {
  function Two({ first }: { first: boolean }) {
    return (
      <>
        {first && <FeedMapShooter width={358} height={222} />}
        <FeedMapShooter width={390} height={844} />
        <Drawing id="a" />
        <Drawing id="b" />
      </>
    );
  }
  const view = await render(<Two first />);
  // One page, never two pictures of the same map at once.
  expect(
    screen.getAllByTestId("feed-map-page", { includeHiddenElements: true }),
  ).toHaveLength(1);
  expect(mapPage()!.parent).toHaveStyle({ width: 358, height: 222 });
  await pagePosts({ type: "ready" });
  await pagePosts({ type: "shot", key: "a:358x222", image: PICTURE });
  expect(injectJavaScript).toHaveBeenCalledTimes(2);

  // The first goes: the other takes the picture still to take.
  await view.rerender(<Two first={false} />);
  expect(mapPage()!.parent).toHaveStyle({ width: 390, height: 844 });
  await pagePosts({ type: "ready" });
  expect(injectJavaScript.mock.calls.at(-1)?.[0]).toContain('"key":"b:358x222"');
  expect(screen.getByText(`a: ${PICTURE}`)).toBeOnTheScreen();
});
