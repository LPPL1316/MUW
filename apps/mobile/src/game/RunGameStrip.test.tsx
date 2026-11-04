import catalog from "@shaperoute/shared-types/fixtures/game-catalog.json";
import me from "@shaperoute/shared-types/fixtures/game-me.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { Activity, GameCatalog, LatLon, Session } from "@shaperoute/shared-types";
import { render, screen, waitFor } from "@testing-library/react-native";

import { answers, apiError } from "../account/testing";
import type { AccountState } from "../account/useAccount";
import { emptyTrack, type Track, type TrackFix } from "../navigation/trackRecorder";
import { FollowsContext } from "../social/followsDoor";
import { saveUnitsChoice } from "../units/units";
import { forgetGameCatalog, setGameCatalog } from "./gameCatalog";
import { RunGameStrip } from "./RunGameStrip";

// The phone's documents folder, in memory: the catalog and the units.
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
const SIGNED_OUT: AccountState = { status: "signedOut", notice: null };
const CATALOG = catalog as GameCatalog;
const MY_ID = SESSION.user.public_id as string;

/** GET /game/teams with one challenge going, and the piece `holder` holds. */
function teamsBody(holder: string | null, kind: "pace" | "distance" = "pace"): unknown {
  return {
    teams: [
      {
        id: "t1",
        name: "Morning runners",
        code: "ABC123",
        owner: MY_ID,
        members: [],
        challenge: {
          id: "c1",
          team_id: "t1",
          shape_id: "lightning",
          status: "active",
          starts_at: "2026-10-25T06:00:00Z",
          ends_at: "2026-11-01T06:00:00Z",
          completed_at: null,
          seconds_left: 500000,
          pieces: [
            {
              idx: 0,
              goal:
                kind === "pace"
                  ? { kind: "pace", total_m: null, distance_m: 1000, pace_s: 300 }
                  : { kind: "distance", total_m: 5000, distance_m: null, pace_s: null },
              holder:
                holder === null ? null : { public_id: holder, username: "Someone" },
              done_m: 0,
              done: false,
              outline: [
                [0, 0],
                [0.5, 0],
              ],
            },
          ],
          contributions: [],
        },
      },
    ],
  };
}

const START: LatLon = [46.0122, 11.2986];
const METRE = 1 / 111_195;
const NOW = Date.UTC(2026, 9, 25, 7, 0, 0);

/** Straight north for `metres` at 5:12 /km, a fix every 50 m. */
function north(metres: number): Track {
  const fixes: TrackFix[] = [];
  for (let m = 0; m <= metres; m += 50) {
    fixes.push({
      point: [START[0] + m * METRE, START[1]],
      timeMs: NOW + m * 0.312 * 1000,
      accuracyM: 5,
    });
  }
  return { fixes, distanceM: metres };
}

beforeEach(() => {
  setGameCatalog(CATALOG);
});

afterEach(() => {
  forgetGameCatalog();
  saveUnitsChoice("phone");
});

async function shown(
  fetchFn: jest.Mock,
  track: Track,
  {
    state = SIGNED_IN,
    activity,
    apiUrl = API,
  }: { state?: AccountState; activity?: Activity; apiUrl?: string | null } = {},
) {
  const line = (each: Track) => (
    <FollowsContext.Provider
      value={{
        apiUrl,
        account: { state, sessionEnded: jest.fn() },
        openProfile: () => {},
      }}
    >
      <RunGameStrip track={each} activity={activity} fetchFn={fetchFn} apiKey={null} />
    </FollowsContext.Provider>
  );
  const result = await render(line(track));
  return { ...result, line };
}

test("the next shape by distance, with this run's metres added as it goes", async () => {
  const fetchFn = answers(
    { status: 200, body: me },
    { status: 200, body: teamsBody(null) },
  );
  const { rerender, line } = await shown(fetchFn, emptyTrack());
  await waitFor(() => expect(screen.getByTestId("game-strip")).toBeTruthy());
  expect(screen.getByTestId("game-strip")).toHaveTextContent("Hexagon 14.2 / 20 km");
  // The run goes on: the phone adds its metres, and asks the API nothing more.
  await rerender(line(north(300)));
  expect(screen.getByTestId("game-strip")).toHaveTextContent("Hexagon 14.5 / 20 km");
  await rerender(line(north(1200)));
  expect(screen.getByTestId("game-strip")).toHaveTextContent("Hexagon 15.4 / 20 km");
  expect(fetchFn).toHaveBeenCalledTimes(2);
});

