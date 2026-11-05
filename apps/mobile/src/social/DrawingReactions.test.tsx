import result from "@shaperoute/shared-types/fixtures/reaction-result.json";
import reactions from "@shaperoute/shared-types/fixtures/reactions.json";
import type { ReactionResult, ReactionsSummary } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, Text } from "react-native";

import type { AccountOutcome } from "../api/accounts";
import { drawingDoubleTapped, DrawingReactions } from "./DrawingReactions";
import { ReactionsContext, type ReactionsDoor } from "./reactionsDoor";
import { withMine } from "./reactionKinds";
import { HEART_ALONE_MS } from "./SuperLikeSheet";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

const DRAWING = "3f9d2c71-8a4b-4e06-b5d1-c27e9a40f815";
/** fire 3, super_like 2, clap 1, wow 1; mine: fire. */
const SUMMARY = reactions as ReactionsSummary;
const WITHOUT_MINE = withMine(SUMMARY, null);
const SUPER_LIKED = result as ReactionResult;
const NOT_FOUND = {
  kind: "api_error",
  code: "http_error",
  message: "Not Found",
  suggested_distance_m: null,
  reason: null,
  retryAfterS: null,
} as const;
const OFFLINE = { kind: "unreachable", url: "http://api" } as const;

function ok<T>(value: T): AccountOutcome<T> {
  return { kind: "ok", value };
}

function left(summary: ReactionsSummary): AccountOutcome<ReactionResult> {
  return ok({ reactions: summary, comment: null });
}

/** A door that reads `read`, and answers each change with the next of its list. */
function door(
  read: AccountOutcome<ReactionsSummary> | null,
  leaves: (AccountOutcome<ReactionResult> | null)[] = [],
  removes: (AccountOutcome<ReactionsSummary> | null)[] = [],
) {
  const value: ReactionsDoor = {
    of: jest.fn(async () => read),
    leave: jest.fn(async () => leaves.shift() ?? null),
    remove: jest.fn(async () => removes.shift() ?? null),
  };
  return value;
}

const onSuperLiked = jest.fn();

async function show(value: ReactionsDoor) {
  await render(
    <ReactionsContext.Provider value={value}>
      <DrawingReactions
        drawingId={DRAWING}
        onSuperLiked={onSuperLiked}
        beside={<Text>4 comments</Text>}
      />
    </ReactionsContext.Provider>,
  );
}

/** Shown and read: the button of one's own reaction is there. */
async function shown(value: ReactionsDoor, label: string) {
  await show(value);
  return screen.findByRole("button", { name: label });
}

async function openBar(label: string) {
  await fireEvent.press(screen.getByRole("button", { name: label }));
}

const choice = (name: string) => screen.getByRole("button", { name });

beforeEach(() => {
  onSuperLiked.mockClear();
});

test("nobody signed in, or an API without reactions: only what is beside", async () => {
  const signedOut = door(null);
  await show(signedOut);
  await waitFor(() => expect(signedOut.of).toHaveBeenCalledWith(DRAWING));
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByText("4 comments")).toBeTruthy();

  const before = door(NOT_FOUND);
  await show(before);
  await waitFor(() => expect(before.of).toHaveBeenCalled());
  expect(screen.queryByRole("button")).toBeNull();
});

test("one's own reaction, the three most used and how many, next to the comments", async () => {
  await shown(door(ok(SUMMARY)), "Your reaction: Fire");
  const summary = screen.getByTestId("reactions-summary");
  expect(summary).toHaveProp("accessibilityLabel", "7 reactions");
  expect(screen.getByText("7")).toBeTruthy();
  // fire, the MuW heart, clap: wow is as used as clap, and comes after.
  expect(screen.getAllByTestId("mark-fire")).toHaveLength(2);
  // Only a picture to a screen reader, which hears the count.
  expect(
    screen.getByTestId("heart-badge", { includeHiddenElements: true }),
  ).toBeTruthy();
  expect(screen.getByTestId("mark-clap")).toBeTruthy();
  expect(screen.queryByTestId("mark-wow")).toBeNull();
  expect(screen.getByText("4 comments")).toBeTruthy();
});

test("without reactions: a face to leave the first, and no count", async () => {
  const empty: ReactionsSummary = {
    counts: { super_like: 0, fire: 0, clap: 0, strong: 0, laugh: 0, wow: 0 },
    total: 0,
    mine: null,
  };
  await shown(door(ok(empty)), "React");
  expect(screen.queryByTestId("reactions-summary")).toBeNull();
});

