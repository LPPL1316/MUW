import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Dimensions, Text } from "react-native";

import {
  inSight,
  type Measurable,
  ScrollSight,
  ScrollSightContext,
  SightScrollView,
  useSeen,
} from "./scrollSight";

const WINDOW = Dimensions.get("window").height;

type Answer = (x: number, y: number, w: number, h: number) => void;

/** A view `y` from the top of the screen, 96 tall; hidden, of no height. */
function viewAt(y: number, height = 96): Measurable & { y: number; height: number } {
  const view = {
    y,
    height,
    measureInWindow: (answer: Answer) => answer(0, view.y, 96, view.height),
  };
  return view;
}

function inPage(sight: ScrollSight) {
  return function Page({ children }: { children: ReactNode }) {
    return (
      <ScrollSightContext.Provider value={sight}>
        {children}
      </ScrollSightContext.Provider>
    );
  };
}

test("a view is in sight when at least a part of it is on screen", () => {
  expect(inSight(0, 96, 800)).toBe(true);
  expect(inSight(-90, 96, 800)).toBe(true);
  expect(inSight(790, 96, 800)).toBe(true);
  expect(inSight(800, 96, 800)).toBe(false);
  expect(inSight(-96, 96, 800)).toBe(false);
  // Not shown: no height.
  expect(inSight(0, 0, 800)).toBe(false);
});

test("outside a page that scrolls, a view counts as seen at once", async () => {
  const { result } = await renderHook(() => useSeen({ current: viewAt(5000) }));
  expect(result.current.seen).toBe(true);
});

test("below the screen it is not seen, until the page brings it up", async () => {
  const sight = new ScrollSight();
  const view = viewAt(WINDOW + 200);
  const { result } = await renderHook(() => useSeen({ current: view }), {
    wrapper: inPage(sight),
  });
  await act(async () => result.current.look());
  expect(result.current.seen).toBe(false);

  // Scrolled, but not far enough.
  view.y = WINDOW + 10;
  await act(async () => sight.moved());
  expect(result.current.seen).toBe(false);

  view.y = WINDOW - 50;
  await act(async () => sight.moved());
  expect(result.current.seen).toBe(true);

  // Seen once, for good: scrolled away it stays.
  view.y = -500;
  await act(async () => sight.moved());
  expect(result.current.seen).toBe(true);
});

test("a view not shown is not seen; shown, its layout looks again", async () => {
  const sight = new ScrollSight();
  const view = viewAt(100, 0);
  const { result } = await renderHook(() => useSeen({ current: view }), {
    wrapper: inPage(sight),
  });
  await act(async () => result.current.look());
  expect(result.current.seen).toBe(false);
  view.height = 96;
  await act(async () => result.current.look());
  expect(result.current.seen).toBe(true);
});

test("a page can say how its parts look where they are", async () => {
  const measure = jest.fn((_view: Measurable, answer: Answer) => answer(0, 10, 96, 96));
  const sight = new ScrollSight(measure);
  const view = viewAt(5000);
  const { result } = await renderHook(() => useSeen({ current: view }), {
    wrapper: inPage(sight),
  });
  await act(async () => result.current.look());
  expect(measure).toHaveBeenCalledWith(view, expect.any(Function));
  expect(result.current.seen).toBe(true);
});

test("the page that scrolls tells its parts, and still calls its own onScroll", async () => {
  const onScroll = jest.fn();
  const told: { sight: ScrollSight | null } = { sight: null };
  function Part() {
    return (
      <ScrollSightContext.Consumer>
        {(sight) => {
          told.sight = sight;
          return <Text>part</Text>;
        }}
      </ScrollSightContext.Consumer>
    );
  }
  await render(
    <SightScrollView testID="page" onScroll={onScroll}>
      <Part />
    </SightScrollView>,
  );
  expect(screen.getByText("part")).toBeOnTheScreen();
  expect(told.sight).toBeInstanceOf(ScrollSight);
  const listener = jest.fn();
  told.sight?.subscribe(listener);
  await fireEvent.scroll(screen.getByTestId("page"), {
    nativeEvent: { contentOffset: { x: 0, y: 300 } },
  });
  expect(listener).toHaveBeenCalledTimes(1);
  expect(onScroll).toHaveBeenCalledTimes(1);
});
