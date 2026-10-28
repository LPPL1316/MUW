import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { drawingProblem } from "../api/drawings";
import { saveLanguageChoice } from "../i18n/language";
import { setVoice } from "../navigation/runControl";
import { DEFAULT_VOICE_CHOICE, saveVoiceChoice } from "../voice/voiceChoice";
import { VoiceSetting } from "../voice/VoiceSetting";
import { SPORTS, type SportOption } from "./sport";
import { SportButton } from "./SportButton";
import { SportSetting } from "./SportSetting";

// «Sport», the voice of «Data» and the words of a run's drawing in the
// app's language (TASK-210, part E).

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => [
    { identifier: "daniel", name: "Daniel", language: "en-GB", quality: "Enhanced" },
    { identifier: "alice", name: "Alice", language: "it-IT", quality: "Default" },
  ]),
  VoiceQuality: { Default: "Default", Enhanced: "Enhanced" },
}));
// The phone's documents folder, in memory.
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
  return { File, Paths: { document: { uri: "file:///documents/" } } };
});

/** As before TASK-190: only run ready. */
const RUN_ONLY: SportOption[] = SPORTS.map((option) =>
  option.id === "run" ? option : { ...option, ready: false },
);

beforeEach(async () => {
  saveVoiceChoice(DEFAULT_VOICE_CHOICE);
  setVoice(true);
  await act(async () => saveLanguageChoice("it"));
});

afterEach(async () => {
  await act(async () => saveLanguageChoice("phone"));
});

test("«Sport» in «Settings» speaks Italian", async () => {
  await render(<SportSetting />);
  expect(screen.getByText("SPORT")).toBeOnTheScreen();
  expect(screen.getByRole("radio", { name: "Corsa" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Bici" })).not.toBeChecked();
  expect(screen.getByRole("radio", { name: "Pagaia" })).not.toBeChecked();
  expect(screen.getByLabelText("Parapendio, in arrivo")).toBeOnTheScreen();
  expect(screen.queryByText("Run")).toBeNull();
});

test("a sport not ready says «Soon» in Italian", async () => {
  await render(<SportSetting sports={RUN_ONLY} />);
  expect(screen.getByLabelText("Bici, in arrivo")).toBeOnTheScreen();
  // Bici, Pagaia and Parapendio (TASK-305 D0).
  expect(screen.getAllByText("In arrivo")).toHaveLength(3);
});

test("the sport's button and its menu speak Italian", async () => {
  await render(<SportButton />);
  const button = screen.getByRole("button", { name: "Sport, Corsa" });
  expect(button.props.accessibilityHint).toBe("Cambia lo sport");
  await fireEvent.press(button);
  expect(screen.getByLabelText("Sport")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "Chiudi" })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("radio", { name: "Pagaia" }));
  expect(screen.getByRole("button", { name: "Sport, Pagaia" })).toBeOnTheScreen();
});

test("the voice of «Data» speaks Italian", async () => {
  await render(<VoiceSetting />);
  await act(async () => {});
  const row = screen.getByRole("button", {
    name: "Lingua e voce: Italiano, Predefinita",
  });
  expect(row.props.accessibilityHint).toBe("Cambia la lingua e la voce");
  expect(screen.getByRole("button", { name: "Ascolta" }).props.accessibilityHint).toBe(
    "Annuncia una svolta con questa voce",
  );

  await fireEvent.press(row);
  expect(screen.getByText("Lingua")).toBeOnTheScreen();
  expect(screen.getByText("Voce")).toBeOnTheScreen();
  expect(
    screen.getByRole("radio", { name: "Lingua dell'app, Italiano" }),
  ).toBeChecked();
  expect(screen.getByRole("radio", { name: "Predefinita" })).toBeChecked();

  // A language with no voice on this phone: English speaks, and says so.
  await fireEvent.press(screen.getByRole("radio", { name: "Deutsch" }));
  expect(
    screen.getByText(
      "Questo telefono non ha una voce per Deutsch: la voce parla inglese.",
    ),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole("radio", { name: "Daniel, en-GB · Migliorata" }),
  ).toBeOnTheScreen();
  expect(screen.getByText("Fatto")).toBeOnTheScreen();
});

test("with «Voice» off, «Listen» says how to hear it, in Italian", async () => {
  setVoice(false);
  await render(<VoiceSetting />);
  await act(async () => {});
  expect(screen.getByRole("button", { name: "Ascolta" }).props.accessibilityHint).toBe(
    "Attiva «Voce» per ascoltare",
  );
});

test("a drawing call that did not go says why in Italian", () => {
  expect(drawingProblem({ kind: "unreachable", url: "http://api" })).toBe(
    "Nessuna connessione. Riprova quando sei online.",
  );
  expect(
    drawingProblem({
      kind: "api_error",
      code: "session_expired",
      message: "Session expired",
      retryAfterS: null,
    } as never),
  ).toBe("La sessione è scaduta. Accedi di nuovo.");
  expect(
    drawingProblem({
      kind: "api_error",
      code: "http_error",
      message: "Not found",
      retryAfterS: null,
    } as never),
  ).toBe("Questa corsa non è più fra le tue attività.");
});