test("the button opens the bar of the six, one's own marked", async () => {
  await shown(door(ok(SUMMARY)), "Your reaction: Fire");
  expect(screen.queryByRole("button", { name: "Clap" })).toBeNull();
  await openBar("Your reaction: Fire");
  for (const name of [
    "MuW heart, super like",
    "Fire",
    "Clap",
    "Strong",
    "Laugh",
    "Wow",
  ]) {
    expect(choice(name)).toBeTruthy();
  }
  expect(choice("Fire")).toBeSelected();
  expect(choice("Clap")).not.toBeSelected();
  // The button again closes it.
  await openBar("Your reaction: Fire");
  expect(screen.queryByRole("button", { name: "Clap" })).toBeNull();
});

test("an emoji chosen shows at once, before the API answers", async () => {
  let answer: (outcome: AccountOutcome<ReactionResult>) => void = () => {};
  const value = door(ok(SUMMARY));
  value.leave = jest.fn(
    () =>
      new Promise<AccountOutcome<ReactionResult>>((resolve) => {
        answer = resolve;
      }),
  );
  await shown(value, "Your reaction: Fire");
  await openBar("Your reaction: Fire");
  await fireEvent.press(choice("Clap"));

  expect(value.leave).toHaveBeenCalledWith(DRAWING, "clap", null);
  expect(screen.getByRole("button", { name: "Your reaction: Clap" })).toBeTruthy();
  // The bar closes, and the count stays: one for one.
  expect(screen.queryByRole("button", { name: "Wow" })).toBeNull();
  expect(screen.getByText("7")).toBeTruthy();

  // What the API counts is what stays: somebody else reacted meanwhile.
  const counted = withMine(SUMMARY, "clap");
  await act(async () => answer(left({ ...counted, total: 8 })));
  expect(screen.getByText("8")).toBeTruthy();
});

test("one's own chosen again takes it away", async () => {
  const value = door(ok(SUMMARY), [], [ok(WITHOUT_MINE)]);
  await shown(value, "Your reaction: Fire");
  await openBar("Your reaction: Fire");
  await fireEvent.press(choice("Fire"));
  expect(value.remove).toHaveBeenCalledWith(DRAWING);
  expect(value.leave).not.toHaveBeenCalled();
  expect(await screen.findByRole("button", { name: "React" })).toBeTruthy();
  expect(screen.getByText("6")).toBeTruthy();
});

