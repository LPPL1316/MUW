import { act, render, screen } from "@testing-library/react-native";

import { saveLanguageChoice } from "../i18n/language";
import { AskForRoute } from "./AskForRoute";
import { CATEGORIES, requestFor, whereFor } from "./presets";
import { cardMapsCredit } from "./RouteCard";
import { passedText } from "./ThemedCard";
import { THEMED_IDEAS } from "./themedIdeas";
import { IdeasFromEurope } from "./IdeasFromEurope";
import { failureText } from "./useStartDirections";

// «Explore» in the app's language (TASK-210, part C): what is shown is
// translated; what goes to the API stays in English.

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

beforeEach(async () => {
  await act(async () => saveLanguageChoice("it"));
});

afterEach(async () => {
  await act(async () => saveLanguageChoice("phone"));
});

test("the categories are shown in Italian, and asked for in English", async () => {
  const onAsk = jest.fn();
  await render(<AskForRoute city={null} where={whereFor(null)} onAsk={onAsk} />);
  expect(screen.getByText("CHIEDI UN PERCORSO")).toBeOnTheScreen();
  expect(screen.getByText("Posti famosi")).toBeOnTheScreen();
  expect(screen.getByText("Angoli nascosti")).toBeOnTheScreen();
  expect(screen.queryByText("Famous Places")).toBeNull();
  expect(screen.getByText("Crea il mio percorso")).toBeOnTheScreen();
  // The sentence is whole in Italian: no "Da vicino a".
  expect(screen.getByText(/^Si parte vicino a te\./)).toBeOnTheScreen();
  // The request the API gets is the English one.
  expect(requestFor(CATEGORIES[0], null)).toMatch(/^Famous Places/);
  expect(screen.getByLabelText(requestFor(CATEGORIES[0], null))).toBeOnTheScreen();
});

test("the words of a themed route and of missing directions speak Italian", () => {
  expect(
    passedText({
      stops: [{ passed: true }, { passed: false }, { passed: true }],
      theme_label: "ristoranti",
    } as never),
  ).toBe("Passa per 2 dei 3 ristoranti trovati:");
  expect(failureText({ kind: "unreachable", url: "http://api" } as never)).toBe(
    "Il server non ha risposto. Controlla la connessione e riprova.",
  );
  expect(cardMapsCredit()).toMatch(/^Mappe: /);
});

test("our ideas are shown in Italian, the cities theirs", async () => {
  const [first] = THEMED_IDEAS;
  await render(<IdeasFromEurope width={350} onIdea={jest.fn()} ideas={[first]} />);
  expect(screen.getByText("IDEE DALL'EUROPA")).toBeOnTheScreen();
  const italian: Record<string, string> = {
    Rome: "Roma",
    Paris: "Parigi",
    London: "Londra",
    Barcelona: "Barcellona",
    Amsterdam: "Amsterdam",
    Lisbon: "Lisbona",
    Prague: "Praga",
    Berlin: "Berlino",
  };
  expect(screen.getByText(new RegExp(`^${italian[first.city]} · `))).toBeOnTheScreen();
  // What «Make it near me» sends stays in English.
  expect(first.text).toMatch(/ km$/);
});
