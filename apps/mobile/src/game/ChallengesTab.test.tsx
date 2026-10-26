import catalog from "@shaperoute/shared-types/fixtures/game-catalog.json";
import challenge from "@shaperoute/shared-types/fixtures/game-challenge.json";
import team from "@shaperoute/shared-types/fixtures/game-team.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type {
  GameCatalog,
  GameChallenge,
  GameTeam,
  Session,
} from "@shaperoute/shared-types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Share } from "react-native";

import { apiError } from "../account/testing";
import type { AccountState } from "../account/useAccount";
import { FollowsContext } from "../social/followsDoor";
import {
  clearRequestedChallenge,
  openChallenge,
  requestedChallenge,
} from "./challengeDoor";
import { ChallengesTab } from "./ChallengesTab";
import { forgetGameCatalog, setGameCatalog } from "./gameCatalog";
import { forgetChallenges } from "./useChallenge";
import { forgetTeams } from "./useTeams";

// The phone's documents folder, in memory: the catalog.
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
const GOING = challenge as GameChallenge;
const TEAM = team as GameTeam;
const WITH_CHALLENGE: GameTeam = { ...TEAM, challenge: GOING };
const ME = SESSION.user.public_id as string;
const ADAM = TEAM.members[1].public_id;
/** Six days and three hours before the deadline. */
const NOW = () => Date.parse("2026-10-26T05:00:00Z");

type Answer = { status: number; body?: unknown };
type Routes = Record<string, (body: unknown) => Answer>;

