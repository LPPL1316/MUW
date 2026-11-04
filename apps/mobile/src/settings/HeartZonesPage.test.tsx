import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { TextInput } from "react-native";

import { NO_BODY, saveBody } from "../body/bodyProfile";
import { appHeart, NO_HEART, saveHeart } from "../body/heartZones";
import { color, fontSize } from "../theme/tokens";
import { HeartZonesPage } from "./HeartZonesPage";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

// The phone's documents folder, in memory, as in units.test.ts.
jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  class File {
    uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
    }
    get exists(): boolean {
      return files.has(this.uri);
    }
    create(): void {
      files.set(this.uri, "");
    }
    write(text: string): void {
      files.set(this.uri, text);
    }
    textSync(): string {
      return files.get(this.uri) ?? "";
    }
    delete(): void {
      files.delete(this.uri);
    }
  }
  return { File, Paths: { document: { uri: "file:///documents/" } }, files };
});

const YEAR = new Date().getFullYear();

afterEach(async () => {
  jest.restoreAllMocks();
  await act(async () => {
    saveBody(NO_BODY);
    saveHeart(NO_HEART);
  });
});

/** The page, for someone who is `age` this year (none: no year of birth). */
async function openPage(age: number | null = 40) {
  await act(async () => {
    saveBody({ ...NO_BODY, birthYear: age === null ? null : YEAR - age });
  });
  const onClose = jest.fn();
  await render(<HeartZonesPage visible onClose={onClose} />);
  return onClose;
}

async function type(label: string, text: string) {
  const input = screen.getByLabelText(label);
  await fireEvent.changeText(input, text);
  await fireEvent(input, "endEditing");
}

/** The box a heart rate is typed in, which holds «bpm» (TASK-386). */
function boxOf(label: string) {
  const box = screen.getByLabelText(label).parent;
  if (box === null) {
    throw new Error(`No box around «${label}»`);
  }
  return box;
}

/** «bpm» is in the frame around the field `label`, as big as its number;
 * the field itself has no frame. */
function expectBpmInBox(label: string) {
  const box = boxOf(label);
  expect(box).toHaveStyle({
    borderColor: color.border,
    backgroundColor: color.surface,
  });
  expect(screen.getByLabelText(label)).not.toHaveStyle({ borderColor: color.border });
  expect(within(box).getByText("bpm")).toHaveStyle({
    fontSize: fontSize.input,
    color: color.textMuted,
  });
}

const FIELDS = [
  "Max heart rate",
  "Resting heart rate",
  "Zone 1 Recovery",
  "Zone 2 Endurance",
  "Zone 3 Tempo",
  "Zone 4 Threshold",
];

/** The tops of zones 1 to 4, as their boxes show them. */
function tops(): string[] {
  return [
    "Zone 1 Recovery",
    "Zone 2 Endurance",
    "Zone 3 Tempo",
    "Zone 4 Threshold",
  ].map((name) => String(screen.getByLabelText(name).props.value));
}

test("without a year of birth nor a max, it says what to add", async () => {
  await openPage(null);
  expect(screen.getByRole("header", { name: "Heart rate zones" })).toBeOnTheScreen();
  expect(
    screen.getByText(
      "Add your year of birth or your max heart rate to see your zones.",
    ),
  ).toBeOnTheScreen();
  expect(screen.queryByText("Zone 1 Recovery")).toBeNull();
  expect(screen.getByLabelText("Max heart rate")).toHaveDisplayValue("");
});

