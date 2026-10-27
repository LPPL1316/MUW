/**
 * The contest at the top of «Feed» (TASK-299 part B, docs/CONCORSI.md §7):
 * its card under the lens only while the API has a contest, the winner's
 * post once it is proclaimed, nothing with a 404 or on a phone that never
 * heard from the API. The card itself is in src/contest/ContestCard.test.tsx;
 * the drawings of the page in FeedScreenPosts.test.tsx.
 */
import closed from "@shaperoute/shared-types/fixtures/contest-closed.json";
import open from "@shaperoute/shared-types/fixtures/contest.json";
import page from "@shaperoute/shared-types/fixtures/feed.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { Contest, Drawing, Session } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import type { AccountState } from "../account/useAccount";
import { apiError } from "../account/testing";
import { forgetContest, keepContest, keptContest } from "../contest/contestKept";
import { SAMPLE_FEED } from "../feed/sampleFeed";
import { forgetFeed } from "../feed/useFeed";
import { DrawingsContext, useDrawingsDoor } from "../social/drawingsDoor";
import { FollowsContext } from "../social/followsDoor";
import { FeedScreen } from "./FeedScreen";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
// The phone's documents folder, in memory: the contest kept.
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
/** A contest that ends far from today's clock: its days are not what is tested here. */
const OPEN: Contest = { ...(open as Contest), ends_at: "2999-12-31T23:59:59Z" };
const CLOSED = closed as Contest;

let fetchSpy: jest.SpiedFunction<typeof fetch>;
/** What the API answers to GET /contests/current. */
let contestAnswer: () => Response | Promise<Response>;

function asked(path: string): RequestInit[] {
  return fetchSpy.mock.calls
    .filter(([url]) => String(url) === `${API}${path}`)
    .map(([, init]) => init ?? {});
}

function Around({
  children,
  state = SIGNED_IN,
  open: opens = () => {},
}: {
  children: ReactNode;
  state?: AccountState;
  open?: (drawing: Pick<Drawing, "id">) => void;
}) {
  const doors = useDrawingsDoor();
  return (
    <FollowsContext.Provider
      value={{
        apiUrl: API,
        account: { state, sessionEnded: () => {} },
        openProfile: () => {},
      }}
    >
      <DrawingsContext.Provider value={{ ...doors, open: opens, openProblem: null }}>
        {children}
      </DrawingsContext.Provider>
    </FollowsContext.Provider>
  );
}

beforeEach(() => {
  forgetFeed();
  forgetContest();
  contestAnswer = () => Response.json(OPEN);
  fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith(`${API}/feed`)) {
      return Response.json(page);
    }
    if (url === `${API}/contests/current`) {
      return contestAnswer();
    }
    return Response.json(
      { error: { code: "http_error", message: url } },
      { status: 404 },
    );
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
});

test("with a contest, its card is under the lens, with the account's best post", async () => {
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  expect(await screen.findByTestId("contest-card")).toBeOnTheScreen();
  expect(screen.getByText("Your best post: #5, 4 reactions")).toBeOnTheScreen();
  // The drawings of the page are still there, under the card.
  expect(screen.getByText("Sunday heart by the river")).toBeOnTheScreen();
  // Asked once, with the token: `mine` is the account's.
  expect(asked("/contests/current")).toHaveLength(1);
  expect(asked("/contests/current")[0]).toMatchObject({
    headers: { Authorization: `Bearer ${SESSION.token}` },
  });
});

