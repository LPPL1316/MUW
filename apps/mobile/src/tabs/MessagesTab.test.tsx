import conversationsExample from "@shaperoute/shared-types/fixtures/conversations.json";
import messagesExample from "@shaperoute/shared-types/fixtures/messages.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type {
  ConversationsPage,
  MessagesPage as Page,
  Session,
} from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Text } from "react-native";

import type { AccountState } from "../account/useAccount";
import { MessagesContext, useInboxTab, useMessagesOf } from "../messages/messagesDoor";
import { MessagesOverlay } from "../messages/MessagesOverlay";
import { MessagesRow } from "../messages/MessagesRow";
import { MessagesPage } from "./MessagesPage";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

// «Messages» as a tab (TASK-367): the list is the tab's, what opens from it
// comes over the app and goes back to it.

const URL = "http://api";
const signedIn: AccountState = { status: "signedIn", session: session as Session };
const account = { state: signedIn, sessionEnded: jest.fn() };
const ID = messagesExample.person.public_id;

const UNREAD = "GET /me/conversations/unread";
const INBOX = "GET /me/conversations?box=inbox&with=attachments";
const REQUESTS = "GET /me/conversations?box=requests&with=attachments";
const MESSAGES = `GET /conversations/${ID}/messages?with=attachments`;

function api(answers: Record<string, () => Response>) {
  const asked: string[] = [];
  const fetchFn = jest.fn(async (input: string, init?: RequestInit) => {
    const call = `${init?.method ?? "GET"} ${input.replace(URL, "")}`;
    asked.push(call);
    const answer = answers[call];
    if (answer === undefined) {
      throw new Error(`Not in this test: ${call}`);
    }
    return answer();
  });
  return { fetchFn: fetchFn as unknown as jest.Mock, asked };
}

const json = (body: unknown) => () => Response.json(body);
const empty: ConversationsPage = { conversations: [], next: null, total: 0 };

/** The app as far as messages go: a way in from elsewhere (the row), the
 * tab, and what opens over it. */
function Harness({ fetchFn }: { fetchFn: jest.Mock }) {
  const door = useMessagesOf(URL, account, { fetchFn, key: null, everyMs: 3_600_000 });
  const [tab, setTab] = useState(false);
  return (
    <MessagesContext.Provider value={door}>
      <Tab onShow={() => setTab(true)} />
      <Text>{tab ? "on the tab" : "elsewhere"}</Text>
      <MessagesRow />
      {tab && <MessagesPage active fetchFn={fetchFn} apiKey={null} />}
      <MessagesOverlay fetchFn={fetchFn} apiKey={null} />
    </MessagesContext.Provider>
  );
}

function Tab({ onShow }: { onShow: () => void }) {
  useInboxTab(onShow);
  return null;
}

test("the list asked for from elsewhere is the tab, with nothing over it", async () => {
  const { fetchFn } = api({
    [UNREAD]: json({ unread: 1, requests: 0 }),
    [INBOX]: json(conversationsExample),
  });
  await render(<Harness fetchFn={fetchFn} />);
  await fireEvent.press(await screen.findByRole("button", { name: /^Messages/ }));
  expect(screen.getByText("on the tab")).toBeOnTheScreen();
  expect(await screen.findByRole("header", { name: "Messages" })).toBeOnTheScreen();
  // The tab's title, and no «←»: the list is not over the app.
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  expect(
    screen.getByRole("button", { name: /^Ada_runs, new message/ }),
  ).toBeOnTheScreen();
});

test("a conversation of the tab opens over it, and «←» comes back to the tab", async () => {
  const { fetchFn, asked } = api({
    [UNREAD]: json({ unread: 1, requests: 0 }),
    [INBOX]: json(conversationsExample),
    [MESSAGES]: json({ ...(messagesExample as Page), next: null }),
    [`PUT /conversations/${ID}/read`]: () => new Response(null, { status: 204 }),
  });
  await render(<Harness fetchFn={fetchFn} />);
  await fireEvent.press(await screen.findByRole("button", { name: /^Messages/ }));
  await fireEvent.press(await screen.findByRole("button", { name: /^Ada_runs, new/ }));
  expect(await screen.findByRole("button", { name: "Send" })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  // The tab reads its list again, as «Messages» did each time it opened.
  expect(await screen.findByRole("header", { name: "Messages" })).toBeOnTheScreen();
  expect(asked.filter((call) => call === INBOX).length).toBeGreaterThanOrEqual(2);
});

test("the requests open over the tab, and «←» comes back to it", async () => {
  const { fetchFn } = api({
    [UNREAD]: json({ unread: 0, requests: 0 }),
    [INBOX]: json(empty),
    [REQUESTS]: json(empty),
  });
  await render(<Harness fetchFn={fetchFn} />);
  await fireEvent.press(await screen.findByRole("button", { name: "Messages" }));
  await fireEvent.press(
    await screen.findByRole("button", { name: "Message requests" }),
  );
  expect(await screen.findByText("No message requests.")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.queryByText("No message requests.")).toBeNull();
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  expect(await screen.findByText(/^No messages yet\. Open/)).toBeOnTheScreen();
});