test("from the age: Tanaka's max and five zones from 50 to 100%", async () => {
  const onClose = await openPage(40);
  expect(screen.getByLabelText("Max heart rate")).toHaveDisplayValue("180");
  expect(screen.getByText("Estimated from your age")).toBeOnTheScreen();
  expect(screen.getByText("90 –")).toBeOnTheScreen();
  expect(tops()).toEqual(["108", "126", "144", "162"]);
  expect(screen.getByText("Zone 5 Max")).toBeOnTheScreen();
  expect(screen.getByText("162 –")).toBeOnTheScreen();
  expect(screen.getByText("180")).toBeOnTheScreen();
  expect(screen.queryByText("Back to calculated zones")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(onClose).toHaveBeenCalled();
});

test("a max typed by hand is set by you; Clear goes back to the age", async () => {
  await openPage(40);
  await type("Max heart rate", "190");
  expect(screen.getByText("Set by you")).toBeOnTheScreen();
  expect(appHeart().maxBpm).toBe(190);
  expect(tops()).toEqual(["114", "133", "152", "171"]);
  await fireEvent.press(screen.getByRole("button", { name: "Clear, Max heart rate" }));
  expect(screen.getByLabelText("Max heart rate")).toHaveDisplayValue("180");
  expect(screen.getByText("Estimated from your age")).toBeOnTheScreen();
  expect(appHeart()).toEqual(NO_HEART);
});

test("with a resting heart rate the zones follow Karvonen", async () => {
  await openPage(40);
  await type("Resting heart rate", "60");
  expect(appHeart().restBpm).toBe(60);
  expect(screen.getByText("120 –")).toBeOnTheScreen();
  expect(tops()).toEqual(["132", "144", "156", "168"]);
});

test("a heart rate out of its limits says why and is not kept", async () => {
  await openPage(40);
  await type("Max heart rate", "250");
  expect(
    screen.getByText("Enter a heart rate between 100 and 230 bpm."),
  ).toBeOnTheScreen();
  expect(appHeart().maxBpm).toBeNull();
  await type("Resting heart rate", "20");
  expect(
    screen.getByText("Enter a heart rate between 30 and 120 bpm."),
  ).toBeOnTheScreen();
  expect(appHeart().restBpm).toBeNull();
  await type("Resting heart rate", "55");
  expect(screen.queryByText("Enter a heart rate between 30 and 120 bpm.")).toBeNull();
  expect(appHeart().restBpm).toBe(55);
});

test("the top of a zone moves the bottom of the next, until Back to calculated zones", async () => {
  await openPage(40);
  await type("Zone 2 Endurance", "130");
  expect(tops()).toEqual(["108", "130", "144", "162"]);
  expect(screen.getByText("130 –")).toBeOnTheScreen();
  // Past the next zone's top it stops a beat under it.
  await type("Zone 3 Tempo", "170");
  expect(tops()).toEqual(["108", "130", "161", "162"]);
  // It stays when the resting heart rate changes.
  await type("Resting heart rate", "60");
  expect(tops()).toEqual(["129", "130", "161", "168"]);
  await fireEvent.press(
    screen.getByRole("button", { name: "Back to calculated zones" }),
  );
  expect(tops()).toEqual(["132", "144", "156", "168"]);
  expect(appHeart()).toEqual({ ...NO_HEART, restBpm: 60 });
  expect(screen.queryByText("Back to calculated zones")).toBeNull();
});

test("a zone's top emptied is calculated again; one that does not read stays", async () => {
  await openPage(40);
  await type("Zone 1 Recovery", "110");
  expect(tops()[0]).toBe("110");
  await type("Zone 1 Recovery", "abc");
  expect(tops()[0]).toBe("110");
  await type("Zone 1 Recovery", "");
  expect(tops()[0]).toBe("108");
  expect(appHeart()).toEqual(NO_HEART);
});

test("bpm sits inside the box of every heart rate, as big as the number", async () => {
  await openPage(40);
  for (const label of FIELDS) {
    expectBpmInBox(label);
  }
  // Zone 5's top is not typed: «bpm» stays beside its number.
  const top = screen.getByText("180").parent;
  expect(top).not.toBeNull();
  expect(within(top!).getByText("bpm")).toHaveStyle({ fontSize: fontSize.input });
  // No «bpm» anywhere else.
  expect(screen.getAllByText("bpm")).toHaveLength(FIELDS.length + 1);
});

test("empty, the boxes already say bpm", async () => {
  await openPage(null);
  for (const label of ["Max heart rate", "Resting heart rate"]) {
    expect(screen.getByLabelText(label)).toHaveDisplayValue("");
    expectBpmInBox(label);
  }
  expect(screen.getAllByText("bpm")).toHaveLength(2);
});

test("a tap on bpm types in its box", async () => {
  const focus = jest.spyOn(
    (TextInput as unknown as { prototype: { focus: () => void } }).prototype,
    "focus",
  );
  await openPage(40);
  await fireEvent.press(within(boxOf("Resting heart rate")).getByText("bpm"));
  expect(focus).toHaveBeenCalledTimes(1);
  await fireEvent.press(within(boxOf("Zone 3 Tempo")).getByText("bpm"));
  expect(focus).toHaveBeenCalledTimes(2);
});
