/**
 * «Feed» with the drawings the members publish (TASK-118, ADR-0227): the
 * page reads them with the account, shows them on the cards of the
 * examples, opens one whole on a tap, and falls back to the examples when
 * there are none. The examples themselves, the ads and the maps are in
 * FeedScreen.test.tsx.
 */
import page from "@shaperoute/shared-types/fixtures/feed.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { Drawing, FeedPost, Session } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import type { AccountState } from "../account/useAccount";
import { apiError } from "../account/testing";
import { SAMPLE_FEED } from "../feed/sampleFeed";
import { forgetFeed } from "../feed/useFeed";
import { DrawingsContext, useDrawingsDoor } from "../social/drawingsDoor";
import { FollowsContext } from "../social/followsDoor";
import { FeedScreen } from "./FeedScreen";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

const API = "http://api";
const SESSION = session as Session;
const SIGNED_IN: AccountState = { status: "signedIn", session: SESSION };
const [STAR, WORD] = page.posts as FeedPost[];

let fetchSpy: jest.SpiedFunction<typeof fetch>;
/** What the API answers to GET /feed. */
let feedAnswer: () => Response | Promise<Response>;

/** What the page asked the API, but for the contest, which it asks as it
 * opens to know whether to show its card (TASK-299). */
function asked(): string[] {
  return fetchSpy.mock.calls
    .map(([url]) => String(url).replace(API, ""))
    .filter((path) => path !== "/contests/current");
}

function Around({
  children,
  open = () => {},
  openProblem = null,
}: {
  children: ReactNode;
  open?: (drawing: Pick<Drawing, "id">) => void;
  openProblem?: string | null;
}) {
  const doors = useDrawingsDoor();
  return (
    <FollowsContext.Provider
      value={{
        apiUrl: API,
        account: { state: SIGNED_IN, sessionEnded: () => {} },
        openProfile: () => {},
      }}
    >
      <DrawingsContext.Provider value={{ ...doors, open, openProblem }}>
        {children}
      </DrawingsContext.Provider>
    </FollowsContext.Provider>
  );
}

beforeEach(() => {
  forgetFeed();
  feedAnswer = () => Response.json(page);
  fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith(`${API}/feed`)) {
      return feedAnswer();
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

test("signed in, the page shows the drawings the members published", async () => {
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} near={[46.0671, 11.1214]} />
    </Around>,
  );
  expect(await screen.findByText("Ada_runs")).toBeOnTheScreen();
  expect(screen.getByText("Sunday heart by the river")).toBeOnTheScreen();
  expect(screen.getByText("Trento")).toBeOnTheScreen();
  expect(
    screen.getByText("Star · 4.0 km · 19 min · 4:45 /km · 290 kcal"),
  ).toBeOnTheScreen();
  // The second, a word on a bike without a title, named by its day.
  expect(screen.getByText("adam.trento")).toBeOnTheScreen();
  expect(
    screen.getByText("Bike · ciao · 6.1 km · 34 min · 5:28 /km"),
  ).toBeOnTheScreen();
  expect(screen.queryByTestId("feed-loading")).toBeNull();
  expect(screen.queryByText(SAMPLE_FEED[0].user)).toBeNull();
  // Asked once, with the token, from where the phone is.
  expect(asked()).toEqual(["/feed?lat=46.07&lon=11.12"]);
  expect(fetchSpy.mock.calls[0][1]).toMatchObject({
    headers: { Authorization: `Bearer ${SESSION.token}` },
  });
});

test("while the first page comes, no example takes its place", async () => {
  let release: (answer: Response) => void = () => {};
  feedAnswer = () =>
    new Promise<Response>((resolve) => {
      release = resolve;
    });
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  expect(screen.getByTestId("feed-loading")).toBeOnTheScreen();
  expect(screen.queryByText(SAMPLE_FEED[0].user)).toBeNull();
  expect(screen.queryByTestId("feed-post")).toBeNull();
  await act(async () => release(Response.json(page)));
  expect(screen.queryByTestId("feed-loading")).toBeNull();
  expect(screen.getByText("Ada_runs")).toBeOnTheScreen();
});

test("a tap on a member's drawing opens it whole, not as a route of «Explore»", async () => {
  const open = jest.fn();
  const onOpen = jest.fn();
  await render(
    <Around open={open}>
      <FeedScreen onOpen={onOpen} />
    </Around>,
  );
  await fireEvent.press(await screen.findByText("Sunday heart by the river"));
  expect(open).toHaveBeenCalledWith(STAR);
  expect(onOpen).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("adam.trento"));
  expect(open).toHaveBeenLastCalledWith(WORD);
});

test("a drawing that did not open says why, above the list", async () => {
  await render(
    <Around openProblem="This drawing is no longer public.">
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  expect(
    await screen.findByText("This drawing is no longer public."),
  ).toBeOnTheScreen();
});

test("with nothing published yet, the examples take the place of the drawings", async () => {
  feedAnswer = () => Response.json({ posts: [], next: null });
  const onOpen = jest.fn();
  await render(
    <Around>
      <FeedScreen onOpen={onOpen} />
    </Around>,
  );
  expect(await screen.findByText(SAMPLE_FEED[0].user)).toBeOnTheScreen();
  expect(screen.queryByText("Ada_runs")).toBeNull();
  // An example opens its route, as before.
  await fireEvent.press(screen.getByText(SAMPLE_FEED[0].title));
  expect(onOpen).toHaveBeenCalledWith(SAMPLE_FEED[0]);
});

test("an API without a feed, or one that does not answer, leaves the examples", async () => {
  feedAnswer = () => Response.json(apiError("http_error"), { status: 404 });
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  expect(await screen.findByText(SAMPLE_FEED[0].user)).toBeOnTheScreen();
  expect(asked()).toEqual(["/feed"]);
});

test("built behind «Draw», the page asks for no drawings until it is on the screen", async () => {
  const { rerender } = await render(
    <Around>
      <FeedScreen onOpen={() => {}} active={false} />
    </Around>,
  );
  expect(asked()).toEqual([]);
  // Not on the screen, and nothing read yet: the examples.
  expect(screen.getByText(SAMPLE_FEED[0].user)).toBeOnTheScreen();
  await rerender(
    <Around>
      <FeedScreen onOpen={() => {}} active />
    </Around>,
  );
  expect(await screen.findByText("Ada_runs")).toBeOnTheScreen();
  expect(asked()).toEqual(["/feed"]);
});

test("the end of the list asks for the next page after the cursor", async () => {
  // One drawing a page: the list draws the first two rows only, in a test.
  const first = { posts: [STAR], next: page.next };
  const second = { posts: [{ ...WORD, id: "another", title: "Another" }], next: null };
  let pages = 0;
  feedAnswer = () => Response.json(pages++ === 0 ? first : second);
  await render(
    <Around>
      <FeedScreen onOpen={() => {}} />
    </Around>,
  );
  await screen.findByText("Ada_runs");
  await act(async () => {
    screen.getByTestId("feed-list").props.onEndReached();
  });
  expect(await screen.findByText("Another")).toBeOnTheScreen();
  await waitFor(() => expect(asked()).toEqual(["/feed", `/feed?cursor=${page.next}`]));
  // The drawings read so far all stay.
  expect(screen.getByText("Ada_runs")).toBeOnTheScreen();
});
