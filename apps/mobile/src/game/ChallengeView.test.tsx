import catalog from "@shaperoute/shared-types/fixtures/game-catalog.json";
import challenge from "@shaperoute/shared-types/fixtures/game-challenge.json";
import team from "@shaperoute/shared-types/fixtures/game-team.json";
import type { GameCatalog, GameChallenge, GameTeam } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { saveLanguageChoice } from "../i18n/language";
import { ChallengeView, doneShare } from "./ChallengeView";
import { FREE_PIECE_COLOR, PERSON_COLORS } from "./personColors";

const GOING = challenge as GameChallenge;
const TEAM = team as GameTeam;
const HEXAGON = (catalog as GameCatalog).shapes.find(
  (shape) => shape.id === "hexagon",
)!;
const ME = TEAM.members[0].public_id;
const ADAM = TEAM.members[1].public_id;
/** Six days and three hours before the deadline. */
const NOW = () => Date.parse("2026-10-26T05:00:00Z");
const onHold = jest.fn();
const onRelease = jest.fn();

type Props = ComponentProps<typeof ChallengeView>;

async function shown(props: Partial<Props> = {}) {
  return render(
    <ChallengeView
      challenge={GOING}
      shape={HEXAGON}
      members={TEAM.members}
      me={ME}
      busy={false}
      problem={null}
      onHold={onHold}
      onRelease={onRelease}
      units="km"
      language="en"
      now={NOW}
      {...props}
    />,
  );
}

beforeEach(() => {
  onHold.mockReset();
  onRelease.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
  saveLanguageChoice("phone");
});

test("the pieces are drawn in the colour of who runs them, the rest in grey", async () => {
  await shown();
  // Piece 1, done by adam, the second member: his colour, nothing left.
  expect(screen.getAllByTestId("stroke-0-run")[0]).toHaveStyle({
    backgroundColor: PERSON_COLORS[1],
  });
  expect(screen.queryAllByTestId("stroke-0-left")).toHaveLength(0);
  // Piece 2, mine, half run: my colour so far, grey after.
  expect(screen.getAllByTestId("stroke-1-run")[0]).toHaveStyle({
    backgroundColor: PERSON_COLORS[0],
  });
  expect(screen.getAllByTestId("stroke-1-left")[0]).toHaveStyle({
    backgroundColor: FREE_PIECE_COLOR,
  });
  // Piece 3, free: grey only.
  expect(screen.queryAllByTestId("stroke-2-run")).toHaveLength(0);
  expect(screen.getAllByTestId("stroke-2-left").length).toBeGreaterThan(0);
});

test("the head says the shape, the pieces, how many are done and the time left", async () => {
  await shown();
  expect(screen.getByRole("header")).toHaveTextContent("Hexagon");
  expect(screen.getByText("3 pieces · 5 km in total each")).toBeOnTheScreen();
  expect(screen.getByTestId("challenge-progress")).toHaveTextContent(
    "1 of 3 pieces done",
  );
  expect(screen.getByTestId("challenge-time-left")).toHaveTextContent(
    "6 days 3 h left",
  );
});

test("who gave what, the most first, in the colours of the drawing", async () => {
  await shown();
  const rows = screen.getAllByTestId(/^gave-/);
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent(/adam\.trento.*5\.0 km/);
  expect(rows[1]).toHaveTextContent(/Runner_42.*2\.4 km/);
  expect(rows[0]).toHaveAccessibleName("adam.trento, 5.0 km");
});

test("the pieces: done, yours with «Leave», free with «Take this piece» for who holds none", async () => {
  await shown();
  expect(screen.getByTestId("piece-0")).toHaveTextContent(
    /Piece 1 · 5 km in total.*Done by adam\.trento/,
  );
  expect(screen.getByTestId("piece-1")).toHaveTextContent(
    /Piece 2.*Yours · 2\.4 \/ 5 km/,
  );
  expect(screen.getByTestId("piece-2")).toHaveTextContent(/Piece 3.*Free/);
  // I hold piece 2: the free one is not mine to take until I leave it.
  expect(screen.queryByTestId("take-2")).toBeNull();
  await fireEvent.press(screen.getByTestId("leave-1"));
  expect(onRelease).toHaveBeenCalledWith(1);
  expect(screen.getByTestId("piece-1")).toHaveAccessibleName(
    "Piece 2, 5 km in total, Yours · 2.4 / 5 km",
  );
});

