import type { LatLon } from "@shaperoute/shared-types";
import { act, render, screen } from "@testing-library/react-native";

import {
  addFix,
  emptyTrack,
  pauseTrack,
  type Track,
} from "../navigation/trackRecorder";
import {
  RouteBar,
  type RouteProgress,
  RunGrid,
  RunStrip,
  TICK_MS,
  useRunNumbers,
} from "./RunPanel";

const START: LatLon = [46.0122, 11.2986];
const METRE = 1 / 111_195;
const NOW = Date.UTC(2026, 9, 2, 7, 0, 0);

/** Straight north, a fix every 50 m at `secondsPerKm`, the last at `endMs`;
 * climbing `climbPerKm` metres each kilometre when given. */
function north(
  metres: number,
  secondsPerKm: number,
  endMs: number,
  climbPerKm?: number,
): Track {
  let track = emptyTrack();
  for (let m = 0; m <= metres; m += 50) {
    track = addFix(track, {
      point: [START[0] + m * METRE, START[1]],
      timeMs: endMs - ((metres - m) / 1000) * secondsPerKm * 1000,
      accuracyM: 5,
      altitudeM: climbPerKm === undefined ? undefined : 200 + (m / 1000) * climbPerKm,
    });
  }
  return track;
}

/** Every number of the run, as the two panels show them. */
function Numbers({
  track,
  live,
  route,
}: {
  track: Track;
  live: boolean;
  route?: RouteProgress;
}) {
  const numbers = useRunNumbers(track, live, route);
  return (
    <>
      <RunStrip numbers={numbers} />
      <RunGrid numbers={numbers} />
      {route && <RouteBar route={route} numbers={numbers} />}
    </>
  );
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
  jest.useRealTimers();
});

test("under the map: how far, the pace now and the clock", async () => {
  // 1.5 km at 6:00 /km: nine minutes.
  const Strip = () => <RunStrip numbers={useRunNumbers(north(1500, 360, NOW), true)} />;
  await render(<Strip />);
  expect(screen.getByLabelText("Distance: 1.50 km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Pace now: 6:00 /km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Time: 9:00")).toBeOnTheScreen();
  // Three numbers: the rest is on the page of the data.
  expect(screen.queryByText("Avg pace")).toBeNull();
  expect(screen.queryByText("Calories")).toBeNull();
});

test("all the numbers: paces, clock, last kilometre, climb and energy", async () => {
  // 1.5 km at 6:00 /km, climbing 20 m each kilometre.
  await render(<Numbers track={north(1500, 360, NOW, 20)} live />);
  expect(screen.getAllByLabelText("Pace now: 6:00 /km")).toHaveLength(2);
  expect(screen.getByLabelText("Avg pace: 6:00 /km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Last km: 6:00 /km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Elev. gain: 30 m")).toBeOnTheScreen();
  // 1.5 km and 30 m up at 70 kg: 70 × (1.5 + 0.0045 × 30) (ADR-0318).
  expect(screen.getByLabelText("Calories: 114 kcal")).toBeOnTheScreen();
  // No route: nothing to go, no bar.
  expect(screen.queryByText(/to go/)).toBeNull();
  expect(screen.queryByTestId("route-done")).toBeNull();
  // The clock goes on between fixes.
  await act(async () => {
    jest.advanceTimersByTime(TICK_MS);
  });
  expect(screen.getAllByLabelText("Time: 9:01")).toHaveLength(2);
});

test("along a route: what is left, about how long, and the bar", async () => {
  await render(
    <Numbers
      track={north(1500, 360, NOW)}
      live
      route={{ remainingM: 3200, done: 0.42 }}
    />,
  );
  expect(screen.getByText("3.2 km to go")).toBeOnTheScreen();
  // 3.2 km at 6:00 /km.
  expect(screen.getByText("about 19 min")).toBeOnTheScreen();
  expect(screen.getByTestId("route-done")).toHaveStyle({ width: "42%" });
});

test("before 100 metres there is no pace, and no time left to say", async () => {
  await render(
    <Numbers
      track={north(50, 360, NOW)}
      live
      route={{ remainingM: 4950, done: 0.01 }}
    />,
  );
  expect(screen.getByLabelText("Distance: 0.05 km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Avg pace: – /km")).toBeOnTheScreen();
  expect(screen.getAllByLabelText("Pace now: – /km")).toHaveLength(2);
  expect(screen.getByLabelText("Last km: – /km")).toBeOnTheScreen();
  expect(screen.getAllByLabelText("Time: 0:18")).toHaveLength(2);
  expect(screen.getByText("5.0 km to go")).toBeOnTheScreen();
  expect(screen.queryByText(/^about/)).toBeNull();
});

test("before the first fix everything waits at zero, and no height is no climb", async () => {
  await render(<Numbers track={emptyTrack()} live />);
  expect(screen.getByLabelText("Distance: 0.00 km")).toBeOnTheScreen();
  expect(screen.getAllByLabelText("Time: 0:00")).toHaveLength(2);
  expect(screen.getByLabelText("Elev. gain: – m")).toBeOnTheScreen();
  expect(screen.getByLabelText("Calories: 0 kcal")).toBeOnTheScreen();
  await act(async () => {
    jest.advanceTimersByTime(3 * TICK_MS);
  });
  expect(screen.getAllByLabelText("Time: 0:00")).toHaveLength(2);
});

test("a run that is over stops its clock at the last fix", async () => {
  // Ended a minute ago.
  await render(<Numbers track={north(1000, 300, NOW - 60_000)} live={false} />);
  expect(screen.getAllByLabelText("Time: 5:00")).toHaveLength(2);
  await act(async () => {
    jest.advanceTimersByTime(5 * TICK_MS);
  });
  expect(screen.getAllByLabelText("Time: 5:00")).toHaveLength(2);
  expect(screen.getByLabelText("Avg pace: 5:00 /km")).toBeOnTheScreen();
});

test("paused, the clock stands where the pause began and there is no pace now", async () => {
  // Paused twenty seconds ago, ten seconds after the last fix.
  const paused = pauseTrack(north(1000, 300, NOW - 30_000), NOW - 20_000);
  await render(<Numbers track={paused} live />);
  expect(screen.getAllByLabelText("Time: 5:10")).toHaveLength(2);
  expect(screen.getAllByLabelText("Pace now: – /km")).toHaveLength(2);
  await act(async () => {
    jest.advanceTimersByTime(5 * TICK_MS);
  });
  expect(screen.getAllByLabelText("Time: 5:10")).toHaveLength(2);
});
