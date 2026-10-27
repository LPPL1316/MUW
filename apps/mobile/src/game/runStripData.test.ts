import catalog from "@shaperoute/shared-types/fixtures/game-catalog.json";
import me from "@shaperoute/shared-types/fixtures/game-me.json";
import type {
  ChallengePiece,
  GameCatalog,
  GameChallenge,
  GameGoal,
  GameMe,
  GameShape,
  GameTeams,
  LatLon,
} from "@shaperoute/shared-types";

import { answers, apiError } from "../account/testing";
import { saveLanguageChoice } from "../i18n/language";
import { emptyTrack, type Track, type TrackFix } from "../navigation/trackRecorder";
import {
  heldPaceGoal,
  loadRunStripData,
  nextDistanceShape,
  type PaceGoal,
  runStripText,
} from "./runStripData";

// The language the words are written in: the phone's, English here.
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
const TOKEN = "token";

/** The fake fetch, as the requests take it. */
const fake = (...list: Parameters<typeof answers>): jest.Mock => answers(...list);

const CATALOG = catalog as GameCatalog;
const ME = me as GameMe;
/** The account of the session fixture. */
const MY_ID = "8c1f7a52-3d4e-4b9a-9f61-2a7c0e5d9b13";
const OTHER_ID = "0d9e1c2b-7a65-4f43-8b21-6c5d4e3f2a10";

/** A fourth shape, 42 km, after the fixture's hexagon. */
const CIRCLE: GameShape = {
  id: "circle",
  names: { en: "Circle", de: "Kreis", it: "Cerchio", es: "Círculo", fr: "Cercle" },
  goal: { kind: "distance", total_m: 42000, distance_m: null, pace_s: null },
  outline: [
    [0.5, 0],
    [1, 0.5],
    [0.5, 1],
    [0, 0.5],
    [0.5, 0],
  ],
};
const WITH_CIRCLE: GameCatalog = { ...CATALOG, shapes: [...CATALOG.shapes, CIRCLE] };

const PACE_1K: PaceGoal = { kind: "pace", distance_m: 1000, pace_s: 300 };
/** The same, as the API writes a goal. */
const API_PACE_1K: GameGoal = {
  kind: "pace",
  total_m: null,
  distance_m: 1000,
  pace_s: 300,
};
const API_5K: GameGoal = {
  kind: "distance",
  total_m: 5000,
  distance_m: null,
  pace_s: null,
};

function piece(
  idx: number,
  holder: string | null,
  goal: GameGoal,
  done = false,
): ChallengePiece {
  return {
    idx,
    goal,
    holder: holder === null ? null : { public_id: holder, username: "Someone" },
    done_m: 0,
    done,
    outline: [
      [0, 0],
      [0.5, 0],
    ],
  };
}

function challenge(
  pieces: ChallengePiece[],
  status: GameChallenge["status"] = "active",
): GameChallenge {
  return {
    id: "c1",
    team_id: "t1",
    shape_id: "lightning",
    status,
    starts_at: "2026-10-25T06:00:00Z",
    ends_at: "2026-11-01T06:00:00Z",
    completed_at: null,
    seconds_left: 500000,
    pieces,
    contributions: [],
  };
}

/** The account's teams, one for each challenge (or none). */
function teamsOf(...challenges: (GameChallenge | null)[]): GameTeams {
  return {
    teams: challenges.map((each, i) => ({
      id: `t${i}`,
      name: "Morning runners",
      code: "ABC123",
      owner: MY_ID,
      members: [{ public_id: MY_ID, username: "Runner_42", photo: null }],
      challenge: each,
    })),
  };
}

const START: LatLon = [46.0122, 11.2986];
const METRE = 1 / 111_195;
const NOW = Date.UTC(2026, 9, 25, 7, 0, 0);

/** Straight north for `metres`, a fix every 50 m, `secondsAt` from the start. */
function north(metres: number, secondsAt: (m: number) => number): Track {
  const fixes: TrackFix[] = [];
  for (let m = 0; m <= metres; m += 50) {
    fixes.push({
      point: [START[0] + m * METRE, START[1]],
      timeMs: NOW + secondsAt(m) * 1000,
      accuracyM: 5,
    });
  }
  return { fixes, distanceM: metres };
}

