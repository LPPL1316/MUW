import comments from "@shaperoute/shared-types/fixtures/comments.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { Comment, CommentsPage, Session } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Alert, type AlertButton } from "react-native";

import type { AccountState } from "../account/useAccount";
import type { AccountOutcome } from "../api/accounts";
import { blockMember, report } from "../api/moderation";
import { forgetBlocked, useBlockedNow } from "./blockedNow";
import { CommentsContext, type CommentsDoor } from "./commentsDoor";
import { DrawingComments } from "./DrawingComments";
import { FollowsContext } from "./followsDoor";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../api/moderation", () => ({
  ...jest.requireActual("../api/moderation"),
  report: jest.fn(),
  blockMember: jest.fn(),
}));

const DRAWING = "3f9d2c71-8a4b-4e06-b5d1-c27e9a40f815";
const [FROM_OTHER, FROM_OWNER] = comments.comments as Comment[];
const OLDER: Comment = {
  ...FROM_OTHER,
  id: "older",
  text: "The third one, on the next page",
};

function page(
  list: Comment[],
  next: string | null = null,
): AccountOutcome<CommentsPage> {
  return { kind: "ok", value: { comments: list, next, total: list.length } };
}

/** A door whose pages are `pages`, in order, and whose writes answer `written`. */
function door(
  pages: AccountOutcome<CommentsPage>[],
  written: AccountOutcome<Comment>[] = [],
) {
  const value: CommentsDoor = {
    pageOf: jest.fn(async () => pages.shift() ?? null),
    write: jest.fn(async () => written.shift() ?? null),
    remove: jest.fn(async () => ({ kind: "ok", value: null }) as const),
    photoOf: jest.fn(async () => null),
  };
  return value;
}

async function show(value: CommentsDoor) {
  await render(
    <CommentsContext.Provider value={value}>
      <DrawingComments drawingId={DRAWING} />
    </CommentsContext.Provider>,
  );
}

async function opened(value: CommentsDoor, label: string) {
  await show(value);
  await fireEvent.press(await screen.findByRole("button", { name: label }));
}

test("nobody signed in, or an API without comments: no button", async () => {
  await show(door([]));
  await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
  await show(
    door([
      {
        kind: "api_error",
        code: "http_error",
        message: "Not Found",
        suggested_distance_m: null,
        retryAfterS: null,
      },
    ]),
  );
  await waitFor(() => expect(screen.queryByText("Comments")).toBeNull());
});

test("the button says how many; the sheet shows them, the oldest first", async () => {
  const value = door([
    { kind: "ok", value: { comments: [FROM_OTHER, FROM_OWNER], next: "c", total: 3 } },
    page([OLDER]),
  ]);
  await opened(value, "3 comments");
  expect(value.pageOf).toHaveBeenCalledWith(DRAWING, null);
  expect(screen.getByText(FROM_OTHER.text)).toBeOnTheScreen();
  expect(screen.getByText(FROM_OWNER.text)).toBeOnTheScreen();
  expect(screen.getAllByText(/other_runner/).length).toBeGreaterThan(0);
  expect(value.photoOf).toHaveBeenCalledWith(FROM_OTHER.author.public_id);
  await fireEvent.press(screen.getByRole("button", { name: "Show more comments" }));
  expect(await screen.findByText(OLDER.text)).toBeOnTheScreen();
  expect(value.pageOf).toHaveBeenLastCalledWith(DRAWING, "c");
  expect(screen.queryByRole("button", { name: "Show more comments" })).toBeNull();
});

test("no comments yet: an invitation to write the first", async () => {
  await opened(door([page([])]), "Write a comment");
  expect(screen.getByText("No comments yet. Be the first.")).toBeOnTheScreen();
});

