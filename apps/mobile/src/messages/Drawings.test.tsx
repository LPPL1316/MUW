import attachmentsExample from "@shaperoute/shared-types/fixtures/message-attachments.json";
import messagesExample from "@shaperoute/shared-types/fixtures/messages.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type {
  LatLon,
  Message,
  MessageDrawing,
  MessagesPage,
  Person,
  Session,
} from "@shaperoute/shared-types";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { AccountState } from "../account/useAccount";
import type { ActivityDetail } from "../api/activities";
import type { FavoriteDetail } from "../api/favorites";
import { favoriteKey } from "../favorites/favoriteKey";
import {
  FavoritesContext,
  type FavoritesDoor,
  useFavoritesOf,
} from "../favorites/favoritesDoor";
import { ConversationScreen } from "./ConversationScreen";
import {
  drawingOfDrawing,
  drawingOfFavorite,
  drawingOfRun,
  favoriteOfMessage,
  fewerPoints,
} from "./messageDrawing";
import { MessagesContext, type MessagesDoor } from "./messagesDoor";
import { SendDrawingButton } from "./SendDrawingButton";
import { peopleOf, SendToFriend } from "./SendToFriend";

// The drawings of the private messages (TASK-333 part C, ADR-0289): a copy
// of the route, a run cut at its ends; sent from the map, a card or the «+»
// of a conversation; opened on the map as a favorite, «←» back to the
// conversation.

const URL = "http://api";
const signedIn: AccountState = { status: "signedIn", session: session as Session };
const open = { ...(messagesExample as MessagesPage), next: null };
const ada = open.person as Person;
const bob: Person = {
  public_id: "1f2e3d4c-0000-4000-8000-0000000000b0",
  username: "bob",
  photo: null,
};

/** A line north, a point every ~111 m. */
function north(points: number): LatLon[] {
  return Array.from({ length: points }, (_, i) => [46 + i / 1000, 11.12] as LatLon);
}

const DRAWING: MessageDrawing = {
  city: "trento",
  shape: "star",
  word: null,
  style: null,
  title: null,
  distance_m: 5000,
  route_m: 5120,
  similarity: 0.96,
  points: north(6),
};

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function door(over: Partial<MessagesDoor> = {}): MessagesDoor {
  return {
    apiUrl: URL,
    account: { state: signedIn, sessionEnded: jest.fn() },
    screen: null,
    openList: jest.fn(),
    openConversation: jest.fn(),
    back: jest.fn(),
    close: jest.fn(),
    unread: { unread: 0, requests: 0 },
    recount: jest.fn(),
    ...over,
  };
}

type Asked = { method: string; url: string; body: unknown };

