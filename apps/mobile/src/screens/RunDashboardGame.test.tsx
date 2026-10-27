import catalog from "@shaperoute/shared-types/fixtures/game-catalog.json";
import me from "@shaperoute/shared-types/fixtures/game-me.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { Activity, GameCatalog, LatLon, Session } from "@shaperoute/shared-types";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native";
import { Text } from "react-native";

import { answers } from "../account/testing";
import type { AccountState } from "../account/useAccount";
import { forgetGameCatalog, setGameCatalog } from "../game/gameCatalog";
import type { Track, TrackFix } from "../navigation/trackRecorder";
import { FollowsContext } from "../social/followsDoor";
import { RunCard } from "./RunDashboard";

/**
 * The game's line on the run's card (TASK-296 part E): under the numbers
 * of «Map», under every number while the run is paused, and on «Data»
 * under the tiles. Read once, as the run starts. What the line says, and
 * when there is none, is `src/game/RunGameStrip.test.tsx`'s.
 */

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
// The phone's documents folder, in memory.
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

const API = "http://api";
const SESSION = session as Session;
const SIGNED_IN: AccountState = { status: "signedIn", session: SESSION };
const CATALOG = catalog as GameCatalog;
const NO_TEAMS = { teams: [] };

const START: LatLon = [46.0122, 11.2986];
const METRE = 1 / 111_195;
const NOW = Date.UTC(2026, 9, 25, 7, 0, 0);

/** Straight north for `metres` at 5:00 /km, a fix every 50 m, the last now. */
function north(metres: number): Track {
  const fixes: TrackFix[] = [];
  for (let m = 0; m <= metres; m += 50) {
    fixes.push({
      point: [START[0] + m * METRE, START[1]],
      timeMs: NOW - (metres - m) * 0.3 * 1000,
      accuracyM: 5,
    });
  }
  return { fixes, distanceM: metres };
}

beforeEach(() => {
  // As the run's own tests: the clock of the numbers stands still.
  jest.useFakeTimers({ now: NOW, doNotFake: ["queueMicrotask", "nextTick"] });
  setGameCatalog(CATALOG);
});

afterEach(() => {
  forgetGameCatalog();
  jest.useRealTimers();
});

function shown(fetchFn: jest.Mock, track: Track, activity?: Activity) {
  return render(
    <FollowsContext.Provider
      value={{
        apiUrl: API,
        account: { state: SIGNED_IN, sessionEnded: jest.fn() },
        openProfile: () => {},
      }}
    >
      <RunCard
        track={track}
        live
        heading={<Text>Next turn</Text>}
        onStop={() => {}}
        activity={activity}
        fetchFn={fetchFn}
        apiKey={null}
      />
    </FollowsContext.Provider>,
  );
}

test("the game's line is under the numbers of «Map» and on «Data», read once", async () => {
  const fetchFn = answers({ status: 200, body: me }, { status: 200, body: NO_TEAMS });
  await shown(fetchFn, north(300));
  await waitFor(() => expect(screen.getByTestId("game-strip")).toBeTruthy());
  expect(screen.getByTestId("game-strip")).toHaveTextContent("Hexagon 14.5 / 20 km");
  // The numbers and the buttons are as they were.
  expect(screen.getByLabelText("Distance: 0.30 km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Pause")).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole("tab", { name: "Data" }));
  const page = within(screen.getByTestId("data-page"));
  expect(page.getByTestId("game-strip")).toHaveTextContent("Hexagon 14.5 / 20 km");
  expect(page.getByLabelText("Last km: – /km")).toBeOnTheScreen();
  // The game and the teams, once each: nothing more while the run goes on.
  expect(fetchFn).toHaveBeenCalledTimes(2);
});

test("paused, the line stays under every number", async () => {
  const fetchFn = answers({ status: 200, body: me }, { status: 200, body: NO_TEAMS });
  const track: Track = { ...north(300), pauses: [{ fromMs: NOW, toMs: null }] };
  await shown(fetchFn, track);
  await waitFor(() => expect(screen.getByTestId("game-strip")).toBeTruthy());
  expect(screen.getByLabelText("Avg pace: 5:00 /km")).toBeOnTheScreen();
  expect(screen.getByTestId("game-strip")).toHaveTextContent("Hexagon 14.5 / 20 km");
});

test("on a bike there is no line, and the game is not asked", async () => {
  const fetchFn = answers();
  await shown(fetchFn, north(300), "cycling");
  expect(screen.getByLabelText(/^Speed now:/)).toBeOnTheScreen();
  expect(screen.queryByTestId("game-strip")).toBeNull();
  expect(fetchFn).not.toHaveBeenCalled();
});
