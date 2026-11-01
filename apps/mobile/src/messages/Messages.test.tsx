import conversationsExample from "@shaperoute/shared-types/fixtures/conversations.json";
import messagesExample from "@shaperoute/shared-types/fixtures/messages.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type {
  ConversationsPage,
  MessagesPage,
  Person,
  Session,
} from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { apiError } from "../account/testing";
import type { AccountState } from "../account/useAccount";
import { forgetBlocked, useBlockedNow } from "../social/blockedNow";
import { MessageButton } from "./MessageButton";
import { MessagesContext, useMessagesOf } from "./messagesDoor";
import { MessagesOverlay } from "./MessagesOverlay";
import { MessagesRow } from "./MessagesRow";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

// The private messages in the app (TASK-319, ADR-0279): «Messages» in
// «Profile», the list, «Message» on a profile, one conversation and what
// its `state` lets one do.

const URL = "http://api";
const signedIn: AccountState = { status: "signedIn", session: session as Session };
const account = { state: signedIn, sessionEnded: jest.fn() };
const ada = messagesExample.person as Person;
const ID = ada.public_id;
const [theirs, mine] = messagesExample.messages;

function conversation(over: Partial<MessagesPage> = {}): MessagesPage {
  return { ...(messagesExample as MessagesPage), next: null, ...over };
}

type Answer = (body: unknown) => Response;

/** A fake API by method and path; what it was asked, with the bodies. */
function api(answers: Record<string, Answer>) {
  const asked: { call: string; body: unknown }[] = [];
  const fetchFn = jest.fn(async (input: string, init?: RequestInit) => {
    const call = `${init?.method ?? "GET"} ${input.replace(URL, "")}`;
    const body = init?.body === undefined ? undefined : JSON.parse(String(init.body));
    asked.push({ call, body });
    const answer = answers[call];
    if (answer === undefined) {
      throw new Error(`Not in this test: ${call}`);
    }
    return answer(body);
  });
  const calls = () => asked.map((a) => a.call);
  return { fetchFn: fetchFn as unknown as jest.Mock, asked, calls };
}

const done = () => new Response(null, { status: 204 });
const json =
  (body: unknown, status = 200) =>
  () =>
    Response.json(body, { status });

/** What «Feed» reads to hide Ada's cards after a block. */
function Probe() {
  return <Text>{useBlockedNow(ID) ? "ada hidden" : "ada shown"}</Text>;
}

function Harness({ fetchFn }: { fetchFn: jest.Mock }) {
  // An hour between the numbers: only the first asking, in a test.
  const door = useMessagesOf(URL, account, { fetchFn, key: null, everyMs: 3_600_000 });
  return (
    <MessagesContext.Provider value={door}>
      <Probe />
      <MessagesRow />
      <MessageButton person={ada} />
      <MessagesOverlay fetchFn={fetchFn} apiKey={null} />
    </MessagesContext.Provider>
  );
}

const UNREAD = "GET /me/conversations/unread";
const INBOX = "GET /me/conversations?box=inbox&with=attachments";
const MESSAGES = `GET /conversations/${ID}/messages?with=attachments`;
const unread = (n = 0, requests = 0) => json({ unread: n, requests });

beforeEach(forgetBlocked);

test("«Messages» counts what waits and opens the list", async () => {
  const { fetchFn, calls } = api({
    [UNREAD]: unread(1, 2),
    [INBOX]: json(conversationsExample),
  });
  await render(<Harness fetchFn={fetchFn} />);
  const row = await screen.findByRole("button", { name: "Messages, 3 waiting" });
  await fireEvent.press(row);
  expect(await screen.findByText("Ada_runs")).toBeOnTheScreen();
  expect(
    screen.getByRole("button", { name: /^Ada_runs, new message: Yes, but the bridge/ }),
  ).toBeOnTheScreen();
  expect(screen.getByTestId("conversation-unread-count")).toHaveTextContent("1");
  expect(
    screen.getByRole("button", { name: "Message requests, 2 waiting" }),
  ).toBeOnTheScreen();
  expect(calls()).toEqual([UNREAD, INBOX]);
  expect(fetchFn.mock.calls[1][1]).toMatchObject({
    headers: { Authorization: `Bearer ${session.token}` },
  });
});

test("an API without messages shows neither «Messages» nor «Message»", async () => {
  const { fetchFn, calls } = api({
    [UNREAD]: json(apiError("http_error", "Not Found"), 404),
  });
  await render(<Harness fetchFn={fetchFn} />);
  // The answer has come.
  await act(async () => {});
  expect(calls()).toEqual([UNREAD]);
  expect(screen.queryByTestId("messages-row")).toBeNull();
  expect(screen.queryByRole("button", { name: "Message Ada_runs" })).toBeNull();
});

