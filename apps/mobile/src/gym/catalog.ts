import type { GymSetKind } from "@shaperoute/shared-types";

import type { Language } from "../i18n/languages";

/**
 * The exercises of a workout at the gym (TASK-385, ADR-0327): the catalog
 * of docs/sports/gym.md, with its names in the app's five languages
 * (approved by the user on 2026-11-04). The keys, kinds and groups are
 * those of packages/shared-types/fixtures/gym-exercises.json, the same as
 * the API's gym_catalog.py: catalog.test.ts compares them.
 */
export type GymGroup =
  "chest" | "back" | "legs" | "shoulders" | "arms" | "core" | "full_body" | "cardio";

export type GymExercise = {
  key: string;
  group: GymGroup;
  kind: GymSetKind;
  names: Readonly<Record<Language, string>>;
};

function exercise(
  key: string,
  group: GymGroup,
  kind: GymSetKind,
  [en, it, de, fr, es]: readonly [string, string, string, string, string],
): GymExercise {
  return { key, group, kind, names: { en, it, de, fr, es } };
}

export const GYM_EXERCISES: readonly GymExercise[] = [
  exercise("bench_press", "chest", "load", [
    "Bench press",
    "Panca piana",
    "Bankdrücken",
    "Développé couché",
    "Press de banca",
  ]),
  exercise("incline_bench_press", "chest", "load", [
    "Incline bench press",
    "Panca inclinata",
    "Schrägbankdrücken",
    "Développé incliné",
    "Press inclinado",
  ]),
  exercise("decline_bench_press", "chest", "load", [
    "Decline bench press",
    "Panca declinata",
    "Negativbankdrücken",
    "Développé décliné",
    "Press declinado",
  ]),
  exercise("dumbbell_bench_press", "chest", "load", [
    "Dumbbell bench press",
    "Panca con manubri",
    "Kurzhantel-Bankdrücken",
    "Développé couché haltères",
    "Press de banca con mancuernas",
  ]),
  exercise("dumbbell_fly", "chest", "load", [
    "Dumbbell fly",
    "Croci con manubri",
    "Kurzhantel-Fliegende",
    "Écarté haltères",
    "Aperturas con mancuernas",
  ]),
  exercise("chest_press_machine", "chest", "load", [
    "Chest press machine",
    "Chest press",
    "Brustpresse",
    "Presse pectorale",
    "Press de pecho en máquina",
  ]),
  exercise("pec_deck", "chest", "load", [
    "Pec deck",
    "Pectoral machine",
    "Butterfly-Maschine",
    "Pec deck",
    "Contractor de pecho",
  ]),
  exercise("cable_crossover", "chest", "load", [
    "Cable crossover",
    "Croci ai cavi",
    "Kabelzug-Crossover",
    "Croisé à la poulie",
    "Cruce de poleas",
  ]),
  exercise("push_up", "chest", "bodyweight", [
    "Push-up",
    "Piegamenti",
    "Liegestütze",
    "Pompes",
    "Flexiones",
  ]),
  exercise("dips", "chest", "bodyweight", [
    "Dips",
    "Dip alle parallele",
    "Dips",
    "Dips",
    "Fondos",
  ]),
  exercise("deadlift", "back", "load", [
    "Deadlift",
    "Stacco da terra",
    "Kreuzheben",
    "Soulevé de terre",
    "Peso muerto",
  ]),
  exercise("pull_up", "back", "bodyweight", [
    "Pull-up",
    "Trazioni",
    "Klimmzüge",
    "Tractions",
    "Dominadas",
  ]),
  exercise("chin_up", "back", "bodyweight", [
    "Chin-up",
    "Trazioni presa inversa",
    "Klimmzüge im Untergriff",
    "Tractions en supination",
    "Dominadas supinas",
  ]),
  exercise("assisted_pull_up", "back", "load", [
    "Assisted pull-up machine",
    "Trazioni assistite",
    "Klimmzugmaschine mit Unterstützung",
    "Tractions assistées",
    "Dominadas asistidas",
  ]),
  exercise("lat_pulldown", "back", "load", [
    "Lat pulldown",
    "Lat machine",
    "Latziehen",
    "Tirage vertical",
    "Jalón al pecho",
  ]),
  exercise("seated_cable_row", "back", "load", [
    "Seated cable row",
    "Pulley basso",
    "Rudern am Kabel",
    "Tirage horizontal",
    "Remo en polea baja",
  ]),
  exercise("row_machine", "back", "load", [
    "Seated row machine",
    "Rematore alla macchina",
    "Rudermaschine",
    "Rowing machine guidée",
    "Remo en máquina",
  ]),
  exercise("barbell_row", "back", "load", [
    "Barbell row",
    "Rematore con bilanciere",
    "Langhantelrudern",
    "Rowing barre",
    "Remo con barra",
  ]),
  exercise("dumbbell_row", "back", "load", [
    "Dumbbell row",
    "Rematore con manubrio",
    "Kurzhantelrudern",
    "Rowing haltère",
    "Remo con mancuerna",
  ]),
  exercise("t_bar_row", "back", "load", [
    "T-bar row",
    "Rematore T-bar",
    "T-Bar-Rudern",
    "Rowing T-bar",
    "Remo en barra T",
  ]),
  exercise("straight_arm_pulldown", "back", "load", [
    "Straight-arm pulldown",
    "Pullover ai cavi",
    "Überzüge am Kabel",
    "Pull-over à la poulie",
    "Pullover en polea",
  ]),
  exercise("back_extension", "back", "bodyweight", [
    "Back extension",
    "Hyperextension",
    "Rückenstrecker",
    "Extension lombaire",
    "Hiperextensiones",
  ]),
  exercise("back_squat", "legs", "load", [
    "Squat",
    "Squat",
    "Kniebeuge",
    "Squat",
    "Sentadilla",
  ]),
  exercise("front_squat", "legs", "load", [
    "Front squat",
    "Front squat",
    "Frontkniebeuge",
    "Squat avant",
    "Sentadilla frontal",
  ]),
  exercise("smith_squat", "legs", "load", [
    "Smith machine squat",
    "Squat al multipower",
    "Kniebeuge an der Multipresse",
    "Squat à la Smith machine",
    "Sentadilla en multipower",
  ]),
  exercise("leg_press", "legs", "load", [
    "Leg press",
    "Leg press",
    "Beinpresse",
    "Presse à cuisses",
    "Prensa de piernas",
  ]),
  exercise("hack_squat", "legs", "load", [
    "Hack squat",
    "Hack squat",
    "Hackenschmidt-Kniebeuge",
    "Hack squat",
    "Sentadilla hack",
  ]),
  exercise("leg_extension", "legs", "load", [
    "Leg extension",
    "Leg extension",
    "Beinstrecker",
    "Leg extension",
    "Extensión de cuádriceps",
  ]),
  exercise("leg_curl", "legs", "load", [
    "Leg curl",
    "Leg curl",
    "Beinbeuger",
    "Leg curl",
    "Curl femoral",
  ]),
  exercise("romanian_deadlift", "legs", "load", [
    "Romanian deadlift",
    "Stacco rumeno",
    "Rumänisches Kreuzheben",
    "Soulevé de terre roumain",
    "Peso muerto rumano",
  ]),
  exercise("lunge", "legs", "load", [
    "Lunges",
    "Affondi",
    "Ausfallschritte",
    "Fentes",
    "Zancadas",
  ]),
  exercise("bulgarian_split_squat", "legs", "load", [
    "Bulgarian split squat",
    "Squat bulgaro",
    "Bulgarische Kniebeuge",
    "Squat bulgare",
    "Sentadilla búlgara",
  ]),
  exercise("step_up", "legs", "load", [
    "Step-up",
    "Step-up",
    "Step-ups",
    "Step-up",
    "Subidas al cajón",
  ]),
  exercise("hip_thrust", "legs", "load", [
    "Hip thrust",
    "Hip thrust",
    "Hip Thrust",
    "Hip thrust",
    "Hip thrust",
  ]),
  exercise("glute_machine", "legs", "load", [
    "Glute machine",
    "Glute machine",
    "Gesäßmaschine",
    "Machine à fessiers",
    "Máquina de glúteos",
  ]),
  exercise("hip_abduction", "legs", "load", [
    "Hip abduction machine",
    "Abductor machine",
    "Abduktorenmaschine",
    "Machine à abducteurs",
    "Máquina de abductores",
  ]),
  exercise("hip_adduction", "legs", "load", [
    "Hip adduction machine",
    "Adductor machine",
    "Adduktorenmaschine",
    "Machine à adducteurs",
    "Máquina de aductores",
  ]),
  exercise("standing_calf_raise", "legs", "load", [
    "Standing calf raise",
    "Calf raise in piedi",
    "Wadenheben stehend",
    "Mollets debout",
    "Elevación de talones de pie",
  ]),
  exercise("seated_calf_raise", "legs", "load", [
    "Seated calf raise",
    "Calf raise seduto",
    "Wadenheben sitzend",
    "Mollets assis",
    "Elevación de talones sentado",
  ]),
  exercise("overhead_press", "shoulders", "load", [
    "Overhead press",
    "Lento avanti",
    "Schulterdrücken",
    "Développé militaire",
    "Press militar",
  ]),
  exercise("dumbbell_shoulder_press", "shoulders", "load", [
    "Dumbbell shoulder press",
    "Shoulder press con manubri",
    "Kurzhantel-Schulterdrücken",
    "Développé épaules haltères",
    "Press de hombros con mancuernas",
  ]),
  exercise("shoulder_press_machine", "shoulders", "load", [
    "Shoulder press machine",
    "Shoulder press alla macchina",
    "Schulterpresse",
    "Presse épaules",
    "Press de hombros en máquina",
  ]),
  exercise("lateral_raise", "shoulders", "load", [
    "Lateral raise",
    "Alzate laterali",
    "Seitheben",
    "Élévations latérales",
    "Elevaciones laterales",
  ]),
  exercise("front_raise", "shoulders", "load", [
    "Front raise",
    "Alzate frontali",
    "Frontheben",
    "Élévations frontales",
    "Elevaciones frontales",
  ]),
  exercise("rear_delt_fly", "shoulders", "load", [
    "Rear delt fly",
    "Alzate posteriori",
    "Reverse Flys",
    "Oiseau",
    "Pájaros",
  ]),
  exercise("reverse_pec_deck", "shoulders", "load", [
    "Reverse pec deck",
    "Reverse pectoral machine",
    "Reverse-Butterfly",
    "Pec deck inversé",
    "Contractor inverso",
  ]),
  exercise("face_pull", "shoulders", "load", [
    "Face pull",
    "Face pull",
    "Face Pulls",
    "Face pull",
    "Face pull",
  ]),
  exercise("upright_row", "shoulders", "load", [
    "Upright row",
    "Tirate al mento",
    "Aufrechtes Rudern",
    "Rowing menton",
    "Remo al mentón",
  ]),
  exercise("shrug", "shoulders", "load", [
    "Shrugs",
    "Scrollate",
    "Shrugs",
    "Shrugs",
    "Encogimientos",
  ]),
  exercise("barbell_curl", "arms", "load", [
    "Barbell curl",
    "Curl con bilanciere",
    "Langhantel-Curls",
    "Curl barre",
    "Curl con barra",
  ]),
  exercise("dumbbell_curl", "arms", "load", [
    "Dumbbell curl",
    "Curl con manubri",
    "Kurzhantel-Curls",
    "Curl haltères",
    "Curl con mancuernas",
  ]),
  exercise("hammer_curl", "arms", "load", [
    "Hammer curl",
    "Curl a martello",
    "Hammer-Curls",
    "Curl marteau",
    "Curl martillo",
  ]),
  exercise("preacher_curl", "arms", "load", [
    "Preacher curl",
    "Curl alla panca Scott",
    "Scott-Curls",
    "Curl au pupitre",
    "Curl predicador",
  ]),
  exercise("cable_curl", "arms", "load", [
    "Cable curl",
    "Curl ai cavi",
    "Kabel-Curls",
    "Curl à la poulie",
    "Curl en polea",
  ]),
  exercise("biceps_curl_machine", "arms", "load", [
    "Biceps curl machine",
    "Curl alla macchina",
    "Bizepsmaschine",
    "Machine à biceps",
    "Máquina de bíceps",
  ]),
  exercise("triceps_pushdown", "arms", "load", [
    "Triceps pushdown",
    "Push down ai cavi",
    "Trizepsdrücken am Kabel",
    "Extension triceps à la poulie",
    "Extensión de tríceps en polea",
  ]),
  exercise("skull_crusher", "arms", "load", [
    "Skull crusher",
    "French press",
    "French Press",
    "Barre au front",
    "Press francés",
  ]),
  exercise("overhead_triceps_extension", "arms", "load", [
    "Overhead triceps extension",
    "Estensioni sopra la testa",
    "Trizepsstrecken über Kopf",
    "Extension triceps au-dessus de la tête",
    "Extensión de tríceps sobre la cabeza",
  ]),
  exercise("close_grip_bench_press", "arms", "load", [
    "Close-grip bench press",
    "Panca presa stretta",
    "Enges Bankdrücken",
    "Développé couché prise serrée",
    "Press de banca agarre cerrado",
  ]),
  exercise("triceps_machine", "arms", "load", [
    "Triceps machine",
    "Tricipiti alla macchina",
    "Trizepsmaschine",
    "Machine à triceps",
    "Máquina de tríceps",
  ]),
  exercise("wrist_curl", "arms", "load", [
    "Wrist curl",
    "Curl per i polsi",
    "Handgelenk-Curls",
    "Curl poignets",
    "Curl de muñeca",
  ]),
  exercise("crunch", "core", "bodyweight", [
    "Crunch",
    "Crunch",
    "Crunches",
    "Crunch",
    "Abdominales",
  ]),
  exercise("ab_crunch_machine", "core", "load", [
    "Ab crunch machine",
    "Crunch alla macchina",
    "Bauchmaschine",
    "Machine à abdos",
    "Máquina de abdominales",
  ]),
  exercise("cable_crunch", "core", "load", [
    "Cable crunch",
    "Crunch ai cavi",
    "Kabel-Crunches",
    "Crunch à la poulie",
    "Crunch en polea",
  ]),
  exercise("hanging_leg_raise", "core", "bodyweight", [
    "Hanging leg raise",
    "Sollevamento gambe alla sbarra",
    "Hängendes Beinheben",
    "Relevé de jambes suspendu",
    "Elevación de piernas colgado",
  ]),
  exercise("russian_twist", "core", "bodyweight", [
    "Russian twist",
    "Russian twist",
    "Russian Twist",
    "Russian twist",
    "Giro ruso",
  ]),
  exercise("ab_wheel", "core", "bodyweight", [
    "Ab wheel",
    "Ruota addominale",
    "Bauchroller",
    "Roue abdominale",
    "Rueda abdominal",
  ]),
  exercise("plank", "core", "timed", [
    "Plank",
    "Plank",
    "Unterarmstütz",
    "Gainage",
    "Plancha",
  ]),
  exercise("side_plank", "core", "timed", [
    "Side plank",
    "Plank laterale",
    "Seitstütz",
    "Gainage latéral",
    "Plancha lateral",
  ]),
  exercise("wall_sit", "core", "timed", [
    "Wall sit",
    "Sedia al muro",
    "Wandsitzen",
    "Chaise",
    "Sentadilla isométrica en pared",
  ]),
  exercise("power_clean", "full_body", "load", [
    "Power clean",
    "Girata al petto",
    "Umsetzen",
    "Épaulé",
    "Cargada",
  ]),
  exercise("snatch", "full_body", "load", [
    "Snatch",
    "Strappo",
    "Reißen",
    "Arraché",
    "Arrancada",
  ]),
  exercise("kettlebell_swing", "full_body", "load", [
    "Kettlebell swing",
    "Swing con kettlebell",
    "Kettlebell-Swing",
    "Swing kettlebell",
    "Swing con kettlebell",
  ]),
  exercise("farmer_carry", "full_body", "load", [
    "Farmer's carry",
    "Farmer walk",
    "Farmer's Walk",
    "Marche du fermier",
    "Paseo del granjero",
  ]),
  exercise("burpee", "full_body", "bodyweight", [
    "Burpees",
    "Burpee",
    "Burpees",
    "Burpees",
    "Burpees",
  ]),
  exercise("box_jump", "full_body", "bodyweight", [
    "Box jump",
    "Box jump",
    "Box Jumps",
    "Sauts sur box",
    "Saltos al cajón",
  ]),
  exercise("battle_ropes", "full_body", "timed", [
    "Battle ropes",
    "Battle rope",
    "Battle Ropes",
    "Cordes ondulatoires",
    "Cuerdas de batalla",
  ]),
  exercise("treadmill", "cardio", "cardio", [
    "Treadmill",
    "Tapis roulant",
    "Laufband",
    "Tapis de course",
    "Cinta de correr",
  ]),
  exercise("curved_treadmill", "cardio", "cardio", [
    "Curved treadmill",
    "Tapis roulant curvo",
    "Kurvenlaufband",
    "Tapis de course incurvé",
    "Cinta curva",
  ]),
  exercise("exercise_bike", "cardio", "cardio", [
    "Exercise bike",
    "Cyclette",
    "Heimtrainer",
    "Vélo d'appartement",
    "Bicicleta estática",
  ]),
  exercise("spin_bike", "cardio", "cardio", [
    "Spin bike",
    "Bici da spinning",
    "Spinning-Rad",
    "Vélo de biking",
    "Bici de spinning",
  ]),
  exercise("recumbent_bike", "cardio", "cardio", [
    "Recumbent bike",
    "Cyclette reclinata",
    "Liegeergometer",
    "Vélo semi-allongé",
    "Bicicleta reclinada",
  ]),
  exercise("air_bike", "cardio", "cardio", [
    "Air bike",
    "Air bike",
    "Air Bike",
    "Air bike",
    "Air bike",
  ]),
  exercise("elliptical", "cardio", "cardio", [
    "Elliptical",
    "Ellittica",
    "Crosstrainer",
    "Vélo elliptique",
    "Elíptica",
  ]),
  exercise("rowing_machine", "cardio", "cardio", [
    "Rowing machine",
    "Vogatore",
    "Rudergerät",
    "Rameur",
    "Máquina de remo",
  ]),
  exercise("ski_machine", "cardio", "cardio", [
    "Ski machine",
    "Ski ergometro",
    "Skiergometer",
    "Ergomètre de ski",
    "Ergómetro de esquí",
  ]),
  exercise("stair_climber", "cardio", "cardio", [
    "Stair climber",
    "Scala",
    "Treppensteiger",
    "Simulateur d'escalier",
    "Escaladora",
  ]),
  exercise("stepper", "cardio", "cardio", [
    "Stepper",
    "Stepper",
    "Stepper",
    "Stepper",
    "Stepper",
  ]),
  exercise("vertical_climber", "cardio", "cardio", [
    "Vertical climber",
    "Climber verticale",
    "Vertikal-Kletterer",
    "Grimpeur vertical",
    "Escalador vertical",
  ]),
  exercise("arm_ergometer", "cardio", "cardio", [
    "Arm bike",
    "Ergometro per braccia",
    "Armergometer",
    "Ergomètre à bras",
    "Ergómetro de brazos",
  ]),
  exercise("jump_rope", "cardio", "cardio", [
    "Jump rope",
    "Salto della corda",
    "Seilspringen",
    "Corde à sauter",
    "Comba",
  ]),
];

const BY_KEY: ReadonlyMap<string, GymExercise> = new Map(
  GYM_EXERCISES.map((item) => [item.key, item]),
);

export function gymExercise(key: string): GymExercise | undefined {
  return BY_KEY.get(key);
}

/** What a set is of, in `language`: the catalog's name, or the one its
 * runner wrote; a key the app does not know yet, in words. */
export function exerciseName(
  set: { exercise?: string; name?: string },
  language: Language,
): string {
  if (set.name !== undefined) {
    return set.name;
  }
  const known = set.exercise === undefined ? undefined : gymExercise(set.exercise);
  if (known !== undefined) {
    return known.names[language];
  }
  const words = (set.exercise ?? "").replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