test("a tap on one of the first three opens its drawing, as a post", async () => {
  const opens = jest.fn();
  await render(
    <Around open={opens}>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  await fireEvent.press(
    await screen.findByRole("button", { name: "2. bea.k, 11 reactions" }),
  );
  expect(opens).toHaveBeenCalledWith(OPEN.top[1].drawing);
});

test("without an account the card is there, without a line of its own", async () => {
  const { mine: _mine, ...withoutMine } = OPEN;
  contestAnswer = () => Response.json(withoutMine);
  await render(
    <Around state={SIGNED_OUT}>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  expect(await screen.findByTestId("contest-card")).toBeOnTheScreen();
  expect(screen.queryByText(/Your best post/)).toBeNull();
  expect(screen.queryByText("Publish a run to take part.")).toBeNull();
  // Asked without a token; the examples are the page's.
  expect(asked("/contests/current")[0].headers).not.toHaveProperty("Authorization");
  expect(screen.getByText(SAMPLE_FEED[0].title)).toBeOnTheScreen();
  // The first three open nothing: no button.
  expect(screen.queryByRole("button", { name: /Ada_runs/ })).toBeNull();
});

test("with a 404 there is no card, and the one kept is forgotten", async () => {
  keepContest({ account: null, contest: OPEN });
  contestAnswer = () =>
    Response.json(apiError("no_contest", "There is no contest right now."), {
      status: 404,
    });
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  await waitFor(() => expect(keptContest()).toBeNull());
  expect(screen.queryByTestId("contest-card")).toBeNull();
  expect(screen.queryByTestId("winner-card")).toBeNull();
  expect(screen.getByText("Sunday heart by the river")).toBeOnTheScreen();
});

test("an API from before the contest is a page without a card", async () => {
  contestAnswer = () =>
    Response.json(apiError("http_error", "Not Found"), { status: 404 });
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  expect(await screen.findByText("Sunday heart by the river")).toBeOnTheScreen();
  await waitFor(() => expect(asked("/contests/current")).toHaveLength(1));
  expect(screen.queryByTestId("contest-card")).toBeNull();
});

test("without a network, a phone that never heard from the API shows no card", async () => {
  contestAnswer = () => Promise.reject(new Error("offline"));
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  expect(await screen.findByText("Sunday heart by the river")).toBeOnTheScreen();
  await waitFor(() => expect(asked("/contests/current")).toHaveLength(1));
  expect(screen.queryByTestId("contest-card")).toBeNull();
});

test("without a network, the contest kept on the phone stays", async () => {
  keepContest({ account: SESSION.user.public_id ?? null, contest: OPEN });
  contestAnswer = () => Promise.reject(new Error("offline"));
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  expect(screen.getByTestId("contest-card")).toBeOnTheScreen();
  await waitFor(() => expect(asked("/contests/current")).toHaveLength(1));
  expect(screen.getByTestId("contest-card")).toBeOnTheScreen();
  expect(screen.getByText("Your best post: #5, 4 reactions")).toBeOnTheScreen();
});

test("a best post kept for another account is not this one's", async () => {
  keepContest({ account: "another-account", contest: OPEN });
  contestAnswer = () => Promise.reject(new Error("offline"));
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  expect(screen.getByTestId("contest-card")).toBeOnTheScreen();
  expect(screen.queryByText(/Your best post/)).toBeNull();
});

test("once the winner is proclaimed, the winning post is at the top, with the badge", async () => {
  const opens = jest.fn();
  contestAnswer = () => Response.json(CLOSED);
  await render(
    <Around open={opens}>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  expect(await screen.findByTestId("winner-card")).toBeOnTheScreen();
  expect(
    screen.getByRole("header", { name: "Ada_runs won the MuW contest" }),
  ).toBeOnTheScreen();
  expect(screen.getByLabelText("Winner")).toBeOnTheScreen();
  expect(screen.queryByTestId("contest-card")).toBeNull();
  // The post as those of the page: a tap opens it whole.
  const [winner] = screen.getAllByTestId("feed-post");
  await fireEvent.press(winner);
  expect(opens).toHaveBeenCalledWith(CLOSED.winner?.drawing);
});

test("a contest closed without a winner, or whose winning run was deleted, shows nothing", async () => {
  contestAnswer = () =>
    Response.json({ ...CLOSED, winner: { reactions: 0, drawing: null } });
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  await waitFor(() => expect(keptContest()).not.toBeNull());
  expect(screen.queryByTestId("winner-card")).toBeNull();
  expect(screen.queryByTestId("contest-card")).toBeNull();
});

test("behind «Draw», «Feed» asks for no contest", async () => {
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} active={false} />
    </Around>,
  );
  await act(async () => {});
  expect(asked("/contests/current")).toHaveLength(0);
});

test("a pull asks for the contest again, with the drawings", async () => {
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  expect(await screen.findByTestId("contest-card")).toBeOnTheScreen();
  contestAnswer = () => Response.json(CLOSED);
  // The pull, as the list's RefreshControl hears it.
  await act(async () =>
    screen.getByTestId("feed-list").props.refreshControl.props.onRefresh(),
  );
  expect(await screen.findByTestId("winner-card")).toBeOnTheScreen();
  expect(asked("/contests/current")).toHaveLength(2);
});
