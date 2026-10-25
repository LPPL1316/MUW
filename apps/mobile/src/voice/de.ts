import { capital, type Phrasebook, type Place } from "./phrasebook";

/** "auf den Fußweg" after a turn, "auf dem Fußweg" at the start: German
 * changes the article. */
function place(onto: string, on: string): Place {
  return { onto, on };
}

/** "eine Minute", "5 Minuten": one is said as a word, which agrees with its unit. */
function units(count: number, one: string, many: string): string {
  return count === 1 ? one : `${count} ${many}`;
}

/**
 * The voice in German (TASK-209): written by the agent, listened to and
 * confirmed by the user on 2026-10-03, the bike on foot (TASK-206) too; the
 * bike's own phrases (TASK-216) are still to be confirmed (`docs/UI.md`,
 * «La voce della corsa»). Directions
 * as German navigation says them, verb last ("Links abbiegen auf …"); a
 * letter is neuter: «das A», «zum A».
 */
export const DE: Phrasebook = {
  turns: {
    depart: "Loslaufen",
    left: "Links abbiegen",
    right: "Rechts abbiegen",
    "sharp-left": "Scharf links abbiegen",
    "sharp-right": "Scharf rechts abbiegen",
    straight: "Geradeaus weiter",
    "u-turn": "Wenden",
  },
  kinds: {
    footway: place("auf den Fußweg", "auf dem Fußweg"),
    pedestrian: place("in die Fußgängerzone", "in der Fußgängerzone"),
    path: place("auf den Pfad", "auf dem Pfad"),
    cycleway: place("auf den Radweg", "auf dem Radweg"),
    track: place("auf den Feldweg", "auf dem Feldweg"),
    steps: place("auf die Treppe", "auf der Treppe"),
    service: place("auf die Zufahrtsstraße", "auf der Zufahrtsstraße"),
    living_street: place("in die Straße", "in der Straße"),
    residential: place("in die Straße", "in der Straße"),
  },
  road: place("auf die Straße", "auf der Straße"),
  street: (name) => place(`auf ${name}`, `auf ${name}`),
  beside: (name) => `neben ${name}`,
  inMetres: (metres, words) => `In ${metres} Metern ${words}`,
  then: "dann",
  offRoute: "Abseits der Route. Bitte zur Route zurückkehren.",
  backOnRoute: "Wieder auf der Route.",
  arrived: "Ziel erreicht.",
  paused: "Pausiert.",
  resumed: "Weiter geht's.",
  stretch: "Denk ans Dehnen.",
  penUp: (letter) =>
    `Buchstabe fertig. ${letter === null ? "Zum nächsten Buchstaben" : `Zum ${letter}`} gehen: die Zeichnung ist pausiert.`,
  penDown: (letter) =>
    `Stift aufsetzen: ${letter === null ? "den nächsten Buchstaben" : `das ${letter}`} zeichnen.`,
  // On a bike (TASK-216).
  rideTo: (letter) =>
    `Buchstabe fertig. ${letter === null ? "Zum nächsten Buchstaben" : `Zum ${letter}`} fahren: die Zeichnung ist pausiert.`,
  // Between the pieces of a shape (TASK-223).
  partUp: "Teil fertig. Zum nächsten Teil gehen: die Zeichnung ist pausiert.",
  partDown: "Stift aufsetzen: den nächsten Teil zeichnen.",
  rideToPart: "Teil fertig. Zum nächsten Teil fahren: die Zeichnung ist pausiert.",
  paddleToPart: "Teil fertig. Zum nächsten Teil paddeln: die Zeichnung ist pausiert.",
  hours: (count) => units(count, "eine Stunde", "Stunden"),
  minutes: (count) => units(count, "eine Minute", "Minuten"),
  seconds: (count) => units(count, "eine Sekunde", "Sekunden"),
  and: " ",
  kilometre: (km, time, pace) =>
    `${units(km, "Ein Kilometer", "Kilometer")}. Zeit: ${time}. Durchschnittstempo: ${pace} pro Kilometer.`,
  cheer: "Los, volle Kraft voraus!",
  // Each kilometre against the one before (TASK-217).
  kmFaster: (by) => `${capital(by)} schneller als der letzte Kilometer.`,
  kmSlower: (by) => `${capital(by)} langsamer als der letzte Kilometer.`,
  kmSamePace: "Gleiches Tempo wie der letzte Kilometer.",
  rideFaster: (km) =>
    `Die letzten ${km} Kilometer waren schneller als die ${km} davor.`,
  rideSlower: (km) =>
    `Die letzten ${km} Kilometer waren langsamer als die ${km} davor.`,
  rideSameSpeed: (km) =>
    `Die letzten ${km} Kilometer waren so schnell wie die ${km} davor.`,
  rideKilometres: (km, time, speed) =>
    `${units(km, "Ein Kilometer", "Kilometer")}. Zeit: ${time}. Durchschnittsgeschwindigkeit: ${speed} Kilometer pro Stunde.`,
  // The bike on foot (TASK-206).
  walkTheBike: (metres) => `absteigen und das Rad ${metres} Meter schieben`,
  backOnTheBike: "Wieder aufsteigen.",
  // With miles (TASK-182): written by the agent, to be confirmed.
  inFeet: (feet, words) => `In ${feet} Fuß ${words}`,
  mile: (miles, time, pace) =>
    `${units(miles, "Eine Meile", "Meilen")}. Zeit: ${time}. Durchschnittstempo: ${pace} pro Meile.`,
  mileFaster: (by) => `${capital(by)} schneller als die letzte Meile.`,
  mileSlower: (by) => `${capital(by)} langsamer als die letzte Meile.`,
  mileSamePace: "Gleiches Tempo wie die letzte Meile.",
  rideMilesFaster: (miles) =>
    `Die letzten ${miles} Meilen waren schneller als die ${miles} davor.`,
  rideMilesSlower: (miles) =>
    `Die letzten ${miles} Meilen waren langsamer als die ${miles} davor.`,
  rideMilesSameSpeed: (miles) =>
    `Die letzten ${miles} Meilen waren so schnell wie die ${miles} davor.`,
  rideMiles: (miles, time, speed) =>
    `${units(miles, "Eine Meile", "Meilen")}. Zeit: ${time}. Durchschnittsgeschwindigkeit: ${speed} Meilen pro Stunde.`,
  walkTheBikeFeet: (feet) => `absteigen und das Rad ${feet} Fuß schieben`,
  // On the water, the pace of 500 metres (TASK-251).
  paddleKilometre: (km, time, pace) =>
    `${units(km, "Ein Kilometer", "Kilometer")}. Zeit: ${time}. Durchschnittstempo: ${pace} pro 500 Meter.`,
  paddleMile: (miles, time, pace) =>
    `${units(miles, "Eine Meile", "Meilen")}. Zeit: ${time}. Durchschnittstempo: ${pace} pro 500 Meter.`,
};
