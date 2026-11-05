/**
 * «Gym» in «Draw» and in «+ Exercise» (TASK-385 part B, the user's choices
 * and texts of 2026-11-04): only «Start workout» and its line; the catalog
 * by group, with a search and an exercise of one's own; the words in each
 * language.
 */
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { translate } from "../i18n/translate";
import { ChooseScreen } from "../screens/ChooseScreen";
import { withoutRouteIcon } from "../screens/RunNoRouteButton";
import type { Sport } from "../settings/sport";
import { color } from "../theme/tokens";
import { GYM_EXERCISES } from "./catalog";
import { ExercisePicker, exercisesFound } from "./ExercisePicker";
import { groupName, GYM_GROUPS } from "./groups";

let mockSport: Sport = "gym";
jest.mock("../settings/useSport", () => ({ useSport: () => mockSport }));

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

afterEach(() => {
  mockSport = "gym";
});

test("in «Draw» the gym is «Start workout» alone, with its line", async () => {
  const onRun = jest.fn();
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
      runLabel="Start workout"
      runIcon={withoutRouteIcon("gym")}
    >
      <Text>Shapes</Text>
    </ChooseScreen>,
  );
  const button = screen.getByRole("button", { name: "Start workout" });
  expect(button).toHaveStyle({ backgroundColor: color.accent });
  expect(screen.getByText("🏋️")).toBeOnTheScreen();
  expect(
    screen.getByText("No route in the gym: MuW times your workout."),
  ).toBeOnTheScreen();
  expect(
    screen.queryByText("No shapes on the slopes: MuW records your day."),
  ).toBeNull();
  expect(screen.queryByText("START")).toBeNull();
  expect(screen.queryByText("Shapes")).toBeNull();
  expect(screen.queryByTestId("draw-footer")).toBeNull();
  await fireEvent.press(button);
  expect(onRun).toHaveBeenCalledTimes(1);
});

test("the search finds a name in the app's language or in English, accents or not", () => {
  expect(exercisesFound("develop", null, "fr").map((e) => e.key)).toContain(
    "bench_press",
  );
  expect(exercisesFound("panca", null, "it").map((e) => e.key)).toEqual(
    expect.arrayContaining(["bench_press", "incline_bench_press"]),
  );
  expect(exercisesFound("treadmill", null, "it").map((e) => e.key)).toContain(
    "treadmill",
  );
  expect(exercisesFound("", "cardio", "en").every((e) => e.group === "cardio")).toBe(
    true,
  );
  expect(exercisesFound("", null, "en")).toHaveLength(GYM_EXERCISES.length);
});

test("the eight groups in the five languages the user approved", () => {
  expect(GYM_GROUPS.map((group) => groupName(group, "it"))).toEqual([
    "Petto",
    "Schiena",
    "Gambe",
    "Spalle",
    "Braccia",
    "Addome",
    "Total body",
    "Cardio",
  ]);
  expect(groupName("back", "de")).toBe("Rücken");
  expect(groupName("full_body", "fr")).toBe("Corps entier");
  expect(groupName("core", "es")).toBe("Abdomen");
  expect(GYM_EXERCISES.every((exercise) => GYM_GROUPS.includes(exercise.group))).toBe(
    true,
  );
});

test("a group narrows the list, a name it has not becomes one's own", async () => {
  const onPick = jest.fn();
  await render(<ExercisePicker onPick={onPick} onClose={jest.fn()} />);
  await fireEvent.press(screen.getByTestId("group-cardio"));
  expect(screen.getByTestId("exercise-treadmill")).toBeOnTheScreen();
  expect(screen.queryByTestId("exercise-bench_press")).toBeNull();
  await fireEvent.press(screen.getByTestId("exercise-treadmill"));
  expect(onPick).toHaveBeenCalledWith({ exercise: "treadmill", kind: "cardio" });

  await fireEvent.changeText(screen.getByTestId("exercise-search"), "Tyre flip");
  await fireEvent.press(screen.getByText("Add “Tyre flip”"));
  await fireEvent.press(screen.getByTestId("own-kind-bodyweight"));
  expect(onPick).toHaveBeenLastCalledWith({ name: "Tyre flip", kind: "bodyweight" });
});

test("the words of a workout, as the user approved them", () => {
  const words = [
    "Start workout",
    "No route in the gym: MuW times your workout.",
    "+ Exercise",
    "Log set",
    "Same again",
    "Rest",
    "Still training?",
    "Finish workout",
  ];
  expect(words.map((text) => translate("it", text))).toEqual([
    "Inizia l'allenamento",
    "In palestra niente percorso: MuW cronometra il tuo allenamento.",
    "+ Esercizio",
    "Segna la serie",
    "Ancora uguale",
    "Recupero",
    "Ti stai ancora allenando?",
    "Termina l'allenamento",
  ]);
  expect(translate("de", "Add “{name}”")).toBe("„{name}“ hinzufügen");
  expect(translate("fr", "Next: {exercise} · set {n}")).toBe(
    "Ensuite : {exercise} · série {n}",
  );
  expect(translate("es", "Rest over — next set")).toBe(
    "Descanso terminado: siguiente serie",
  );
});
