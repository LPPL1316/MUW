import { saveLanguageChoice } from "../i18n/language";
import { NOTES_AT_FIRST, roughMetres, shownNotes, toNote, toNotes } from "./warnings";

afterEach(() => saveLanguageChoice("phone"));

// The texts as the route engine writes them today (validation.py,
// optimizer.py, network.py): when the engine changes one, change it here too,
// word for word, or the app shows the raw text again.
test.each([
  [
    "start moved 1.2 km north of the requested point, where the shape closes on the roads",
    "info",
    "The route starts 1.2 km north of your start, where the shape fits the roads. Go to “Start here”.",
  ],
  ["120 m of the route on steps", "caution", "There are 120 m of steps along the way."],
  [
    "1400 m of the route on main roads",
    "caution",
    "1.4 km runs along main roads, with traffic.",
  ],
  ["60 m of the route in tunnels", "caution", "60 m runs through tunnels."],
  [
    "24% of the route is on roads already travelled (limit 20%)",
    "info",
    "About 24% of the route goes over the same roads twice.",
  ],
  [
    "31% of the route runs next to another stretch of it, within 25 m (limit 30%)",
    "info",
    "About 31% of the route runs alongside itself.",
  ],
  [
    "distance on roads is +12% from the target after 18 attempts",
    "info",
    "The route is 12% longer than asked.",
  ],
  [
    "distance on roads is -8% from the target after 18 attempts",
    "info",
    "The route is 8% shorter than asked.",
  ],
  [
    "shape similarity 0.86 is below 0.90 after 18 attempts",
    "caution",
    "The roads here follow the shape only roughly.",
  ],
  [
    "sparse road network: shape points are 140 m from the nearest road on average (threshold 120 m)",
    "caution",
    "Few roads here: the route follows the shape loosely.",
  ],
  [
    "start is 250 m from the nearest road; the route begins there",
    "info",
    "The nearest road is 250 m away: the route begins there.",
  ],
  [
    "no road path to shape point 17; skipped",
    "caution",
    "A bit of the shape has no road to follow, so the route skips it.",
  ],
])("%j reads %s: %j", (warning, tone, text) => {
  expect(toNote(warning)).toMatchObject({ tone, text });
});

// Every direction optimizer._compass can write, with metres and kilometres.
test.each([
  ["north", "250 m"],
  ["north-east", "250 m"],
  ["east", "1.5 km"],
  ["south-east", "900 m"],
  ["south", "2 km"],
  ["south-west", "1.2 km"],
  ["west", "40 m"],
  ["north-west", "1.75 km"],
])("the start moved %s is said in plain words", (direction, distance) => {
  expect(
    toNote(
      `start moved ${distance} ${direction} of the requested point, where the shape closes on the roads`,
    ),
  ).toEqual({
    tone: "info",
    text: `The route starts ${distance} ${direction} of your start, where the shape fits the roads. Go to “Start here”.`,
  });
});

test("a warning the app does not know is shown as it is, capitalised", () => {
  expect(toNote("something new from the engine")).toEqual({
    tone: "info",
    text: "Something new from the engine",
  });
});

test("an unknown warning never reaches the user in lower case", () => {
  const text = toNote("start moved 250 m up-hill somewhere else").text;
  expect(text.charAt(0)).toBe("S");
  expect(toNote("").text).toBe("");
});

test("things to watch for come first, and a sentence is said once", () => {
  expect(
    toNotes([
      "distance on roads is +12% from the target after 18 attempts",
      "no road path to shape point 3; skipped",
      "no road path to shape point 9; skipped",
      "120 m of the route on steps",
    ]).map((note) => note.text),
  ).toEqual([
    "A bit of the shape has no road to follow, so the route skips it.",
    "There are 120 m of steps along the way.",
    "The route is 12% longer than asked.",
  ]);
});

// --- Two notes at first (TASK-337) ---

