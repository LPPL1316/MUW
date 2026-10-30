/**
 * The route engine's warnings in plain words (TASK-054).
 *
 * The engine writes them for developers: "shape similarity 0.85 is below 0.90
 * after 12 attempts". The contract has no codes for them yet, so the app
 * recognises the texts the engine writes today and says them simply. A text it
 * does not recognise is shown as it is, with a capital first letter: a new
 * warning is never hidden (ADR-0077).
 *
 * The patterns follow the engine's f-strings: `validation.py` (the Issues),
 * `optimizer.py` (search, plan_shape) and `network.py` (snap_to_network).
 * Codes in the contract would make this file unnecessary.
 */

import { decimal, t } from "../i18n";
import {
  distanceLabel,
  METRES_PER_FOOT,
  shortBelowM,
  shortDistanceLabel,
} from "../units/format";
import { appUnits } from "../units/units";

/**
 * How many notes the route shows at first (TASK-337): with more, the panel
 * grew over the map on the phone. The rest wait behind «Show more», never
 * dropped (ADR-0077). Notes about safety are always shown, even more of them.
 */
export const NOTES_AT_FIRST = 2;

/** How a note should look: something to watch for, or just to know. */
export type NoteTone = "caution" | "info";

export type Note = {
  tone: NoteTone;
  text: string;
  /** About safety, or a stretch that cannot be run or ridden (TASK-337):
   * never behind «Show more». */
  safety?: true;
};

type Rule = {
  pattern: RegExp;
  tone: NoteTone;
  safety?: true;
  say: (match: RegExpExecArray) => string;
};

/**
 * With «Miles» (TASK-182): "800 ft", to 50 feet and at least 50, or "1.2
 * mi" from a thousand feet up, with the comma of the app's language.
 */
function inMiles(m: number): string {
  return m < shortBelowM("mi")
    ? shortDistanceLabel(Math.max(m, 50 * METRES_PER_FOOT), "mi")
    : distanceLabel(m, "mi");
}

/** "250 m", or "1.2 km" from a thousand metres up; in the app's units. */
function metres(value: string): string {
  const m = Number(value);
  if (appUnits() === "mi") {
    return inMiles(m);
  }
  return m < 1000 ? `${Math.round(m)} m` : `${decimal(m / 1000)} km`;
}

/** The engine's own "250 m" or "1.5 km", in the app's units: in km as the
 * app's language writes the decimal ("1,5 km" in Italian, TASK-210), and
 * as it is when it does not read. */
function engineDistance(text: string): string {
  const match = /^(\d+(?:\.(\d+))?) (m|km)$/.exec(text);
  if (!match) {
    return text;
  }
  if (appUnits() === "mi") {
    return inMiles(Number(match[1]) * (match[3] === "km" ? 1000 : 1));
  }
  return match[2] === undefined
    ? text
    : `${decimal(Number(match[1]), match[2].length)} ${match[3]}`;
}

/**
 * A stretch with the bike on foot as the card says it (TASK-206): "920 m",
 * to 10 m and at least 10, or "1.1 km" ("1,1 km" in Italian) from a
 * thousand metres up. With «Miles», "900 ft" or "0.7 mi".
 */
export function roughMetres(m: number): string {
  if (appUnits() === "mi") {
    return inMiles(m);
  }
  const tens = Math.max(10, Math.round(m / 10) * 10);
  return tens < 1000 ? `${tens} m` : `${decimal(m / 1000)} km`;
}

