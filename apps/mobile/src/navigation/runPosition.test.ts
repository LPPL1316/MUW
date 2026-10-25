/**
 * The run's positions with the app in the background (TASK-261, ADR-0225):
 * a task of expo-task-manager on iOS, and on Android in a service with its
 * notification (TASK-294), when the app can have it; the GPS in the
 * foreground only otherwise, as before.
 */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { color } from "../theme/tokens";
import { RUN_LOCATION_TASK, watchRunPosition } from "./runPosition";

jest.mock("expo-location", () => ({
  Accuracy: { BestForNavigation: 6 },
  ActivityType: { Fitness: 3 },
  isBackgroundLocationAvailableAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));
jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn(),
  isAvailableAsync: jest.fn(),
}));

/** The task as the app defined it when it loaded, before any test. */
const [[taskName, runTask]] = jest.mocked(TaskManager.defineTask).mock.calls;

/** What iOS hands the task: positions, or an error. */
function deliver(
  locations: Location.LocationObject[] | null,
  error: TaskManager.TaskManagerError | null = null,
): Promise<unknown> {
  return runTask({
    data: locations === null ? null : { locations },
    error,
    executionInfo: { eventId: "1", taskName: RUN_LOCATION_TASK },
  });
}

function at(seconds: number): Location.LocationObject {
  return {
    coords: { latitude: 46 + seconds / 100_000, longitude: 11, accuracy: 5 },
    timestamp: seconds * 1000,
  } as Location.LocationObject;
}

const OPTIONS = { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5 };