test("without a connection the reaction comes back as it was, with a notice", async () => {
  const value = door(ok(SUMMARY), [OFFLINE], [OFFLINE]);
  await shown(value, "Your reaction: Fire");
  await openBar("Your reaction: Fire");
  await fireEvent.press(choice("Wow"));
  expect(
    await screen.findByText("Your reaction wasn't saved. Check the connection."),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Your reaction: Fire" })).toBeTruthy();
  expect(screen.getByText("7")).toBeTruthy();

  // Taking it away, the same.
  await openBar("Your reaction: Fire");
  await fireEvent.press(choice("Fire"));
  await waitFor(() => expect(value.remove).toHaveBeenCalled());
  expect(
    await screen.findByText("Your reaction wasn't saved. Check the connection."),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Your reaction: Fire" })).toBeTruthy();
});

test("the next try forgets the notice of the last", async () => {
  const value = door(ok(SUMMARY), [OFFLINE, left(withMine(SUMMARY, "wow"))]);
  await shown(value, "Your reaction: Fire");
  await openBar("Your reaction: Fire");
  await fireEvent.press(choice("Wow"));
  await screen.findByText("Your reaction wasn't saved. Check the connection.");
  await openBar("Your reaction: Fire");
  await fireEvent.press(choice("Wow"));
  expect(
    await screen.findByRole("button", { name: "Your reaction: Wow" }),
  ).toBeTruthy();
  expect(screen.queryByText(/wasn't saved/)).toBeNull();
});

describe("the super like", () => {
  const HEART = "MuW heart, super like";

  async function write(text: string) {
    await fireEvent.changeText(screen.getByLabelText("Comment"), text);
    await fireEvent.press(screen.getByRole("button", { name: "Send" }));
  }

  test("the heart in the bar asks for its comment, and counts with it", async () => {
    const value = door(ok(SUMMARY), [ok(SUPER_LIKED)]);
    await shown(value, "Your reaction: Fire");
    await openBar("Your reaction: Fire");
    await fireEvent.press(choice(HEART));

    // Nothing left yet: the field, and the heart over the drawing.
    expect(value.leave).not.toHaveBeenCalled();
    expect(screen.getByRole("header", { name: "Super like" })).toBeTruthy();
    expect(screen.getByTestId("super-like-heart")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Your reaction: Fire" })).toBeTruthy();

    await write("What a heart!");
    expect(value.leave).toHaveBeenCalledWith(DRAWING, "super_like", "What a heart!");
    expect(
      await screen.findByRole("button", { name: `Your reaction: ${HEART}` }),
    ).toBeTruthy();
    // The sheet goes down on its spring, then it is gone (TASK-388 C).
    await waitFor(() =>
      expect(screen.queryByRole("header", { name: "Super like" })).toBeNull(),
    );
    expect(onSuperLiked).toHaveBeenCalledTimes(1);
  });

  test("«Cancel» leaves nothing", async () => {
    const value = door(ok(SUMMARY));
    await shown(value, "Your reaction: Fire");
    await openBar("Your reaction: Fire");
    await fireEvent.press(choice(HEART));
    await fireEvent.changeText(screen.getByLabelText("Comment"), "Almost");
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("header", { name: "Super like" })).toBeNull(),
    );
    expect(value.leave).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Your reaction: Fire" })).toBeTruthy();
    expect(onSuperLiked).not.toHaveBeenCalled();
  });

  test("a double tap on the drawing asks for it too", async () => {
    const value = door(ok(WITHOUT_MINE), [ok(SUPER_LIKED)]);
    await shown(value, "React");
    await act(async () => drawingDoubleTapped());
    expect(screen.getByRole("header", { name: "Super like" })).toBeTruthy();
    expect(screen.getByTestId("super-like-heart")).toBeTruthy();
    // A second double tap while writing changes nothing.
    await act(async () => drawingDoubleTapped());
    await write("ok");
    expect(value.leave).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole("button", { name: `Your reaction: ${HEART}` }),
    ).toBeTruthy();
  });

  test("a negative comment: the alert, and neither the heart nor the words", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const value = door(ok(SUMMARY), [
      { ...NOT_FOUND, code: "comment_rejected", reason: "negative" },
    ]);
    await shown(value, "Your reaction: Fire");
    await act(async () => drawingDoubleTapped());
    await write("You run badly");
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        "You can't write negative comments in this app. Try another app.",
      ),
    );
    // The sheet stays, with the words to change.
    expect(screen.getByLabelText("Comment")).toHaveProp("value", "You run badly");
    expect(screen.getByRole("button", { name: "Your reaction: Fire" })).toBeTruthy();
    expect(onSuperLiked).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  test("without a connection it does not count, and the sheet says why", async () => {
    const value = door(ok(SUMMARY), [OFFLINE]);
    await shown(value, "Your reaction: Fire");
    await act(async () => drawingDoubleTapped());
    await write("See you Sunday");
    expect(
      await screen.findByText("No connection. Try again when you are online."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Your reaction: Fire" })).toBeTruthy();
    expect(onSuperLiked).not.toHaveBeenCalled();
  });

  test("one's own heart in the bar takes it away, without asking for words", async () => {
    const mine = withMine(SUMMARY, "super_like");
    const value = door(ok(mine), [], [ok(WITHOUT_MINE)]);
    await shown(value, `Your reaction: ${HEART}`);
    await openBar(`Your reaction: ${HEART}`);
    await fireEvent.press(choice(HEART));
    expect(value.remove).toHaveBeenCalledWith(DRAWING);
    expect(screen.queryByRole("header", { name: "Super like" })).toBeNull();
    expect(await screen.findByRole("button", { name: "React" })).toBeTruthy();
  });

  describe("already left", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test("a double tap shows the heart again, and nothing else", async () => {
      const mine = withMine(SUMMARY, "super_like");
      const value = door(ok(mine));
      await shown(value, `Your reaction: ${HEART}`);
      await act(async () => drawingDoubleTapped());
      expect(screen.getByTestId("super-like-heart")).toBeTruthy();
      expect(screen.queryByRole("header", { name: "Super like" })).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(HEART_ALONE_MS);
      });
      expect(screen.queryByTestId("super-like-heart")).toBeNull();
      expect(value.leave).not.toHaveBeenCalled();
      expect(value.remove).not.toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: `Your reaction: ${HEART}` }),
      ).toBeTruthy();
    });
  });
});

test("a double tap with the card gone, or reactions off, does nothing", async () => {
  const value = door(null);
  const { unmount } = await render(
    <ReactionsContext.Provider value={value}>
      <DrawingReactions drawingId={DRAWING} />
    </ReactionsContext.Provider>,
  );
  await waitFor(() => expect(value.of).toHaveBeenCalled());
  await act(async () => drawingDoubleTapped());
  expect(screen.queryByTestId("super-like-heart")).toBeNull();
  await unmount();
  expect(() => drawingDoubleTapped()).not.toThrow();
});