test("holding none, the free piece can be taken; a taken one says whose it is", async () => {
  await shown({ me: ADAM });
  expect(screen.getByTestId("piece-1")).toHaveTextContent(
    /Taken by Runner_42 · 2\.4 \/ 5 km/,
  );
  expect(screen.queryByTestId("leave-1")).toBeNull();
  await fireEvent.press(screen.getByTestId("take-2"));
  expect(onHold).toHaveBeenCalledWith(2);
});

test("while a piece is on its way the buttons wait, and a refusal is said", async () => {
  await shown({ busy: true, problem: "Someone holds this piece already." });
  await fireEvent.press(screen.getByTestId("leave-1"));
  expect(onRelease).not.toHaveBeenCalled();
  expect(screen.getByTestId("challenge-problem")).toHaveTextContent(
    "Someone holds this piece already.",
  );
});

test("the countdown ticks each second under an hour", async () => {
  jest.useFakeTimers();
  let at = Date.parse("2026-11-01T07:30:00Z");
  await shown({ now: () => at });
  expect(screen.getByTestId("challenge-time-left")).toHaveTextContent(
    "30 min 0 s left",
  );
  at += 1000;
  await act(async () => jest.advanceTimersByTime(1000));
  expect(screen.getByTestId("challenge-time-left")).toHaveTextContent(
    "29 min 59 s left",
  );
});

test("complete, it says so with the day, and no piece can be taken or left", async () => {
  const done: GameChallenge = {
    ...GOING,
    status: "completed",
    completed_at: "2026-10-27T10:00:00Z",
    pieces: GOING.pieces.map((piece) => ({ ...piece, done: true, done_m: 5000 })),
  };
  await shown({ challenge: done });
  expect(screen.getByTestId("challenge-complete")).toHaveTextContent(
    /Complete! Your team drew it together\. .* 27 Oct 2026/,
  );
  expect(screen.queryByTestId("challenge-time-left")).toBeNull();
  expect(screen.queryAllByTestId(/^(take|leave)-/)).toHaveLength(0);
  expect(screen.getByTestId("challenge-progress")).toHaveTextContent(
    "3 of 3 pieces done",
  );
});

test("expired, it says how many pieces were missing", async () => {
  await shown({ challenge: { ...GOING, status: "expired", seconds_left: 0 } });
  expect(screen.getByTestId("challenge-expired")).toHaveTextContent(
    "Time ran out: 2 pieces were missing.",
  );
  expect(screen.queryAllByTestId(/^(take|leave)-/)).toHaveLength(0);
  const one: GameChallenge = {
    ...GOING,
    status: "expired",
    pieces: GOING.pieces.map((piece) =>
      piece.idx === 2 ? piece : { ...piece, done: true, done_m: 5000 },
    ),
  };
  await shown({ challenge: one });
  expect(screen.getByText("Time ran out: 1 piece was missing.")).toBeOnTheScreen();
});

test("in miles, and in Italian", async () => {
  await shown({ units: "mi" });
  expect(screen.getByTestId("piece-1")).toHaveTextContent(/Yours · 1\.5 \/ 3\.1 mi/);
  saveLanguageChoice("it");
  await shown({ language: "it" });
  expect(screen.getByRole("header")).toHaveTextContent("Esagono");
  expect(screen.getByTestId("piece-1")).toHaveTextContent(
    /Pezzo 2 · 5 km in totale.*Tuo · 2,4 \/ 5 km/,
  );
  expect(screen.getByTestId("challenge-time-left")).toHaveTextContent(
    "Mancano 6 giorni e 3 h",
  );
});

test("how far a piece is run: a fast piece is done or not", () => {
  expect(doneShare(GOING.pieces[0])).toBe(1);
  expect(doneShare(GOING.pieces[1])).toBeCloseTo(0.48);
  expect(doneShare(GOING.pieces[2])).toBe(0);
  expect(
    doneShare({
      ...GOING.pieces[2],
      goal: { kind: "pace", total_m: null, distance_m: 1000, pace_s: 300 },
      done_m: 1000,
    }),
  ).toBe(0);
});