test("a comment written goes at the end, and the field empties", async () => {
  const mine: Comment = { ...FROM_OTHER, id: "mine", text: "Great score!" };
  const value = door([page([FROM_OTHER])], [{ kind: "ok", value: mine }]);
  await opened(value, "1 comment");
  const post = screen.getByRole("button", { name: "Post" });
  // Nothing written, nothing to post.
  expect(post).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText("Comment"), "  Great score!  ");
  await fireEvent.press(screen.getByRole("button", { name: "Post" }));
  expect(value.write).toHaveBeenCalledWith(DRAWING, "  Great score!  ");
  expect(await screen.findByText("Great score!")).toBeOnTheScreen();
  expect(screen.getByLabelText("Comment").props.value).toBe("");
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));
  expect(screen.getByRole("button", { name: "2 comments" })).toBeOnTheScreen();
});

test("too long: the count turns, and «Post» waits", async () => {
  await opened(door([page([])]), "Write a comment");
  await fireEvent.changeText(screen.getByLabelText("Comment"), "x".repeat(460));
  expect(screen.getByText("460/500")).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText("Comment"), "x".repeat(501));
  expect(screen.getByText("501/500")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Post" })).toBeDisabled();
});

test("a comment the API refuses says why, and the words stay", async () => {
  const value = door(
    [page([])],
    [
      {
        kind: "api_error",
        code: "too_many_requests",
        message: "Too many comments in a minute: wait a moment and try again.",
        suggested_distance_m: null,
        retryAfterS: 40,
      },
    ],
  );
  await opened(value, "Write a comment");
  await fireEvent.changeText(screen.getByLabelText("Comment"), "One more");
  await fireEvent.press(screen.getByRole("button", { name: "Post" }));
  expect(
    await screen.findByText(
      "Too many comments in a minute. Wait a moment and try again.",
    ),
  ).toBeOnTheScreen();
  expect(screen.getByLabelText("Comment").props.value).toBe("One more");
});

test("a negative comment is refused with an alert, and the words stay", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const value = door(
    [page([])],
    [
      {
        kind: "api_error",
        code: "comment_rejected",
        message: "You can't write negative comments in this app. Try another app.",
        suggested_distance_m: null,
        reason: "negative",
        retryAfterS: null,
      },
    ],
  );
  await opened(value, "Write a comment");
  await fireEvent.changeText(screen.getByLabelText("Comment"), "What an ugly route");
  await fireEvent.press(screen.getByRole("button", { name: "Post" }));
  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith(
      "You can't write negative comments in this app. Try another app.",
    ),
  );
  expect(screen.getByLabelText("Comment").props.value).toBe("What an ugly route");
  expect(screen.getByText("No comments yet. Be the first.")).toBeOnTheScreen();
  alert.mockRestore();
});

test("a comment of one's own is held to delete it; another's is not", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const value = door([page([FROM_OTHER, FROM_OWNER])]);
  await opened(value, "2 comments");
  // FROM_OWNER is not deletable for who asks.
  await fireEvent(screen.getByText(FROM_OWNER.text), "longPress");
  expect(alert).not.toHaveBeenCalled();
  await fireEvent(screen.getByText(FROM_OTHER.text), "longPress");
  expect(alert).toHaveBeenCalledWith(
    "Delete this comment?",
    undefined,
    expect.any(Array),
  );
  const buttons = alert.mock.calls[0][2] ?? [];
  buttons.find((b) => b.text === "Delete")?.onPress?.();
  expect(value.remove).toHaveBeenCalledWith(FROM_OTHER.id);
  await waitFor(() => expect(screen.queryByText(FROM_OTHER.text)).toBeNull());
  alert.mockRestore();
});

test("a comment is plain text: a link or a tag is shown as written", async () => {
  const html: Comment = {
    ...FROM_OTHER,
    text: '<a href="https://example.com">look</a> & <b>bold</b>',
  };
  await opened(door([page([html])]), "1 comment");
  expect(screen.getByText(html.text)).toBeOnTheScreen();
});

