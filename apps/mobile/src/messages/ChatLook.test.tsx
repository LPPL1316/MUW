import conversationsExample from "@shaperoute/shared-types/fixtures/conversations.json";
import messagesExample from "@shaperoute/shared-types/fixtures/messages.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type {
  Conversation,
  ConversationsPage,
  MessagesPage,
  Person,
  Session,
} from "@shaperoute/shared-types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import type { AccountState } from "../account/useAccount";
import { isConversation } from "../api/messages";
import { ConversationList } from "./ConversationList";
import { ConversationScreen } from "./ConversationScreen";
import { MessagesContext, type MessagesDoor } from "./messagesDoor";
import { listWhen } from "./messageTime";

// What TASK-353 adds to the chat: times, days, how many are new, the older
// messages while scrolling up. It works on a server of before as well.

const URL = "http://api";
const signedIn: AccountState = { status: "signedIn", session: session as Session };
const example = (conversationsExample as ConversationsPage).conversations[0];
const page = { ...(messagesExample as MessagesPage), next: null };
const ada = page.person as Person;
// An hour between two readings: only the first one, in a test.
const HOUR_MS = 3_600_000;

const door: MessagesDoor = {
  apiUrl: URL,
  account: { state: signedIn, sessionEnded: jest.fn() },
  screen: null,
  openList: jest.fn(),
  openConversation: jest.fn(),
  back: jest.fn(),
  close: jest.fn(),
  unread: { unread: 0, requests: 0 },
  recount: jest.fn(),
};

async function showList(conversation: Conversation) {
  const fetchFn = jest.fn(async () =>
    Response.json({ conversations: [conversation], next: null, total: 1 }),
  );
  await render(
    <MessagesContext.Provider value={door}>
      <ConversationList
        box="requests"
        onOpen={jest.fn()}
        fetchFn={fetchFn as unknown as typeof fetch}
        apiKey={null}
      />
    </MessagesContext.Provider>,
  );
  await screen.findByText(ada.username);
}

async function showConversation(fetchFn: jest.Mock) {
  await render(
    <MessagesContext.Provider value={door}>
      <ConversationScreen
        person={ada}
        onBack={jest.fn()}
        fetchFn={fetchFn as unknown as typeof fetch}
        apiKey={null}
        everyMs={HOUR_MS}
      />
    </MessagesContext.Provider>,
  );
  await screen.findByText(page.messages[0].text);
}

/** The list told it was scrolled near its end: the top, as it is inverted. */
async function scrollUp() {
  const list = screen.getByTestId("conversation-messages");
  const size = { width: 300, height: 1000 };
  const seen = { width: 300, height: 500 };
  await fireEvent(list, "layout", { nativeEvent: { layout: seen } });
  await fireEvent(list, "contentSizeChange", size.width, size.height);
  await fireEvent.scroll(list, {
    nativeEvent: {
      contentOffset: { x: 0, y: size.height - seen.height },
      contentSize: size,
      layoutMeasurement: seen,
    },
  });
}

function clock(iso: string): string {
  const when = new Date(iso);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(when.getHours())}:${two(when.getMinutes())}`;
}

test("the list says how many are new, and «9+» beyond nine", async () => {
  await showList({ ...example, unread_count: 3 });
  expect(screen.getByTestId("conversation-unread-count")).toHaveTextContent("3");
  expect(screen.queryByTestId("conversation-unread")).toBeNull();
  expect(
    screen.getByRole("button", { name: /^Ada_runs, 3 new messages: Yes, but/ }),
  ).toBeOnTheScreen();
  await screen.unmount();
  await showList({ ...example, unread_count: 10 });
  expect(screen.getByTestId("conversation-unread-count")).toHaveTextContent("9+");
});

test("a server of before says no number: the dot stays", async () => {
  const { unread_count: _gone, ...before } = example;
  expect(isConversation(before)).toBe(true);
  await showList(before);
  expect(screen.getByTestId("conversation-unread")).toBeOnTheScreen();
  expect(screen.queryByTestId("conversation-unread-count")).toBeNull();
});

test("a conversation read has neither dot nor number, and says when", async () => {
  await showList({ ...example, unread: false, unread_count: 0 });
  expect(screen.queryByTestId("conversation-unread")).toBeNull();
  expect(screen.queryByTestId("conversation-unread-count")).toBeNull();
  // As it reads today: the example's date is fixed, the clock goes on.
  const when = listWhen(example.last.created_at, new Date());
  expect(screen.getByText(when)).toBeOnTheScreen();
  expect(
    screen.getByRole("button", {
      name: new RegExp(`^Ada_runs: Yes, but.*, ${when}$`, "s"),
    }),
  ).toBeOnTheScreen();
});

test("each message says its time, and a title opens its day", async () => {
  const today = new Date();
  today.setHours(9, 15, 0, 0);
  const fetchFn = jest.fn(async (_input: string, init?: RequestInit) =>
    init?.method === "PUT"
      ? new Response(null, { status: 204 })
      : Response.json({
          ...page,
          messages: [
            { ...page.messages[0], created_at: today.toISOString() },
            ...page.messages.slice(1),
          ],
        }),
  );
  await showConversation(fetchFn);
  expect(screen.getByText("Today")).toBeOnTheScreen();
  expect(screen.getAllByText("09:15").length).toBeGreaterThan(0);
  const older = page.messages[page.messages.length - 1].created_at;
  expect(screen.getAllByText(clock(older)).length).toBeGreaterThan(0);
  expect(screen.getByText("Mon 26 Oct 2026")).toBeOnTheScreen();
});

test("scrolling up brings the older page, once", async () => {
  const older = {
    ...page.messages[0],
    id: "d2c1b0a9-0000-4000-8000-000000000009",
    text: "From last week",
    created_at: "2026-10-19T09:00:00Z",
  };
  const asked: string[] = [];
  let answer: (body: Response) => void = () => {};
  const fetchFn = jest.fn(async (input: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      return new Response(null, { status: 204 });
    }
    asked.push(input);
    if (input.includes("cursor=")) {
      return new Promise<Response>((resolve) => {
        answer = resolve;
      });
    }
    return Response.json({ ...page, next: "next-page" });
  });
  await showConversation(fetchFn);

  await scrollUp();
  await scrollUp();
  expect(await screen.findByText("Loading…")).toBeOnTheScreen();
  expect(asked.filter((url) => url.includes("cursor="))).toHaveLength(1);
  answer(Response.json({ ...page, messages: [older], next: null }));
  expect(await screen.findByText("From last week")).toBeOnTheScreen();
  await waitFor(() => expect(screen.queryByText("Loading…")).toBeNull());
  expect(screen.queryByRole("button", { name: "Show earlier messages" })).toBeNull();
});

test("an older page that fails leaves the button, which asks again", async () => {
  let fails = true;
  const fetchFn = jest.fn(async (input: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      return new Response(null, { status: 204 });
    }
    if (input.includes("cursor=")) {
      if (fails) {
        throw new Error("no connection");
      }
      return Response.json({ ...page, messages: [], next: null });
    }
    return Response.json({ ...page, next: "next-page" });
  });
  await showConversation(fetchFn);
  await scrollUp();
  const button = await screen.findByText("Show earlier messages");
  fails = false;
  await fireEvent.press(button);
  await waitFor(() => expect(screen.queryByText("Show earlier messages")).toBeNull());
});
