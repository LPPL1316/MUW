import { capital, type Phrasebook, type Place } from "./phrasebook";

/** "sur le sentier" after a turn, "par le sentier" at the start. */
function place(words: string): Place {
  return { onto: `sur ${words}`, on: `par ${words}` };
}

/** "une minute", "5 minutes": one is said as a word, which agrees with its unit. */
function units(count: number, one: string, many: string): string {
  return count === 1 ? one : `${count} ${many}`;
}

/** "de Via Roma", "d'Avenue Foch": `de` loses its vowel before one. */
function of(name: string): string {
  return /^[aeiouyhàâäéèêëîïôöûüœæ]/i.test(name) ? `d'${name}` : `de ${name}`;
}

/**
 * The voice in French (TASK-209): written by the agent, listened to and
 * confirmed by the user on 2026-10-03, the bike on foot (TASK-206) too; the
 * bike's own phrases (TASK-216) are still to be confirmed (`docs/UI.md`,
 * «La voce della corsa»). A letter is
 * masculine: «le A», «jusqu'au A».
 */
export const FR: Phrasebook = {
  turns: {
    depart: "Partez",
    left: "Tournez à gauche",
    right: "Tournez à droite",
    "sharp-left": "Tournez fortement à gauche",
    "sharp-right": "Tournez fortement à droite",
    straight: "Continuez tout droit",
    "u-turn": "Faites demi-tour",
  },
  kinds: {
    footway: place("le chemin piéton"),
    pedestrian: place("la rue piétonne"),
    path: place("le sentier"),
    cycleway: place("la piste cyclable"),
    track: place("le chemin de terre"),
    steps: place("les escaliers"),
    service: place("la voie de service"),
    living_street: place("la rue"),
    residential: place("la rue"),
  },
  road: place("la route"),
  street: place,
  beside: (name) => `à côté ${of(name)}`,
  inMetres: (metres, words) => `Dans ${metres} mètres, ${words}`,
  then: "puis",
  offRoute: "Vous avez quitté le parcours. Revenez-y.",
  backOnRoute: "De retour sur le parcours.",
  arrived: "Vous êtes à l'arrivée.",
  paused: "En pause.",
  resumed: "Reprise.",
  stretch: "Pensez à vous étirer.",
  penUp: (letter) =>
    `Lettre terminée. Marchez jusqu'${letter === null ? "à la lettre suivante" : `au ${letter}`} : le dessin est en pause.`,
  penDown: (letter) =>
    `Stylo baissé : dessinez ${letter === null ? "la lettre suivante" : `le ${letter}`}.`,
  // On a bike (TASK-216).
  rideTo: (letter) =>
    `Lettre terminée. Roulez jusqu'${letter === null ? "à la lettre suivante" : `au ${letter}`} : le dessin est en pause.`,
  // Between the pieces of a shape (TASK-223).
  partUp:
    "Partie terminée. Marchez jusqu'à la partie suivante : le dessin est en pause.",
  partDown: "Stylo baissé : dessinez la partie suivante.",
  rideToPart:
    "Partie terminée. Roulez jusqu'à la partie suivante : le dessin est en pause.",
  paddleToPart:
    "Partie terminée. Pagayez jusqu'à la partie suivante : le dessin est en pause.",
  hours: (count) => units(count, "une heure", "heures"),
  minutes: (count) => units(count, "une minute", "minutes"),
  seconds: (count) => units(count, "une seconde", "secondes"),
  and: " ",
  kilometre: (km, time, pace) =>
    `${capital(units(km, "un kilomètre", "kilomètres"))}. Temps : ${time}. Allure moyenne : ${pace} au kilomètre.`,
  cheer: "Allez, en avant toute !",
  // Each kilometre against the one before (TASK-217).
  kmFaster: (by) => `Ce kilomètre : ${by} plus rapide que le précédent.`,
  kmSlower: (by) => `Ce kilomètre : ${by} plus lent que le précédent.`,
  kmSamePace: "Même allure que le kilomètre précédent.",
  rideFaster: (km) =>
    `Les ${km} derniers kilomètres ont été plus rapides que les ${km} précédents.`,
  rideSlower: (km) =>
    `Les ${km} derniers kilomètres ont été plus lents que les ${km} précédents.`,
  rideSameSpeed: (km) =>
    `Les ${km} derniers kilomètres ont été à la même vitesse que les ${km} précédents.`,
  rideKilometres: (km, time, speed) =>
    `${capital(units(km, "un kilomètre", "kilomètres"))}. Temps : ${time}. Vitesse moyenne : ${speed} kilomètres par heure.`,
  // The bike on foot (TASK-206).
  walkTheBike: (metres) => `descendez et poussez le vélo sur ${metres} mètres`,
  backOnTheBike: "Remontez sur le vélo.",
  // With miles (TASK-182): written by the agent, to be confirmed. «Mile»,
  // as the app's «Miles» in «Settings».
  inFeet: (feet, words) => `Dans ${feet} pieds, ${words}`,
  mile: (miles, time, pace) =>
    `${capital(units(miles, "un mile", "miles"))}. Temps : ${time}. Allure moyenne : ${pace} au mile.`,
  mileFaster: (by) => `Ce mile : ${by} plus rapide que le précédent.`,
  mileSlower: (by) => `Ce mile : ${by} plus lent que le précédent.`,
  mileSamePace: "Même allure que le mile précédent.",
  rideMilesFaster: (miles) =>
    `Les ${miles} derniers miles ont été plus rapides que les ${miles} précédents.`,
  rideMilesSlower: (miles) =>
    `Les ${miles} derniers miles ont été plus lents que les ${miles} précédents.`,
  rideMilesSameSpeed: (miles) =>
    `Les ${miles} derniers miles ont été à la même vitesse que les ${miles} précédents.`,
  rideMiles: (miles, time, speed) =>
    `${capital(units(miles, "un mile", "miles"))}. Temps : ${time}. Vitesse moyenne : ${speed} miles par heure.`,
  walkTheBikeFeet: (feet) => `descendez et poussez le vélo sur ${feet} pieds`,
  // On the water, the pace of 500 metres (TASK-251).
  paddleKilometre: (km, time, pace) =>
    `${capital(units(km, "un kilomètre", "kilomètres"))}. Temps : ${time}. Allure moyenne : ${pace} aux 500 mètres.`,
  paddleMile: (miles, time, pace) =>
    `${capital(units(miles, "un mile", "miles"))}. Temps : ${time}. Allure moyenne : ${pace} aux 500 mètres.`,
};
