import type { Phrasebook, Place } from "./phrasebook";

/** "onto the footpath" after a turn, "on the footpath" at the start. */
function onto(words: string): Place {
  return { onto: `onto ${words}`, on: `on ${words}` };
}

/** "1 hour", "5 minutes": a number with its unit. */
function units(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

function letterWords(letter: string | null): string {
  return letter === null ? "the next letter" : `the ${letter}`;
}

/**
 * The voice in English: the words it has said since TASK-049, unchanged,
 * and the language it speaks when nothing else is chosen (ADR-0171).
 */
export const EN: Phrasebook = {
  turns: {
    depart: "Head out",
    left: "Turn left",
    right: "Turn right",
    "sharp-left": "Turn sharp left",
    "sharp-right": "Turn sharp right",
    straight: "Continue straight",
    "u-turn": "Make a U-turn",
  },
  kinds: {
    footway: onto("the footpath"),
    pedestrian: onto("the pedestrian street"),
    path: onto("the path"),
    cycleway: onto("the cycle path"),
    track: onto("the track"),
    steps: onto("the steps"),
    service: onto("the service road"),
    living_street: onto("the street"),
    residential: onto("the street"),
  },
  road: onto("the road"),
  street: onto,
  beside: (name) => `beside ${name}`,
  inMetres: (metres, words) => `In ${metres} metres, ${words}`,
  then: "then",
  offRoute: "You are off the route. Head back to it.",
  backOnRoute: "Back on the route.",
  arrived: "You have arrived.",
  paused: "Paused.",
  resumed: "Resumed.",
  stretch: "Remember to stretch.",
  penUp: (letter) =>
    `Letter done. Walk to ${letterWords(letter)}: the drawing is paused.`,
  penDown: (letter) => `Pen down: draw ${letterWords(letter)}.`,
  // On a bike (TASK-216).
  rideTo: (letter) =>
    `Letter done. Ride to ${letterWords(letter)}: the drawing is paused.`,
  // Between the pieces of a shape (TASK-223).
  partUp: "Part done. Walk to the next part: the drawing is paused.",
  partDown: "Pen down: draw the next part.",
  rideToPart: "Part done. Ride to the next part: the drawing is paused.",
  // On the water (TASK-226).
  paddleToPart: "Part done. Paddle to the next part: the drawing is paused.",
  hours: (count) => units(count, "hour"),
  minutes: (count) => units(count, "minute"),
  seconds: (count) => units(count, "second"),
  and: " ",
  kilometre: (km, time, pace) =>
    `${units(km, "kilometre")}. Time: ${time}. Average pace: ${pace} per kilometre.`,
  cheer: "Come on, full speed ahead!",
  // Each kilometre against the one before (TASK-217).
  kmFaster: (by) => `${by} faster than the last kilometre.`,
  kmSlower: (by) => `${by} slower than the last kilometre.`,
  kmSamePace: "Same pace as the last kilometre.",
  rideFaster: (km) => `The last ${km} kilometres were faster than the ${km} before.`,
  rideSlower: (km) => `The last ${km} kilometres were slower than the ${km} before.`,
  rideSameSpeed: (km) =>
    `The last ${km} kilometres were at the same speed as the ${km} before.`,
  rideKilometres: (km, time, speed) =>
    `${units(km, "kilometre")}. Time: ${time}. Average speed: ${units(speed, "kilometre")} per hour.`,
  // The bike on foot (TASK-206).
  walkTheBike: (metres) => `get off and walk the bike for ${metres} metres`,
  backOnTheBike: "Back on the bike.",
  // With miles (TASK-182): the same phrases, in miles and feet.
  inFeet: (feet, words) => `In ${feet} feet, ${words}`,
  mile: (miles, time, pace) =>
    `${units(miles, "mile")}. Time: ${time}. Average pace: ${pace} per mile.`,
  mileFaster: (by) => `${by} faster than the last mile.`,
  mileSlower: (by) => `${by} slower than the last mile.`,
  mileSamePace: "Same pace as the last mile.",
  rideMilesFaster: (miles) =>
    `The last ${miles} miles were faster than the ${miles} before.`,
  rideMilesSlower: (miles) =>
    `The last ${miles} miles were slower than the ${miles} before.`,
  rideMilesSameSpeed: (miles) =>
    `The last ${miles} miles were at the same speed as the ${miles} before.`,
  rideMiles: (miles, time, speed) =>
    `${units(miles, "mile")}. Time: ${time}. Average speed: ${units(speed, "mile")} per hour.`,
  walkTheBikeFeet: (feet) => `get off and walk the bike for ${feet} feet`,
  // On the water, the pace of 500 metres (TASK-251).
  paddleKilometre: (km, time, pace) =>
    `${units(km, "kilometre")}. Time: ${time}. Average pace: ${pace} per 500 metres.`,
  paddleMile: (miles, time, pace) =>
    `${units(miles, "mile")}. Time: ${time}. Average pace: ${pace} per 500 metres.`,
};
