import type { Direction, Turn } from "@shaperoute/shared-types";

import { roundMetres } from "../navigation/phrases";
import { roundFeet } from "../units/runFormat";
import type { Units } from "../units/units";

/**
 * What the voice says along a run, in one language (TASK-209, ADR-0171).
 * Each language writes its words once (`en.ts`, `it.ts`, …) and
 * `voiceWords` puts them together the same way for all: the navigator
 * decides when to speak and what about, these say it. Only what is said:
 * what the screen writes, the banner too, is the app's (TASK-210). With
 * miles (TASK-182, ADR-0149) the same phrases say miles and feet: each
 * language writes those too, beside the ones in kilometres and metres,
 * which stay as they were.
 */

/** The kinds of road the voice names when OpenStreetMap gives no name
 * (ADR-0045): a runner meets these; any other is "the road". */
export const KINDS = [
  "footway",
  "pedestrian",
  "path",
  "cycleway",
  "track",
  "steps",
  "service",
  "living_street",
  "residential",
] as const;

export type Kind = (typeof KINDS)[number];

/** The kilometre after which the voice cheers the runner on (the user's
 * choice, 2026-10-03): «Daje, avanti tutta!» after the first 5 km. */
export const CHEER_KM = 5;

/** With miles, the mile after which the voice cheers (TASK-182): the one
 * nearest to CHEER_KM, 4.8 km into the run. */
export const CHEER_MI = 3;

/** Where a direction goes, as said after a turn ("onto the footpath") and
 * at the start ("on the footpath"): some languages change the words. */
export type Place = { onto: string; on: string };

/** A language's words for the voice. */
export type Phrasebook = {
  /** "Turn left", "Continue straight"; the departure: "Head out". */
  turns: Record<Turn, string>;
  /** A road without a name, by its kind: never a name made up (ADR-0045). */
  kinds: Record<Kind, Place>;
  /** A road without a name of any other kind. */
  road: Place;
  /** A road by its own name, which is never translated (ADR-0057). */
  street(name: string): Place;
  /** The street a nameless road runs beside (ADR-0058): "beside Via Roma". */
  beside(name: string): string;
  /** "In 50 metres, turn left…": `metres` is rounded, `words` start in
   * lower case. */
  inMetres(metres: number, words: string): string;
  /** Before each direction said after the first: "then". */
  then: string;
  offRoute: string;
  backOnRoute: string;
  arrived: string;
  /** The pause by standing still, and the run going on (TASK-169). */
  paused: string;
  resumed: string;
  /** At the end of the run, before «Your run» (TASK-285): "Remember to
   * stretch." */
  stretch: string;
  /** The end of a letter with the pen up, and the start of the next
   * (TASK-198); `letter` is null when the word does not say which. */
  penUp(letter: string | null): string;
  penDown(letter: string | null): string;
  /** The end of a letter with the pen up on a bike (TASK-216): "Letter
   * done. Ride to the U: the drawing is paused." */
  rideTo(letter: string | null): string;
  /** The same between the pieces of a shape (TASK-223), which have no
   * name: "Part done. Walk to the next part: the drawing is paused.",
   * "Pen down: draw the next part.", on a bike "Ride to", and on the water
   * "Paddle to" (TASK-226). */
  partUp: string;
  partDown: string;
  rideToPart: string;
  paddleToPart: string;
  /** A part of a time, with its unit: "1 hour", "5 minutes", "42 seconds". */
  hours(count: number): string;
  minutes(count: number): string;
  seconds(count: number): string;
  /** Between two parts of a time: " " in English, " e " in Italian. */
  and: string;
  /** Each kilometre, with the time so far and the average pace, both
   * already said as times. */
  kilometre(km: number, time: string, pace: string): string;
  /** Said after the kilometre CHEER_KM: «Daje, avanti tutta!». */
  cheer: string;
  /** After each kilometre from the second (TASK-217): the kilometre against
   * the one before, `by` a time already said ("12 seconds"), or at the same
   * pace. */
  kmFaster(by: string): string;
  kmSlower(by: string): string;
  kmSamePace: string;
  /** The same on a bike, the last `km` kilometres against the `km` before,
   * in speed and with no numbers (TASK-217). */
  rideFaster(km: number): string;
  rideSlower(km: number): string;
  rideSameSpeed(km: number): string;
  /** Every RIDE_KM_EVERY kilometres on a bike (TASK-216), with the time so
   * far, already said as a time, and the average speed in whole km/h. */
  rideKilometres(km: number, time: string, speed: number): string;
  /** A stretch of a bike route with the bike on foot (TASK-206): "get off
   * and walk the bike for 200 metres", in lower case, said after
   * `inMetres` or alone; `metres` is rounded. */
  walkTheBike(metres: number): string;
  /** Its end: "Back on the bike." */
  backOnTheBike: string;
  /** With miles (TASK-182), a short distance is said in feet: "In 150
   * feet, turn left…"; `feet` is rounded, `words` start in lower case. */
  inFeet(feet: number, words: string): string;
  /** Each mile, as `kilometre` each kilometre: the time so far and the
   * average pace for a mile, both already said as times. */
  mile(miles: number, time: string, pace: string): string;
  /** After each mile from the second, the mile against the one before, as
   * `kmFaster`, `kmSlower` and `kmSamePace`. */
  mileFaster(by: string): string;
  mileSlower(by: string): string;
  mileSamePace: string;
  /** On a bike, the last `miles` miles against the `miles` before, as
   * `rideFaster`, `rideSlower` and `rideSameSpeed`. */
  rideMilesFaster(miles: number): string;
  rideMilesSlower(miles: number): string;
  rideMilesSameSpeed(miles: number): string;
  /** Every RIDE_MI_EVERY miles on a bike, as `rideKilometres`: the average
   * speed in whole miles per hour. */
  rideMiles(miles: number, time: string, speed: number): string;
  /** As `walkTheBike`, in feet: "get off and walk the bike for 650 feet". */
  walkTheBikeFeet(feet: number): string;
  /** Each kilometre on the water (TASK-251), as `kilometre`: the time so
   * far and the average pace of 500 metres, both already said as times. */
  paddleKilometre(km: number, time: string, pace: string): string;
  /** The same with miles: each mile, and the pace of 500 metres still. */
  paddleMile(miles: number, time: string, pace: string): string;
};