/** The first kilometre at 5:12 /km, then 5:00 /km. */
const firstKmSlow = (m: number) => (m <= 1000 ? m * 0.312 : 312 + (m - 1000) * 0.3);

afterEach(() => {
  saveLanguageChoice("phone");
});

describe("the next shape by distance", () => {
  test("is the nearest not unlocked above the total", () => {
    // The triangle (5 km) is unlocked: skipped even below its distance.
    expect(nextDistanceShape(CATALOG, ME, 0)?.shape.id).toBe("hexagon");
    expect(nextDistanceShape(CATALOG, ME, 14200)).toEqual({
      shape: CATALOG.shapes[1],
      goalM: 20000,
    });
  });

  test("leaves behind a shape the total has reached, and ends with none", () => {
    expect(nextDistanceShape(WITH_CIRCLE, ME, 19999)?.shape.id).toBe("hexagon");
    expect(nextDistanceShape(WITH_CIRCLE, ME, 20000)?.shape.id).toBe("circle");
    expect(nextDistanceShape(CATALOG, ME, 20000)).toBeNull();
    expect(nextDistanceShape(WITH_CIRCLE, ME, 42000)).toBeNull();
  });

  test("takes the nearest whatever the order of the catalog", () => {
    const circleFirst: GameCatalog = {
      ...CATALOG,
      shapes: [CIRCLE, ...CATALOG.shapes],
    };
    expect(nextDistanceShape(circleFirst, ME, 14200)?.shape.id).toBe("hexagon");
  });

  test("a shape the API did not list is not unlocked", () => {
    // ME has no state for the circle.
    expect(nextDistanceShape(WITH_CIRCLE, ME, 30000)?.shape.id).toBe("circle");
  });
});

describe("the pace piece in hand", () => {
  test("is my pace piece of a challenge still going, without the API's other fields", () => {
    const teams = teamsOf(
      null,
      challenge([piece(0, OTHER_ID, API_PACE_1K), piece(1, MY_ID, API_PACE_1K)]),
    );
    expect(heldPaceGoal(teams, MY_ID)).toEqual(PACE_1K);
  });

  test("is not a piece of distance, one done, somebody else's, or of a challenge over", () => {
    expect(
      heldPaceGoal(teamsOf(challenge([piece(0, MY_ID, API_5K)])), MY_ID),
    ).toBeNull();
    expect(
      heldPaceGoal(teamsOf(challenge([piece(0, MY_ID, API_PACE_1K, true)])), MY_ID),
    ).toBeNull();
    expect(
      heldPaceGoal(teamsOf(challenge([piece(0, OTHER_ID, API_PACE_1K)])), MY_ID),
    ).toBeNull();
    expect(
      heldPaceGoal(teamsOf(challenge([piece(0, null, API_PACE_1K)])), MY_ID),
    ).toBeNull();
    for (const status of ["completed", "expired"] as const) {
      expect(
        heldPaceGoal(teamsOf(challenge([piece(0, MY_ID, API_PACE_1K)], status)), MY_ID),
      ).toBeNull();
    }
    expect(
      heldPaceGoal(teamsOf(challenge([piece(0, MY_ID, API_PACE_1K)])), null),
    ).toBeNull();
    expect(heldPaceGoal(teamsOf(), MY_ID)).toBeNull();
  });
});

