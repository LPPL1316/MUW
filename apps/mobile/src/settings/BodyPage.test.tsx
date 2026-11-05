import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { TextInput } from "react-native";

import { appBody, type BodyProfile, NO_BODY, saveBody } from "../body/bodyProfile";
import { saveUnitsChoice } from "../units/units";
import { BodyPage } from "./BodyPage";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

// The phone's documents folder, in memory, as in BodySetting.test.tsx.
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

jest.mock("../units/phoneUnits", () => ({ phoneUnits: jest.fn(() => "km") }));

afterEach(async () => {
  jest.restoreAllMocks();
  await act(async () => {
    saveBody(NO_BODY);
    saveUnitsChoice("phone");
  });
});

const KEPT: BodyProfile = { ...NO_BODY, weightKg: 72.5, heightCm: 178 };

async function openPage(units: "km" | "mi", body: BodyProfile = NO_BODY) {
  await act(async () => {
    saveUnitsChoice(units);
    saveBody(body);
  });
  await render(<BodyPage visible onClose={jest.fn()} />);
}

/** The box a field's number is typed in, which holds its unit (TASK-383). */
function boxOf(label: string) {
  const box = screen.getByLabelText(label).parent;
  if (box === null) {
    throw new Error(`No box around «${label}»`);
  }
  return box;
}

async function type(label: string, text: string) {
  const input = screen.getByLabelText(label);
  await fireEvent.changeText(input, text);
  await fireEvent(input, "endEditing");
}

test("with kilometres, kg and cm sit in the boxes of weight and height", async () => {
  await openPage("km", KEPT);
  expect(screen.getByLabelText("Weight")).toHaveDisplayValue("72.5");
  expect(within(boxOf("Weight")).getByText("kg")).toBeOnTheScreen();
  expect(screen.getByLabelText("Height")).toHaveDisplayValue("178");
  expect(within(boxOf("Height")).getByText("cm")).toBeOnTheScreen();
  // The year has no unit, and no imperial unit shows.
  expect(within(boxOf("Year of birth")).queryByText(/\S/)).toBeNull();
  for (const unit of ["lb", "ft", "in"]) {
    expect(screen.queryByText(unit)).toBeNull();
  }
});

test("empty, the boxes already say kg and cm", async () => {
  await openPage("km");
  expect(screen.getByLabelText("Weight")).toHaveDisplayValue("");
  expect(within(boxOf("Weight")).getByText("kg")).toBeOnTheScreen();
  expect(screen.getByLabelText("Height")).toHaveDisplayValue("");
  expect(within(boxOf("Height")).getByText("cm")).toBeOnTheScreen();
});

test("with kilometres, kilograms and centimetres are kept as typed", async () => {
  await openPage("km");
  await type("Weight", "80,5");
  await type("Height", "181");
  expect(appBody()).toEqual({ ...NO_BODY, weightKg: 80.5, heightCm: 181 });
});

test("with miles, lb, ft and in sit in their boxes, from the kilograms and centimetres kept", async () => {
  await openPage("mi", KEPT);
  // 72.5 kg = 159.8 lb; 178 cm = 70 in = 5 ft 10 in.
  expect(screen.getByLabelText("Weight")).toHaveDisplayValue("159.8");
  expect(within(boxOf("Weight")).getByText("lb")).toBeOnTheScreen();
  expect(screen.getByLabelText("Height, ft")).toHaveDisplayValue("5");
  expect(within(boxOf("Height, ft")).getByText("ft")).toBeOnTheScreen();
  expect(screen.getByLabelText("Height, in")).toHaveDisplayValue("10");
  expect(within(boxOf("Height, in")).getByText("in")).toBeOnTheScreen();
  expect(screen.queryByText("kg")).toBeNull();
  expect(screen.queryByText("cm")).toBeNull();
});

test("with miles, pounds and feet-inches are kept in kilograms and centimetres", async () => {
  await openPage("mi");
  await type("Weight", "176");
  await fireEvent.changeText(screen.getByLabelText("Height, ft"), "6");
  await type("Height, in", "1");
  // 176 lb = 79.832 kg; 6 ft 1 in = 73 in = 185.42 cm.
  expect(appBody().weightKg).toBeCloseTo(79.832, 3);
  expect(appBody().heightCm).toBeCloseTo(185.42, 2);
  // Back in kilometres, the same body in kg and cm.
  await screen.unmount();
  await openPage("km", appBody());
  expect(screen.getByLabelText("Weight")).toHaveDisplayValue("79.8");
  expect(screen.getByLabelText("Height")).toHaveDisplayValue("185");
});

test("a tap on the unit types in its box", async () => {
  const focus = jest.spyOn(
    (TextInput as unknown as { prototype: { focus: () => void } }).prototype,
    "focus",
  );
  await openPage("km");
  await fireEvent.press(within(boxOf("Height")).getByText("cm"));
  expect(focus).toHaveBeenCalledTimes(1);
});