/** The voice's phrases in one language, ready to say. */
export type VoiceWords = {
  /** "Turn left onto Via Roma"; the departure says where it starts:
   * "Head out on Via Roma". */
  direction(direction: Direction): string;
  /**
   * The words said before a junction: "In 50 metres, turn left onto Via
   * Roma, then turn right onto the footpath". `chain` is the direction and
   * those joined to it (a street crossed in a few metres), said together;
   * with `inM` null, the first is said as it is. With miles, the same
   * metres are said in feet: "In 150 feet, turn left…" (TASK-182).
   */
  announcement(chain: readonly Direction[], inM: number | null): string;
  /** "25 minutes 10 seconds", "1 hour 2 minutes": a time as said. */
  time(ms: number): string;
  /** "1 kilometre. Time: … Average pace: … per kilometre."; the kilometre
   * CHEER_KM ends with the cheer. */
  kilometre(km: number, ms: number, paceMs: number): string;
  /** "12 seconds faster than the last kilometre.", "8 seconds slower…",
   * "Same pace as the last kilometre." (TASK-217): `seconds` whole, said
   * as a time once they are a minute. */
  kmFaster(seconds: number): string;
  kmSlower(seconds: number): string;
  kmSamePace: string;
  /** "The last 10 kilometres were faster than the 10 before.", on a bike
   * (TASK-217). */
  rideFaster(km: number): string;
  rideSlower(km: number): string;
  rideSameSpeed(km: number): string;
  offRoute: string;
  backOnRoute: string;
  arrived: string;
  paused: string;
  resumed: string;
  stretch: string;
  penUp(letter: string | null): string;
  penDown(letter: string | null): string;
  /** The end of a letter with the pen up, on a bike (TASK-216). */
  rideTo(letter: string | null): string;
  /** The same between the pieces of a shape (TASK-223), on the water too
   * (TASK-226). */
  partUp: string;
  partDown: string;
  rideToPart: string;
  paddleToPart: string;
  /** "10 kilometres. Time: … Average speed: 24 kilometres per hour.", on a
   * bike (TASK-216): `speed` in km/h, already whole. */
  rideKilometres(km: number, ms: number, speed: number): string;
  /** "In 50 metres, get off and walk the bike for 200 metres."; with `inM`
   * null, from here: "Get off and walk the bike for 200 metres." (TASK-206).
   * With miles, both in feet: "In 150 feet, get off and walk the bike for
   * 650 feet." (TASK-182). */
  walkTheBike(inM: number | null, metres: number): string;
  backOnTheBike: string;
  /** With miles (TASK-182): "1 mile. Time: … Average pace: … per mile.",
   * `paceMs` the time of a mile; the mile CHEER_MI ends with the cheer. */
  mile(miles: number, ms: number, paceMs: number): string;
  /** "12 seconds faster than the last mile.", "8 seconds slower…", "Same
   * pace as the last mile.": as `kmFaster`, `kmSlower` and `kmSamePace`. */
  mileFaster(seconds: number): string;
  mileSlower(seconds: number): string;
  mileSamePace: string;
  /** "The last 5 miles were faster than the 5 before.", on a bike. */
  rideMilesFaster(miles: number): string;
  rideMilesSlower(miles: number): string;
  rideMilesSameSpeed(miles: number): string;
  /** "5 miles. Time: … Average speed: 15 miles per hour.", on a bike:
   * `speed` in mph, already whole. */
  rideMiles(miles: number, ms: number, speed: number): string;
  /** "1 kilometre. Time: … Average pace: … per 500 metres.", on the water
   * (TASK-251): `paceMs` the time of 500 metres; the kilometre CHEER_KM
   * ends with the cheer. */
  paddleKilometre(km: number, ms: number, paceMs: number): string;
  /** With miles: "1 mile. Time: … Average pace: … per 500 metres."; the
   * mile CHEER_MI ends with the cheer. */
  paddleMile(miles: number, ms: number, paceMs: number): string;
};

