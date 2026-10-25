/**
 * When the GPS may have stopped with the app (TASK-255, TASK-261): the app
 * leaving the front, where the GPS is followed there only; the phone
 * freezing the app, wherever it is followed.
 */
import { AppState, type AppStateStatus, Platform } from "react-native";

import { FROZEN_AFTER_MS, TICK_MS, watchAway } from "./runAway";

const BEGAN = Date.UTC(2026, 9, 8, 7, 0, 0);

let appState: (next: AppStateStatus) => void = () => {};
const removeAppState = jest.fn();

beforeEach(() => {
  jest.useFakeTimers({ now: BEGAN });
  appState = () => {};
  removeAppState.mockClear();
  // React Native's own mock of AppState keeps its calls: cleared here.
  jest
    .spyOn(AppState, "addEventListener")
    .mockClear()
    .mockImplementation((_type, listener) => {
      appState = listener;
      return { remove: removeAppState };
    });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test("with the GPS in front only, leaving the front is told at once (TASK-255)", () => {
  const recorder = { leave: jest.fn() };
  const away = watchAway(recorder, { background: false });
  jest.advanceTimersByTime(5000);
  appState("inactive");
  expect(recorder.leave).not.toHaveBeenCalled();
  appState("background");
  expect(recorder.leave).toHaveBeenCalledWith(BEGAN + 5000);
  away.remove();
  expect(removeAppState).toHaveBeenCalled();
});

test("with the GPS in the background, leaving the front is not an absence", () => {
  const recorder = { leave: jest.fn() };
  const away = watchAway(recorder, { background: true });
  // The fixes go on with the phone locked, and so does the clock.
  appState("background");
  jest.advanceTimersByTime(120_000);
  away.beforeFix();
  expect(AppState.addEventListener).not.toHaveBeenCalled();
  expect(recorder.leave).not.toHaveBeenCalled();
  away.remove();
});

test("a freeze of the app is told from its start, by the tick after it", () => {
  const recorder = { leave: jest.fn() };
  const away = watchAway(recorder, { background: true });
  jest.advanceTimersByTime(3 * TICK_MS);
  // iOS froze the app for three minutes: no tick, no fix.
  jest.setSystemTime(BEGAN + 3 * TICK_MS + 180_000);
  jest.advanceTimersByTime(TICK_MS);
  expect(recorder.leave).toHaveBeenCalledTimes(1);
  expect(recorder.leave).toHaveBeenCalledWith(BEGAN + 3 * TICK_MS);
  // Told once: the ticks go on as before.
  jest.advanceTimersByTime(10 * TICK_MS);
  expect(recorder.leave).toHaveBeenCalledTimes(1);
  away.remove();
});

test("the fix that ends a freeze is told after it, even before the next tick", () => {
  const recorder = { leave: jest.fn() };
  const away = watchAway(recorder, { background: true });
  jest.setSystemTime(BEGAN + 90_000);
  away.beforeFix();
  expect(recorder.leave).toHaveBeenCalledWith(BEGAN);
  // The tick right after has nothing more to tell.
  jest.advanceTimersByTime(TICK_MS);
  expect(recorder.leave).toHaveBeenCalledTimes(1);
  away.remove();
});

test("a tick late but within FROZEN_AFTER_MS is a busy app, not a frozen one", () => {
  const recorder = { leave: jest.fn() };
  const away = watchAway(recorder, { background: true });
  jest.setSystemTime(BEGAN + FROZEN_AFTER_MS);
  away.beforeFix();
  expect(recorder.leave).not.toHaveBeenCalled();
  away.remove();
});

test("with the GPS in front only, a freeze counts too", () => {
  const recorder = { leave: jest.fn() };
  const away = watchAway(recorder, { background: false });
  jest.setSystemTime(BEGAN + 200_000);
  away.beforeFix();
  expect(recorder.leave).toHaveBeenCalledWith(BEGAN);
  away.remove();
});

test("once removed, nothing is told", () => {
  const recorder = { leave: jest.fn() };
  const away = watchAway(recorder, { background: true });
  away.remove();
  jest.setSystemTime(BEGAN + 200_000);
  jest.advanceTimersByTime(TICK_MS);
  expect(recorder.leave).not.toHaveBeenCalled();
});

test("on Android in the background a late tick is the screen off, not a freeze (TASK-294)", () => {
  jest.replaceProperty(Platform, "OS", "android");
  const recorder = { leave: jest.fn() };
  const away = watchAway(recorder, { background: true });
  // The screen off for three minutes: the app's clock stood still, the
  // service went on with the GPS, and a runner at a light gave no fix.
  jest.setSystemTime(BEGAN + 180_000);
  away.beforeFix();
  jest.advanceTimersByTime(TICK_MS);
  expect(recorder.leave).not.toHaveBeenCalled();
  expect(AppState.addEventListener).not.toHaveBeenCalled();
  away.remove();
});

test("on Android with the GPS in front only, leaving the front and a freeze count as before", () => {
  jest.replaceProperty(Platform, "OS", "android");
  const recorder = { leave: jest.fn() };
  const away = watchAway(recorder, { background: false });
  appState("background");
  expect(recorder.leave).toHaveBeenCalledWith(BEGAN);
  jest.setSystemTime(BEGAN + 200_000);
  away.beforeFix();
  expect(recorder.leave).toHaveBeenCalledTimes(2);
  away.remove();
});
