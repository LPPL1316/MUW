/**
 * A day on the snow (TASK-375, ADR-0319): «Ski» and «Cross-country ski» are
 * recorded without a shape, saved as "skiing" and "xc_skiing", and stay out
 * of the store builds until the server keeps them and the day has its
 * numbers (part C).
 */
import { RECORD_ACTIVITIES, RUN_ACTIVITIES } from "@shaperoute/shared-types";

import { freeRunActivity } from "../navigation/freeSport";
import { withoutRouteIcon } from "../screens/RunNoRouteButton";
import {
  activityOf,
  ALL_SPORTS,
  canChoose,
  isRecordOnly,
  runActivityOf,
  shownSports,
  type Sport,
  type SportOption,
  withoutRouteLabel,
} from "./sport";

const EVERY: Sport[] = ALL_SPORTS.map((option) => option.id);

test("«Ski» ⛷️ and «Cross-country ski» 🎿 are recorded without a shape", () => {
  const snow = ALL_SPORTS.filter((option) => option.recordOnly === true);
  expect(snow.map(({ id, emoji, name }) => [id, emoji, name])).toEqual([
    ["ski", "⛷️", "Ski"],
    ["xc_ski", "🎿", "Cross-country ski"],
  ]);
  expect(isRecordOnly("ski")).toBe(true);
  expect(isRecordOnly("xc_ski")).toBe(true);
  for (const sport of EVERY.filter((id) => id !== "ski" && id !== "xc_ski")) {
    expect(isRecordOnly(sport)).toBe(false);
  }
});

test("not ready yet: «Soon» in Expo Go and preview, absent from a store build", () => {
  expect(canChoose("ski")).toBe(false);
  expect(canChoose("xc_ski")).toBe(false);
  const store = shownSports(ALL_SPORTS, true).map((option) => option.id);
  expect(store).not.toContain("ski");
  expect(store).not.toContain("xc_ski");
  // The day it is ready, it can be chosen like any other.
  const ready: SportOption[] = ALL_SPORTS.map((option) =>
    option.recordOnly === true ? { ...option, ready: true } : option,
  );
  expect(canChoose("ski", ready)).toBe(true);
  expect(shownSports(ready, true).map((option) => option.id)).toContain("xc_ski");
});

test("a day on the snow is saved as its own activity, the others as their route", () => {
  expect(runActivityOf("ski")).toBe("skiing");
  expect(runActivityOf("xc_ski")).toBe("xc_skiing");
  // The gym is saved as a workout, without a route (TASK-385 B).
  expect(runActivityOf("gym")).toBe("gym");
  for (const sport of EVERY.filter((id) => !isRecordOnly(id) && id !== "gym")) {
    expect(runActivityOf(sport)).toBe(activityOf(sport));
  }
  expect(runActivityOf("walk")).toBe("walking");
  // Every one is an activity the API saves, and the snow is apart.
  for (const sport of EVERY) {
    expect(RUN_ACTIVITIES).toContain(runActivityOf(sport));
  }
  expect(EVERY.filter((id) => isRecordOnly(id)).map(runActivityOf)).toEqual([
    ...RECORD_ACTIVITIES,
  ]);
  // No route is ever asked for the snow: «Draw» asks a run, never shown.
  expect(activityOf("ski")).toBe("running");
});

test("«Draw» says «Record your day», with the sport's sign", () => {
  expect(withoutRouteLabel("ski")).toBe("Record your day");
  expect(withoutRouteLabel("xc_ski")).toBe("Record your day");
  expect(withoutRouteIcon("ski")).toBe("⛷️");
  expect(withoutRouteIcon("xc_ski")).toBe("🎿");
});

test("until part C, downhill shows a ride's speeds and across country a pace", () => {
  expect(freeRunActivity("skiing")).toBe("cycling");
  expect(freeRunActivity("xc_skiing")).toBeUndefined();
  expect(freeRunActivity("running")).toBeUndefined();
  expect(freeRunActivity("paddling")).toBe("paddling");
  expect(freeRunActivity("walking")).toBe("walking");
});