function isKind(kind: string): kind is Kind {
  return (KINDS as readonly string[]).includes(kind);
}

function lower(words: string): string {
  return words.charAt(0).toLowerCase() + words.slice(1);
}

/**
 * The phrases of `book`, put together as every language does. With `units`
 * miles the short distances, which stay the navigator's metres, are said in
 * feet (TASK-182); in kilometres, as always, in metres.
 */
export function voiceWords(book: Phrasebook, units: Units = "km"): VoiceWords {
  /** "In 50 metres, …" or, with miles, "In 150 feet, …". */
  function inShort(metres: number, words: string): string {
    return units === "mi"
      ? book.inFeet(roundFeet(metres), words)
      : book.inMetres(roundMetres(metres), words);
  }

  /** The road the direction goes onto, or null when OSM says nothing. */
  function place(direction: Direction): Place | null {
    if (direction.street) {
      return book.street(direction.street);
    }
    // A merged edge can be "footway / steps": the first kind is enough.
    const kind = direction.road_type?.split(" / ")[0];
    if (!kind) {
      return null;
    }
    return isKind(kind) ? book.kinds[kind] : book.road;
  }

  function direction(direction: Direction): string {
    const where = place(direction);
    const words =
      where === null ? "" : ` ${direction.turn === "depart" ? where.on : where.onto}`;
    // `street` always wins over `along`, which is missing from an API older
    // than TASK-060.
    const beside =
      !direction.street && direction.along ? ` ${book.beside(direction.along)}` : "";
    return `${book.turns[direction.turn]}${words}${beside}`;
  }

  function time(ms: number): string {
    const total = Math.max(0, Math.round(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (hours > 0) {
      return minutes > 0
        ? `${book.hours(hours)}${book.and}${book.minutes(minutes)}`
        : book.hours(hours);
    }
    if (minutes === 0) {
      return book.seconds(seconds);
    }
    return seconds > 0
      ? `${book.minutes(minutes)}${book.and}${book.seconds(seconds)}`
      : book.minutes(minutes);
  }

  return {
    direction,
    announcement(chain, inM) {
      const said = chain.map(direction);
      const first = inM === null ? said[0] : inShort(inM, lower(said[0]));
      return [
        first,
        ...said.slice(1).map((words) => `${book.then} ${lower(words)}`),
      ].join(", ");
    },
    time,
    kilometre(km, ms, paceMs) {
      const said = book.kilometre(km, time(ms), time(paceMs));
      return km === CHEER_KM ? `${said} ${book.cheer}` : said;
    },
    kmFaster: (seconds) => book.kmFaster(time(seconds * 1000)),
    kmSlower: (seconds) => book.kmSlower(time(seconds * 1000)),
    kmSamePace: book.kmSamePace,
    rideFaster: book.rideFaster,
    rideSlower: book.rideSlower,
    rideSameSpeed: book.rideSameSpeed,
    offRoute: book.offRoute,
    backOnRoute: book.backOnRoute,
    arrived: book.arrived,
    paused: book.paused,
    resumed: book.resumed,
    stretch: book.stretch,
    penUp: book.penUp,
    penDown: book.penDown,
    rideTo: book.rideTo,
    partUp: book.partUp,
    partDown: book.partDown,
    rideToPart: book.rideToPart,
    paddleToPart: book.paddleToPart,
    rideKilometres(km, ms, speed) {
      return book.rideKilometres(km, time(ms), speed);
    },
    walkTheBike(inM, metres) {
      const words =
        units === "mi"
          ? book.walkTheBikeFeet(roundFeet(metres))
          : book.walkTheBike(roundMetres(metres));
      return inM === null ? `${capital(words)}.` : `${inShort(inM, words)}.`;
    },
    backOnTheBike: book.backOnTheBike,
    mile(miles, ms, paceMs) {
      const said = book.mile(miles, time(ms), time(paceMs));
      return miles === CHEER_MI ? `${said} ${book.cheer}` : said;
    },
    mileFaster: (seconds) => book.mileFaster(time(seconds * 1000)),
    mileSlower: (seconds) => book.mileSlower(time(seconds * 1000)),
    mileSamePace: book.mileSamePace,
    rideMilesFaster: book.rideMilesFaster,
    rideMilesSlower: book.rideMilesSlower,
    rideMilesSameSpeed: book.rideMilesSameSpeed,
    rideMiles(miles, ms, speed) {
      return book.rideMiles(miles, time(ms), speed);
    },
    paddleKilometre(km, ms, paceMs) {
      const said = book.paddleKilometre(km, time(ms), time(paceMs));
      return km === CHEER_KM ? `${said} ${book.cheer}` : said;
    },
    paddleMile(miles, ms, paceMs) {
      const said = book.paddleMile(miles, time(ms), time(paceMs));
      return miles === CHEER_MI ? `${said} ${book.cheer}` : said;
    },
  };
}

/** `words` with a capital first letter: a phrase that opens a sentence. */
export function capital(words: string): string {
  return words.charAt(0).toUpperCase() + words.slice(1);
}