describe("reading the game as the run starts", () => {
  test("asks for the game and the teams at once, and keeps my pace piece", async () => {
    const fetchFn = fake(
      { status: 200, body: me },
      { status: 200, body: teamsOf(challenge([piece(0, MY_ID, API_PACE_1K)])) },
    );
    const data = await loadRunStripData(API, TOKEN, MY_ID, { fetchFn, key: null });
    expect(data).toEqual({ me: ME, pace: PACE_1K });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls.map((call) => call[0])).toEqual([
      `${API}/game/me`,
      `${API}/game/teams`,
    ]);
    // Each with the account's token.
    for (const call of fetchFn.mock.calls) {
      expect((call[1] as RequestInit).headers).toMatchObject({
        Authorization: `Bearer ${TOKEN}`,
      });
    }
  });

  test("an API without the teams yet leaves the shape by distance alone", async () => {
    const fetchFn = fake(
      { status: 200, body: me },
      { status: 404, body: apiError("http_error", "Not Found") },
    );
    expect(await loadRunStripData(API, TOKEN, MY_ID, { fetchFn, key: null })).toEqual({
      me: ME,
      pace: null,
    });
  });

  test("without a network, or with a session the API refuses, there is nothing", async () => {
    const offline = fake(new Error("offline"), new Error("offline"));
    expect(
      await loadRunStripData(API, TOKEN, MY_ID, { fetchFn: offline, key: null }),
    ).toBeNull();
    const refused = fake(
      { status: 401, body: apiError("session_expired") },
      { status: 401, body: apiError("session_expired") },
    );
    expect(
      await loadRunStripData(API, TOKEN, MY_ID, { fetchFn: refused, key: null }),
    ).toBeNull();
  });

  test("without a public id of mine the teams are not asked", async () => {
    const fetchFn = fake({ status: 200, body: me });
    expect(await loadRunStripData(API, TOKEN, null, { fetchFn, key: null })).toEqual({
      me: ME,
      pace: null,
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("the words of the line", () => {
  test("the next shape with this run's metres added, as «Play» writes the way", () => {
    const data = { me: ME, pace: null };
    expect(runStripText(data, CATALOG, emptyTrack(), "km", "en")).toBe(
      "Hexagon 14.2 / 20 km",
    );
    expect(
      runStripText(
        data,
        CATALOG,
        north(300, (m) => m * 0.3),
        "km",
        "en",
      ),
    ).toBe("Hexagon 14.5 / 20 km");
    expect(
      runStripText(
        data,
        CATALOG,
        north(300, (m) => m * 0.3),
        "mi",
        "en",
      ),
    ).toBe("Hexagon 9.0 / 12.4 mi");
    // In Italian, the name and the comma of the language.
    saveLanguageChoice("it");
    expect(
      runStripText(
        data,
        CATALOG,
        north(300, (m) => m * 0.3),
        "km",
        "it",
      ),
    ).toBe("Esagono 14,5 / 20 km");
  });

  test("over the distance it moves to the next shape, never saying «unlocked»", () => {
    const data = { me: { ...ME, counted_m: 19800 }, pace: null };
    expect(
      runStripText(
        data,
        WITH_CIRCLE,
        north(300, (m) => m * 0.3),
        "km",
        "en",
      ),
    ).toBe("Circle 20.1 / 42 km");
    expect(
      runStripText(
        data,
        CATALOG,
        north(300, (m) => m * 0.3),
        "km",
        "en",
      ),
    ).toBeNull();
  });

  test("with a pace piece in hand, the last kilometre against the target", () => {
    const data = { me: ME, pace: PACE_1K };
    expect(
      runStripText(
        data,
        CATALOG,
        north(300, (m) => m * 0.3),
        "km",
        "en",
      ),
    ).toBe("Last km – · target 5:00 /km");
    expect(runStripText(data, CATALOG, north(1200, firstKmSlow), "km", "en")).toBe(
      "Last km 5:12 · target 5:00 /km",
    );
    saveLanguageChoice("it");
    expect(runStripText(data, CATALOG, north(1200, firstKmSlow), "km", "it")).toBe(
      "Ultimo km 5:12 · obiettivo 5:00 /km",
    );
  });

  test("with miles, the last mile against the target a mile", () => {
    const data = { me: ME, pace: PACE_1K };
    expect(runStripText(data, CATALOG, north(1200, firstKmSlow), "mi", "en")).toBe(
      "Last mi – · target 8:03 /mi",
    );
    // A mile at 5:12 /km takes 8:22.
    expect(
      runStripText(
        data,
        CATALOG,
        north(1700, (m) => m * 0.312),
        "mi",
        "en",
      ),
    ).toBe("Last mi 8:22 · target 8:03 /mi");
  });
});
