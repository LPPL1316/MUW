import { act, renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

import {
  firstPageShown,
  forgetFirstPage,
  markFirstPage,
  useMayWorkAhead,
} from "./firstPage";

/**
 * When the app may work ahead of the user (TASK-306): after the launch
 * animation, in front, not running.
 */

let change: ((state: AppStateStatus) => void) | null = null;

beforeEach(() => {
  forgetFirstPage();
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    change = listener as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as never;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("once the animation is over, and only once", () => {
  expect(firstPageShown()).toBe(false);
  markFirstPage();
  markFirstPage();
  expect(firstPageShown()).toBe(true);
});

test("not before the first page, nor while busy, nor in the background", async () => {
  const { result, rerender } = await renderHook(
    ({ busy }: { busy: boolean }) => useMayWorkAhead(busy),
    { initialProps: { busy: false } },
  );
  expect(result.current).toBe(false);
  await act(async () => markFirstPage());
  expect(result.current).toBe(true);
  await rerender({ busy: true });
  expect(result.current).toBe(false);
  await rerender({ busy: false });
  await act(async () => change?.("background"));
  expect(result.current).toBe(false);
  // Behind a panel of the system it is still in front.
  await act(async () => change?.("inactive"));
  expect(result.current).toBe(true);
});
