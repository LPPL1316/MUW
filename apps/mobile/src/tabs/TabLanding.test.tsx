import conversationsExample from "@shaperoute/shared-types/fixtures/conversations.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { Session } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Pressable, Text } from "react-native";

import type { MemorySecureStore } from "../account/testing";
import type { AccountState } from "../account/useAccount";
import { MessagesContext, useMessagesOf } from "../messages/messagesDoor";
import { OwnProfile, ProfileLayer } from "../screens/ProfileLayer";
import { MessagesPage } from "./MessagesPage";

// A swipe that lands on «Messages» or on «Profile» finds the page as it slid
// in: no «Loading…» in place of the list, no profile empty and filling again
// (the user's video of 2026-11-05).

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-secure-store", () =>
  jest
    .requireActual<typeof import("../account/testing")>("../account/testing")
    .memorySecureStore(),
);

// «Profile» as far as being built goes: how many times, and a way to open a
// page of it over the app and back.
let mockBuilds = 0;
jest.mock("../screens/ProfileScreen", () => {
  const { useState: useOnce } = jest.requireActual<typeof import("react")>("react");
  const { Pressable: Press, Text: Words } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    ProfileScreen: ({
      page,
      onPage,
      onBack,
    }: {
      page: string;
      onPage: (to: string) => void;
      onBack?: () => void;
    }) => {
      // Only the fourth page counts, not a page of it over the app.
      const [built] = useOnce(() => (page === "account" ? (mockBuilds += 1) : 0));
      return page === "account" ? (
        <>
          <Words>{`built ${built}`}</Words>
          <Press onPress={() => onPage("settings")} accessibilityRole="button">
            <Words>Settings</Words>
          </Press>
        </>
      ) : (
        <Press onPress={onBack} accessibilityRole="button">
          <Words>Back</Words>
        </Press>
      );
    },
  };
});

const store = jest.requireMock<MemorySecureStore>("expo-secure-store");
const URL = "http://api";
const signedIn: AccountState = { status: "signedIn", session: session as Session };
const account = { state: signedIn, sessionEnded: jest.fn() };
const UNREAD = "GET /me/conversations/unread";
const INBOX = "GET /me/conversations?box=inbox&with=attachments";

beforeEach(() => {
  mockBuilds = 0;
  store.kept.clear();
});

function Messages({ fetchFn }: { fetchFn: jest.Mock }) {
  const door = useMessagesOf(URL, account, { fetchFn, key: null, everyMs: 3_600_000 });
  const [active, setActive] = useState(true);
  return (
    <MessagesContext.Provider value={door}>
      <Pressable onPress={() => setActive(!active)} accessibilityRole="button">
        <Text>Swipe</Text>
      </Pressable>
      <MessagesPage active={active} fetchFn={fetchFn} apiKey={null} />
    </MessagesContext.Provider>
  );
}

test("«Messages» reads its list again in place as a swipe lands on it", async () => {
  const pending: ((answer: Response) => void)[] = [];
  const asked: string[] = [];
  const fetchFn = jest.fn(async (input: string, init?: RequestInit) => {
    const call = `${init?.method ?? "GET"} ${input.replace(URL, "")}`;
    asked.push(call);
    if (call === UNREAD) {
      return Response.json({ unread: 1, requests: 0 });
    }
    if (call === INBOX && asked.filter((each) => each === INBOX).length === 1) {
      return Response.json(conversationsExample);
    }
    if (call === INBOX) {
      return new Promise<Response>((resolve) => pending.push(resolve));
    }
    throw new Error(`Not in this test: ${call}`);
  });
  await render(<Messages fetchFn={fetchFn} />);
  const ada = /^Ada_runs, new message/;
  expect(await screen.findByRole("button", { name: ada })).toBeOnTheScreen();

  // Away, and back: the list is asked for again, and stays while it comes.
  await fireEvent.press(screen.getByRole("button", { name: "Swipe" }));
  await fireEvent.press(screen.getByRole("button", { name: "Swipe" }));
  expect(asked.filter((each) => each === INBOX)).toHaveLength(2);
  expect(screen.queryByText("Loading…")).toBeNull();
  expect(screen.getByRole("button", { name: ada })).toBeOnTheScreen();

  // The new list takes its place.
  await act(async () =>
    pending[0](Response.json({ ...conversationsExample, conversations: [] })),
  );
  expect(await screen.findByText(/^No messages yet\. Open/)).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: ada })).toBeNull();
});

function Profile() {
  const [active, setActive] = useState(true);
  return (
    <ProfileLayer apiUrl={URL}>
      <Pressable onPress={() => setActive(!active)} accessibilityRole="button">
        <Text>Swipe</Text>
      </Pressable>
      <OwnProfile active={active} />
    </ProfileLayer>
  );
}

test("«Profile» is built anew as it leaves the screen, not as a swipe lands on it", async () => {
  await render(<Profile />);
  expect(screen.getByText("built 1")).toBeOnTheScreen();
  // To another tab: built anew there and then, out of sight.
  await fireEvent.press(screen.getByRole("button", { name: "Swipe" }));
  expect(screen.getByText("built 2")).toBeOnTheScreen();
  // Back: as it was left, nothing built while it lands.
  await fireEvent.press(screen.getByRole("button", { name: "Swipe" }));
  expect(screen.getByText("built 2")).toBeOnTheScreen();
});

test("«Profile» is built anew when what it opened over the app closes", async () => {
  await render(<Profile />);
  expect(screen.getByText("built 1")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
  // Under the page over the app, as it was.
  expect(
    screen.getByText("built 1", { includeHiddenElements: true }),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByText("built 2")).toBeOnTheScreen();
});
