import { capital, type Phrasebook, type Place } from "./phrasebook";

/** "sul sentiero" after a turn, "lungo il sentiero" at the start. */
function place(onto: string, on: string): Place {
  return { onto, on };
}

/** "un minuto", "5 minuti": one is said as a word, which agrees with its unit. */
function units(count: number, one: string, many: string): string {
  return count === 1 ? one : `${count} ${many}`;
}

/**
 * The voice in Italian (TASK-209): written by the agent and confirmed by
 * the user on 2026-10-03, who added «Daje, avanti tutta!» after the first
 * 5 km (`docs/UI.md`, «La voce della corsa»). A letter is feminine: «la A».
 */
export const IT: Phrasebook = {
  turns: {
    depart: "Parti",
    left: "Svolta a sinistra",
    right: "Svolta a destra",
    "sharp-left": "Svolta decisamente a sinistra",
    "sharp-right": "Svolta decisamente a destra",
    straight: "Prosegui dritto",
    "u-turn": "Torna indietro",
  },
  kinds: {
    footway: place("sul percorso pedonale", "lungo il percorso pedonale"),
    pedestrian: place("sulla via pedonale", "lungo la via pedonale"),
    path: place("sul sentiero", "lungo il sentiero"),
    cycleway: place("sulla pista ciclabile", "lungo la pista ciclabile"),
    track: place("sulla strada sterrata", "lungo la strada sterrata"),
    steps: place("sulla scalinata", "lungo la scalinata"),
    service: place("sulla strada di servizio", "lungo la strada di servizio"),
    living_street: place("sulla via", "lungo la via"),
    residential: place("sulla via", "lungo la via"),
  },
  road: place("sulla strada", "lungo la strada"),
  street: (name) => place(`su ${name}`, `lungo ${name}`),
  beside: (name) => `accanto a ${name}`,
  inMetres: (metres, words) => `Tra ${metres} metri, ${words}`,
  then: "poi",
  offRoute: "Sei fuori percorso. Torna sul percorso.",
  backOnRoute: "Di nuovo sul percorso.",
  arrived: "Hai raggiunto l'arrivo.",
  paused: "In pausa.",
  resumed: "Si riparte.",
  stretch: "Ricordati di fare stretching.",
  penUp: (letter) =>
    `Lettera finita. Cammina fino ${letter === null ? "alla lettera successiva" : `alla ${letter}`}: il disegno è in pausa.`,
  penDown: (letter) =>
    `Giù la penna: disegna ${letter === null ? "la lettera successiva" : `la ${letter}`}.`,
  // On a bike (TASK-216).
  rideTo: (letter) =>
    `Lettera finita. Pedala fino ${letter === null ? "alla lettera successiva" : `alla ${letter}`}: il disegno è in pausa.`,
  // Between the pieces of a shape (TASK-223).
  partUp: "Parte finita. Cammina fino alla parte successiva: il disegno è in pausa.",
  partDown: "Giù la penna: disegna la parte successiva.",
  rideToPart: "Parte finita. Pedala fino alla parte successiva: il disegno è in pausa.",
  paddleToPart:
    "Parte finita. Pagaia fino alla parte successiva: il disegno è in pausa.",
  hours: (count) => units(count, "un'ora", "ore"),
  minutes: (count) => units(count, "un minuto", "minuti"),
  seconds: (count) => units(count, "un secondo", "secondi"),
  and: " e ",
  kilometre: (km, time, pace) =>
    `${capital(units(km, "un chilometro", "chilometri"))}. Tempo: ${time}. Passo medio: ${pace} al chilometro.`,
  cheer: "Daje, avanti tutta!",
  // Each kilometre against the one before (TASK-217).
  kmFaster: (by) => `Questo chilometro: ${by} meglio del precedente.`,
  kmSlower: (by) => `Questo chilometro: ${by} peggio del precedente.`,
  kmSamePace: "Stesso passo del chilometro precedente.",
  rideFaster: (km) => `Ultimi ${km} chilometri più veloci dei ${km} precedenti.`,
  rideSlower: (km) => `Ultimi ${km} chilometri più lenti dei ${km} precedenti.`,
  rideSameSpeed: (km) =>
    `Ultimi ${km} chilometri alla stessa velocità dei ${km} precedenti.`,
  rideKilometres: (km, time, speed) =>
    `${capital(units(km, "un chilometro", "chilometri"))}. Tempo: ${time}. Velocità media: ${speed} chilometri orari.`,
  // The bike on foot (TASK-206).
  walkTheBike: (metres) => `scendi e porta la bici a mano per ${metres} metri`,
  backOnTheBike: "Risali in bici.",
  // With miles (TASK-182): written by the agent, to be confirmed by the
  // user. «Miglia» is feminine: «le ultime 5 miglia».
  inFeet: (feet, words) => `Tra ${feet} piedi, ${words}`,
  mile: (miles, time, pace) =>
    `${capital(units(miles, "un miglio", "miglia"))}. Tempo: ${time}. Passo medio: ${pace} al miglio.`,
  mileFaster: (by) => `Questo miglio: ${by} meglio del precedente.`,
  mileSlower: (by) => `Questo miglio: ${by} peggio del precedente.`,
  mileSamePace: "Stesso passo del miglio precedente.",
  rideMilesFaster: (miles) =>
    `Ultime ${miles} miglia più veloci delle ${miles} precedenti.`,
  rideMilesSlower: (miles) =>
    `Ultime ${miles} miglia più lente delle ${miles} precedenti.`,
  rideMilesSameSpeed: (miles) =>
    `Ultime ${miles} miglia alla stessa velocità delle ${miles} precedenti.`,
  rideMiles: (miles, time, speed) =>
    `${capital(units(miles, "un miglio", "miglia"))}. Tempo: ${time}. Velocità media: ${speed} miglia orarie.`,
  walkTheBikeFeet: (feet) => `scendi e porta la bici a mano per ${feet} piedi`,
  // On the water, the pace of 500 metres (TASK-251).
  paddleKilometre: (km, time, pace) =>
    `${capital(units(km, "un chilometro", "chilometri"))}. Tempo: ${time}. Passo medio: ${pace} ogni 500 metri.`,
  paddleMile: (miles, time, pace) =>
    `${capital(units(miles, "un miglio", "miglia"))}. Tempo: ${time}. Passo medio: ${pace} ogni 500 metri.`,
};
