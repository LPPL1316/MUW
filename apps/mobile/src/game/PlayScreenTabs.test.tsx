import catalog from "@shaperoute/shared-types/fixtures/game-catalog.json";
import challenge from "@shaperoute/shared-types/fixtures/game-challenge.json";
import me from "@shaperoute/shared-types/fixtures/game-me.json";
import team from "@shaperoute/shared-types/fixtures/game-team.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type {
  GameCatalog,
  GameChallenge,
  GameTeam,
  Session,
} from "@shaperoute/shared-types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { apiError } from "../account/testing";
import type { AccountState } from "../account/useAccount";
import { FollowsContext } from "../social/followsDoor";
import {
  clearRequestedChallenge,
  openChallenge,
  requestedChallenge,
} from "./challengeDoor";
import { forgetGameCatalog, setGameCatalog } from "./gameCatalog";
import { PlayScreen } from "./PlayScreen";
import { forgetChallenges } from "./useChallenge";
import { forgetGameMe } from "./useGameMe";
import { forgetTeams } from "./useTeams";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
// The phone's documents folder, in memory: the catalog, the language, the units.
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
const TEAM: GameTeam = { ...(team as GameTeam), challenge: GOING };

/** A fake API that answers by path, whatever the order. */
function fakeApi(teamsStatus = 200): jest.Mock {
  return jest.fn(async (url: string) => {
    const path = url.replace(API, "");
    if (path === "/game/me") {
      return Response.json(me);
    }
    if (path === "/game/teams") {
      return teamsStatus === 200
        ? Response.json({ teams: [TEAM] })
        : Response.json(apiError("http_error", "Not Found"), { status: teamsStatus });
    }
    if (path === `/game/challenges/${GOING.id}`) {
      return Response.json(GOING);
    }
    throw new Error(`No answer for ${path}`);
  });
}

async function shown(fetchFn: jest.Mock, state: AccountState = SIGNED_IN) {
  return render(
    <FollowsContext.Provider
      value={{
        apiUrl: API,
        account: { state, sessionEnded: jest.fn() },
        openProfile: () => {},
      }}
    >
      <PlayScreen active onSignIn={jest.fn()} fetchFn={fetchFn} apiKey={null} />
    </FollowsContext.Provider>,
  );
}

beforeEach(() => {
  forgetGameMe();
  forgetTeams();
  forgetChallenges();
  clearRequestedChallenge();
  setGameCatalog(CATALOG);
});

afterEach(forgetGameCatalog);

test("the page opens on the collection, and «Challenges» shows the teams", async () => {
  const fetchFn = fakeApi();
  await shown(fetchFn);
  await waitFor(() => expect(screen.getByTestId("play-totals")).toBeOnTheScreen());
  expect(
    screen.getByRole("button", { name: "Collection", selected: true }),
  ).toBeOnTheScreen();
  expect(screen.queryByTestId("challenges-tab")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Challenges" }));
  await waitFor(() => expect(screen.getByTestId(`team-${TEAM.id}`)).toBeOnTheScreen());
  expect(screen.queryByTestId("play-totals")).toBeNull();
  expect(screen.queryByTestId("shape-card-triangle")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Collection" }));
  expect(screen.getByTestId("play-totals")).toBeOnTheScreen();
  expect(screen.getByTestId("shape-card-triangle")).toBeOnTheScreen();
});

test("a server without the teams keeps the tab quiet", async () => {
  await shown(fakeApi(404));
  await fireEvent.press(screen.getByRole("button", { name: "Challenges" }));
  await waitFor(() => expect(screen.getByTestId("challenges-none")).toBeOnTheScreen());
});

test("a challenge's notification opens the page on its challenge, built or not yet", async () => {
  const fetchFn = fakeApi();
  await shown(fetchFn);
  await waitFor(() => expect(screen.getByTestId("play-totals")).toBeOnTheScreen());
  await act(async () => openChallenge(GOING.id));
  await waitFor(() => expect(screen.getByTestId("challenge-view")).toBeOnTheScreen());
  expect(
    screen.getByRole("button", { name: "Challenges", selected: true }),
  ).toBeOnTheScreen();
  expect(requestedChallenge()).toBeNull();
  // Back to the list, and the same notification again: the challenge again.
  await fireEvent.press(screen.getByTestId("team-back"));
  await waitFor(() => expect(screen.getByTestId("challenges-tab")).toBeOnTheScreen());
  await act(async () => openChallenge(GOING.id));
  await waitFor(() => expect(screen.getByTestId("challenge-view")).toBeOnTheScreen());
  // A page built after the request finds it too.
  await screen.unmount();
  await act(async () => openChallenge(GOING.id));
  await shown(fetchFn);
  await waitFor(() => expect(screen.getByTestId("challenge-view")).toBeOnTheScreen());
  expect(requestedChallenge()).toBeNull();
});

test("signed out, the tab asks to sign in", async () => {
  await shown(fakeApi(), SIGNED_OUT);
  await fireEvent.press(screen.getByRole("button", { name: "Challenges" }));
  expect(screen.getByTestId("challenges-sign-in")).toBeOnTheScreen();
});
