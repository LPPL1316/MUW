import type { RouteResult, SwimTurn } from "@shaperoute/shared-types";
import swim from "@shaperoute/shared-types/fixtures/route-result-swimming.json";
import { act, render, screen } from "@testing-library/react-native";

import { saveLanguageChoice } from "../i18n/language";
import { saveUnitsChoice } from "../units/units";

import { firstLapTurns, lapsNote, turnAt, turnLabel } from "./swimTurns";
import { SwimTurns } from "./SwimTurns";

jest.mock("expo-file-system");

/** The heart of the contract, three laps, its turns opposite «Hotel
 * Miramare» (TASK-323 part B). */
const HEART = swim as unknown as RouteResult;

const BARE: SwimTurn = {
  point: [44, 12.65],
  at_m: 61,
  side: "right",
  angle_deg: 90,
  lap: 1,
  landmark: null,
};

afterEach(() => {
  saveLanguageChoice("phone");
  saveUnitsChoice("phone");
});

test("the turns to learn are the first lap's: every lap turns the same", () => {
  const turns = HEART.turns ?? [];
  expect(turns.map((turn) => turn.lap)).toEqual([1, 1, 1, 2, 2, 3, 3, 3]);
  expect(firstLapTurns(turns).map((turn) => turn.side)).toEqual([
    "left",
    "right",
    "left",
  ]);
  expect(firstLapTurns(undefined)).toEqual([]);
});

test("a turn is said as in the GPX, with the place on the shore when there is one", () => {
  const [first] = firstLapTurns(HEART.turns);
  expect(turnLabel(first!)).toBe("Turn left · Hotel Miramare");
  expect(turnLabel(BARE)).toBe("Turn right");
  expect(turnLabel({ ...BARE, side: "left" })).toBe("Turn left");
});

test("how far along the swim, in the app's units", () => {
  expect(turnAt(BARE, "km")).toBe("60 m from the start");
  expect(turnAt(BARE, "mi")).toBe("200 ft from the start");
  expect(turnAt({ ...BARE, at_m: 1520 }, "km")).toBe("1.5 km from the start");
});

test("more than one lap says the others are the same", () => {
  expect(lapsNote(3)).toBe("The same turns every lap, 3 laps, then back to the shore.");
  expect(lapsNote(1)).toBeNull();
  expect(lapsNote(undefined)).toBeNull();
});

test("the list before «Start»: the first lap's turns, each read whole", async () => {
  await render(<SwimTurns turns={HEART.turns} laps={HEART.laps} />);
  expect(screen.getByRole("header", { name: "TURNS" })).toBeOnTheScreen();
  expect(
    screen.getByText("The same turns every lap, 3 laps, then back to the shore."),
  ).toBeOnTheScreen();
  expect(screen.getAllByText("Turn left · Hotel Miramare")).toHaveLength(2);
  expect(screen.getAllByText("Turn right · Hotel Miramare")).toHaveLength(1);
  expect(
    screen.getByLabelText("Turn left · Hotel Miramare, 30 m from the start"),
  ).toBeOnTheScreen();
});

test("one lap, no note; no turns, like a circle, no list", async () => {
  await render(<SwimTurns turns={[BARE]} laps={1} />);
  expect(screen.getByText("Turn right")).toBeOnTheScreen();
  expect(screen.queryByText(/every lap/)).toBeNull();
  await render(<SwimTurns turns={[]} laps={2} />);
  expect(screen.queryByText("TURNS")).toBeNull();
  await render(<SwimTurns turns={undefined} laps={undefined} />);
  expect(screen.queryByText("TURNS")).toBeNull();
});

test("the list speaks Italian, the place's name as it is", async () => {
  await act(async () => saveLanguageChoice("it"));
  await render(<SwimTurns turns={HEART.turns} laps={HEART.laps} />);
  expect(screen.getByText("CURVE")).toBeOnTheScreen();
  expect(screen.getAllByText("Gira a sinistra · Hotel Miramare")).toHaveLength(2);
  expect(screen.getByText("Gira a destra · Hotel Miramare")).toBeOnTheScreen();
});
