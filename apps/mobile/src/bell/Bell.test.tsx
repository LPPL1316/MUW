import example from "@shaperoute/shared-types/fixtures/notifications.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type {
  NotificationLine,
  NotificationsPage,
  Session,
} from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import type { AccountState } from "../account/useAccount";
import type { Opens } from "../notifications/openTarget";
import { BellButton } from "./BellButton";
import { BellContext, useBellOf } from "./bellDoor";
import { BellOverlay } from "./BellOverlay";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

// The bell of the header (TASK-367 part C, ADR-0311): its number, the list
// over the app, what a line opens, and a server without the list.

const URL = "http://api";
const signedIn: AccountState = { status: "signedIn", session: session as Session };
const signedOut: AccountState = { status: "signedOut", notice: null };
// As «Profile» hands them: the same objects from one render to the next.
const account = { state: signedIn, sessionEnded: jest.fn() };
const outAccount = { state: signedOut, sessionEnded: jest.fn() };
const page = example as NotificationsPage;
const [comment, request] = page.notifications;
// A group run's line: its push opens nothing, nor does the line.
const groupRun: NotificationLine = {
  ...request,
  id: 40,
  kind: "group_run_soon",
  text: "Morning loop starts in an hour.",
  read: true,
  opens: {
    kind: "group_run_soon",
    group_run_id: "5b0c6a1e-3d2f-4e8a-9b7c-1d2e3f4a5b6c",
  },
};

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
const notFound = json({ error: { code: "http_error", message: "Not Found" } }, 404);

function opensSpy(): jest.Mocked<Opens> {
  return {
    openDrawing: jest.fn(),
    openProfile: jest.fn(),
    openPlay: jest.fn(),
    openChallenge: jest.fn(),
    openConversation: jest.fn(),
    openContest: jest.fn(),
  };
}

function Harness({
  fetchFn,
  opens,
  state = signedIn,
  everyMs = 3_600_000,
}: {
  fetchFn: jest.Mock;
  opens: Opens;
  state?: AccountState;
  everyMs?: number;
}) {
  const door = useBellOf(URL, state === signedIn ? account : outAccount, {
    fetchFn,
    key: null,
    everyMs,
  });
  return (
    <BellContext.Provider value={door}>
      <BellButton />
      <BellOverlay opens={opens} fetchFn={fetchFn} apiKey={null} />
    </BellContext.Provider>
  );
}

test("the bell shows the unread lines, and opening the list reads them", async () => {
  const { fetchFn, asked, calls } = api({
    "GET /notifications": json(page),
    "POST /notifications/read": done,
  });
  await render(<Harness fetchFn={fetchFn} opens={opensSpy()} />);

  const bell = await screen.findByTestId("bell");
  expect(bell).toHaveProp("accessibilityLabel", "Notifications, 1 new");
  expect(screen.getByTestId("bell-count")).toHaveTextContent("1");

  await fireEvent.press(bell);
  expect(await screen.findByText(/commented on your post/)).toBeOnTheScreen();
  expect(screen.getByText(/asked to follow you/)).toBeOnTheScreen();
  // The new line is marked; read up to the newest one shown.
  expect(screen.getAllByTestId("bell-line-unread")).toHaveLength(1);
  expect(asked.at(-1)).toEqual({
    call: "POST /notifications/read",
    body: { up_to: 42 },
  });
  expect(screen.queryByTestId("bell-count")).toBeNull();
  expect(calls()).toEqual([
    "GET /notifications",
    "GET /notifications",
    "POST /notifications/read",
  ]);
});

test("a line opens what its push opens, and the list closes", async () => {
  const { fetchFn } = api({
    "GET /notifications": json({
      ...page,
      notifications: [comment, request, groupRun],
    }),
    "POST /notifications/read": done,
  });
  const opens = opensSpy();
  await render(<Harness fetchFn={fetchFn} opens={opens} />);
  await fireEvent.press(await screen.findByTestId("bell"));

  // A group run's line opens nothing, as its push.
  const run = await screen.findByTestId("bell-line-40");
  expect(run).toBeDisabled();

  await fireEvent.press(screen.getByTestId("bell-line-42"));
  expect(opens.openDrawing).toHaveBeenCalledWith(
    "1c9d3b2a-5e4f-4a6b-8c7d-9e0f1a2b3c4d",
  );
  expect(screen.queryByTestId("bell-list")).toBeNull();

  await fireEvent.press(screen.getByTestId("bell"));
  await fireEvent.press(await screen.findByTestId("bell-line-41"));
  expect(opens.openProfile).toHaveBeenCalledWith(
    expect.objectContaining({ username: "third_runner" }),
  );
});

test("the next page comes with «Show more»", async () => {
  const { fetchFn, calls } = api({
    "GET /notifications": json({ ...page, notifications: [comment], before: 42 }),
    "GET /notifications?before=42": json({
      ...page,
      notifications: [request],
      unread: 0,
    }),
    "POST /notifications/read": done,
  });
  await render(<Harness fetchFn={fetchFn} opens={opensSpy()} />);
  await fireEvent.press(await screen.findByTestId("bell"));
  await fireEvent.press(await screen.findByText("Show more"));
  expect(await screen.findByText(/asked to follow you/)).toBeOnTheScreen();
  expect(screen.queryByText("Show more")).toBeNull();
  expect(calls()).toContain("GET /notifications?before=42");
});

test("an empty list says what will come, and «←» closes it", async () => {
  const { fetchFn } = api({
    "GET /notifications": json({ notifications: [], unread: 0, before: null }),
  });
  await render(<Harness fetchFn={fetchFn} opens={opensSpy()} />);
  const bell = await screen.findByTestId("bell");
  expect(bell).toHaveProp("accessibilityLabel", "Notifications");
  expect(screen.queryByTestId("bell-count")).toBeNull();
  await fireEvent.press(bell);
  expect(await screen.findByText(/No notifications yet/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.queryByTestId("bell-list")).toBeNull();
});

test("a server without the list: no bell, no error, asked once", async () => {
  jest.useFakeTimers();
  try {
    const { fetchFn, calls } = api({ "GET /notifications": notFound });
    await render(<Harness fetchFn={fetchFn} opens={opensSpy()} everyMs={1_000} />);
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });
    expect(screen.queryByTestId("bell")).toBeNull();
    expect(screen.queryByText(/wrong|connection/i)).toBeNull();
    expect(calls()).toEqual(["GET /notifications"]);
  } finally {
    jest.useRealTimers();
  }
});

test("without an account there is no bell and nothing is asked", async () => {
  const { fetchFn } = api({});
  await render(<Harness fetchFn={fetchFn} opens={opensSpy()} state={signedOut} />);
  expect(screen.queryByTestId("bell")).toBeNull();
  expect(fetchFn).not.toHaveBeenCalled();
});

test("the number is asked again on time, and kept when an answer fails", async () => {
  jest.useFakeTimers();
  try {
    let answer = json(page);
    const { fetchFn, calls } = api({ "GET /notifications": () => answer() });
    await render(<Harness fetchFn={fetchFn} opens={opensSpy()} everyMs={1_000} />);
    await act(async () => {});
    expect(screen.getByTestId("bell-count")).toHaveTextContent("1");
    answer = json({ error: { code: "internal", message: "x" } }, 500);
    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
    expect(calls()).toHaveLength(2);
    expect(screen.getByTestId("bell-count")).toHaveTextContent("1");
    answer = json({ ...page, unread: 3 });
    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
    expect(screen.getByTestId("bell-count")).toHaveTextContent("3");
  } finally {
    jest.useRealTimers();
  }
});
