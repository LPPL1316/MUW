/**
 * «Draw» with a sport recorded without a shape (TASK-375, ADR-0319): only
 * the yellow «Record your day» and the line under it; no start, no shape, no
 * route button.
 */
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { translate } from "../i18n/translate";
import type { Sport } from "../settings/sport";
import { color } from "../theme/tokens";
import { ChooseScreen } from "./ChooseScreen";

let mockSport: Sport = "ski";
jest.mock("../settings/useSport", () => ({ useSport: () => mockSport }));

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

async function draw(onRun: () => void, runLabel: string, runIcon: string) {
  await render(
    <ChooseScreen
      status="From your position"
      denied={false}
      mode="gps"
      onMode={jest.fn()}
      searching={false}
      onPlace={jest.fn()}
      near={null}
      mapError={null}
      footer={<Text>Draw route</Text>}
      onRun={onRun}
      runLabel={runLabel}
      runIcon={runIcon}
    >
      <Text>Shapes</Text>
    </ChooseScreen>,
  );
}

afterEach(() => {
  mockSport = "ski";
});

test("on the snow «Draw» is «Record your day» alone, yellow, and it records", async () => {
  const onRun = jest.fn();
  await draw(onRun, "Record your day", "⛷️");
  const button = screen.getByRole("button", { name: "Record your day" });
  expect(button).toHaveStyle({ backgroundColor: color.accent });
  expect(screen.getByText("⛷️")).toBeOnTheScreen();
  expect(
    screen.getByText("No shapes on the slopes: MuW records your day."),
  ).toBeOnTheScreen();
  // Nothing of a route: no start, no shapes, no «Draw route».
  expect(screen.queryByText("START")).toBeNull();
  expect(screen.queryByText("Shapes")).toBeNull();
  expect(screen.queryByText("Draw route")).toBeNull();
  expect(screen.queryByTestId("draw-footer")).toBeNull();
  // One way to record, not two.
  expect(screen.getAllByTestId("run-no-route")).toHaveLength(1);
  await fireEvent.press(button);
  expect(onRun).toHaveBeenCalledTimes(1);
});

test("cross-country is the same page, with its own sign", async () => {
  mockSport = "xc_ski";
  await draw(jest.fn(), "Record your day", "🎿");
  expect(screen.getByRole("button", { name: "Record your day" })).toBeOnTheScreen();
  expect(screen.getByText("🎿")).toBeOnTheScreen();
});

test("the words the user approved, in each language", () => {
  const said = (language: "it" | "de" | "fr" | "es") =>
    [
      "Ski",
      "Cross-country ski",
      "Record your day",
      "No shapes on the slopes: MuW records your day.",
    ].map((text) => translate(language, text));
  expect(said("it")).toEqual([
    "Sci",
    "Sci di fondo",
    "Registra la giornata",
    "Niente forme sulle piste: MuW registra la tua giornata.",
  ]);
  expect(said("de")).toEqual([
    "Ski",
    "Langlauf",
    "Tag aufzeichnen",
    "Keine Formen auf der Piste: MuW zeichnet deinen Tag auf.",
  ]);
  expect(said("fr")).toEqual([
    "Ski",
    "Ski de fond",
    "Enregistrer la journée",
    "Pas de formes sur les pistes : MuW enregistre ta journée.",
  ]);
  expect(said("es")).toEqual([
    "Esquí",
    "Esquí de fondo",
    "Registra tu jornada",
    "Sin formas en las pistas: MuW registra tu jornada.",
  ]);
});

test("any other sport keeps its page with the route", async () => {
  mockSport = "run";
  await draw(jest.fn(), "Run without a route", "🏃");
  expect(screen.getByText("Shapes")).toBeOnTheScreen();
  expect(screen.getByTestId("draw-footer")).toBeOnTheScreen();
  expect(screen.queryByTestId("record-day")).toBeNull();
});
