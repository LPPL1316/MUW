import { capital, type Phrasebook, type Place } from "./phrasebook";

/** "hacia el sendero" after a turn, "por el sendero" at the start. */
function place(words: string): Place {
  return { onto: `hacia ${words}`, on: `por ${words}` };
}

/** "un minuto", "5 minutos": one is said as a word, which agrees with its unit. */
function units(count: number, one: string, many: string): string {
  return count === 1 ? one : `${count} ${many}`;
}

/**
 * The voice in Spanish (TASK-209): written by the agent, listened to and
 * confirmed by the user on 2026-10-03, the bike on foot (TASK-206) too; the
 * bike's own phrases (TASK-216) are still to be confirmed (`docs/UI.md`,
 * «La voce della corsa»). A letter is
 * feminine: «la A».
 */
export const ES: Phrasebook = {
  turns: {
    depart: "Sal",
    left: "Gira a la izquierda",
    right: "Gira a la derecha",
    "sharp-left": "Gira bruscamente a la izquierda",
    "sharp-right": "Gira bruscamente a la derecha",
    straight: "Sigue recto",
    "u-turn": "Da media vuelta",
  },
  kinds: {
    footway: place("el camino peatonal"),
    pedestrian: place("la calle peatonal"),
    path: place("el sendero"),
    cycleway: place("el carril bici"),
    track: place("el camino de tierra"),
    steps: place("las escaleras"),
    service: place("la vía de servicio"),
    living_street: place("la calle"),
    residential: place("la calle"),
  },
  road: place("la carretera"),
  street: place,
  beside: (name) => `junto a ${name}`,
  inMetres: (metres, words) => `En ${metres} metros, ${words}`,
  then: "luego",
  offRoute: "Te has salido de la ruta. Vuelve a ella.",
  backOnRoute: "De nuevo en la ruta.",
  arrived: "Has llegado.",
  paused: "En pausa.",
  resumed: "Reanudamos.",
  stretch: "Recuerda estirar.",
  penUp: (letter) =>
    `Letra terminada. Camina hasta ${letter === null ? "la siguiente letra" : `la ${letter}`}: el dibujo está en pausa.`,
  penDown: (letter) =>
    `Baja el lápiz: dibuja ${letter === null ? "la siguiente letra" : `la ${letter}`}.`,
  // On a bike (TASK-216).
  rideTo: (letter) =>
    `Letra terminada. Pedalea hasta ${letter === null ? "la siguiente letra" : `la ${letter}`}: el dibujo está en pausa.`,
  // Between the pieces of a shape (TASK-223).
  partUp: "Parte terminada. Camina hasta la siguiente parte: el dibujo está en pausa.",
  partDown: "Baja el lápiz: dibuja la siguiente parte.",
  rideToPart:
    "Parte terminada. Pedalea hasta la siguiente parte: el dibujo está en pausa.",
  paddleToPart:
    "Parte terminada. Rema hasta la siguiente parte: el dibujo está en pausa.",
  hours: (count) => units(count, "una hora", "horas"),
  minutes: (count) => units(count, "un minuto", "minutos"),
  seconds: (count) => units(count, "un segundo", "segundos"),
  and: " y ",
  kilometre: (km, time, pace) =>
    `${capital(units(km, "un kilómetro", "kilómetros"))}. Tiempo: ${time}. Ritmo medio: ${pace} por kilómetro.`,
  cheer: "¡Vamos, a toda máquina!",
  // Each kilometre against the one before (TASK-217).
  kmFaster: (by) => `Este kilómetro: ${by} más rápido que el anterior.`,
  kmSlower: (by) => `Este kilómetro: ${by} más lento que el anterior.`,
  kmSamePace: "Mismo ritmo que el kilómetro anterior.",
  rideFaster: (km) =>
    `Los últimos ${km} kilómetros, más rápidos que los ${km} anteriores.`,
  rideSlower: (km) =>
    `Los últimos ${km} kilómetros, más lentos que los ${km} anteriores.`,
  rideSameSpeed: (km) =>
    `Los últimos ${km} kilómetros, a la misma velocidad que los ${km} anteriores.`,
  rideKilometres: (km, time, speed) =>
    `${capital(units(km, "un kilómetro", "kilómetros"))}. Tiempo: ${time}. Velocidad media: ${speed} kilómetros por hora.`,
  // The bike on foot (TASK-206).
  walkTheBike: (metres) => `bájate y empuja la bici durante ${metres} metros`,
  backOnTheBike: "Vuelve a subir a la bici.",
  // With miles (TASK-182): written by the agent, to be confirmed. «Milla»
  // is feminine.
  inFeet: (feet, words) => `En ${feet} pies, ${words}`,
  mile: (miles, time, pace) =>
    `${capital(units(miles, "una milla", "millas"))}. Tiempo: ${time}. Ritmo medio: ${pace} por milla.`,
  mileFaster: (by) => `Esta milla: ${by} más rápida que la anterior.`,
  mileSlower: (by) => `Esta milla: ${by} más lenta que la anterior.`,
  mileSamePace: "Mismo ritmo que la milla anterior.",
  rideMilesFaster: (miles) =>
    `Las últimas ${miles} millas, más rápidas que las ${miles} anteriores.`,
  rideMilesSlower: (miles) =>
    `Las últimas ${miles} millas, más lentas que las ${miles} anteriores.`,
  rideMilesSameSpeed: (miles) =>
    `Las últimas ${miles} millas, a la misma velocidad que las ${miles} anteriores.`,
  rideMiles: (miles, time, speed) =>
    `${capital(units(miles, "una milla", "millas"))}. Tiempo: ${time}. Velocidad media: ${speed} millas por hora.`,
  walkTheBikeFeet: (feet) => `bájate y empuja la bici durante ${feet} pies`,
  // On the water, the pace of 500 metres (TASK-251).
  paddleKilometre: (km, time, pace) =>
    `${capital(units(km, "un kilómetro", "kilómetros"))}. Tiempo: ${time}. Ritmo medio: ${pace} cada 500 metros.`,
  paddleMile: (miles, time, pace) =>
    `${capital(units(miles, "una milla", "millas"))}. Tiempo: ${time}. Ritmo medio: ${pace} cada 500 metros.`,
  // Fuera de la ruta, dónde está (TASK-303).
  routeAt: (metres, towards) =>
    `La ruta sigue a ${metres} metros, hacia el ${towards}.`,
  routeAtFeet: (feet, towards) => `La ruta sigue a ${feet} pies, hacia el ${towards}.`,
  compass: [
    "norte",
    "noreste",
    "este",
    "sureste",
    "sur",
    "suroeste",
    "oeste",
    "noroeste",
  ],
};
