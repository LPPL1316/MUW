import type { Direction } from "@shaperoute/shared-types";
import result from "@shaperoute/shared-types/fixtures/route-result.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Brightness from "expo-brightness";
import { activateKeepAwakeAsync } from "expo-keep-awake";
import { Alert, type AlertButton, Linking } from "react-native";

import { type Navigation, remainingM, startNavigation } from "../navigation/navigator";
import { distanceLabel } from "../navigation/phrases";
import { addFix, emptyTrack, type Track } from "../navigation/trackRecorder";
import { KEEP_AWAKE_TAG, POCKET_BRIGHTNESS } from "../navigation/usePocketMode";
import { RUN_AWAKE_TAG } from "../navigation/useRunAwake";
import { NavigationBanner, NavigationCard } from "./NavigateScreen";
import { POCKET_WARNING, resetPocketWarning } from "./PocketScreen";

jest.mock("expo-brightness", () => ({
  getBrightnessAsync: jest.fn(() => Promise.resolve(0.6)),
  setBrightnessAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));

const directions = result.directions as Direction[];
const points = result.points as [number, number][];

/** Following the route, with the footway beside Via Rosmini as the next turn. */
function beforeFootway(footway: Direction): Navigation {
  const { navigation } = startNavigation(points, [
    directions[0],
    directions[1],
    footway,
    ...directions.slice(3),
  ]);
  return { ...navigation, next: 2, saidUpTo: 2, alongM: 1900 };
}

test("without the location, the banner says how to turn it on and opens the Settings", async () => {
  const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue();
  await render(<NavigationBanner state={{ status: "denied" }} />);
  expect(screen.getByText("Location is off")).toBeOnTheScreen();
  expect(
    screen.getByText("Allow it for MuW in Settings to follow the route."),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Open Settings" }));
  expect(openSettings).toHaveBeenCalledTimes(1);
  openSettings.mockRestore();
});

test("the banner says the street beside an unnamed road", async () => {
  const navigation = beforeFootway(directions[2]);
  await render(
    <NavigationBanner
      state={{ status: "following", navigation, position: null, track: emptyTrack() }}
    />,
  );
  expect(
    screen.getByText("Turn left onto the footpath beside Via Rosmini"),
  ).toBeTruthy();
});

test("the banner reads as before when the API has no along", async () => {
  const { along: _along, ...old } = directions[2];
  const navigation = beforeFootway(old);
  await render(
    <NavigationBanner
      state={{ status: "following", navigation, position: null, track: emptyTrack() }}
    />,
  );
  expect(screen.getByText("Turn left onto the footpath")).toBeTruthy();
});

const NOW = Date.UTC(2026, 9, 2, 7, 0, 0);

/** Straight north from the route's start, a fix every 50 m at 6:00 /km,
 * the last at NOW. */
function north(metres: number): Track {
  const [lat, lon] = points[0];
  let track = emptyTrack();
  for (let m = 0; m <= metres; m += 50) {
    track = addFix(track, {
      point: [lat + m / 111_195, lon],
      timeMs: NOW - (metres - m) * 360,
      accuracyM: 5,
    });
  }
  return track;
}

test("under the turn: how much of the drawing is done, and the heading", async () => {
  const navigation = beforeFootway(directions[2]);
  const total = navigation.along[navigation.along.length - 1];
  await render(
    <NavigationBanner
      state={{ status: "following", navigation, position: null, track: north(500) }}
    />,
  );
  expect(
    screen.getByText(`${Math.round((1900 / total) * 100)}% drawn`),
  ).toBeOnTheScreen();
  // The letter on the chip, the word to who listens, as on a free run.
  expect(screen.getByLabelText("Heading north")).toBeOnTheScreen();
  expect(screen.getByText("N")).toBeOnTheScreen();
  // The turn is still what it was.
  expect(
    screen.getByText("Turn left onto the footpath beside Via Rosmini"),
  ).toBeOnTheScreen();
});

test("before the first metres there is no heading to show", async () => {
  const navigation = beforeFootway(directions[2]);
  await render(
    <NavigationBanner
      state={{ status: "following", navigation, position: null, track: emptyTrack() }}
    />,
  );
  expect(screen.getByText(/% drawn$/)).toBeOnTheScreen();
  expect(screen.queryByLabelText(/^Heading/)).toBeNull();
});

test("off the route, the banner still says how much is drawn", async () => {
  const navigation = { ...beforeFootway(directions[2]), offRoute: true };
  await render(
    <NavigationBanner
      state={{ status: "following", navigation, position: null, track: north(500) }}
    />,
  );
  expect(screen.getByText("Off the route")).toBeOnTheScreen();
  expect(screen.getByText(/% drawn$/)).toBeOnTheScreen();
});

describe("the numbers of the run", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("the card has distance, paces, clock and what is left of the route", async () => {
    const navigation = beforeFootway(directions[2]);
    await render(
      <NavigationCard navigation={navigation} track={north(1500)} onStop={() => {}} />,
    );
    expect(screen.getByLabelText("Distance: 1.50 km")).toBeOnTheScreen();
    expect(screen.getByLabelText("Pace now: 6:00 /km")).toBeOnTheScreen();
    expect(screen.getByLabelText("Time: 9:00")).toBeOnTheScreen();
    expect(
      screen.getByText(`${distanceLabel(remainingM(navigation))} to go`),
    ).toBeOnTheScreen();
    expect(screen.getByText(/^about \d+ min$/)).toBeOnTheScreen();
    expect(screen.getByTestId("route-done")).toBeOnTheScreen();
    // A run with a line is paused, not stopped by a touch (TASK-169).
    expect(screen.getByLabelText("Pause")).toBeOnTheScreen();
    expect(screen.queryByText("Stop")).toBeNull();
  });

  test("on the page of the data the turn stays, with every number", async () => {
    const navigation = beforeFootway(directions[2]);
    await render(
      <NavigationCard navigation={navigation} track={north(1500)} onStop={() => {}} />,
    );
    expect(screen.queryByText(/^Turn /)).toBeNull();
    await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
    expect(screen.getByText(/^Turn /)).toBeOnTheScreen();
    expect(screen.getByLabelText("Avg pace: 6:00 /km")).toBeOnTheScreen();
    expect(screen.getByLabelText("Last km: 6:00 /km")).toBeOnTheScreen();
    expect(screen.getByLabelText("Kilometre 1: 6:00")).toBeOnTheScreen();
    // What is left of the route, on both pages.
    expect(screen.getAllByTestId("route-done")).toHaveLength(2);
  });

  test("arrived, the clock stops and the button says Finish", async () => {
    const navigation = { ...beforeFootway(directions[2]), arrived: true };
    await render(
      <NavigationCard navigation={navigation} track={north(1000)} onStop={() => {}} />,
    );
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByLabelText("Time: 6:00")).toBeOnTheScreen();
    expect(screen.getByText("Finish")).toBeOnTheScreen();
  });
});