// «Report» and «Block» on another's comment (TASK-275, ADR-0228). The
// session is Ada_runs's, the author of FROM_OWNER; other_runner wrote
// FROM_OTHER, which Ada may delete (her drawing).
const URL = "http://api";
const ME = session as Session;
const signedIn: AccountState = { status: "signedIn", session: ME };
const OTHERS: Comment = { ...FROM_OTHER, id: "others", deletable: false };
const MINE: Comment = { ...FROM_OWNER, deletable: true };
const OK = { kind: "ok", value: null } as const;

async function openedSignedIn(
  value: CommentsDoor,
  label: string,
  {
    sessionEnded = jest.fn(),
    beside = null,
  }: { sessionEnded?: () => void; beside?: ReactNode } = {},
) {
  await render(
    <FollowsContext.Provider
      value={{
        apiUrl: URL,
        account: { state: signedIn, sessionEnded },
        openProfile: jest.fn(),
      }}
    >
      <CommentsContext.Provider value={value}>
        <DrawingComments drawingId={DRAWING} />
        {beside}
      </CommentsContext.Provider>
    </FollowsContext.Provider>,
  );
  await fireEvent.press(await screen.findByRole("button", { name: label }));
}

/** The alerts shown, and a way to tap a button of the last one titled so. */
function alerts() {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const titled = (title: string) =>
    alert.mock.calls.filter(([shown]) => shown === title).at(-1);
  return {
    alert,
    buttons: (title: string) =>
      ((titled(title)?.[2] ?? []) as AlertButton[]).map((button) => button.text),
    tap: async (title: string, text: string) => {
      const button = ((titled(title)?.[2] ?? []) as AlertButton[]).find(
        (shown) => shown.text === text,
      );
      await act(async () => button?.onPress?.());
    },
  };
}

beforeEach(() => {
  forgetBlocked();
  jest.mocked(report).mockReset();
  jest.mocked(blockMember).mockReset();
});

test("another's comment is held to report it: the reasons, then thanks", async () => {
  const { alert, buttons, tap } = alerts();
  jest.mocked(report).mockResolvedValue(OK);
  await openedSignedIn(door([page([OTHERS])]), "1 comment");
  await fireEvent(screen.getByText(OTHERS.text), "longPress");
  expect(buttons("Report or block")).toEqual([
    "Report",
    "Block other_runner",
    "Cancel",
  ]);
  await tap("Report or block", "Report");
  expect(buttons("Why are you reporting this?")).toEqual([
    "Spam",
    "Offensive or hateful",
    "Harassment or bullying",
    "Nudity or sexual content",
    "Something else",
    "Cancel",
  ]);
  await tap("Why are you reporting this?", "Offensive or hateful");
  expect(report).toHaveBeenCalledWith(URL, ME.token, "comment", OTHERS.id, "offensive");
  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith("Thanks for telling us. We will look at it."),
  );
  // Reported, the comment stays: whoever runs the app looks at it.
  expect(screen.getByText(OTHERS.text)).toBeOnTheScreen();
  alert.mockRestore();
});

test("another's comment is held to block its author: asked first, then gone", async () => {
  const { alert, buttons, tap } = alerts();
  jest.mocked(blockMember).mockResolvedValue(OK);
  const value = door([page([OTHERS, MINE]), page([MINE])]);
  let blocked = false;
  function Watch() {
    blocked = useBlockedNow(OTHERS.author.public_id);
    return null;
  }
  await openedSignedIn(value, "2 comments", { beside: <Watch /> });
  await fireEvent(screen.getByText(OTHERS.text), "longPress");
  await tap("Report or block", "Block other_runner");
  expect(buttons("Block other_runner?")).toEqual(["Cancel", "Block"]);
  expect(alert).toHaveBeenCalledWith(
    "Block other_runner?",
    "You will not see each other's drawings, comments or profile, and any follow between you ends. They are not told.",
    expect.any(Array),
  );
  expect(blockMember).not.toHaveBeenCalled();
  await tap("Block other_runner?", "Block");
  expect(blockMember).toHaveBeenCalledWith(URL, ME.token, OTHERS.author.public_id);
  // The page is asked again, without them, and «Feed» drops their cards.
  await waitFor(() => expect(screen.queryByText(OTHERS.text)).toBeNull());
  expect(value.pageOf).toHaveBeenCalledTimes(2);
  expect(screen.getByText(MINE.text)).toBeOnTheScreen();
  expect(blocked).toBe(true);
  alert.mockRestore();
});