test("with a pace piece in hand, the last kilometre against the target", async () => {
  const fetchFn = answers(
    { status: 200, body: me },
    { status: 200, body: teamsBody(MY_ID) },
  );
  const { rerender, line } = await shown(fetchFn, north(300));
  await waitFor(() => expect(screen.getByTestId("game-strip")).toBeTruthy());
  expect(screen.getByTestId("game-strip")).toHaveTextContent(
    "Last km – · target 5:00 /km",
  );
  await rerender(line(north(1200)));
  expect(screen.getByTestId("game-strip")).toHaveTextContent(
    "Last km 5:12 · target 5:00 /km",
  );
});

test("a pace piece somebody else holds, or a piece of distance, is not mine", async () => {
  const others = answers(
    { status: 200, body: me },
    { status: 200, body: teamsBody("x-1") },
  );
  await shown(others, north(1200));
  await waitFor(() => expect(screen.getByTestId("game-strip")).toBeTruthy());
  expect(screen.getByTestId("game-strip")).toHaveTextContent("Hexagon 15.4 / 20 km");
  await screen.unmount();

  const distance = answers(
    { status: 200, body: me },
    { status: 200, body: teamsBody(MY_ID, "distance") },
  );
  await shown(distance, north(1200));
  await waitFor(() => expect(screen.getByTestId("game-strip")).toBeTruthy());
  expect(screen.getByTestId("game-strip")).toHaveTextContent("Hexagon 15.4 / 20 km");
});

test("in miles", async () => {
  saveUnitsChoice("mi");
  const fetchFn = answers(
    { status: 200, body: me },
    { status: 200, body: teamsBody(null) },
  );
  await shown(fetchFn, north(300));
  await waitFor(() => expect(screen.getByTestId("game-strip")).toBeTruthy());
  expect(screen.getByTestId("game-strip")).toHaveTextContent("Hexagon 9.0 / 12.4 mi");
  await screen.unmount();

  const pace = answers(
    { status: 200, body: me },
    { status: 200, body: teamsBody(MY_ID) },
  );
  await shown(pace, north(1700));
  await waitFor(() => expect(screen.getByTestId("game-strip")).toBeTruthy());
  expect(screen.getByTestId("game-strip")).toHaveTextContent(
    "Last mi 8:22 · target 8:03 /mi",
  );
});

test("an API without the teams yet shows the shape by distance", async () => {
  const fetchFn = answers(
    { status: 200, body: me },
    { status: 404, body: apiError("http_error", "Not Found") },
  );
  await shown(fetchFn, north(300));
  await waitFor(() => expect(screen.getByTestId("game-strip")).toBeTruthy());
  expect(screen.getByTestId("game-strip")).toHaveTextContent("Hexagon 14.5 / 20 km");
});

test("no line, and no request, on a bike or on the water, paddled or swum", async () => {
  for (const activity of ["cycling", "paddling", "swimming"] as const) {
    const fetchFn = answers();
    await shown(fetchFn, north(300), { activity });
    await waitFor(() => expect(fetchFn).not.toHaveBeenCalled());
    expect(screen.queryByTestId("game-strip")).toBeNull();
    await screen.unmount();
  }
});

test("no line, and no request, without an account, an API or the catalog", async () => {
  const signedOut = answers();
  await shown(signedOut, north(300), { state: SIGNED_OUT });
  expect(signedOut).not.toHaveBeenCalled();
  expect(screen.queryByTestId("game-strip")).toBeNull();
  await screen.unmount();

  const noApi = answers();
  await shown(noApi, north(300), { apiUrl: null });
  expect(noApi).not.toHaveBeenCalled();
  expect(screen.queryByTestId("game-strip")).toBeNull();
  await screen.unmount();

  forgetGameCatalog();
  const noGame = answers();
  await shown(noGame, north(300));
  expect(noGame).not.toHaveBeenCalled();
  expect(screen.queryByTestId("game-strip")).toBeNull();
});

test("without a network the run goes on without the line, and no error", async () => {
  const fetchFn = answers(new Error("offline"), new Error("offline"));
  await shown(fetchFn, north(300));
  await waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
  // Give the answers their microtask.
  await waitFor(() => expect(screen.queryByTestId("game-strip")).toBeNull());
  expect(screen.queryByTestId("game-strip")).toBeNull();
});