/** Presses "Go dark" in the pocket-mode warning, if it is showing. */
function acceptWarning(alert: jest.SpyInstance) {
  const buttons = alert.mock.calls.at(-1)?.[2] as AlertButton[];
  buttons.find((button) => button.text === "Go dark")?.onPress?.();
}

describe("pocket mode", () => {
  const { navigation } = startNavigation(points, directions);
  let alert: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    resetPocketWarning();
    alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  test("the first time, it warns that locking the phone stops directions", async () => {
    await render(<NavigationCard navigation={navigation} onStop={() => {}} />);
    await fireEvent.press(screen.getByLabelText("Pocket mode"));
    expect(alert).toHaveBeenCalledWith(
      "Pocket mode",
      POCKET_WARNING,
      expect.any(Array),
    );
    expect(POCKET_WARNING).toContain("if you press the side button, directions stop");
    expect(screen.queryByText("Hold for 2 seconds to leave pocket mode")).toBeNull();

    await act(() => acceptWarning(alert));
    expect(screen.getByText("Hold for 2 seconds to leave pocket mode")).toBeTruthy();
    expect(activateKeepAwakeAsync).toHaveBeenCalled();
    expect(Brightness.setBrightnessAsync).toHaveBeenLastCalledWith(POCKET_BRIGHTNESS);
    // The first Modal of the run loads slowly on a busy machine.
  }, 20_000);

  test("after the warning, it starts straight away", async () => {
    await render(<NavigationCard navigation={navigation} onStop={() => {}} />);
    await fireEvent.press(screen.getByLabelText("Pocket mode"));
    await act(() => acceptWarning(alert));
    await fireEvent(screen.getByLabelText(/Hold for 2 seconds/), "longPress");

    await fireEvent.press(screen.getByLabelText("Pocket mode"));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Hold for 2 seconds to leave pocket mode")).toBeTruthy();
  });

  test("taps do nothing; only a hold brings the screen back", async () => {
    const onStop = jest.fn();
    await render(<NavigationCard navigation={navigation} onStop={onStop} />);
    await fireEvent.press(screen.getByLabelText("Pocket mode"));
    await act(() => acceptWarning(alert));
    const black = screen.getByLabelText(/Hold for 2 seconds/);

    await fireEvent.press(black);
    expect(screen.getByText("Hold for 2 seconds to leave pocket mode")).toBeTruthy();
    await fireEvent(black, "pressIn");
    expect(screen.getByText("Keep holding…")).toBeTruthy();
    await fireEvent(black, "pressOut");

    await fireEvent(black, "longPress");
    expect(screen.queryByText("Hold for 2 seconds to leave pocket mode")).toBeNull();
    expect(Brightness.setBrightnessAsync).toHaveBeenLastCalledWith(0.6);
    expect(onStop).not.toHaveBeenCalled();
  });

  test("cancelling the warning keeps the screen as it is", async () => {
    await render(<NavigationCard navigation={navigation} onStop={() => {}} />);
    await fireEvent.press(screen.getByLabelText("Pocket mode"));
    expect(screen.queryByText("Hold for 2 seconds to leave pocket mode")).toBeNull();
    // The run keeps the screen on by itself (TASK-255); pocket mode did not.
    expect(activateKeepAwakeAsync).not.toHaveBeenCalledWith(KEEP_AWAKE_TAG);
    expect(activateKeepAwakeAsync).toHaveBeenCalledWith(RUN_AWAKE_TAG);
  });

  test("arriving ends pocket mode, and there is no button to start it again", async () => {
    const view = await render(
      <NavigationCard navigation={navigation} onStop={() => {}} />,
    );
    await fireEvent.press(screen.getByLabelText("Pocket mode"));
    await act(() => acceptWarning(alert));

    await view.rerender(
      <NavigationCard
        navigation={{ ...navigation, arrived: true }}
        onStop={() => {}}
      />,
    );
    expect(screen.queryByText("Hold for 2 seconds to leave pocket mode")).toBeNull();
    expect(screen.queryByLabelText("Pocket mode")).toBeNull();
    expect(Brightness.setBrightnessAsync).toHaveBeenLastCalledWith(0.6);
  });
});

test("the way out is Stop during the run and Finish at the end (TASK-113)", async () => {
  const { navigation } = startNavigation(points, directions);
  const onStop = jest.fn();
  const view = await render(<NavigationCard navigation={navigation} onStop={onStop} />);
  expect(screen.getByText("Stop")).toBeTruthy();
  await view.rerender(
    <NavigationCard navigation={{ ...navigation, arrived: true }} onStop={onStop} />,
  );
  await fireEvent.press(screen.getByText("Finish"));
  expect(onStop).toHaveBeenCalledTimes(1);
});