/** A fake API by method and path. */
function api(answers: Record<string, () => Response>) {
  const asked: Asked[] = [];
  const fetchFn = jest.fn(async (input: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const url = input.replace(URL, "");
    asked.push({
      method,
      url,
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    });
    const answer = answers[`${method} ${url}`];
    if (answer === undefined) {
      throw new Error(`Not in this test: ${method} ${url}`);
    }
    return answer();
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, asked };
}

// --- The copy ---

test("a run of one's own goes without its first and last 200 m", () => {
  const run = {
    place: "Trento",
    shape: "heart",
    word: null,
    style: null,
    title: null,
    distance_m: 1111,
    fidelity: 82,
    rotation_deg: null,
    activity: "running",
    track: north(11),
  } as unknown as ActivityDetail;
  const drawing = drawingOfRun(run);
  const points = drawing?.points ?? [];
  // Cut where the 200 m fall, between two fixes: the fixes between stay.
  expect(points.slice(1, -1)).toEqual(north(11).slice(2, 9));
  expect(points[0][0]).toBeCloseTo(46.0018, 4);
  expect(points[points.length - 1][0]).toBeCloseTo(46.0082, 4);
  expect(drawing).toMatchObject({
    city: "Trento",
    shape: "heart",
    similarity: 0.82,
    activity: "running",
  });
  // Too short to keep any of it: nothing to send.
  expect(drawingOfRun({ ...run, track: north(3) })).toBeNull();
});

test("a drawing of the Feed goes as the API gave it, named by its route", () => {
  const drawing = drawingOfDrawing({
    place: null,
    shape: null,
    word: null,
    style: null,
    title: null,
    route_title: "Castles of Trento",
    distance_m: 7000,
    fidelity: null,
    rotation_deg: 45,
    activity: "cycling",
    track: north(4),
  } as never);
  expect(drawing).toMatchObject({
    city: "",
    title: "Castles of Trento",
    points: north(4),
    similarity: 0,
    rotation_deg: 45,
    activity: "cycling",
  });
});

test("a favorite goes whole, and a long run in fewer points", () => {
  const favorite = {
    ...DRAWING,
    id: "k",
    created_at: "2026-10-29T10:00:00Z",
    walks: [],
    on_foot: [],
  };
  expect(drawingOfFavorite(favorite as FavoriteDetail)).toEqual(DRAWING);
  const long = north(25_000);
  const fewer = fewerPoints(long);
  expect(fewer).toHaveLength(20_000);
  expect(fewer[0]).toEqual(long[0]);
  expect(fewer[fewer.length - 1]).toEqual(long[long.length - 1]);
});

test("a drawing received opens as a favorite named by its line", () => {
  const detail = favoriteOfMessage(DRAWING, new Date("2026-10-29T18:00:00Z"));
  expect(detail).toMatchObject({
    id: favoriteKey(DRAWING.points),
    shape: "star",
    points: DRAWING.points,
    walks: [],
    created_at: "2026-10-29T18:00:00.000Z",
  });
});

// --- The way back ---

test("a route shown from a message goes back there, not to the list", async () => {
  const onProfile = jest.fn();
  const onOpened = jest.fn();
  const account = { state: signedIn, sessionEnded: jest.fn() } as never;
  const fetchFn = jest.fn(async () => Response.json({ favorites: [] }));
  // The same objects at every render, as «Profile» gives them.
  const doors = { onProfile, onOpened };
  const options = { fetchFn: fetchFn as unknown as typeof fetch, key: null };
  const { result } = await renderHook(() =>
    useFavoritesOf(URL, account, doors, options),
  );

  const back = jest.fn();
  await act(async () =>
    result.current.show(favoriteOfMessage(DRAWING, new Date()), back),
  );
  expect(result.current.opened?.keepable.id).toBe(favoriteKey(DRAWING.points));
  expect(onOpened).toHaveBeenCalled();
  // The map lets it go first, then «←» asks where to.
  await act(async () => result.current.close());
  await act(async () => result.current.showList());
  expect(back).toHaveBeenCalledTimes(1);
  expect(onProfile).not.toHaveBeenCalled();
  // Once: the next «←» is the list's again.
  await act(async () => result.current.showList());
  expect(onProfile).toHaveBeenCalledWith("favorites", null);
});

// --- Send to a friend ---

test("who one writes to comes first, then who one follows, each once", () => {
  expect(peopleOf([ada], [bob, ada]).map((p) => p.username)).toEqual([
    "Ada_runs",
    "bob",
  ]);
});

test("«Send to a friend» sends the drawing to the one touched", async () => {
  const { fetchFn, asked } = api({
    "GET /me/conversations?box=inbox&with=attachments": () =>
      Response.json({
        conversations: [{ person: ada, last: open.messages[0], unread: false }],
        next: null,
        total: 1,
      }),
    "GET /me/following": () => Response.json({ people: [bob], next: null, total: 1 }),
    [`POST /conversations/${ada.public_id}/messages?with=attachments`]: () =>
      Response.json({ ...open.messages[0], id: "m", mine: true }, { status: 201 }),
    [`POST /conversations/${bob.public_id}/messages?with=attachments`]: () =>
      Response.json(
        {
          error: {
            code: "http_error",
            message:
              "Photos, videos and drawings can be sent once they accept your message.",
          },
        },
        { status: 409 },
      ),
  });
  await render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <MessagesContext.Provider value={door()}>
        <SendToFriend
          drawing={DRAWING}
          onClose={jest.fn()}
          fetchFn={fetchFn}
          apiKey={null}
        />
      </MessagesContext.Provider>
    </SafeAreaProvider>,
  );
  await fireEvent.press(await screen.findByRole("button", { name: "Ada_runs" }));
  expect(await screen.findByText("Sent to Ada_runs.")).toBeOnTheScreen();
  expect(asked.find((a) => a.method === "POST")?.body).toEqual({
    text: "",
    attachment: { drawing: DRAWING },
  });
  // Bob has not accepted a message: a request is text only.
  await fireEvent.press(screen.getByRole("button", { name: "bob" }));
  expect(
    await screen.findByText(
      "Photos, videos and drawings can be sent once bob accepts your message.",
    ),
  ).toBeOnTheScreen();
});