/** Lets what was asked of the phone happen, one step after the other. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  jest.mocked(Location.isBackgroundLocationAvailableAsync).mockResolvedValue(true);
  jest.mocked(TaskManager.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(Location.startLocationUpdatesAsync).mockReset().mockResolvedValue();
  jest.mocked(Location.stopLocationUpdatesAsync).mockReset().mockResolvedValue();
  jest
    .mocked(Location.watchPositionAsync)
    .mockReset()
    .mockResolvedValue({ remove: jest.fn() });
});

test("the task is defined when the app loads", () => {
  expect(taskName).toBe(RUN_LOCATION_TASK);
});

test("on iOS the positions come from the task, with the phone locked too", async () => {
  const positions: number[] = [];
  const watch = await watchRunPosition(OPTIONS, (position) => {
    positions.push(position.timestamp);
  });

  expect(watch.background).toBe(true);
  expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(RUN_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 5,
    activityType: Location.ActivityType.Fitness,
    // Standing still at a light: iOS must not stop the GPS by itself.
    pausesUpdatesAutomatically: false,
    // The blue bar, with «While using» only.
    showsBackgroundLocationIndicator: true,
  });
  expect(Location.watchPositionAsync).not.toHaveBeenCalled();

  // iOS may hand over several at once: each one, in order.
  await deliver([at(1), at(2)]);
  await deliver([at(3)]);
  expect(positions).toEqual([1000, 2000, 3000]);

  watch.remove();
  await settle();
  expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(RUN_LOCATION_TASK);
  // A late hand-over reaches no run.
  await deliver([at(4)]);
  expect(positions).toEqual([1000, 2000, 3000]);
});

test("an error from the GPS gives no position, and the run goes on", async () => {
  const onPosition = jest.fn();
  const watch = await watchRunPosition(OPTIONS, onPosition);
  await deliver(null, { code: 0, message: "kCLErrorDomain" });
  expect(onPosition).not.toHaveBeenCalled();
  await deliver([at(1)]);
  expect(onPosition).toHaveBeenCalledTimes(1);
  watch.remove();
  await settle();
});

test("positions for no run stop the task: the app closed during one", async () => {
  await deliver([at(1)]);
  await settle();
  expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(RUN_LOCATION_TASK);
});

test("the end of a run never stops the next one's GPS", async () => {
  const first = await watchRunPosition(OPTIONS, jest.fn());
  const onPosition = jest.fn();
  // «Stop», and at once another start (a route that changed).
  first.remove();
  const second = await watchRunPosition(OPTIONS, onPosition);
  await settle();
  expect(second.background).toBe(true);
  const stops = jest.mocked(Location.stopLocationUpdatesAsync).mock;
  const starts = jest.mocked(Location.startLocationUpdatesAsync).mock;
  expect(starts.calls).toHaveLength(2);
  // Whatever was stopped for the first run came before the second's start.
  expect(
    stops.invocationCallOrder.every((order) => order < starts.invocationCallOrder[1]),
  ).toBe(true);
  await deliver([at(1)]);
  expect(onPosition).toHaveBeenCalledTimes(1);
  // Removing the first again changes nothing.
  const stopped = stops.calls.length;
  first.remove();
  await settle();
  expect(stops.calls).toHaveLength(stopped);
  second.remove();
  await settle();
  expect(stops.calls).toHaveLength(stopped + 1);
});

test("a stop still on its way delays the next start: never the other way round", async () => {
  const first = await watchRunPosition(OPTIONS, jest.fn());
  let stopDone: () => void = () => {};
  jest.mocked(Location.stopLocationUpdatesAsync).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        stopDone = resolve;
      }),
  );
  first.remove();
  const second = watchRunPosition(OPTIONS, jest.fn());
  await settle();
  // The phone has not finished stopping: the second start waits.
  expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledTimes(1);
  expect(Location.startLocationUpdatesAsync).toHaveBeenCalledTimes(1);
  stopDone();
  expect((await second).background).toBe(true);
  expect(Location.startLocationUpdatesAsync).toHaveBeenCalledTimes(2);
  (await second).remove();
  await settle();
  stopDone();
  await settle();
});

test("positions for no run, just before a start, do not stop the new run", async () => {
  // A late hand-over with no run asks for a stop; a run starts at once.
  const late = deliver([at(1)]);
  const onPosition = jest.fn();
  const watch = await watchRunPosition(OPTIONS, onPosition);
  await late;
  await settle();
  const stops = jest.mocked(Location.stopLocationUpdatesAsync).mock;
  const starts = jest.mocked(Location.startLocationUpdatesAsync).mock;
  expect(
    stops.invocationCallOrder.every((order) => order < starts.invocationCallOrder[0]),
  ).toBe(true);
  await deliver([at(2)]);
  expect(onPosition).toHaveBeenCalledTimes(1);
  watch.remove();
  await settle();
});

test("without the background mode (Expo Go), the GPS is followed in front, as before", async () => {
  jest.mocked(Location.isBackgroundLocationAvailableAsync).mockResolvedValue(false);
  const remove = jest.fn();
  jest.mocked(Location.watchPositionAsync).mockResolvedValue({ remove });
  const onPosition = jest.fn();

  const watch = await watchRunPosition(OPTIONS, onPosition);

  expect(watch.background).toBe(false);
  expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  expect(Location.watchPositionAsync).toHaveBeenCalledWith(OPTIONS, onPosition);
  watch.remove();
  expect(remove).toHaveBeenCalled();
});

test("when the phone refuses the task, the GPS is followed in front", async () => {
  jest
    .mocked(Location.startLocationUpdatesAsync)
    .mockRejectedValue(new Error("Background location has not been configured"));
  const onPosition = jest.fn();

  const watch = await watchRunPosition(OPTIONS, onPosition);

  expect(watch.background).toBe(false);
  expect(Location.watchPositionAsync).toHaveBeenCalledWith(OPTIONS, onPosition);
  // The task, if iOS ever calls it, belongs to no run.
  await deliver([at(1)]);
  expect(onPosition).not.toHaveBeenCalled();
  watch.remove();
});

test("a task manager that cannot work, or fails to say, means the front only", async () => {
  jest.mocked(TaskManager.isAvailableAsync).mockResolvedValue(false);
  expect((await watchRunPosition(OPTIONS, jest.fn())).background).toBe(false);
  jest
    .mocked(TaskManager.isAvailableAsync)
    .mockRejectedValue(new Error("Cannot find native module"));
  expect((await watchRunPosition(OPTIONS, jest.fn())).background).toBe(false);
  expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
});

test("on Android the positions come from the task, in a service with its notification (TASK-294)", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  const positions: number[] = [];
  const watch = await watchRunPosition(OPTIONS, (position) => {
    positions.push(position.timestamp);
  });

  expect(watch.background).toBe(true);
  expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(RUN_LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 5,
    // «While using» is enough: Android shows the run as a notification.
    foregroundService: {
      notificationTitle: "MuW is recording your activity",
      notificationBody: "It keeps going with the screen locked, voice included.",
      notificationColor: color.accent,
      // Closing the app ends the GPS; the run reopens paused (TASK-272).
      killServiceOnDestroy: true,
    },
  });
  expect(Location.watchPositionAsync).not.toHaveBeenCalled();

  await deliver([at(1), at(2)]);
  expect(positions).toEqual([1000, 2000]);
  watch.remove();
  await settle();
  expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(RUN_LOCATION_TASK);
  jest.restoreAllMocks();
});

test("on Android a service the phone refuses (the app not in front) means the front only", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  jest
    .mocked(Location.startLocationUpdatesAsync)
    .mockRejectedValue(new Error("Couldn't start the foreground service"));
  const onPosition = jest.fn();

  const watch = await watchRunPosition(OPTIONS, onPosition);

  expect(watch.background).toBe(false);
  expect(Location.watchPositionAsync).toHaveBeenCalledWith(OPTIONS, onPosition);
  watch.remove();
  jest.restoreAllMocks();
});

test("elsewhere than iOS and Android (the web) the GPS is followed in front", async () => {
  jest.replaceProperty(Platform, "OS", "web");
  jest.mocked(Location.isBackgroundLocationAvailableAsync).mockClear();
  const watch = await watchRunPosition(OPTIONS, jest.fn());
  expect(watch.background).toBe(false);
  expect(Location.isBackgroundLocationAvailableAsync).not.toHaveBeenCalled();
  expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  jest.restoreAllMocks();
});
