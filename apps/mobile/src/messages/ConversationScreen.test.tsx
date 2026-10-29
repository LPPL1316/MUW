import messagesExample from "@shaperoute/shared-types/fixtures/messages.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { Message, MessagesPage, Person, Session } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import type { AccountState } from "../account/useAccount";
import { ConversationScreen, merged } from "./ConversationScreen";
import { MessagesContext, type MessagesDoor } from "./messagesDoor";

// One conversation (TASK-319): read again while it is on screen, the new
// messages over the ones held, a deleted one gone.

const URL = "http://api";
const signedIn: AccountState = { status: "signedIn", session: session as Session };
const page = { ...(messagesExample as MessagesPage), next: null };
const ada = page.person as Person;
const [theirs, mine] = page.messages;

function message(id: string, created_at: string, text = id): Message {
  return { id, text, created_at, mine: false };
}

test("a page read again comes over the messages held, the latest first", () => {
  const old = message("old", "2026-10-26T09:00:00Z");
  const a = message("a", "2026-10-26T09:12:00Z");
  const b = message("b", "2026-10-26T09:12:00.500000Z");
  const c = message("c", "2026-10-26T09:13:00Z");
  // Older than the page: kept, «a» too, though «…:00Z» sorts after «…:00.5Z».
  expect(merged([b, a, old], [c, b]).map((m) => m.id)).toEqual(["c", "b", "a", "old"]);
  // Inside what the page covers, a message not in it was deleted.
  expect(merged([c, b, a], [c, a]).map((m) => m.id)).toEqual(["c", "a"]);
  expect(merged([c, b], [])).toEqual([]);
});

test("open, it is read again, and a new message shows", async () => {
  const newer = message(
    "e3b1c0d2-0000-4000-8000-000000000001",
    "2026-10-26T09:30:00Z",
    "Are you coming?",
  );
  const answers = [page, { ...page, messages: [newer, theirs, mine] }];
  const fetchFn = jest.fn(async (input: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      return new Response(null, { status: 204 });
    }
    expect(input).toBe(
      `${URL}/conversations/${ada.public_id}/messages?with=attachments`,
    );
    return Response.json(answers.length > 1 ? answers.shift() : answers[0]);
  });
  const recount = jest.fn();
  const door: MessagesDoor = {
    apiUrl: URL,
    account: { state: signedIn, sessionEnded: jest.fn() },
    screen: null,
    openList: jest.fn(),
    openConversation: jest.fn(),
    back: jest.fn(),
    close: jest.fn(),
    unread: { unread: 0, requests: 0 },
    recount,
  };
  await render(
    <MessagesContext.Provider value={door}>
      <ConversationScreen
        person={ada}
        onBack={jest.fn()}
        fetchFn={fetchFn as unknown as typeof fetch}
        apiKey={null}
        everyMs={20}
      />
    </MessagesContext.Provider>,
  );
  expect(await screen.findByText(theirs.text)).toBeOnTheScreen();
  expect(await screen.findByText("Are you coming?")).toBeOnTheScreen();
  expect(screen.getByText(mine.text)).toBeOnTheScreen();
  // Each new message of the other is marked read once.
  const reads = fetchFn.mock.calls.filter(([, init]) => init?.method === "PUT");
  expect(reads.map(([url]) => url)).toEqual([
    `${URL}/conversations/${ada.public_id}/read`,
    `${URL}/conversations/${ada.public_id}/read`,
  ]);
  expect(recount).toHaveBeenCalled();
});

test("a reading asked before a message is sent does not take it away", async () => {
  const sent = message(
    "f0a1b2c3-0000-4000-8000-000000000002",
    "2026-10-26T09:31:00Z",
    "On my way",
  );
  let release: (r: Response) => void = () => {};
  let gets = 0;
  let posted = false;
  const fetchFn = jest.fn(async (_input: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      return new Response(null, { status: 204 });
    }
    if (init?.method === "POST") {
      posted = true;
      return Response.json({ ...sent, mine: true }, { status: 201 });
    }
    gets += 1;
    if (gets === 2) {
      // The second reading waits: it was asked before the message went.
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    }
    const now = posted ? [{ ...sent, mine: true }, ...page.messages] : page.messages;
    return Response.json({ ...page, messages: now });
  });
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
  await render(
    <MessagesContext.Provider value={door}>
      <ConversationScreen
        person={ada}
        onBack={jest.fn()}
        fetchFn={fetchFn as unknown as typeof fetch}
        apiKey={null}
        everyMs={20}
      />
    </MessagesContext.Provider>,
  );
  await screen.findByText(theirs.text);
  await waitFor(() => expect(gets).toBe(2));
  await fireEvent.changeText(screen.getByLabelText("Message"), "On my way");
  await fireEvent.press(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByText("On my way")).toBeOnTheScreen();
  // While the second waits, nobody asks again.
  expect(gets).toBe(2);
  await act(async () => release(Response.json(page)));
  expect(screen.getByText("On my way")).toBeOnTheScreen();
  // The readings after it have the message: it stays.
  await waitFor(() => expect(gets).toBeGreaterThan(3));
  expect(screen.getByText("On my way")).toBeOnTheScreen();
});
