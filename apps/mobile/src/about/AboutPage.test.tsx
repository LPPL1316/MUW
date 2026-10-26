import { act, render, screen } from "@testing-library/react-native";

import { saveLanguageChoice } from "../i18n/language";
import { AboutPage } from "./AboutPage";
import { EN } from "./content/en";
import { IT } from "./content/it";

afterEach(async () => {
  await act(async () => saveLanguageChoice("phone"));
});

test("«Help» shows its name and every section under its heading", async () => {
  await render(<AboutPage id="help" />);
  const headers = screen.getAllByRole("header").map((header) => header.props.children);
  expect(headers).toEqual([
    "How MuW works",
    ...EN.help.sections.map((section) => section.heading),
  ]);
  expect(screen.getByText(/^MuW draws real routes/)).toBeOnTheScreen();
  // A list of points: each on its own line, the dot not read.
  expect(screen.getByText(/^Tap «Draw route»/)).toBeOnTheScreen();
});

test("«Help» is not a draft: no notice, no day", async () => {
  await render(<AboutPage id="help" />);
  expect(screen.queryByText("Draft — not final yet.")).toBeNull();
  expect(screen.queryByText(/^Last updated/)).toBeNull();
});

test("«Terms» says it is a draft before anything else, with its day", async () => {
  await render(<AboutPage id="terms" />);
  expect(screen.getByText("Draft — not final yet.")).toBeOnTheScreen();
  expect(screen.getByText("Last updated: 10 October 2026")).toBeOnTheScreen();
  expect(screen.getByRole("header", { name: EN.terms.title })).toBeOnTheScreen();
  // What the user still has to fill stands out, as it is written.
  expect(screen.getAllByText("[name]").length).toBeGreaterThan(0);
  expect(screen.getAllByText("[contact email]").length).toBeGreaterThan(0);
});

test("«Privacy» is final: its day, no draft notice, nothing left to fill (TASK-237 D)", async () => {
  await render(<AboutPage id="privacy" />);
  expect(screen.queryByText("Draft — not final yet.")).toBeNull();
  expect(screen.getByText("Last updated: 26 October 2026")).toBeOnTheScreen();
  expect(screen.getByRole("header", { name: EN.privacy.title })).toBeOnTheScreen();
  expect(
    screen.getByText(/controller of your personal data is Luca Pallaoro/),
  ).toBeOnTheScreen();
  expect(screen.queryByText(/\[[^\]]+\]/)).toBeNull();
});

test("with the app in Italian the text and its day are in Italian", async () => {
  await act(async () => saveLanguageChoice("it"));
  await render(<AboutPage id="privacy" />);
  expect(
    screen.getByRole("header", { name: "Informativa sulla privacy" }),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole("header", { name: IT.privacy.sections[0].heading }),
  ).toBeOnTheScreen();
  expect(screen.queryByText("Bozza — non ancora definitiva.")).toBeNull();
  expect(screen.getByText("Ultimo aggiornamento: 26 ottobre 2026")).toBeOnTheScreen();
  expect(screen.queryByText("Privacy policy")).toBeNull();
});

test("with the app in German the draft is German, and still a draft (TASK-210 F)", async () => {
  await act(async () => saveLanguageChoice("de"));
  await render(<AboutPage id="terms" />);
  const title = screen.getByRole("header", { name: "Nutzungsbedingungen" });
  expect(title).toBeOnTheScreen();
  // VoiceOver is told the text is German.
  expect(title.props.accessibilityLanguage).toBe("de-DE");
  expect(screen.getByText("Entwurf – noch nicht endgültig.")).toBeOnTheScreen();
  expect(screen.getByText("Zuletzt aktualisiert: 10. Oktober 2026")).toBeOnTheScreen();
  // The places to fill are the same as in English, and stand out.
  expect(screen.getAllByText("[name]").length).toBeGreaterThan(0);
  expect(screen.getAllByText("[governing law]").length).toBeGreaterThan(0);
  expect(screen.queryByText("Terms of use")).toBeNull();
});

test.each([
  ["es", "Política de privacidad", "Última actualización: 26 de octubre de 2026"],
  ["fr", "Politique de confidentialité", "Dernière mise à jour : 26 octobre 2026"],
  ["de", "Datenschutzerklärung", "Zuletzt aktualisiert: 26. Oktober 2026"],
] as const)(
  "with the app in «%s» «Privacy» is final in it",
  async (language, name, day) => {
    await act(async () => saveLanguageChoice(language));
    await render(<AboutPage id="privacy" />);
    expect(screen.getByRole("header", { name })).toBeOnTheScreen();
    expect(screen.getByText(day)).toBeOnTheScreen();
    expect(screen.getAllByText(/muw2610@gmail\.com/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/\[[^\]]+\]/)).toBeNull();
  },
);

test("the page turns with the language while it is open", async () => {
  await render(<AboutPage id="help" />);
  expect(screen.getByRole("header", { name: "How MuW works" })).toBeOnTheScreen();
  await act(async () => saveLanguageChoice("it"));
  expect(screen.getByRole("header", { name: "Come funziona MuW" })).toBeOnTheScreen();
});

test.each([
  ["de", "So funktioniert MuW", "de-DE", /^Tippe auf «Route zeichnen»/],
  ["es", "Cómo funciona MuW", "es-ES", /^Toca «Dibujar la ruta»/],
  ["fr", "Comment fonctionne MuW", "fr-FR", /^Touche «Dessiner le parcours»/],
] as const)(
  "with the app in «%s» «Help» is in it, and VoiceOver is told so (TASK-210 F)",
  async (language, name, speech, button) => {
    await act(async () => saveLanguageChoice(language));
    await render(<AboutPage id="help" />);
    const title = screen.getByRole("header", { name });
    expect(title.props.accessibilityLanguage).toBe(speech);
    expect(screen.getByText(button)).toBeOnTheScreen();
    expect(screen.queryByText(/^Tap «Draw route»/)).toBeNull();
  },
);