/** A fake API that answers by method and path, whatever the order. */
function fakeApi(routes: Routes): jest.Mock {
  return jest.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url.replace(API, "")}`;
    const route = routes[key];
    if (route === undefined) {
      throw new Error(`No answer for ${key}`);
    }
    const { status, body } = route(
      init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    );
    return body === undefined
      ? new Response(null, { status })
      : Response.json(body, { status });
  });
}

function calls(fetchFn: jest.Mock): string[] {
  return fetchFn.mock.calls.map(
    ([url, init]) => `${init.method} ${url.replace(API, "")}`,
  );
}

async function shown(
  fetchFn: jest.Mock,
  state: AccountState = SIGNED_IN,
  onSignIn = jest.fn(),
) {
  return render(
    <FollowsContext.Provider
      value={{
        apiUrl: API,
        account: { state, sessionEnded: jest.fn() },
        openProfile: () => {},
      }}
    >
      <ChallengesTab
        active
        onSignIn={onSignIn}
        fetchFn={fetchFn}
        apiKey={null}
        now={NOW}
      />
    </FollowsContext.Provider>,
  );
}

beforeEach(() => {
  forgetTeams();
  forgetChallenges();
  clearRequestedChallenge();
  setGameCatalog(CATALOG);
});

afterEach(() => {
  forgetGameCatalog();
  jest.restoreAllMocks();
});

test("without an account, the way to sign in", async () => {
  const onSignIn = jest.fn();
  const fetchFn = fakeApi({});
  await shown(fetchFn, SIGNED_OUT, onSignIn);
  await fireEvent.press(screen.getByTestId("challenges-sign-in"));
  expect(onSignIn).toHaveBeenCalledTimes(1);
  expect(fetchFn).not.toHaveBeenCalled();
});

test("a server without the teams yet: a quiet line, no form and no error", async () => {
  const fetchFn = fakeApi({
    "GET /game/teams": () => ({
      status: 404,
      body: apiError("http_error", "Not Found"),
    }),
  });
  await shown(fetchFn);
  await waitFor(() => expect(screen.getByTestId("challenges-none")).toBeOnTheScreen());
  expect(screen.getByTestId("challenges-none")).toHaveTextContent(
    "Teams are not on this server yet.",
  );
  expect(screen.queryByTestId("team-create")).toBeNull();
  expect(screen.queryByText("Try again")).toBeNull();
});

test("no network and nothing yet: the account's words and «Try again»", async () => {
  let down = true;
  const fetchFn = jest.fn(async (_url: string) => {
    if (down) {
      throw new Error("offline");
    }
    return Response.json({ teams: [] }, { status: 200 });
  });
  await shown(fetchFn);
  await waitFor(() => expect(screen.getByTestId("challenges-retry")).toBeOnTheScreen());
  expect(screen.getByText(/^No connection\./)).toBeOnTheScreen();
  down = false;
  await fireEvent.press(screen.getByTestId("challenges-retry"));
  await waitFor(() => expect(screen.getByTestId("challenges-empty")).toBeOnTheScreen());
});

test("the teams are listed, and a team opens with its code, members and challenge", async () => {
  const share = jest
    .spyOn(Share, "share")
    .mockResolvedValue({ action: "sharedAction" });
  const fetchFn = fakeApi({
    "GET /game/teams": () => ({ status: 200, body: { teams: [WITH_CHALLENGE] } }),
    [`GET /game/challenges/${GOING.id}`]: () => ({ status: 200, body: GOING }),
  });
  await shown(fetchFn);
  await waitFor(() => expect(screen.getByTestId(`team-${TEAM.id}`)).toBeOnTheScreen());
  expect(screen.getByTestId(`team-${TEAM.id}`)).toHaveTextContent(
    /Trento runners.*2 members.*Hexagon · 1 of 3 pieces done/,
  );
  await fireEvent.press(screen.getByTestId(`team-${TEAM.id}`));
  // What the list said of the challenge shows at once; the API is asked.
  expect(screen.getByTestId("team-view")).toBeOnTheScreen();
  expect(screen.getByTestId("team-code")).toHaveTextContent("Code K7PQ2M");
  expect(screen.getByTestId("challenge-view")).toBeOnTheScreen();
  expect(screen.getByTestId(`member-${ME}`)).toHaveTextContent(/Runner_42.*Owner/);
  expect(screen.getByTestId(`member-${ADAM}`)).toHaveTextContent(/adam\.trento/);
  await waitFor(() =>
    expect(calls(fetchFn)).toContain(`GET /game/challenges/${GOING.id}`),
  );
  await fireEvent.press(screen.getByTestId("team-share"));
  expect(share).toHaveBeenCalledWith({
    message:
      "Join my team «Trento runners» on MuW: open Play, Challenges, and enter the code K7PQ2M.",
  });
  // Back: the list, read again.
  await fireEvent.press(screen.getByTestId("team-back"));
  expect(screen.getByTestId("challenges-tab")).toBeOnTheScreen();
  await waitFor(() =>
    expect(calls(fetchFn).filter((call) => call === "GET /game/teams")).toHaveLength(2),
  );
});

test("a team is created with its name, and opens", async () => {
  const fetchFn = fakeApi({
    "GET /game/teams": () => ({ status: 200, body: { teams: [] } }),
    "POST /game/teams": (body) => ({
      status: 201,
      body: { ...TEAM, name: (body as { name: string }).name },
    }),
  });
  await shown(fetchFn);
  await waitFor(() => expect(screen.getByTestId("challenges-empty")).toBeOnTheScreen());
  // Nothing to create without a name.
  await fireEvent.press(screen.getByTestId("team-create"));
  expect(calls(fetchFn)).not.toContain("POST /game/teams");
  await fireEvent.changeText(screen.getByTestId("team-name"), " Night owls ");
  await fireEvent.press(screen.getByTestId("team-create"));
  await waitFor(() => expect(screen.getByTestId("team-view")).toBeOnTheScreen());
  expect(JSON.parse(fetchFn.mock.calls[1][1].body)).toEqual({ name: "Night owls" });
  expect(screen.getByRole("header", { name: "Night owls" })).toBeOnTheScreen();
  expect(screen.getByTestId("team-no-challenge")).toBeOnTheScreen();
});

test("joining: a code nobody has says so, a refusal says the generic words, a code joins", async () => {
  const outcomes: Answer[] = [
    { status: 404, body: apiError("http_error", "No team with this code.") },
    { status: 403, body: apiError("http_error", "You can't join this team.") },
    { status: 200, body: TEAM },
  ];
  const fetchFn = fakeApi({
    "GET /game/teams": () => ({ status: 200, body: { teams: [] } }),
    "POST /game/teams/join": () => outcomes.shift() ?? { status: 500 },
  });
  await shown(fetchFn);
  await waitFor(() => expect(screen.getByTestId("challenges-empty")).toBeOnTheScreen());
  await fireEvent.changeText(screen.getByTestId("team-code-field"), "ABCDEF");
  await fireEvent.press(screen.getByTestId("team-join"));
  await waitFor(() =>
    expect(screen.getByTestId("join-problem")).toHaveTextContent(
      "No team with this code.",
    ),
  );
  await fireEvent.press(screen.getByTestId("team-join"));
  await waitFor(() =>
    expect(screen.getByTestId("join-problem")).toHaveTextContent(
      "You can't join this team.",
    ),
  );
  await fireEvent.press(screen.getByTestId("team-join"));
  await waitFor(() => expect(screen.getByTestId("team-view")).toBeOnTheScreen());
  expect(screen.getByTestId("team-code")).toHaveTextContent("Code K7PQ2M");
});

test("«Leave team» asks once more, then the team is gone from the list", async () => {
  let teams = [TEAM];
  const fetchFn = fakeApi({
    "GET /game/teams": () => ({ status: 200, body: { teams } }),
    [`DELETE /game/teams/${TEAM.id}/members/${ME}`]: () => {
      teams = [];
      return { status: 204 };
    },
  });
  await shown(fetchFn);
  await waitFor(() => expect(screen.getByTestId(`team-${TEAM.id}`)).toBeOnTheScreen());
  await fireEvent.press(screen.getByTestId(`team-${TEAM.id}`));
  await fireEvent.press(screen.getByTestId("team-leave"));
  expect(screen.getByText("Leave this team?")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("team-leave-cancel"));
  expect(screen.queryByText("Leave this team?")).toBeNull();
  await fireEvent.press(screen.getByTestId("team-leave"));
  await fireEvent.press(screen.getByTestId("team-leave-confirm"));
  await waitFor(() => expect(screen.getByTestId("challenges-empty")).toBeOnTheScreen());
  expect(calls(fetchFn)).toContain(`DELETE /game/teams/${TEAM.id}/members/${ME}`);
});

test("the owner removes a member", async () => {
  let teams = [TEAM];
  const fetchFn = fakeApi({
    "GET /game/teams": () => ({ status: 200, body: { teams } }),
    [`DELETE /game/teams/${TEAM.id}/members/${ADAM}`]: () => {
      teams = [{ ...TEAM, members: [TEAM.members[0]] }];
      return { status: 204 };
    },
  });
  await shown(fetchFn);
  await waitFor(() => expect(screen.getByTestId(`team-${TEAM.id}`)).toBeOnTheScreen());
  await fireEvent.press(screen.getByTestId(`team-${TEAM.id}`));
  expect(screen.queryByTestId(`remove-${ME}`)).toBeNull();
  await fireEvent.press(screen.getByTestId(`remove-${ADAM}`));
  await waitFor(() => expect(screen.queryByTestId(`member-${ADAM}`)).toBeNull());
  expect(calls(fetchFn)).toContain(`DELETE /game/teams/${TEAM.id}/members/${ADAM}`);
});

test("a new challenge is started from the team, and shown", async () => {
  const fetchFn = fakeApi({
    "GET /game/teams": () => ({ status: 200, body: { teams: [TEAM] } }),
    [`POST /game/teams/${TEAM.id}/challenges`]: () => ({ status: 201, body: GOING }),
    [`GET /game/challenges/${GOING.id}`]: () => ({ status: 200, body: GOING }),
  });
  await shown(fetchFn);
  await waitFor(() => expect(screen.getByTestId(`team-${TEAM.id}`)).toBeOnTheScreen());
  await fireEvent.press(screen.getByTestId(`team-${TEAM.id}`));
  await fireEvent.press(screen.getByTestId("team-new-challenge"));
  expect(screen.getByTestId("new-challenge")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("new-shape-hexagon"));
  await fireEvent.press(screen.getByTestId("new-pieces-more"));
  await fireEvent.press(screen.getByTestId("new-start"));
  await waitFor(() => expect(screen.getByTestId("challenge-view")).toBeOnTheScreen());
  const sent = fetchFn.mock.calls.find(([url]) => String(url).endsWith("/challenges"));
  expect(JSON.parse(sent[1].body)).toEqual({
    shape_id: "hexagon",
    pieces: 3,
    piece: { kind: "distance", total_m: 5000 },
    days: 7,
  });
  expect(screen.queryByTestId("team-new-challenge")).toBeNull();
  expect(screen.getByTestId("challenge-time-left")).toHaveTextContent(
    "6 days 3 h left",
  );
});

test("a piece is taken from the challenge", async () => {
  const free: GameChallenge = {
    ...GOING,
    pieces: GOING.pieces.map((piece) =>
      piece.idx === 1 ? { ...piece, holder: null } : piece,
    ),
  };
  const mine: GameChallenge = {
    ...GOING,
    pieces: GOING.pieces.map((piece) =>
      piece.idx === 2
        ? { ...piece, holder: { public_id: ME, username: "Runner_42" } }
        : piece,
    ),
  };
  let current = free;
  const fetchFn = fakeApi({
    "GET /game/teams": () => ({
      status: 200,
      body: { teams: [{ ...TEAM, challenge: free }] },
    }),
    [`GET /game/challenges/${GOING.id}`]: () => ({ status: 200, body: current }),
    [`POST /game/challenges/${GOING.id}/pieces/2/hold`]: () => {
      current = mine;
      return { status: 200, body: mine };
    },
  });
  await shown(fetchFn);
  await waitFor(() => expect(screen.getByTestId(`team-${TEAM.id}`)).toBeOnTheScreen());
  await fireEvent.press(screen.getByTestId(`team-${TEAM.id}`));
  await fireEvent.press(screen.getByTestId("take-2"));
  await waitFor(() => expect(screen.getByTestId("leave-2")).toBeOnTheScreen());
  expect(screen.getByTestId("piece-2")).toHaveTextContent(/Yours/);
});

test("a challenge's notification opens its challenge, whose team the challenge names", async () => {
  const fetchFn = fakeApi({
    "GET /game/teams": () => ({ status: 200, body: { teams: [WITH_CHALLENGE] } }),
    [`GET /game/challenges/${GOING.id}`]: () => ({ status: 200, body: GOING }),
  });
  await act(async () => openChallenge(GOING.id));
  await shown(fetchFn);
  await waitFor(() => expect(screen.getByTestId("challenge-view")).toBeOnTheScreen());
  expect(requestedChallenge()).toBeNull();
  await waitFor(() =>
    expect(screen.getByRole("header", { name: "Trento runners" })).toBeOnTheScreen(),
  );
  expect(screen.getByTestId("team-code")).toHaveTextContent("Code K7PQ2M");
});