test("under one's own drawing «Delete» is there too; one's own comment is only deleted", async () => {
  const { alert, buttons, tap } = alerts();
  const value = door([page([FROM_OTHER, MINE])]);
  await openedSignedIn(value, "2 comments");
  await fireEvent(screen.getByText(FROM_OTHER.text), "longPress");
  expect(buttons("Report or block")).toEqual([
    "Report",
    "Block other_runner",
    "Delete",
    "Cancel",
  ]);
  await tap("Report or block", "Delete");
  await tap("Delete this comment?", "Delete");
  expect(value.remove).toHaveBeenCalledWith(FROM_OTHER.id);
  await waitFor(() => expect(screen.queryByText(FROM_OTHER.text)).toBeNull());
  alert.mockClear();
  await fireEvent(screen.getByText(MINE.text), "longPress");
  expect(alert).toHaveBeenCalledTimes(1);
  expect(buttons("Delete this comment?")).toEqual(["Cancel", "Delete"]);
  expect(report).not.toHaveBeenCalled();
  alert.mockRestore();
});

test("VoiceOver offers the same choices as actions", async () => {
  const { alert, buttons } = alerts();
  await openedSignedIn(door([page([OTHERS, MINE])]), "2 comments");
  const others = screen.getByLabelText(/^other_runner, /);
  expect(others.props.accessibilityHint).toBe("Report or block");
  expect(
    others.props.accessibilityActions.map((a: { name: string }) => a.name),
  ).toEqual(["report", "block"]);
  await fireEvent(others, "accessibilityAction", {
    nativeEvent: { actionName: "report" },
  });
  expect(buttons("Why are you reporting this?")).toHaveLength(6);
  const mine = screen.getByLabelText(/^Ada_runs, /);
  expect(mine.props.accessibilityHint).toBe("Touch and hold to delete.");
  expect(mine.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual([
    "delete",
  ]);
  alert.mockRestore();
});

test("a report or a block that fails says why, and an ended session ends", async () => {
  const { alert, tap } = alerts();
  const sessionEnded = jest.fn();
  jest.mocked(report).mockResolvedValue({
    kind: "api_error",
    code: "session_expired",
    message: "Your session has ended. Log in again.",
    suggested_distance_m: null,
    retryAfterS: null,
  });
  jest.mocked(blockMember).mockResolvedValue({ kind: "unreachable", url: URL });
  await openedSignedIn(door([page([OTHERS])]), "1 comment", { sessionEnded });
  await fireEvent(screen.getByText(OTHERS.text), "longPress");
  await tap("Report or block", "Report");
  await tap("Why are you reporting this?", "Spam");
  await waitFor(() => expect(sessionEnded).toHaveBeenCalledWith(ME.token));
  expect(alert).not.toHaveBeenCalledWith("Thanks for telling us. We will look at it.");
  await fireEvent(screen.getByText(OTHERS.text), "longPress");
  await tap("Report or block", "Block other_runner");
  await tap("Block other_runner?", "Block");
  await waitFor(() =>
    expect(alert).toHaveBeenLastCalledWith(
      expect.stringContaining("No connection. Check the network and try again."),
    ),
  );
  expect(screen.getByText(OTHERS.text)).toBeOnTheScreen();
  alert.mockRestore();
});

test("comments that did not come can be asked again", async () => {
  const value = door([{ kind: "unreachable", url: "http://api" }, page([FROM_OTHER])]);
  await opened(value, "Comments");
  expect(
    screen.getByText("No connection. Try again when you are online."),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText(FROM_OTHER.text)).toBeOnTheScreen();
});
