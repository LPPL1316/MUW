/**
 * «Enter “{theme}”» on the account's own post (TASK-343 part B): it enters
 * and withdraws at once, only on a drawing that can take part, and not at all
 * with an API without themes.
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
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { apiError } from "../account/testing";
import { FollowsContext } from "../social/followsDoor";
import { forgetContest, keptContest, setContest } from "./contestKept";
import { EnterOnPost } from "./EnterOnPost";

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
const THEMED: ThemedContest = {
  ...(themedFixture as unknown as ThemedContest),
  starts_at: "2020-01-01T00:00:00Z",
  ends_at: "2999-12-31T23:59:59Z",
  entered: [],
};
const POST = {
  ...entries.gallery.entries[0].drawing,
  id: "own-post",
  public: true,
  track: [],
  visibility: "everyone",
  published_at: "2500-01-01T00:00:00Z",
  author: { public_id: ACCOUNT, username: "me" },
} as unknown as DrawingDetail;
const NAME = `Enter “${THEMED.theme.en.title}”`;

let answer: () => Response;
let fetchSpy: jest.SpiedFunction<typeof fetch>;

/** The calls of the entry, without the challenge asked for again after them. */
function asked(): RequestInit[] {
  return fetchSpy.mock.calls
    .filter(([url]) => String(url).includes("/entries/"))
    .map(([, init]) => init ?? {});
}

async function show(drawing: DrawingDetail, status: "in" | "out" = "in") {
  await render(
    <FollowsContext.Provider
      value={{
        apiUrl: API,
        account: {
          state:
            status === "in"
              ? { status: "signedIn", session: SESSION }
              : { status: "signedOut", notice: null },
          sessionEnded: () => {},
        },
        openProfile: () => {},
      }}
    >
      <EnterOnPost drawing={drawing} />
    </FollowsContext.Provider>,
  );
}

beforeEach(() => {
  forgetContest();
  answer = () => new Response(null, { status: 204 });
  fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async () => answer());
});

afterEach(() => {
  fetchSpy.mockRestore();
});

test("it enters and withdraws at once", async () => {
  setContest({ account: ACCOUNT, contest: THEMED });
  await show(POST);
  await fireEvent.press(screen.getByRole("switch", { name: NAME }));
  await waitFor(() =>
    expect(
      screen.getByRole("switch", { name: NAME }).props.accessibilityState.checked,
    ).toBe(true),
  );
  expect(String(fetchSpy.mock.calls[0][0])).toBe(
    `${API}/contests/${THEMED.id}/entries/own-post`,
  );
  expect(asked()[0].method).toBe("PUT");
  await fireEvent.press(screen.getByRole("switch", { name: NAME }));
  await waitFor(() =>
    expect(
      screen.getByRole("switch", { name: NAME }).props.accessibilityState.checked,
    ).toBe(false),
  );
  expect(asked()[1].method).toBe("DELETE");
});

test("after an entry the challenge is asked for again: the card shows the new place", async () => {
  setContest({ account: ACCOUNT, contest: THEMED });
  const mine = { drawing_id: "own-post", rank: 1, reactions: 0 };
  fetchSpy.mockImplementation(async (url) =>
    String(url).endsWith("/contests/current")
      ? Response.json({ ...THEMED, mine, entered: ["own-post"] })
      : new Response(null, { status: 204 }),
  );
  await show(POST);
  await fireEvent.press(screen.getByRole("switch", { name: NAME }));
  await waitFor(() => expect(keptContest()?.contest.mine).toEqual(mine));
});

test("a refusal says why, and the switch stays", async () => {
  setContest({ account: ACCOUNT, contest: THEMED });
  answer = () => Response.json(apiError("contest_closed", "No."), { status: 409 });
  await show(POST);
  await fireEvent.press(screen.getByRole("switch", { name: NAME }));
  expect(
    await screen.findByText("This challenge takes no entries now."),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole("switch", { name: NAME }).props.accessibilityState.checked,
  ).toBe(false);
});

test.each([
  ["somebody else's", { author: { public_id: "other", username: "o" } }],
  ["for followers", { visibility: "followers" }],
  ["imported", { source: "file" }],
  ["published before the challenge", { published_at: "2019-01-01T00:00:00Z" }],
])("a post %s has no switch", async (_name, change) => {
  setContest({ account: ACCOUNT, contest: THEMED });
  await show({ ...POST, ...change } as DrawingDetail);
  expect(screen.queryByRole("switch")).toBeNull();
});

test("without an account there is no switch", async () => {
  setContest({ account: null, contest: THEMED });
  await show(POST, "out");
  expect(screen.queryByRole("switch")).toBeNull();
});

test("with an API without themes there is no switch", async () => {
  setContest({ account: ACCOUNT, contest: open as Contest });
  await show(POST);
  expect(screen.queryByRole("switch")).toBeNull();
});
