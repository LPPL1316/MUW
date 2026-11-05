import { act, renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

import {
  forgetRestQuestion,
  type RestFeel,
  type RestNotifier,
  useRestAlert,
} from "./restAlert";
import { type Rest, startRest } from "./restTimer";

// TASK-385 part B (ADR-0327 point 6): how the end of a rest is told, with
// the app open and with the app away.

let stateListener: ((state: AppStateStatus) => void) | null = null;

beforeEach(() => {
  jest.useFakeTimers({ now: 1_000_000 });
  forgetRestQuestion();
  stateListener = null;
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    stateListener = listener as (state: AppStateStatus) => void;
    return { remove: () => (stateListener = null) } as ReturnType<
      typeof AppState.addEventListener
    >;
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function tools() {
  const feel: RestFeel = { soon: jest.fn(), over: jest.fn() };
  const notifier: RestNotifier = {
    ask: jest.fn(async () => "granted"),
    schedule: jest.fn(async () => "notice-1"),
    cancel: jest.fn(async () => {}),
  };
  return { feel, notifier };
}

test("with the app open: a touch 10 s before, a buzz and a sound at the end", async () => {
  const { feel, notifier } = tools();
  await renderHook(() =>
    useRestAlert(startRest(Date.now(), 60), "Next: Squat · set 2", { feel, notifier }),
  );
  await act(async () => jest.advanceTimersByTime(49_999));
  expect(feel.soon).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(1));
  expect(feel.soon).toHaveBeenCalledTimes(1);
  expect(feel.over).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(10_000));
  expect(feel.over).toHaveBeenCalledTimes(1);
  expect(notifier.schedule).not.toHaveBeenCalled();
});

test("the permission is asked at the first rest, once", async () => {
  const { feel, notifier } = tools();
  const { rerender } = await renderHook(
    ({ rest }: { rest: Rest | null }) => useRestAlert(rest, null, { feel, notifier }),
    { initialProps: { rest: null as Rest | null } },
  );
  expect(notifier.ask).not.toHaveBeenCalled();
  await rerender({ rest: startRest(Date.now(), 30) });
  await rerender({ rest: startRest(Date.now() + 5, 60) });
  expect(notifier.ask).toHaveBeenCalledTimes(1);
});

test("with the app away a notification waits for the end, taken back when it comes back", async () => {
  const { feel, notifier } = tools();
  await renderHook(() =>
    useRestAlert(startRest(Date.now(), 90), "Next: Squat · set 2", { feel, notifier }),
  );
  await act(async () => jest.advanceTimersByTime(30_000));
  await act(async () => stateListener?.("background"));
  expect(notifier.schedule).toHaveBeenCalledWith(
    60,
    "Rest over — next set",
    "Next: Squat · set 2",
  );
  await act(async () => stateListener?.("active"));
  expect(notifier.cancel).toHaveBeenCalledWith("notice-1");
});

test("a rest that changes or ends takes its notification back", async () => {
  const { feel, notifier } = tools();
  const { rerender } = await renderHook(
    ({ rest }: { rest: Rest | null }) => useRestAlert(rest, null, { feel, notifier }),
    { initialProps: { rest: startRest(Date.now(), 90) as Rest | null } },
  );
  await act(async () => stateListener?.("background"));
  expect(notifier.schedule).toHaveBeenCalledWith(90, "Rest over — next set", null);
  await rerender({ rest: null });
  await act(async () => jest.advanceTimersByTime(0));
  expect(notifier.cancel).toHaveBeenCalledWith("notice-1");
  await act(async () => jest.advanceTimersByTime(120_000));
  expect(feel.over).not.toHaveBeenCalled();
});
