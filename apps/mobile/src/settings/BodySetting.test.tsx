import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { appBody, NO_BODY, saveBody } from "../body/bodyProfile";
import { saveUnitsChoice } from "../units/units";
import { BodySetting } from "./BodySetting";

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

jest.mock("../units/phoneUnits", () => ({ phoneUnits: jest.fn(() => "km") }));

afterEach(async () => {
  await act(async () => {
    saveBody(NO_BODY);
    saveUnitsChoice("phone");
  });
});

async function openPage() {
  await render(<BodySetting />);
  await fireEvent.press(screen.getByRole("button", { name: "Body, Not set" }));
}

test("the row opens the page, which says what the body is for", async () => {
  await openPage();
  expect(screen.getByRole("header", { name: "Body" })).toBeOnTheScreen();
  expect(
    screen.getByText(
      "Used only to estimate your calories and heart rate zones. It stays on this phone.",
    ),
  ).toBeOnTheScreen();
  expect(
    screen.getByText("Calories are an estimate. Weight matters most."),
  ).toBeOnTheScreen();
  // Nothing to clear yet.
  expect(screen.queryByText("Clear")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.queryByRole("header", { name: "Body" })).toBeNull();
});

test("each field is kept as soon as it is typed, and the row shows the weight", async () => {
  await openPage();
  await fireEvent.press(screen.getByRole("radio", { name: "Prefer not to say" }));
  expect(screen.getByRole("radio", { name: "Prefer not to say" })).toBeChecked();
  const weight = screen.getByLabelText("Weight");
  await fireEvent.changeText(weight, "72,5");
  await fireEvent(weight, "endEditing");
  const height = screen.getByLabelText("Height");
  await fireEvent.changeText(height, "178");
  await fireEvent(height, "endEditing");
  const year = screen.getByLabelText("Year of birth");
  await fireEvent.changeText(year, "1990");
  await fireEvent(year, "endEditing");
  expect(appBody()).toEqual({
    sex: "unsaid",
    weightKg: 72.5,
    heightCm: 178,
    birthYear: 1990,
  });
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("button", { name: "Body, 72.5 kg" })).toBeOnTheScreen();
});

test("a value out of its limits says why and is not kept", async () => {
  await openPage();
  const weight = screen.getByLabelText("Weight");
  await fireEvent.changeText(weight, "12");
  await fireEvent(weight, "endEditing");
  expect(screen.getByText("Enter a weight between 30 and 300 kg.")).toBeOnTheScreen();
  expect(appBody().weightKg).toBeNull();
  await fireEvent.changeText(weight, "80");
  await fireEvent(weight, "endEditing");
  expect(screen.queryByText("Enter a weight between 30 and 300 kg.")).toBeNull();
  expect(appBody().weightKg).toBe(80);
});

test("Clear empties a field", async () => {
  await act(async () => {
    saveBody({ ...NO_BODY, weightKg: 80, sex: "female" });
  });
  await render(<BodySetting />);
  await fireEvent.press(screen.getByRole("button", { name: "Body, 80 kg" }));
  expect(screen.getByLabelText("Weight")).toHaveDisplayValue("80");
  await fireEvent.press(screen.getByRole("button", { name: "Clear, Weight" }));
  expect(screen.getByLabelText("Weight")).toHaveDisplayValue("");
  await fireEvent.press(screen.getByRole("button", { name: "Clear, Sex" }));
  expect(appBody()).toEqual(NO_BODY);
});

test("with miles, pounds and feet-inches; back in kilograms the same weight", async () => {
  await act(async () => {
    saveUnitsChoice("mi");
  });
  await openPage();
  expect(screen.getByText("lb")).toBeOnTheScreen();
  const weight = screen.getByLabelText("Weight");
  await fireEvent.changeText(weight, "160");
  await fireEvent(weight, "endEditing");
  const feet = screen.getByLabelText("Height, ft");
  await fireEvent.changeText(feet, "5");
  await fireEvent.changeText(screen.getByLabelText("Height, in"), "10");
  await fireEvent(feet, "endEditing");
  expect(appBody().heightCm).toBeCloseTo(177.8);
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("button", { name: "Body, 160 lb" })).toBeOnTheScreen();
  await act(async () => {
    saveUnitsChoice("km");
  });
  expect(screen.getByRole("button", { name: "Body, 72.6 kg" })).toBeOnTheScreen();
  await act(async () => {
    saveUnitsChoice("mi");
  });
  expect(screen.getByRole("button", { name: "Body, 160 lb" })).toBeOnTheScreen();
});
