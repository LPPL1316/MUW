import done from "@shaperoute/shared-types/fixtures/themed-route-job-done.json";

import { CATEGORIES } from "./presets";
import ideas from "./themedIdeas.json";
import {
  HERE_M,
  IDEA_CITIES,
  ideaRequest,
  isHere,
  isThemedIdea,
  nearMeRequest,
  THEMED_IDEAS,
  type ThemedIdea,
} from "./themedIdeas";
import type { ThemedResult } from "./themedRoutes";

const ROME: ThemedIdea = {
  id: "rome-famous-places-star",
  city: "Rome",
  category: "Famous Places",
  text: "Famous Places star 8 km",
  preview: [
    [41.89, 12.49],
    [41.891, 12.491],
  ],
  result: {
    ...(done.result as ThemedResult),
    city: "Rome",
    centre: [41.8933, 12.4829],
  },
};

test("every idea of the file is one, the four categories, our cities", () => {
  expect(THEMED_IDEAS.length).toBe(ideas.ideas.length);
  expect(THEMED_IDEAS.length).toBeGreaterThanOrEqual(8);
  const four = CATEGORIES.slice(0, 4) as readonly string[];
  for (const idea of THEMED_IDEAS) {
    expect(four).toContain(idea.category);
    expect(IDEA_CITIES as readonly string[]).toContain(idea.city);
    expect(idea.result.city).toBe(idea.city);
    expect(idea.text).toBe(
      `${idea.category} ${idea.result.shape} ${Math.round(idea.result.target_m / 1000)} km`,
    );
    expect(idea.result.stops.filter((s) => s.passed).length).toBeGreaterThanOrEqual(2);
  }
  expect(new Set(THEMED_IDEAS.map((idea) => idea.id)).size).toBe(THEMED_IDEAS.length);
  // Every city has one at least, every category too.
  expect(new Set(THEMED_IDEAS.map((idea) => idea.city))).toEqual(new Set(IDEA_CITIES));
  expect(new Set(THEMED_IDEAS.map((idea) => idea.category))).toEqual(new Set(four));
});

test("an idea needs its words, its card's line and a result", () => {
  expect(isThemedIdea(ROME)).toBe(true);
  expect(isThemedIdea({ ...ROME, preview: [] })).toBe(false);
  expect(isThemedIdea({ ...ROME, text: undefined })).toBe(false);
  expect(isThemedIdea({ ...ROME, result: { ...ROME.result, points: [] } })).toBe(false);
  expect(isThemedIdea(null)).toBe(false);
});

test("opened, it is the request that made it; near me, the same words from the start", () => {
  expect(ideaRequest(ROME)).toEqual({
    text: "Famous Places star 8 km",
    centre: [41.8933, 12.4829],
    city: "Rome",
  });
  expect(nearMeRequest(ROME, [46.0679, 11.1211])).toEqual({
    text: "Famous Places star 8 km",
    centre: [46.0679, 11.1211],
    city: null,
  });
});

test("in its city it is here, from Trento it is not, without a start neither", () => {
  // About 3 km from the centre: in Rome.
  expect(isHere(ROME, [41.9, 12.5])).toBe(true);
  expect(isHere(ROME, [46.0679, 11.1211])).toBe(false);
  expect(isHere(ROME, null)).toBe(false);
  expect(HERE_M).toBe(20_000);
});