test("«Send to a friend» is there only with an account and the messages", async () => {
  const shown = (value: MessagesDoor) =>
    render(
      <MessagesContext.Provider value={value}>
        <SendDrawingButton drawing={() => DRAWING} />
      </MessagesContext.Provider>,
    );
  await shown(door());
  expect(screen.getByRole("button", { name: "Send to a friend" })).toBeOnTheScreen();
  await shown(door({ unread: null }));
  expect(screen.queryByRole("button", { name: "Send to a friend" })).toBeNull();
  await shown(
    door({
      account: {
        state: { status: "signedOut", notice: null },
        sessionEnded: jest.fn(),
      },
    }),
  );
  expect(screen.queryByRole("button", { name: "Send to a friend" })).toBeNull();
});

// --- In a conversation ---

test("«Drawing» of the «+» sends a favorite, whole", async () => {
  const favorite = {
    id: "fav1",
    city: "trento",
    shape: "star",
    word: null,
    style: null,
    title: null,
    distance_m: 5000,
    route_m: 5120,
    similarity: 0.96,
    start: DRAWING.points[0],
    preview: DRAWING.points,
    created_at: "2026-10-29T10:00:00Z",
  };
  const { fetchFn, asked } = api({
    [`GET /conversations/${ada.public_id}/messages?with=attachments`]: () =>
      Response.json(open),
    "GET /me/favorites": () => Response.json({ favorites: [favorite] }),
    "GET /me/activities": () => Response.json({ activities: [], next: null, total: 0 }),
    "GET /me/favorites/fav1": () =>
      Response.json({
        ...favorite,
        start: undefined,
        preview: undefined,
        points: DRAWING.points,
        walks: [],
        on_foot: [],
      }),
    [`POST /conversations/${ada.public_id}/messages?with=attachments`]: () =>
      Response.json(
        {
          ...(attachmentsExample as MessagesPage).messages[0],
          id: "sent-drawing",
          mine: true,
          text: "Tomorrow?",
        },
        { status: 201 },
      ),
  });
  await render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <MessagesContext.Provider value={door()}>
        <ConversationScreen
          person={ada}
          onBack={jest.fn()}
          fetchFn={fetchFn}
          apiKey={null}
          everyMs={3_600_000}
        />
      </MessagesContext.Provider>
    </SafeAreaProvider>,
  );
  await screen.findByText(open.messages[0].text);
  await fireEvent.changeText(screen.getByLabelText("Message"), "Tomorrow?");
  await fireEvent.press(
    screen.getByRole("button", { name: "Add a photo, a video or a drawing" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Drawing" }));
  expect(await screen.findByText("Send a drawing")).toBeOnTheScreen();
  await fireEvent.press(await screen.findByRole("button", { name: "Star · 5.1 km" }));
  await waitFor(() => expect(asked.some((a) => a.method === "POST")).toBe(true));
  expect(asked.find((a) => a.method === "POST")?.body).toEqual({
    text: "Tomorrow?",
    attachment: { drawing: DRAWING },
  });
  expect(await screen.findByText("Tomorrow?")).toBeOnTheScreen();
});

test("a drawing touched opens on the map, and «←» comes back", async () => {
  const page = { ...(attachmentsExample as MessagesPage), next: null };
  const drawingMessage = page.messages[0] as Message;
  const { fetchFn } = api({
    [`GET /conversations/${ada.public_id}/messages?with=attachments`]: () =>
      Response.json(page),
    [`GET /messages/${drawingMessage.id}/drawing`]: () => Response.json(DRAWING),
    [`PUT /conversations/${ada.public_id}/read`]: () =>
      new Response(null, { status: 204 }),
  });
  const show = jest.fn();
  const favorites = { show } as unknown as FavoritesDoor;
  const messages = door();
  await render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <FavoritesContext.Provider value={favorites}>
        <MessagesContext.Provider value={messages}>
          <ConversationScreen
            person={ada}
            onBack={jest.fn()}
            fetchFn={fetchFn}
            apiKey={null}
            everyMs={3_600_000}
          />
        </MessagesContext.Provider>
      </FavoritesContext.Provider>
    </SafeAreaProvider>,
  );
  await fireEvent.press(
    await screen.findByRole("button", { name: "Drawing: Heart, 5.1 km" }),
  );
  await waitFor(() => expect(show).toHaveBeenCalled());
  const [detail, back] = show.mock.calls[0] as [FavoriteDetail, () => void];
  expect(detail.points).toEqual(DRAWING.points);
  expect(messages.close).toHaveBeenCalled();
  back();
  expect(messages.openConversation).toHaveBeenCalledWith(ada);
});
