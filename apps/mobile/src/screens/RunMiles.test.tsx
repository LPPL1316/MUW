/**
 * The run's screens with «Miles» chosen in «Settings» (TASK-182, part C):
 * the distance in miles, the paces for a mile, the last mile, the miles one
 * by one on «Data», on a bike the speed in mph, the way to a turn in feet,
 * and the end of the run. A change in «Settings» is on the screen at once.
 * In kilometres the screens are in their own tests, unchanged.
 */
import type { Activity, Direction, LatLon } from "@shaperoute/shared-types";
import result from "@shaperoute/shared-types/fixtures/route-result.json";
import scoreRequest from "@shaperoute/shared-types/fixtures/track-score-request.json";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useEffect, useState } from "react";
import { Text } from "react-native";

import { appLanguage } from "../i18n/language";
import type { FreeRun } from "../navigation/freeRun";
import { startNavigation } from "../navigation/navigator";
import {
  controlRun,
  type RunSession,
  setAutoPause,
  setVoice,
  skipCountdown,
} from "../navigation/runControl";
import {
  addFix,
  emptyTrack,
  type Track,
  type TrackFix,
} from "../navigation/trackRecorder";
import { clearRun, type ScorableRun, startRun } from "../navigation/trackStore";
import { METRES_PER_MILE } from "../units/format";
import { saveUnitsChoice } from "../units/units";
import { FinishCard } from "./FinishScreen";
import { FreeFinishCard, FreeRunBanner } from "./FreeRunScreen";
import { NavigationBanner } from "./NavigateScreen";
import { RunCard } from "./RunDashboard";
import {
  RouteBar,
  type RouteProgress,
  RunGrid,
  RunStrip,
  useRunNumbers,
} from "./RunPanel";

// The app's language, English unless a test says otherwise.
jest.mock("../i18n/language", () => ({
  ...jest.requireActual<typeof import("../i18n/language")>("../i18n/language"),
  appLanguage: jest.fn(() => "en"),
}));
jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock("expo-brightness", () => ({
  getBrightnessAsync: jest.fn(() => Promise.resolve(0.6)),
  setBrightnessAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  class File {
    uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
    }
    get exists(): boolean {
      return files.has(this.uri);
    }
    create(): void {
      files.set(this.uri, "");
    }
    write(text: string): void {
      files.set(this.uri, text);
    }
    textSync(): string {
      return files.get(this.uri) ?? "";
    }
    delete(): void {
      files.delete(this.uri);
    }
  }
  return { File, Paths: { document: { uri: "file:///documents/" } } };
});

const START: LatLon = [46.0122, 11.2986];
/** A metre north in degrees, a little over: a fix at a mile has run it. */
const METRE = 1 / 111_194;
const MILE = METRES_PER_MILE;
const NOW = Date.UTC(2026, 9, 5, 7, 0, 0);

/**
 * North to `end` metres, the first mile at `first` seconds a kilometre and
 * the rest at `rest`, a fix every 50 m and one at the end of each mile, the
 * last one now. `end` is a multiple of 50 m, as the fixes are.
 */
function north(end: number, first: number, rest: number = first): TrackFix[] {
  const secondsAt = (m: number) =>
    m <= MILE ? (m / 1000) * first : (MILE / 1000) * first + ((m - MILE) / 1000) * rest;
  const at = new Set<number>([end]);
  for (let m = 0; m < end; m += 50) {
    at.add(m);
  }
  for (let m = MILE; m < end; m += MILE) {
    at.add(m);
  }
  return [...at]
    .sort((a, b) => a - b)
    .map((m) => ({
      point: [START[0] + m * METRE, START[1]],
      timeMs: NOW - (secondsAt(end) - secondsAt(m)) * 1000,
      accuracyM: 5,
    }));
}

function trackOf(fixes: TrackFix[]): Track {
  return fixes.reduce(addFix, emptyTrack());
}

/** Every number of the run, as the two panels show them. */
function Numbers({
  track,
  route,
  activity,
}: {
  track: Track;
  route?: RouteProgress;
  activity?: Activity;
}) {
  const numbers = useRunNumbers(track, false, route, activity);
  return (
    <>
      <RunStrip numbers={numbers} />
      <RunGrid numbers={numbers} />
      {route && <RouteBar route={route} numbers={numbers} />}
    </>
  );
}

