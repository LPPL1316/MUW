/**
 * The monthly challenges in the app (TASK-343 part B, docs/CONCORSI.md §15):
 * a challenge is recognised by its `theme`, and a contest without one, or an
 * API from before part A (c7a83347), behaves as it did.
 */
import open from "@shaperoute/shared-types/fixtures/contest.json";
import entries from "@shaperoute/shared-types/fixtures/contest-entries.json";
import themedFixture from "@shaperoute/shared-types/fixtures/contest-themed.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type {
  Contest,
  DrawingDetail,
  Session,
  ThemedContest,
} from "@shaperoute/shared-types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import type { AccountState } from "../account/useAccount";
import { apiError } from "../account/testing";
import type { AccountOutcome } from "../api/accounts";
import { DrawingsContext, useDrawingsDoor } from "../social/drawingsDoor";
import { FollowsContext } from "../social/followsDoor";
import { forgetBlocked } from "../social/blockedNow";
import { ContestCard } from "./ContestCard";
import {
  entryProblem,
  fetchContestEntries,
  fetchPastContests,
  isContest,
  setContestEntry,
  themedOf,
  themeText,
} from "./contestApi";
import { askedContest, closeContestPage, openContestPage } from "./contestDoor";
import {
  enteredIn,
  forgetContest,
  keptContest,
  markEntered,
  setContest,
} from "./contestKept";
import { ContestPage, ContestPageHost } from "./ContestPage";
import { ContestRules, RULES, THEMED_RULES } from "./ContestRules";
import { enterable, EnterSwitch } from "./EnterSwitch";
import { FeedContest } from "./FeedContest";
import { sendEntry } from "./sendEntry";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
// The page's map shooter is a web page: not in a test.
jest.mock("../feed/FeedMaps", () => ({
  FeedMapShooter: () => null,
  useFeedMap: () => null,
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

const API = "http://api";
const SESSION = session as Session;
const ACCOUNT = SESSION.user.public_id ?? "";
const SIGNED_IN: AccountState = { status: "signedIn", session: SESSION };
const SIGNED_OUT: AccountState = { status: "signedOut", notice: null };

const PLAIN = open as Contest;
/** A challenge far from today's clock: its days are not what is tested here. */
const THEMED: ThemedContest = {
  ...(themedFixture as unknown as ThemedContest),
  starts_at: "2020-01-01T00:00:00Z",
  ends_at: "2999-12-31T23:59:59Z",
};
const GALLERY = entries.gallery;
const ARCHIVE = entries.archive;
const NOT_FOUND = () =>
  Response.json(apiError("http_error", "Not Found"), { status: 404 });

let answers: Record<string, () => Response | Promise<Response>>;
let fetchSpy: jest.SpiedFunction<typeof fetch>;

function asked(part: string): RequestInit[] {
  return fetchSpy.mock.calls
    .filter(([url]) => String(url).includes(part))
    .map(([, init]) => init ?? {});
}

function Around({
  children,
  state = SIGNED_IN,
  opens = () => {},
}: {
  children: ReactNode;
  state?: AccountState;
  opens?: (drawing: { id: string }) => void;
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
  forgetContest();
  closeContestPage();
  answers = {
    "/contests/current": () => Response.json(THEMED),
    "/entries": () => Response.json(GALLERY),
    "/contests?state=closed": () => Response.json(ARCHIVE),
  };
  fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    const found = Object.keys(answers).find((part) => url.includes(part));
    return found === undefined ? NOT_FOUND() : answers[found]();
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
  forgetBlocked();
});

describe("what the API says", () => {
  test("a contest without a theme is no challenge, and still a contest", () => {
    expect(isContest(PLAIN)).toBe(true);
    expect(themedOf(PLAIN)).toBeNull();
    expect(isContest(THEMED)).toBe(true);
    expect(themedOf(THEMED)?.theme.en.title).toBe(THEMED.theme.en.title);
  });

  test("a theme that does not read leaves a contest as it was", () => {
    const odd = { ...PLAIN, theme: { en: { title: 3 } } } as unknown as Contest;
    expect(isContest(odd)).toBe(true);
    expect(themedOf(odd)).toBeNull();
  });

  test("the challenge's other fields may be missing", () => {
    const { entrants: _e, entered: _d, ...bare } = THEMED;
    expect(themedOf(bare as Contest)).toMatchObject({ entrants: 0, entered: [] });
  });

  test("the theme in the app's language, English when it is missing", () => {
    expect(themeText({ en: { title: "Animals", description: "d" } }, "it").title).toBe(
      "Animals",
    );
    expect(
      themeText(
        {
          en: { title: "Animals", description: "d" },
          it: { title: "Animali", description: "d" },
        },
        "it",
      ).title,
    ).toBe("Animali");
  });

  test("the gallery and the archive read the fixtures, and say their 404", async () => {
    const page = await fetchContestEntries(API, null, THEMED.id, "new", "c/1");
    expect(page.kind).toBe("ok");
    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      `${API}/contests/${THEMED.id}/entries?order=new&cursor=c%2F1`,
    );
    expect((await fetchPastContests(API, null, null)).kind).toBe("ok");
    answers["/entries"] = NOT_FOUND;
    answers["/contests?state=closed"] = NOT_FOUND;
    expect(await fetchContestEntries(API, null, THEMED.id, "top", null)).toMatchObject({
      kind: "api_error",
      code: "http_error",
    });
    expect(await fetchPastContests(API, null, null)).toMatchObject({
      kind: "api_error",
      code: "http_error",
    });
  });

  test("an entry is a PUT, a withdrawal a DELETE, with the token", async () => {
    answers["/entries"] = () => new Response(null, { status: 204 });
    expect(await setContestEntry(API, "tok", "c", "d", true)).toMatchObject({
      kind: "ok",
    });
    expect(await setContestEntry(API, "tok", "c", "d", false)).toMatchObject({
      kind: "ok",
    });
    const [put, del] = asked("/contests/c/entries/d");
    expect(put.method).toBe("PUT");
    expect(del.method).toBe("DELETE");
    expect(put.headers).toMatchObject({ Authorization: "Bearer tok" });
  });

  test("a refused entry has words of its own", () => {
    const refused = (code: string) =>
      ({
        kind: "api_error",
        code,
        message: "server words",
        suggested_distance_m: null,
        retryAfterS: null,
      }) as AccountOutcome<unknown>;
    expect(entryProblem(refused("not_entrant"))).toMatch(/cannot take part/);
    expect(entryProblem(refused("contest_closed"))).toBe(
      "This challenge takes no entries now.",
    );
    expect(entryProblem(refused("http_error"))).toBe(
      "This challenge takes no entries now.",
    );
    expect(entryProblem({ kind: "ok", value: null })).toBeNull();
  });
});

describe("the card of «Feed»", () => {
  test("without a theme: as before, «How it works» and no way to a page", async () => {
    await render(<ContestCard contest={PLAIN} mine={null} />);
    expect(screen.getByRole("header", { name: "MuW contest" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "How it works" })).toBeOnTheScreen();
    expect(screen.getByText("Publish a run to take part.")).toBeOnTheScreen();
    expect(screen.queryByText("Monthly challenge")).toBeNull();
    expect(screen.queryByText("See the challenge")).toBeNull();
    expect(screen.queryByTestId("contest-card-head")).toBeNull();
  });

  test("with a theme: its title, and a tap opens the page", async () => {
    await render(<ContestCard contest={THEMED} mine={null} />);
    expect(
      screen.getByRole("header", { name: THEMED.theme.en.title }),
    ).toBeOnTheScreen();
    expect(screen.getByText("Monthly challenge")).toBeOnTheScreen();
    expect(
      screen.getByText("Publish a run and enter it to take part."),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("contest-card-head"));
    expect(askedContest()?.id).toBe(THEMED.id);
    closeContestPage();
    await fireEvent.press(screen.getByRole("button", { name: "See the challenge" }));
    expect(askedContest()?.id).toBe(THEMED.id);
  });

  test("a closed challenge keeps the way to its page; a closed contest has none", async () => {
    const closedThemed = { ...THEMED, closed_at: "2999-12-31T23:59:59Z", winner: null };
    const { unmount } = await render(
      <FeedContest contest={closedThemed} mine={null} width={300} />,
    );
    expect(screen.getByRole("button", { name: "See the challenge" })).toBeOnTheScreen();
    await unmount();
    await render(
      <FeedContest
        contest={{ ...PLAIN, closed_at: "2999-12-31T23:59:59Z", winner: null }}
        mine={null}
        width={300}
      />,
    );
    expect(screen.queryByText("See the challenge")).toBeNull();
  });
});

describe("the rules", () => {
  test("without a theme, the text approved in TASK-299, whole", async () => {
    await render(<ContestRules contest={PLAIN} visible onClose={() => {}} />);
    for (const rule of RULES) {
      expect(screen.getByText(rule)).toBeOnTheScreen();
    }
    expect(screen.getByText("MuW contest")).toBeOnTheScreen();
    expect(screen.queryByText(/The theme is/)).toBeNull();
  });

  test("with a theme: the theme, the entry, no limit, and Apple and Google", async () => {
    await render(<ContestRules contest={THEMED} visible onClose={() => {}} />);
    expect(
      screen.getByText(`The theme is “${THEMED.theme.en.title}”.`),
    ).toBeOnTheScreen();
    for (const rule of THEMED_RULES) {
      expect(screen.getByText(rule)).toBeOnTheScreen();
    }
    expect(screen.getByText(/as many drawings as you like/)).toBeOnTheScreen();
    expect(screen.getByText(/Apple and Google are not sponsors/)).toBeOnTheScreen();
  });
});

describe("the page", () => {
  test("theme, days, entrants, prize, rules, the gallery and the way to the past", async () => {
    setContest({ account: ACCOUNT, contest: THEMED });
    await render(
      <Around>
        <ContestPage contestId={THEMED.id} onBack={() => {}} />
      </Around>,
    );
    expect(await screen.findByText("#1")).toBeOnTheScreen();
    expect(
      screen.getByRole("header", { name: THEMED.theme.en.title }),
    ).toBeOnTheScreen();
    expect(screen.getByText(THEMED.theme.en.description)).toBeOnTheScreen();
    expect(screen.getByText(`${THEMED.entrants} people taking part`)).toBeOnTheScreen();
    expect(screen.getByText(/^Prize:/)).toBeOnTheScreen();
    expect(screen.getByText("You entered 1 drawing")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "How it works" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Past challenges" })).toBeOnTheScreen();
    // The archive is asked for only when it is opened.
    expect(asked("/contests?state=closed")).toHaveLength(0);
  });

  test("«Top» | «New» asks the gallery again in the other order", async () => {
    setContest({ account: ACCOUNT, contest: THEMED });
    await render(
      <Around>
        <ContestPage contestId={THEMED.id} onBack={() => {}} />
      </Around>,
    );
    await screen.findAllByTestId("gallery-entry");
    await fireEvent.press(screen.getByRole("button", { name: "New" }));
    await waitFor(() =>
      expect(
        fetchSpy.mock.calls.some(([url]) => String(url).includes("order=new")),
      ).toBe(true),
    );
    expect(await screen.findByText("#1")).toBeOnTheScreen();
  });

  test("a post opens with an account; without one it is no button", async () => {
    const opens = jest.fn();
    setContest({ account: ACCOUNT, contest: THEMED });
    const { unmount } = await render(
      <Around opens={opens}>
        <ContestPage contestId={THEMED.id} onBack={() => {}} />
      </Around>,
    );
    const [post] = await screen.findAllByTestId("feed-post");
    await fireEvent.press(post);
    expect(opens).toHaveBeenCalledWith(GALLERY.entries[0].drawing);
    await unmount();
    opens.mockClear();
    await render(
      <Around opens={opens} state={SIGNED_OUT}>
        <ContestPage contestId={THEMED.id} onBack={() => {}} />
      </Around>,
    );
    const [other] = await screen.findAllByTestId("feed-post");
    await fireEvent.press(other);
    expect(opens).not.toHaveBeenCalled();
  });

  test("with the gallery answering 404, the page says nobody has entered", async () => {
    answers["/entries"] = NOT_FOUND;
    setContest({ account: ACCOUNT, contest: THEMED });
    await render(
      <Around>
        <ContestPage contestId={THEMED.id} onBack={() => {}} />
      </Around>,
    );
    expect(await screen.findByText("No drawings entered yet.")).toBeOnTheScreen();
    expect(screen.queryByText("Something went wrong.")).toBeNull();
  });

  test("a gallery that fails can be asked again", async () => {
    answers["/entries"] = () => Promise.reject(new Error("offline"));
    setContest({ account: ACCOUNT, contest: THEMED });
    await render(
      <Around>
        <ContestPage contestId={THEMED.id} onBack={() => {}} />
      </Around>,
    );
    const again = await screen.findByRole("button", { name: "Try again" });
    answers["/entries"] = () => Response.json(GALLERY);
    await fireEvent.press(again);
    expect(await screen.findByText("#1")).toBeOnTheScreen();
  });

  test("a challenge the API no longer keeps is looked for in the archive", async () => {
    const past = ARCHIVE.contests.find((contest) => contest.theme !== null);
    answers["/contests/current"] = () =>
      Response.json(apiError("no_contest", "There is no contest right now."), {
        status: 404,
      });
    await render(
      <Around>
        <ContestPage contestId={past?.id ?? ""} onBack={() => {}} />
      </Around>,
    );
    expect(
      await screen.findByRole("header", { name: past?.theme?.en.title }),
    ).toBeOnTheScreen();
    expect(screen.getByText("Ended")).toBeOnTheScreen();
  });

  test("with every endpoint answering 404, it says so and goes back", async () => {
    answers = {};
    const back = jest.fn();
    await render(
      <Around>
        <ContestPage contestId="11111111-1111-1111-1111-111111111111" onBack={back} />
      </Around>,
    );
    expect(
      await screen.findByText("This challenge is not available any more."),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(back).toHaveBeenCalled();
  });

  test("«Past challenges»: the archive, with a contest without a theme too", async () => {
    setContest({ account: ACCOUNT, contest: THEMED });
    await render(
      <Around>
        <ContestPage contestId={THEMED.id} onBack={() => {}} />
      </Around>,
    );
    await fireEvent.press(
      await screen.findByRole("button", { name: "Past challenges" }),
    );
    expect(await screen.findAllByTestId("past-contest")).toHaveLength(
      ARCHIVE.contests.length,
    );
    expect(screen.getByRole("header", { name: "Past challenges" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: "Past challenges" })).toBeOnTheScreen();
  });

  test("an archive answering 404 is an empty one", async () => {
    answers["/contests?state=closed"] = NOT_FOUND;
    setContest({ account: ACCOUNT, contest: THEMED });
    await render(
      <Around>
        <ContestPage contestId={THEMED.id} onBack={() => {}} />
      </Around>,
    );
    await fireEvent.press(
      await screen.findByRole("button", { name: "Past challenges" }),
    );
    expect(await screen.findByText("No past challenges yet.")).toBeOnTheScreen();
  });

  test("the host shows the page asked for, and hides it behind a drawing", async () => {
    setContest({ account: ACCOUNT, contest: THEMED });
    const opened = { id: "x" } as DrawingDetail;
    const Host = ({ drawing }: { drawing: DrawingDetail | null }) => {
      const doors = useDrawingsDoor();
      return (
        <FollowsContext.Provider
          value={{
            apiUrl: API,
            account: { state: SIGNED_IN, sessionEnded: () => {} },
            openProfile: () => {},
          }}
        >
          <DrawingsContext.Provider value={{ ...doors, opened: drawing }}>
            <ContestPageHost />
          </DrawingsContext.Provider>
        </FollowsContext.Provider>
      );
    };
    const { rerender } = await render(<Host drawing={null} />);
    expect(screen.queryByTestId("contest-page")).toBeNull();
    await act(async () => openContestPage(THEMED.id));
    expect(await screen.findByTestId("contest-page")).toBeOnTheScreen();
    await rerender(<Host drawing={opened} />);
    expect(screen.queryByTestId("contest-page")).toBeNull();
    await rerender(<Host drawing={null} />);
    expect(screen.getByTestId("contest-page")).toBeOnTheScreen();
    await act(async () => closeContestPage());
    expect(screen.queryByTestId("contest-page")).toBeNull();
  });
});

describe("entering", () => {
  const NOW = Date.parse("2500-01-01T00:00:00Z");

  test("only a challenge that takes entries now can be entered", () => {
    const kept = (contest: Contest) => ({ account: null, contest });
    expect(enterable(null, NOW)).toBeNull();
    expect(enterable(kept(PLAIN), NOW)).toBeNull();
    expect(enterable(kept(THEMED), NOW)?.id).toBe(THEMED.id);
    expect(
      enterable(kept({ ...THEMED, closed_at: "2400-01-01T00:00:00Z" }), NOW),
    ).toBeNull();
    expect(
      enterable(kept({ ...THEMED, starts_at: "2600-01-01T00:00:00Z" }), NOW),
    ).toBeNull();
    expect(
      enterable(kept({ ...THEMED, ends_at: "2400-01-01T00:00:00Z" }), NOW),
    ).toBeNull();
  });

  test("the switch is not there without a challenge", async () => {
    setContest({ account: ACCOUNT, contest: PLAIN });
    await render(<EnterSwitch entry={undefined} onEntry={() => {}} />);
    expect(screen.queryByRole("switch")).toBeNull();
  });

  test("the switch says the theme and changes the choice", async () => {
    setContest({ account: ACCOUNT, contest: THEMED });
    const onEntry = jest.fn();
    await render(<EnterSwitch entry={undefined} onEntry={onEntry} />);
    const on = screen.getByRole("switch", {
      name: `Enter “${THEMED.theme.en.title}”`,
    });
    expect(on.props.accessibilityState.checked).toBe(false);
    await fireEvent.press(on);
    expect(onEntry).toHaveBeenCalledWith({ contest: THEMED.id, entered: true });
  });

  test("an entry goes after the drawing, and marks the challenge kept", async () => {
    setContest({
      account: ACCOUNT,
      contest: { ...THEMED, entered: [] } as ThemedContest,
    });
    answers["/entries"] = () => new Response(null, { status: 204 });
    const sent = await sendEntry(API, "tok", "drawing-1", {
      title: null,
      description: null,
      activity: "running",
      tags: [],
      visibility: "everyone",
      entry: { contest: THEMED.id, entered: true },
    });
    expect(sent).toEqual({ kind: "done" });
    expect(enteredIn(keptContest(), ACCOUNT)).toEqual(["drawing-1"]);
  });

  test("no call without an entry, or for a drawing not for everyone", async () => {
    const base = {
      title: null,
      description: null,
      activity: "running" as const,
      tags: [],
    };
    expect(
      await sendEntry(API, "tok", "d", { ...base, visibility: "everyone" }),
    ).toEqual({ kind: "done" });
    expect(
      await sendEntry(API, "tok", "d", {
        ...base,
        visibility: "followers",
        entry: { contest: THEMED.id, entered: true },
      }),
    ).toEqual({ kind: "done" });
    expect(asked("/entries")).toHaveLength(0);
  });

  test("an entry waits without a network, and a refusal does not", async () => {
    const choice = {
      title: null,
      description: null,
      activity: "running" as const,
      tags: [],
      visibility: "everyone" as const,
      entry: { contest: THEMED.id, entered: true },
    };
    answers["/entries"] = () => Promise.reject(new Error("offline"));
    expect(await sendEntry(API, "tok", "d", choice)).toEqual({ kind: "waits" });
    answers["/entries"] = () =>
      Response.json(apiError("not_entrant", "No."), { status: 409 });
    expect(await sendEntry(API, "tok", "d", choice)).toMatchObject({ kind: "refused" });
    answers["/entries"] = NOT_FOUND;
    expect(await sendEntry(API, "tok", "d", choice)).toMatchObject({ kind: "refused" });
  });

  test("a mark on another contest, or on no challenge, changes nothing", () => {
    setContest({ account: ACCOUNT, contest: PLAIN });
    markEntered(PLAIN.id, "d", true);
    expect(themedOf(keptContest()?.contest as Contest)).toBeNull();
    setContest({
      account: ACCOUNT,
      contest: { ...THEMED, entered: [] } as ThemedContest,
    });
    markEntered("another", "d", true);
    expect(enteredIn(keptContest(), ACCOUNT)).toEqual([]);
  });

  test("what was entered is shown only to the account it was asked for", () => {
    setContest({ account: "another-account", contest: THEMED });
    expect(enteredIn(keptContest(), ACCOUNT)).toEqual([]);
    expect(enteredIn(keptContest(), "another-account")).toEqual(THEMED.entered);
  });
});
