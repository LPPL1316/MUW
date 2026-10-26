import comments from "@shaperoute/shared-types/fixtures/comments.json";
import closed from "@shaperoute/shared-types/fixtures/contest-closed.json";
import open from "@shaperoute/shared-types/fixtures/contest.json";
import drawing from "@shaperoute/shared-types/fixtures/drawing.json";
import result from "@shaperoute/shared-types/fixtures/reaction-result.json";
import reactions from "@shaperoute/shared-types/fixtures/reactions.json";
import type {
  CommentsPage,
  Contest,
  DrawingDetail,
  ReactionResult,
  ReactionsSummary,
} from "@shaperoute/shared-types";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { forgetContest, setContest } from "../contest/contestKept";
import { CommentsContext, type CommentsDoor } from "./commentsDoor";
import { DrawingCard } from "./DrawingCard";
import { drawingDoubleTapped } from "./DrawingReactions";
import { ReactionsContext, type ReactionsDoor } from "./reactionsDoor";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

const DRAWING = drawing as DrawingDetail;
const PAGE = comments as CommentsPage;

afterEach(() => {
  forgetContest();
});

test("a super like goes with a comment: the comments count it at once", async () => {
  const pages = [PAGE, { ...PAGE, total: PAGE.total + 1 }];
  const commentsDoor: CommentsDoor = {
    pageOf: jest.fn(async () => ({ kind: "ok", value: pages.shift()! }) as const),
    write: jest.fn(async () => null),
    remove: jest.fn(async () => null),
    photoOf: jest.fn(async () => null),
  };
  const reactionsDoor: ReactionsDoor = {
    of: jest.fn(
      async () => ({ kind: "ok", value: reactions as ReactionsSummary }) as const,
    ),
    leave: jest.fn(
      async () => ({ kind: "ok", value: result as ReactionResult }) as const,
    ),
    remove: jest.fn(async () => null),
  };
  await render(
    <CommentsContext.Provider value={commentsDoor}>
      <ReactionsContext.Provider value={reactionsDoor}>
        <DrawingCard drawing={DRAWING} onBack={jest.fn()} />
      </ReactionsContext.Provider>
    </CommentsContext.Provider>,
  );
  // The reactions next to the comments' button, over «Back to the profile».
  expect(
    await screen.findByRole("button", { name: `${PAGE.total} comments` }),
  ).toBeTruthy();
  expect(
    await screen.findByRole("button", { name: "Your reaction: Fire" }),
  ).toBeTruthy();
  expect(commentsDoor.pageOf).toHaveBeenCalledTimes(1);

  await act(async () => drawingDoubleTapped());
  await fireEvent.changeText(screen.getByLabelText("Comment"), "What a heart!");
  await fireEvent.press(screen.getByRole("button", { name: "Send" }));

  await waitFor(() =>
    expect(reactionsDoor.leave).toHaveBeenCalledWith(
      DRAWING.id,
      "super_like",
      "What a heart!",
    ),
  );
  expect(
    await screen.findByRole("button", { name: `${PAGE.total + 1} comments` }),
  ).toBeTruthy();
  expect(commentsDoor.pageOf).toHaveBeenCalledTimes(2);
});

test("the drawing that won the contest kept on the phone has the «Winner» band", async () => {
  const winner = closed as Contest;
  expect(winner.winner?.drawing?.id).toBe(DRAWING.id);
  await act(async () => setContest({ account: null, contest: winner }));
  await render(<DrawingCard drawing={DRAWING} onBack={jest.fn()} />);
  expect(screen.getByTestId("winner-band")).toHaveTextContent("🏆Winner");

  // Another drawing has none.
  await render(
    <DrawingCard drawing={{ ...DRAWING, id: "another" }} onBack={jest.fn()} />,
  );
  expect(screen.queryByTestId("winner-band")).toBeNull();
});

test("while the contest runs, or without one, no drawing has the band", async () => {
  await act(async () => setContest({ account: null, contest: open as Contest }));
  await render(<DrawingCard drawing={DRAWING} onBack={jest.fn()} />);
  expect(screen.queryByTestId("winner-band")).toBeNull();
  await act(async () => forgetContest());
  expect(screen.queryByTestId("winner-band")).toBeNull();
});