test("an empty list says how to write, the requests say there are none", async () => {
  const empty: ConversationsPage = { conversations: [], next: null, total: 0 };
  const { fetchFn } = api({
    [UNREAD]: unread(),
    [INBOX]: json(empty),
    "GET /me/conversations?box=requests&with=attachments": json(empty),
  });
  await render(<Harness fetchFn={fetchFn} />);
  await fireEvent.press(await screen.findByRole("button", { name: "Messages" }));
  expect(
    await screen.findByText(
      "No messages yet. Open someone's profile and tap Message to write to them.",
    ),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Message requests" }));
  expect(await screen.findByText("No message requests.")).toBeOnTheScreen();
  // «←» from the requests: «Messages».
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(await screen.findByText(/^No messages yet\. Open/)).toBeOnTheScreen();
});

test("a conversation opened from the list is marked read, and «←» goes back to it", async () => {
  const { fetchFn, calls } = api({
    [UNREAD]: unread(1),
    [INBOX]: json(conversationsExample),
    [MESSAGES]: json(conversation()),
    [`PUT /conversations/${ID}/read`]: done,
  });
  await render(<Harness fetchFn={fetchFn} />);
  await fireEvent.press(await screen.findByRole("button", { name: /^Messages/ }));
  await fireEvent.press(await screen.findByRole("button", { name: /^Ada_runs, new/ }));
  expect(await screen.findByText(theirs.text)).toBeOnTheScreen();
  expect(screen.getByText(mine.text)).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Send" })).toBeOnTheScreen();
  // Read: the numbers are asked again.
  await screen.findByRole("button", { name: "Back" });
  expect(calls()).toContain(`PUT /conversations/${ID}/read`);
  expect(calls().filter((c) => c === UNREAD).length).toBeGreaterThanOrEqual(2);
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(
    await screen.findByRole("button", { name: /^Message requests/ }),
  ).toBeOnTheScreen();
});

test("«Message» on a profile: the first message is a request, then the wait", async () => {
  const { fetchFn, asked } = api({
    [UNREAD]: unread(),
    [MESSAGES]: json(conversation({ state: "first", messages: [] })),
    [`POST /conversations/${ID}/messages?with=attachments`]: json(mine, 201),
  });
  await render(<Harness fetchFn={fetchFn} />);
  await fireEvent.press(
    await screen.findByRole("button", { name: "Message Ada_runs" }),
  );
  expect(
    await screen.findByText(
      "Ada_runs gets this as a message request. You can send one message until they accept it.",
    ),
  ).toBeOnTheScreen();
  const send = screen.getByRole("button", { name: "Send" });
  expect(send).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText("Message"), `  ${mine.text} `);
  await fireEvent.press(send);
  expect(await screen.findByText(mine.text)).toBeOnTheScreen();
  expect(
    screen.getByText(
      "Message request sent. You can write again when Ada_runs accepts it.",
    ),
  ).toBeOnTheScreen();
  expect(screen.queryByLabelText("Message")).toBeNull();
  expect(asked.find((a) => a.call.startsWith("POST"))?.body).toEqual({
    text: mine.text,
  });
  // From a profile, «←» closes: the profile is under it.
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.queryByText(mine.text)).toBeNull();
});

test("a negative request is said in words, and the text stays", async () => {
  const { fetchFn } = api({
    [UNREAD]: unread(),
    [MESSAGES]: json(conversation({ state: "first", messages: [] })),
    [`POST /conversations/${ID}/messages?with=attachments`]: json(
      apiError("comment_rejected"),
      422,
    ),
  });
  await render(<Harness fetchFn={fetchFn} />);
  await fireEvent.press(
    await screen.findByRole("button", { name: "Message Ada_runs" }),
  );
  const box = await screen.findByLabelText("Message");
  await fireEvent.changeText(box, "What an ugly route");
  await fireEvent.press(screen.getByRole("button", { name: "Send" }));
  expect(
    await screen.findByText("You can't send negative messages in this app."),
  ).toBeOnTheScreen();
  expect(screen.getByLabelText("Message")).toHaveProp("value", "What an ugly route");
});

