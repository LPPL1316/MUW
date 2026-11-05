import type { Language } from "../i18n/languages";
import type { GymGroup } from "./catalog";

/**
 * The groups of the catalog in «+ Exercise» (TASK-385 part B), in the
 * app's five languages as the user approved them on 2026-11-04. Here, as
 * the names of the exercises are in catalog.ts, and not through `t()`:
 * «Back» is already «Indietro» there, the way back, not the back.
 */

export const GYM_GROUPS: readonly GymGroup[] = [
  "chest",
  "back",
  "legs",
  "shoulders",
  "arms",
  "core",
  "full_body",
  "cardio",
];

const NAMES: Readonly<Record<GymGroup, Readonly<Record<Language, string>>>> = {
  chest: { en: "Chest", it: "Petto", de: "Brust", fr: "Pectoraux", es: "Pecho" },
  back: { en: "Back", it: "Schiena", de: "Rücken", fr: "Dos", es: "Espalda" },
  legs: { en: "Legs", it: "Gambe", de: "Beine", fr: "Jambes", es: "Piernas" },
  shoulders: {
    en: "Shoulders",
    it: "Spalle",
    de: "Schultern",
    fr: "Épaules",
    es: "Hombros",
  },
  arms: { en: "Arms", it: "Braccia", de: "Arme", fr: "Bras", es: "Brazos" },
  core: { en: "Core", it: "Addome", de: "Bauch", fr: "Abdos", es: "Abdomen" },
  full_body: {
    en: "Full body",
    it: "Total body",
    de: "Ganzkörper",
    fr: "Corps entier",
    es: "Cuerpo completo",
  },
  cardio: { en: "Cardio", it: "Cardio", de: "Cardio", fr: "Cardio", es: "Cardio" },
};

export function groupName(group: GymGroup, language: Language): string {
  return NAMES[group][language];
}
