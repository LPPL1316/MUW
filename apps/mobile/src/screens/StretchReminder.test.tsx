import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Speech from "expo-speech";

import { saveLanguageChoice } from "../i18n/language";
import { setVoice } from "../navigation/runControl";
import { resetRunAudio } from "../voice/runAudio";
import { DEFAULT_VOICE_CHOICE, saveVoiceChoice } from "../voice/voiceChoice";
import { StretchReminder } from "./StretchReminder";

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  isSpeakingAsync: jest.fn(async () => false),
}));
// The phone's documents folder, in memory: the voice's choice is read from it.
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
    delete(): void {
      files.delete(this.uri);
    }
    textSync(): string {
      return files.get(this.uri) ?? "";
    }
  }
  return { File, Paths: { document: { uri: "file:///documents/" } } };
});

const mockExpoAudio = {
  setAudioModeAsync: jest.fn(async () => {}),
  setIsAudioActiveAsync: jest.fn(async () => {}),
};
jest.mock("expo", () => ({
  requireOptionalNativeModule: (name: string) =>
    name === "ExpoAudio" ? mockExpoAudio : null,
}));

/** The promises the sound module started have run. */
async function settled(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  saveLanguageChoice("en");
  saveVoiceChoice(DEFAULT_VOICE_CHOICE);
  setVoice(true);
  resetRunAudio();
  jest.mocked(Speech.speak).mockClear();
  mockExpoAudio.setAudioModeAsync.mockClear();
});

test("reminds on the screen and with the voice, once", async () => {
  await render(<StretchReminder onStretch={jest.fn()} onSkip={jest.fn()} />);
  expect(screen.getByText("Remember to stretch")).toBeTruthy();
  expect(screen.getByText("Stretch")).toBeTruthy();
  expect(screen.getByText("Skip")).toBeTruthy();
  expect(Speech.speak).toHaveBeenCalledTimes(1);
  expect(Speech.speak).toHaveBeenCalledWith("Remember to stretch.", {
    language: "en-US",
  });
});

test("«Skip» and «Stretch» each go their own way", async () => {
  const onStretch = jest.fn();
  const onSkip = jest.fn();
  await render(<StretchReminder onStretch={onStretch} onSkip={onSkip} />);
  await fireEvent.press(screen.getByText("Skip"));
  expect(onSkip).toHaveBeenCalledTimes(1);
  expect(onStretch).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("Stretch"));
  expect(onStretch).toHaveBeenCalledTimes(1);
});

test("with the voice off, the screen alone reminds", async () => {
  setVoice(false);
  await render(<StretchReminder onStretch={jest.fn()} onSkip={jest.fn()} />);
  expect(screen.getByText("Remember to stretch")).toBeTruthy();
  expect(Speech.speak).not.toHaveBeenCalled();
});

test("speaks in the voice's language, and writes in the app's", async () => {
  saveLanguageChoice("it");
  await render(<StretchReminder onStretch={jest.fn()} onSkip={jest.fn()} />);
  expect(screen.getByText("Ricordati di fare stretching")).toBeTruthy();
  expect(Speech.speak).toHaveBeenCalledWith("Ricordati di fare stretching.", {
    language: "it-IT",
  });
  saveLanguageChoice("en");
});

test("holds the run's sound while it is there, and lets it go after", async () => {
  const shown = await render(
    <StretchReminder onStretch={jest.fn()} onSkip={jest.fn()} />,
  );
  await settled();
  // The voice is heard as during the run: over the silent switch.
  expect(mockExpoAudio.setAudioModeAsync).toHaveBeenLastCalledWith(
    expect.objectContaining({ playsInSilentMode: true }),
  );
  shown.unmount();
  await settled();
  expect(mockExpoAudio.setAudioModeAsync).toHaveBeenLastCalledWith(
    expect.objectContaining({ playsInSilentMode: false }),
  );
});