/** A run as the recording hooks make it, with its card and its two pages. */
function LiveRun({ fixes, activity }: { fixes: TrackFix[]; activity?: Activity }) {
  const [track, setTrack] = useState<Track>(emptyTrack);
  useEffect(() => {
    const recorder = startRun([], Date.now());
    const session: RunSession = controlRun(recorder, {
      onChange: () => setTrack(recorder.track()),
      say: () => {},
    });
    // The GPS of the run on screen: each fix draws the card again.
    const gps = (fix: TrackFix) => {
      session.onFix(fix, false);
      setTrack(recorder.track());
    };
    skipCountdown();
    fixes.forEach(gps);
    return () => session.end();
  }, [fixes]);
  return (
    <RunCard
      track={track}
      live
      heading={<Text>Next turn</Text>}
      onStop={() => {}}
      activity={activity}
    />
  );
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, doNotFake: ["queueMicrotask", "nextTick"] });
  clearRun();
  setAutoPause(true);
  setVoice(true);
  await act(async () => {
    saveUnitsChoice("mi");
  });
});

afterEach(async () => {
  await act(async () => {
    saveUnitsChoice("phone");
  });
  jest.useRealTimers();
});

test("the numbers of a run in miles: the distance, the paces for a mile, the last mile", async () => {
  // 3.3 km, 2.05 miles, at 5:00 /km, which is 8:03 a mile.
  await render(<Numbers track={trackOf(north(3300, 300))} />);
  expect(screen.getByLabelText("Distance: 2.05 mi")).toBeOnTheScreen();
  expect(screen.getAllByLabelText("Pace now: 8:03 /mi")).toHaveLength(2);
  expect(screen.getByLabelText("Avg pace: 8:03 /mi")).toBeOnTheScreen();
  expect(screen.getByLabelText("Last mi: 8:03 /mi")).toBeOnTheScreen();
  expect(screen.getByText("Last mi")).toBeOnTheScreen();
  expect(screen.queryByText("Last km")).toBeNull();
  expect(screen.queryByText("km")).toBeNull();
  expect(screen.queryByText("/km")).toBeNull();
  // The time is the time; the climb stays in metres and the energy in kcal.
  expect(screen.getAllByLabelText("Time: 16:30")).toHaveLength(2);
  expect(screen.getByLabelText("Elev. gain: – m")).toBeOnTheScreen();
  expect(screen.getByLabelText("Calories: 231 kcal")).toBeOnTheScreen();
});

test("the last mile is the last whole one, and none before the first", async () => {
  // 1.45 km, 0.9 of a mile: a kilometre is whole and a mile is not.
  const view = await render(<Numbers track={trackOf(north(1450, 300))} />);
  expect(screen.getByLabelText("Last mi: – /mi")).toBeOnTheScreen();
  expect(screen.getByLabelText("Distance: 0.90 mi")).toBeOnTheScreen();
  // The first mile at 5:00 /km, then to 2.6 km at 6:00 /km: the last whole mile
  // is the first, 8:03, while the pace now is 9:39.
  await view.rerender(<Numbers track={trackOf(north(2600, 300, 360))} />);
  expect(screen.getByLabelText("Last mi: 8:03 /mi")).toBeOnTheScreen();
  expect(screen.getAllByLabelText("Pace now: 9:39 /mi")).toHaveLength(2);
});

test("along a route in miles: what is left in miles, then in feet", async () => {
  const track = trackOf(north(1950, 300));
  const view = await render(
    <Numbers track={track} route={{ remainingM: 3200, done: 0.42 }} />,
  );
  expect(screen.getByText("2.0 mi to go")).toBeOnTheScreen();
  // 3.2 km at 5:00 /km: the time left does not change with the units.
  expect(screen.getByText("about 16 min")).toBeOnTheScreen();
  await view.rerender(
    <Numbers track={track} route={{ remainingM: 120, done: 0.97 }} />,
  );
  expect(screen.getByText("400 ft to go")).toBeOnTheScreen();
});

test("by bike in miles the numbers are speeds in mph", async () => {
  // 3.7 km, 2.3 miles: the first mile at 24 km/h (14.9 mph), the rest at
  // 20 km/h (12.4 mph).
  const track = trackOf(north(3700, 150, 180));
  await render(<Numbers track={track} activity="cycling" />);
  expect(screen.getByLabelText("Distance: 2.30 mi")).toBeOnTheScreen();
  expect(screen.getAllByLabelText("Speed now: 12.4 mph")).toHaveLength(2);
  expect(screen.getByLabelText("Avg speed: 13.4 mph")).toBeOnTheScreen();
  expect(screen.getByLabelText("Last mi: 12.4 mph")).toBeOnTheScreen();
  expect(screen.queryByText("km/h")).toBeNull();
});