test("the first two notes are shown, all of them after «Show more»", () => {
  const notes = toNotes([
    "distance on roads is +12% from the target after 18 attempts",
    "shape similarity 0.86 is below 0.90 after 18 attempts",
    "120 m of the route on steps",
  ]);
  expect(NOTES_AT_FIRST).toBe(2);
  expect(shownNotes(notes, false).map((note) => note.text)).toEqual([
    "The roads here follow the shape only roughly.",
    "There are 120 m of steps along the way.",
  ]);
  expect(shownNotes(notes, true)).toEqual(notes);
  expect(shownNotes(notes.slice(0, 1), false)).toEqual(notes.slice(0, 1));
  expect(shownNotes([], false)).toEqual([]);
});

// The Coordinatore's condition: what makes a stretch unsafe, or one that
// cannot be run or ridden, is never behind «Show more».
test.each([
  ["120 m of the route on steps", true],
  ["1400 m of the route on main roads", true],
  ["60 m of the route in tunnels", true],
  ["923 m of the route with the bike on foot", true],
  ["shape similarity 0.86 is below 0.90 after 18 attempts", false],
  ["no road path to shape point 17; skipped", false],
  ["distance on roads is +12% from the target after 18 attempts", false],
  ["something new from the engine", false],
])("%j is about safety: %s", (warning, safety) => {
  expect(toNote(warning).safety === true).toBe(safety);
});

test("notes about safety are always among the first ones, even more than two", () => {
  const behind = [
    "shape similarity 0.86 is below 0.90 after 18 attempts",
    "no road path to shape point 3; skipped",
    "sparse road network: shape points are 140 m from the nearest road on average (threshold 120 m)",
  ];
  // Things to watch for that are not about safety come first from the
  // engine: a safety note after them still shows, in its place.
  const one = toNotes([...behind, "120 m of the route on steps"]);
  expect(shownNotes(one, false).map((note) => note.text)).toEqual([
    "The roads here follow the shape only roughly.",
    "There are 120 m of steps along the way.",
  ]);
  const three = toNotes([
    ...behind,
    "distance on roads is +12% from the target after 18 attempts",
    "120 m of the route on steps",
    "1400 m of the route on main roads",
    "60 m of the route in tunnels",
  ]);
  expect(shownNotes(three, false).map((note) => note.text)).toEqual([
    "There are 120 m of steps along the way.",
    "1.4 km runs along main roads, with traffic.",
    "60 m runs through tunnels.",
  ]);
  const onFoot = toNotes([
    ...behind,
    "923 m of the route with the bike on foot",
    "distance on roads is +12% from the target after 18 attempts",
  ]);
  expect(shownNotes(onFoot, false).map((note) => note.text)).toEqual([
    "The roads here follow the shape only roughly.",
    "Includes 920 m walking the bike.",
  ]);
});

// --- The bike on foot (TASK-206) ---

test("a bike route says the metres with the bike on foot, part of its distance", () => {
  expect(toNote("923 m of the route with the bike on foot")).toEqual({
    tone: "info",
    text: "Includes 920 m walking the bike.",
    safety: true,
  });
  expect(toNote("1062 m of the route with the bike on foot").text).toBe(
    "Includes 1.1 km walking the bike.",
  );
  saveLanguageChoice("it");
  expect(toNote("923 m of the route with the bike on foot").text).toBe(
    "Di cui 920 m con la bici a mano.",
  );
  expect(toNote("1062 m of the route with the bike on foot").text).toBe(
    "Di cui 1,1 km con la bici a mano.",
  );
});

test("the metres on foot to 10, at least 10, and in km from a thousand", () => {
  expect(roughMetres(3)).toBe("10 m");
  expect(roughMetres(96)).toBe("100 m");
  expect(roughMetres(504)).toBe("500 m");
  expect(roughMetres(994)).toBe("990 m");
  expect(roughMetres(996)).toBe("1.0 km");
  expect(roughMetres(2449)).toBe("2.4 km");
});