const RULES: Rule[] = [
  {
    // optimizer.plan_shape, when the shape was placed away (ADR-0040). The
    // direction is one of optimizer._compass: "north", "north-east", ...
    pattern:
      /^start moved (.+?) ([a-z]+(?:-[a-z]+)*) of the requested point, where the shape closes/,
    tone: "info",
    // The direction is said as the run's heading is (runStats.ts).
    say: ([, distance, direction]) =>
      t(
        "The route starts {distance} {direction} of your start, where the shape fits the roads. Go to “Start here”.",
        { distance: engineDistance(distance), direction: t(direction) },
      ),
  },
  {
    pattern: /^(\d+(?:\.\d+)?) m of the route on steps$/,
    tone: "caution",
    safety: true,
    say: ([, m]) =>
      t("There are {distance} of steps along the way.", { distance: metres(m) }),
  },
  {
    pattern: /^(\d+(?:\.\d+)?) m of the route on main roads$/,
    tone: "caution",
    safety: true,
    say: ([, m]) =>
      t("{distance} runs along main roads, with traffic.", { distance: metres(m) }),
  },
  {
    // validation.py, a bike route walked in part (TASK-206, ADR-0167): the
    // stretches are part of the route and of its distance.
    pattern: /^(\d+(?:\.\d+)?) m of the route with the bike on foot$/,
    tone: "info",
    safety: true,
    say: ([, m]) =>
      t("Includes {distance} walking the bike.", { distance: roughMetres(Number(m)) }),
  },
  {
    pattern: /^(\d+(?:\.\d+)?) m of the route in tunnels$/,
    tone: "caution",
    safety: true,
    say: ([, m]) => t("{distance} runs through tunnels.", { distance: metres(m) }),
  },
  {
    pattern: /^(\d+)% of the route is on roads already travelled/,
    tone: "info",
    say: ([, share]) =>
      t("About {share}% of the route goes over the same roads twice.", { share }),
  },
  {
    pattern: /^(\d+)% of the route runs next to another stretch of it/,
    tone: "info",
    say: ([, share]) =>
      t("About {share}% of the route runs alongside itself.", { share }),
  },
  {
    pattern: /^distance on roads is ([+-])(\d+)% from the target/,
    tone: "info",
    say: ([, sign, share]) =>
      sign === "+"
        ? t("The route is {share}% longer than asked.", { share })
        : t("The route is {share}% shorter than asked.", { share }),
  },
  {
    pattern: /^shape similarity [\d.]+ is below [\d.]+/,
    tone: "caution",
    say: () => t("The roads here follow the shape only roughly."),
  },
  {
    pattern: /^sparse road network: shape points are (\d+) m from the nearest road/,
    tone: "caution",
    say: () => t("Few roads here: the route follows the shape loosely."),
  },
  {
    pattern: /^start is (\d+) m from the nearest road; the route begins there$/,
    tone: "info",
    say: ([, m]) =>
      t("The nearest road is {distance} away: the route begins there.", {
        distance: metres(m),
      }),
  },
  {
    pattern: /^no road path to shape point \d+; skipped$/,
    tone: "caution",
    say: () => t("A bit of the shape has no road to follow, so the route skips it."),
  },
];

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** One warning of the engine, as the app shows it. */
export function toNote(warning: string): Note {
  for (const rule of RULES) {
    const match = rule.pattern.exec(warning);
    if (match) {
      const note: Note = { tone: rule.tone, text: rule.say(match) };
      return rule.safety ? { ...note, safety: true } : note;
    }
  }
  return { tone: "info", text: capitalise(warning) };
}

/**
 * All the warnings, as notes: things to watch for first. The same sentence
 * twice (a skipped shape point each time) is shown once.
 */
export function toNotes(warnings: readonly string[]): Note[] {
  const notes: Note[] = [];
  for (const warning of warnings) {
    const note = toNote(warning);
    if (!notes.some((known) => known.text === note.text)) {
      notes.push(note);
    }
  }
  return [
    ...notes.filter((note) => note.tone === "caution"),
    ...notes.filter((note) => note.tone === "info"),
  ];
}

/**
 * The notes on screen (TASK-337), in their order: every note about safety,
 * and the first others up to two notes in all; or all of them once «Show
 * more» was pressed.
 */
export function shownNotes(notes: readonly Note[], all: boolean): Note[] {
  if (all) {
    return [...notes];
  }
  const room = NOTES_AT_FIRST - notes.filter((note) => note.safety).length;
  const others = notes.filter((note) => !note.safety).slice(0, Math.max(0, room));
  return notes.filter((note) => note.safety || others.includes(note));
}