test("a request is accepted, and the box comes", async () => {
  const { fetchFn, calls } = api({
    [UNREAD]: unread(0, 1),
    [MESSAGES]: json(conversation({ state: "request", messages: [theirs] })),
    [`PUT /conversations/${ID}/read`]: done,
    [`PUT /conversations/${ID}/accept`]: done,
  });
  await render(<Harness fetchFn={fetchFn} />);
  await fireEvent.press(
    await screen.findByRole("button", { name: "Message Ada_runs" }),
  );
  expect(
    await screen.findByText("Ada_runs wants to send you a message."),
  ).toBeOnTheScreen();
  expect(screen.queryByLabelText("Message")).toBeNull();
  expect(screen.getByRole("button", { name: "Delete" })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Accept" }));
  expect(await screen.findByLabelText("Message")).toBeOnTheScreen();
  expect(calls()).toContain(`PUT /conversations/${ID}/accept`);
});

test("a request deleted closes the conversation", async () => {
  const { fetchFn, calls } = api({
    [UNREAD]: unread(0, 1),
    [MESSAGES]: json(conversation({ state: "request", messages: [theirs] })),
    [`PUT /conversations/${ID}/read`]: done,
    [`DELETE /conversations/${ID}`]: done,
  });
  await render(<Harness fetchFn={fetchFn} />);
  await fireEvent.press(
    await screen.findByRole("button", { name: "Message Ada_runs" }),
  );
  await fireEvent.press(await screen.findByRole("button", { name: "Delete" }));
  await screen.findByRole("button", { name: "Message Ada_runs" });
  expect(screen.queryByText(theirs.text)).toBeNull();
  expect(calls()).toContain(`DELETE /conversations/${ID}`);
});

test("«Block» of a request asks first, saying the conversation goes", async () => {
  const { fetchFn, calls } = api({
    [UNREAD]: unread(0, 1),
    [MESSAGES]: json(conversation({ state: "request", messages: [theirs] })),
    [`PUT /conversations/${ID}/read`]: done,
    [`PUT /users/${ID}/block`]: done,
  });
  await render(<Harness fetchFn={fetchFn} />);
  await fireEvent.press(
    await screen.findByRole("button", { name: "Message Ada_runs" }),
  );
  await fireEvent.press(await screen.findByRole("button", { name: "Block" }));
  expect(screen.getByText("Block Ada_runs?")).toBeOnTheScreen();
  expect(screen.getByText(/your conversation is deleted/)).toBeOnTheScreen();
  expect(calls()).not.toContain(`PUT /users/${ID}/block`);
  const buttons = screen.getAllByRole("button", { name: "Block" });
  await fireEvent.press(buttons[buttons.length - 1]);
  await screen.findByRole("button", { name: "Message Ada_runs" });
  expect(calls()).toContain(`PUT /users/${ID}/block`);
  expect(screen.getByText("ada hidden")).toBeOnTheScreen();
  expect(screen.queryByText(theirs.text)).toBeNull();
});

test("one's own message held long is deleted for both", async () => {
  const { fetchFn, calls } = api({
    [UNREAD]: unread(),
    [MESSAGES]: json(conversation()),
    [`PUT /conversations/${ID}/read`]: done,
    [`DELETE /messages/${mine.id}`]: done,
  });
  await render(<Harness fetchFn={fetchFn} />);
  await fireEvent.press(
    await screen.findByRole("button", { name: "Message Ada_runs" }),
  );
  await fireEvent(await screen.findByText(mine.text), "longPress");
  expect(screen.getByText("Delete this message for both of you?")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Delete" }));
  expect(await screen.findByText(theirs.text)).toBeOnTheScreen();
  expect(screen.queryByText(mine.text)).toBeNull();
  expect(calls()).toContain(`DELETE /messages/${mine.id}`);
});

test("the other's message held long is reported, that message only", async () => {
  const { fetchFn, asked } = api({
    [UNREAD]: unread(),
    [MESSAGES]: json(conversation()),
    [`PUT /conversations/${ID}/read`]: done,
    "POST /reports": done,
  });
  await render(<Harness fetchFn={fetchFn} />);
  await fireEvent.press(
    await screen.findByRole("button", { name: "Message Ada_runs" }),
  );
  await fireEvent(await screen.findByText(theirs.text), "longPress");
  await fireEvent.press(screen.getByRole("button", { name: "Report this message" }));
  await fireEvent.press(screen.getByRole("button", { name: "Harassment or bullying" }));
  expect(
    await screen.findByText("Thanks for telling us. We will look at it."),
  ).toBeOnTheScreen();
  expect(asked.find((a) => a.call === "POST /reports")?.body).toEqual({
    kind: "message",
    id: theirs.id,
    reason: "harassment",
  });
});
