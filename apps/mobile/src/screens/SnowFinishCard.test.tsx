/**
 * The end of a day on the snow (TASK-375 part C, ADR-0319): the numbers of
 * a day of skiing or of cross-country skiing in place of a run's, no
 * calories, and «Your day» over the map.
 */
import type { LatLon } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { translate } from "../i18n/translate";
import type { FreeRun } from "../navigation/freeRun";
import { addFix, emptyTrack, type Track } from "../navigation/trackRecorder";
import type { Sport } from "../settings/sport";
import { saveUnitsChoice } from "../units/units";
import { FreeFinishBanner, FreeFinishCard } from "./FreeRunScreen";
import { speedOf } from "./SnowFinishCard";

let mockSport: Sport = "ski";
jest.mock("../settings/useSport", () => ({ useSport: () => mockSport }));

jest.mock("expo-brightness", () => ({
  getBrightnessAsync: jest.fn(() => Promise.resolve(0.6)),
  setBrightnessAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));

const START: LatLon = [46.4, 11.8];
const METRE = 1 / 111_195;

/** Two descents of 1.2 km and 300 m down at 10 m/s, a chairlift between
 * them: 300 m up in five minutes. */
function twoDescents(): Track {
  let track = emptyTrack();
  let north = 0;
  let height = 2000;
  let at = 0;
  const go = (seconds: number, every: number, northM: number, upM: number) => {
    for (let s = every; s <= seconds; s += every) {
      track = addFix(track, {
        point: [START[0] + (north + (northM * s) / seconds) * METRE, START[1]],
        timeMs: (at + s) * 1000,
        accuracyM: 5,
        altitudeM: height + (upM * s) / seconds,
      });
    }
    north += northM;
    height += upM;
    at += seconds;
  };
  track = addFix(track, {
    point: START,
    timeMs: 0,
    accuracyM: 5,
    altitudeM: height,
  });
  go(120, 5, 1200, -300);
  go(300, 10, -1200, 300);
  go(120, 5, 1200, -300);
  return track;
}

function dayOf(track: Track): FreeRun {
  return { version: 1, route: [], track, status: "stopped" };
}

afterEach(() => {
  mockSport = "ski";
  saveUnitsChoice("km");
});

test("a day of skiing has its descents, metres down, speeds and lifts", async () => {
  await render(<FreeFinishCard run={dayOf(twoDescents())} onDone={jest.fn()} />);
  // Only the descents' kilometres, not the lift's.
  expect(screen.getByLabelText("Skied: 2.40 km")).toBeOnTheScreen();
  expect(screen.getByLabelText("Descents: 2")).toBeOnTheScreen();
  expect(screen.getByLabelText("Vertical: 600 m")).toBeOnTheScreen();
  expect(screen.getByLabelText("Top speed: 36.0 km/h")).toBeOnTheScreen();
  expect(screen.getByLabelText("Avg speed: 36.0 km/h")).toBeOnTheScreen();
  expect(screen.getByLabelText("Lifts: 1")).toBeOnTheScreen();
  expect(screen.getByLabelText("Time: 9:00")).toBeOnTheScreen();
  // No calories on the snow, and no pace.
  expect(screen.queryByText("Calories")).toBeNull();
  expect(screen.queryByText("Avg pace")).toBeNull();
});

test("with miles the speeds are in mph and the kilometres in miles", async () => {
  saveUnitsChoice("mi");
  await render(<FreeFinishCard run={dayOf(twoDescents())} onDone={jest.fn()} />);
  expect(screen.getByLabelText("Skied: 1.49 mi")).toBeOnTheScreen();
  expect(screen.getByLabelText("Top speed: 22.4 mph")).toBeOnTheScreen();
  // The metres down stay metres, as the metres climbed of a run.
  expect(screen.getByLabelText("Vertical: 600 m")).toBeOnTheScreen();
});

test("a day of cross-country skiing has a run's distance, pace and climb, no calories", async () => {
  mockSport = "xc_ski";
  await render(<FreeFinishCard run={dayOf(twoDescents())} onDone={jest.fn()} />);
  expect(screen.getByLabelText("Distance: 3.60 km")).toBeOnTheScreen();
  expect(screen.getByText("Avg pace")).toBeOnTheScreen();
  expect(screen.getByLabelText("Elev. gain: 300 m")).toBeOnTheScreen();
  expect(screen.getByLabelText("Time: 9:00")).toBeOnTheScreen();
  expect(screen.queryByText("Calories")).toBeNull();
  expect(screen.queryByText("Descents")).toBeNull();
});

test("the day keeps the ways out of a run", async () => {
  const onResume = jest.fn();
  const onDone = jest.fn();
  await render(
    <FreeFinishCard run={dayOf(twoDescents())} onResume={onResume} onDone={onDone} />,
  );
  await fireEvent.press(screen.getByText("Keep running"));
  await fireEvent.press(screen.getByText("Done"));
  expect(onResume).toHaveBeenCalledTimes(1);
  expect(onDone).toHaveBeenCalledTimes(1);
});

test("a run keeps its own end", async () => {
  mockSport = "run";
  await render(<FreeFinishCard run={dayOf(twoDescents())} onDone={jest.fn()} />);
  expect(screen.getByText("Calories")).toBeOnTheScreen();
  expect(screen.queryByText("Descents")).toBeNull();
});

test.each<[Sport, string, string]>([
  // A day of skiing has its lifts dashed on the map (part C2).
  ["ski", "Your day", "White: your descents. Dashed: the lifts."],
  ["xc_ski", "Your day", "White: where you skied."],
  ["run", "Your run", "White: what you ran."],
])("over the map of %s: %s", async (sport, title, line) => {
  mockSport = sport;
  await render(<FreeFinishBanner />);
  expect(screen.getByText(title)).toBeOnTheScreen();
  expect(screen.getByText(line)).toBeOnTheScreen();
});

test("a speed not known yet is a dash", () => {
  expect(speedOf(null, "km")).toBe("–");
  expect(speedOf(10, "km")).toBe("36.0");
});

test("the approved texts, in Italian", () => {
  expect(translate("it", "Your day")).toBe("La tua giornata");
  expect(translate("it", "White: where you skied.")).toBe("Bianco: dove hai sciato.");
  expect(translate("it", "Skied: {distance}", { distance: "2,40 km" })).toBe(
    "Sciati: 2,40 km",
  );
  expect(translate("it", "Descents")).toBe("Discese");
  expect(translate("it", "Vertical")).toBe("Dislivello");
  expect(translate("it", "Top speed")).toBe("Vel. max");
  expect(translate("it", "Lifts")).toBe("Risalite");
  expect(translate("it", "White: your descents. Dashed: the lifts.")).toBe(
    "Bianco: le discese. Tratteggio: gli impianti.",
  );
});
