import type { RouteRequest } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { saveLanguageChoice } from "../i18n/language";
import { DistanceStepper } from "./DistanceStepper";
import { ImageChoice } from "./ImageChoice";
import { imageProblemText, problemText } from "./problems";
import { DrawButton, RouteChoice, RouteOutcome } from "./RoutePanel";
import { toNote } from "./warnings";
import { checkWord } from "./wordInput";

// «Draw» in the app's language (TASK-210): what the panel, the wait, a
// problem, a warning of the engine and the word field say in Italian. The
// English of each is in the files' own tests.

beforeEach(() => saveLanguageChoice("it"));
afterEach(() => saveLanguageChoice("phone"));

const request: RouteRequest = {
  start: [46.0671, 11.1214],
  shape: "heart",
  distance_m: 7500,
  activity: "running",
};

function choice(kind: "shape" | "word", wordText = "") {
  return (
    <RouteChoice
      kind={kind}
      onKind={jest.fn()}
      shapeText="stemma della Ferrari"
      shape={null}
      onShapeText={jest.fn()}
      reading={{ status: "unread" }}
      onShapeDone={jest.fn()}
      wordText={wordText}
      onWordText={jest.fn()}
      wordCheck={checkWord(wordText, 5000)}
      letterStyle="block"
      onLetterStyle={jest.fn()}
      distanceText="5"
      distanceM={5000}
      image={{ status: "none" }}
      onChooseImage={jest.fn()}
      onDistanceText={jest.fn()}
    />
  );
}

test("the panel's labels, switch and notes are in Italian", async () => {
  await render(choice("shape"));
  expect(screen.getByText("COSA DISEGNI")).toBeTruthy();
  expect(screen.getByText("Forma")).toBeTruthy();
  expect(screen.getByText("Parola")).toBeTruthy();
  expect(screen.getByText("Immagine")).toBeTruthy();
  expect(screen.getByPlaceholderText("cuore, stella, cavallo…")).toBeTruthy();
  expect(screen.getByText("Premi Fine e l'AI lo leggerà.")).toBeTruthy();
  expect(screen.getByText("DISTANZA")).toBeTruthy();
  expect(screen.getByLabelText("Distanza in km")).toBeTruthy();
});

test("a word too long for its distance offers the km it needs, in Italian", async () => {
  await render(choice("word", "ciao"));
  expect(screen.getByText("LETTERE")).toBeTruthy();
  expect(screen.getByText("Quadrate")).toBeTruthy();
  expect(
    screen.getByText(
      "Le lettere quadrate seguono la griglia delle strade: meglio per parole corte.",
    ),
  ).toBeTruthy();
  expect(
    screen.getByText("A «CIAO» servono almeno 12 km: 3 km per ogni lettera."),
  ).toBeTruthy();
  expect(screen.getByText("Usa 12 km")).toBeTruthy();
});

test("the draw button and the wait say what they do in Italian", async () => {
  await render(<DrawButton enabled onDraw={jest.fn()} />);
  expect(screen.getByText("Disegna il percorso")).toBeTruthy();
  await render(
    <RouteOutcome
      view={{
        status: "waiting",
        request: { ...request, shape: undefined, word: "CIAO" },
        startedAt: 0,
        phase: "computing",
      }}
      onCancel={jest.fn()}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onTryDistance={jest.fn()}
      onPickShape={jest.fn()}
      onStart={jest.fn()}
    />,
  );
  expect(screen.getByText("Disegno «CIAO», 7,5 km…")).toBeTruthy();
  expect(screen.getByText("Annulla")).toBeTruthy();
});

test("a shape that does not fit says where it does, and offers it, in Italian", async () => {
  const onTryDistance = jest.fn();
  await render(
    <RouteOutcome
      view={{
        status: "failed",
        request,
        problem: {
          kind: "api_error",
          code: "shape_not_drawable",
          message: "no",
          suggested_distance_m: 10_000,
        },
      }}
      onCancel={jest.fn()}
      exporting={{ status: "idle" }}
      onExport={jest.fn()}
      onTryDistance={onTryDistance}
      onPickShape={jest.fn()}
      onStart={jest.fn()}
    />,
  );
  expect(
    screen.getByText(
      "Qui questa forma non sta sulle strade a questa distanza. Ci sta a circa 10 km.",
    ),
  ).toBeTruthy();
  fireEvent.press(screen.getByText("Prova 10 km"));
  expect(onTryDistance).toHaveBeenCalledWith(10_000);
});

test("the picture's problems and the word's are in Italian", () => {
  expect(
    problemText({
      kind: "api_error",
      code: "image_not_usable",
      message: "the background is not uniform",
      reason: "background",
    }).text,
  ).toMatch(/^Lo sfondo è troppo pieno\./);
  expect(imageProblemText({ kind: "too_large", bytes: 12_340_000 }).text).toBe(
    "Questa foto è troppo grande: 12,3 MB, al massimo 10 MB. Scegline una più piccola.",
  );
  expect(checkWord("due parole", 5000)).toMatchObject({
    problem: "Una parola sola, senza spazi.",
  });
});

test("the engine's warnings are said in Italian, the direction too", () => {
  expect(toNote("120 m of the route on steps").text).toBe(
    "Lungo la strada ci sono 120 m di scale.",
  );
  expect(
    toNote(
      "start moved 1.2 km north-east of the requested point, where the shape closes on the roads",
    ).text,
  ).toBe(
    "Il percorso parte 1,2 km a nord-est dalla tua partenza, dove la forma sta sulle strade. Vai a «Parti da qui».",
  );
  expect(toNote("distance on roads is +12% from the target").text).toBe(
    "Il percorso è più lungo del 12% rispetto a quanto chiesto.",
  );
});

test("the picture's buttons and the stepper's are in Italian", async () => {
  await render(<ImageChoice state={{ status: "none" }} onChoose={jest.fn()} />);
  expect(screen.getByText("Scegli una foto")).toBeTruthy();
  expect(screen.getByText("Scatta una foto")).toBeTruthy();
  await render(<DistanceStepper text="5" onText={jest.fn()} editable />);
  expect(screen.getByLabelText("Più corta")).toBeTruthy();
  expect(screen.getByLabelText("Più lunga")).toBeTruthy();
});