test("«Data» in miles: the miles one by one, each with its pace and its change", async () => {
  // 3.7 km, 2.3 miles: the first mile at 5:00 /km (8:03), then at 6:00 /km
  // (9:39).
  await render(<LiveRun fixes={north(3700, 300, 360)} />);
  expect(screen.getByLabelText("Distance: 2.30 mi")).toBeOnTheScreen();
  expect(screen.getByLabelText("Pace now: 9:39 /mi")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
  // The distance, large, with its unit under it.
  expect(screen.getAllByLabelText("Distance: 2.30 mi").length).toBeGreaterThan(0);
  expect(screen.getByText("miles")).toBeOnTheScreen();
  expect(screen.queryByText("kilometres")).toBeNull();
  expect(screen.getByText("Mi")).toBeOnTheScreen();
  expect(screen.queryByText("Km")).toBeNull();
  expect(screen.getByLabelText("Mile 1: 8:03")).toBeOnTheScreen();
  expect(screen.getByLabelText("Mile 2: 9:39, +1:37")).toBeOnTheScreen();
  expect(screen.getByText("+1:37")).toBeOnTheScreen();
  // Two miles: no third row, though the run is 3.7 km long.
  expect(screen.queryByLabelText(/^Mile 3/)).toBeNull();
  expect(screen.queryByLabelText(/^Kilometre/)).toBeNull();
  // The faster mile has the longer bar.
  expect(screen.getByTestId("split-bar-1")).toHaveStyle({ width: "100%" });
  expect(screen.queryByText("Your first mile will show here.")).toBeNull();
});

test("before the first mile, «Data» says where the miles will be", async () => {
  // 1.45 km are 0.9 of a mile: in kilometres there would be a row.
  await render(<LiveRun fixes={north(1450, 300)} />);
  await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
  expect(screen.getByText("Your first mile will show here.")).toBeOnTheScreen();
  expect(screen.queryByText("Your first kilometre will show here.")).toBeNull();
  expect(screen.queryByLabelText(/^Kilometre 1/)).toBeNull();
  expect(screen.queryByLabelText(/^Mile 1/)).toBeNull();
});

test("by bike «Data» in miles says each mile's speed in mph, and how it changed", async () => {
  await render(<LiveRun fixes={north(3700, 150, 180)} activity="cycling" />);
  expect(screen.getByLabelText("Speed now: 12.4 mph")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
  expect(screen.getByLabelText("Avg speed: 13.4 mph")).toBeOnTheScreen();
  expect(screen.getByText("Speed")).toBeOnTheScreen();
  expect(screen.getByLabelText("Mile 1: 14.9 mph")).toBeOnTheScreen();
  expect(screen.getByLabelText("Mile 2: 12.4 mph, -2.5")).toBeOnTheScreen();
  expect(screen.getByText("-2.5")).toBeOnTheScreen();
});

test("a change of units in «Settings» is on the run's screen at once", async () => {
  await render(<LiveRun fixes={north(3700, 300, 360)} />);
  await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
  expect(screen.getByLabelText("Mile 1: 8:03")).toBeOnTheScreen();
  await act(async () => {
    saveUnitsChoice("km");
  });
  // 3.70 km: three whole kilometres, as before TASK-182.
  expect(screen.getAllByLabelText("Distance: 3.70 km").length).toBeGreaterThan(0);
  expect(screen.getByText("kilometres")).toBeOnTheScreen();
  expect(screen.getByText("Km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Kilometre 1: 5:00")).toBeOnTheScreen();
  expect(screen.getByLabelText("Kilometre 2: 5:23, +0:23")).toBeOnTheScreen();
  expect(screen.getByLabelText("Kilometre 3: 6:00, +0:37")).toBeOnTheScreen();
  expect(screen.getByLabelText("Avg pace: 5:34 /km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Last km: 6:00 /km")).toBeOnTheScreen();
  expect(screen.queryByLabelText(/^Mile/)).toBeNull();
  await act(async () => {
    saveUnitsChoice("mi");
  });
  expect(screen.getByLabelText("Mile 2: 9:39, +1:37")).toBeOnTheScreen();
  expect(screen.getByLabelText("Last mi: 9:39 /mi")).toBeOnTheScreen();
  expect(screen.queryByLabelText(/^Kilometre/)).toBeNull();
});

test("in Italian, the miles' own names", async () => {
  jest.mocked(appLanguage).mockReturnValue("it");
  try {
    await render(<LiveRun fixes={north(3700, 300, 360)} />);
    await fireEvent.press(screen.getByRole("tab", { name: "Dati" }));
    expect(screen.getByLabelText("Ultimo mi: 9:39 /mi")).toBeOnTheScreen();
    expect(screen.getByText("miglia")).toBeOnTheScreen();
    expect(screen.getByLabelText("Miglio 2: 9:39, +1:37")).toBeOnTheScreen();
  } finally {
    jest.mocked(appLanguage).mockReturnValue("en");
  }
});

test("in Italian before the first mile, and by bike", async () => {
  jest.mocked(appLanguage).mockReturnValue("it");
  try {
    const view = await render(<LiveRun fixes={north(1450, 300)} />);
    await fireEvent.press(screen.getByRole("tab", { name: "Dati" }));
    expect(screen.getByText("Il tuo primo miglio apparirà qui.")).toBeOnTheScreen();
    await view.unmount();
    clearRun();
    await render(<LiveRun fixes={north(3700, 150, 180)} activity="cycling" />);
    await fireEvent.press(screen.getByRole("tab", { name: "Dati" }));
    expect(screen.getByLabelText("Miglio 2: 12.4 mph, -2.5")).toBeOnTheScreen();
    expect(screen.getByLabelText("Ultimo mi: 12.4 mph")).toBeOnTheScreen();
  } finally {
    jest.mocked(appLanguage).mockReturnValue("en");
  }
});

test("the banner says how far the turn is in feet", async () => {
  const directions = result.directions as Direction[];
  const { navigation } = startNavigation(
    result.points as [number, number][],
    directions,
  );
  // 104 m before the turn at 2,004 m: 343 feet.
  const before = { ...navigation, next: 2, saidUpTo: 2, alongM: 1900 };
  const view = await render(
    <NavigationBanner
      state={{
        status: "following",
        navigation: before,
        position: null,
        track: emptyTrack(),
      }}
    />,
  );
  expect(screen.getByText("350 ft")).toBeOnTheScreen();
  expect(screen.queryByText("100 m")).toBeNull();
  // A kilometre before the first turn: miles.
  await view.rerender(
    <NavigationBanner
      state={{
        status: "following",
        navigation: { ...navigation, next: 1, saidUpTo: 0, alongM: 3.6 },
        position: null,
        track: emptyTrack(),
      }}
    />,
  );
  expect(screen.getByText("0.6 mi")).toBeOnTheScreen();
  // And in kilometres, as before.
  await act(async () => {
    saveUnitsChoice("km");
  });
  expect(screen.getByText("1.0 km")).toBeOnTheScreen();
});

test("without a route the way to the start is in feet, then in miles", async () => {
  const run = trackOf(north(200, 300));
  const view = await render(
    <FreeRunBanner state={{ status: "running", track: run, position: null }} />,
  );
  expect(screen.getByText("650 ft")).toBeOnTheScreen();
  expect(
    screen.getByLabelText("Your start: 650 ft in a straight line, to the south"),
  ).toBeOnTheScreen();
  const far = trackOf(north(2000, 300));
  await view.rerender(
    <FreeRunBanner state={{ status: "running", track: far, position: null }} />,
  );
  expect(screen.getByText("1.2 mi")).toBeOnTheScreen();
  await act(async () => {
    saveUnitsChoice("km");
  });
  expect(screen.getByText("2.0 km")).toBeOnTheScreen();
});

test("the end of a run without a route in miles", async () => {
  const run: FreeRun = {
    version: 1,
    route: [],
    // 4.21 km in 25:00, as in FreeRunScreen.test.tsx.
    track: {
      fixes: [
        { point: START, timeMs: 0, accuracyM: 5 },
        { point: [START[0] + 0.01, START[1]], timeMs: 1_500_000, accuracyM: 5 },
      ],
      distanceM: 4210,
    },
    status: "stopped",
  };
  await render(<FreeFinishCard run={run} onDone={jest.fn()} />);
  expect(screen.getByText("2.62 mi")).toBeOnTheScreen();
  expect(screen.getByLabelText("Distance: 2.62 mi")).toBeOnTheScreen();
  expect(screen.getByLabelText("Time: 25:00")).toBeOnTheScreen();
  // 5:56 /km is 9:33 a mile.
  expect(screen.getByLabelText("Avg pace: 9:33 /mi")).toBeOnTheScreen();
  expect(screen.queryByText("4.21 km")).toBeNull();
  await act(async () => {
    saveUnitsChoice("km");
  });
  expect(screen.getByText("4.21 km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Avg pace: 5:56 /km")).toBeOnTheScreen();
});

test("the end of a run along a route says how far in miles", async () => {
  const run: ScorableRun = {
    version: 1,
    route: scoreRequest.points as LatLon[],
    similarity: scoreRequest.similarity,
    status: "arrived",
    track: {
      distanceM: 4007,
      fixes: scoreRequest.track.map((fix) => ({
        point: fix.point as LatLon,
        timeMs: fix.time_ms,
        accuracyM: fix.accuracy_m,
      })),
    },
  };
  await render(<FinishCard run={run} onDone={jest.fn()} />);
  expect(screen.getByText("2.5 mi · 20 min")).toBeOnTheScreen();
  await act(async () => {
    saveUnitsChoice("km");
  });
  expect(screen.getByText("4.0 km · 20 min")).toBeOnTheScreen();
});
