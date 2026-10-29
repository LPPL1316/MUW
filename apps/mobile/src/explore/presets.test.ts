import {
  CATEGORIES,
  cityShort,
  exampleFor,
  FEATURED_CITIES,
  isSpot,
  requestFor,
  suggestionDetail,
  whereFor,
} from "./presets";
import { MAX_RECENT, remember } from "./recentCities";

const milan = {
  label: "Milan, Lombardy, Italy",
  point: [45.4642, 9.1896] as [number, number],
};

test("cities from several countries, the four of our ideas the first categories", () => {
  expect(FEATURED_CITIES).toEqual(
    expect.arrayContaining(["New York", "Tokyo", "Dubai", "Torino"]),
  );
  expect(CATEGORIES.slice(0, 4)).toEqual([
    "Famous Places",
    "Best Views",
    "Hidden Gems",
    "Photography",
  ]);
  expect(CATEGORIES).toContain("Food");
  expect(new Set(CATEGORIES).size).toBe(CATEGORIES.length);
});

test("requests and examples follow the city", () => {
  expect(cityShort(milan.label)).toBe("Milan");
  expect(requestFor("Best Views", milan)).toBe("Best Views in Milan");
  expect(requestFor("Food", null)).toBe("Food");
  expect(exampleFor(milan)).toMatch(/in Milan/);
  expect(whereFor(milan)).toBe("in Milan");
  expect(whereFor(null)).toBe("near your start");
});

test("a place is no city: its point, not its name, goes with the request", () => {
  const arena = {
    label: "Verona Arena, Verona, Italy",
    point: [45.439, 10.9949] as [number, number],
    kind: "place" as const,
  };
  expect(isSpot(arena)).toBe(true);
  expect(isSpot({ ...milan, kind: "city" })).toBe(false);
  expect(isSpot(milan)).toBe(false);
  expect(requestFor("Food", arena)).toBe("Food");
  expect(whereFor(arena)).toBe("near Verona Arena");
  expect(exampleFor(arena)).not.toMatch(/Arena/);
});

test("the second line of a suggestion", () => {
  expect(suggestionDetail(milan)).toBe("City centre · Lombardy, Italy");
  expect(suggestionDetail({ ...milan, label: "Milan" })).toBe("City centre");
  expect(
    suggestionDetail({
      label: "Verona Arena, Verona, Italy",
      point: [45.439, 10.9949],
      kind: "place",
    }),
  ).toBe("Verona, Italy");
});

test("the recent cities: the last first, once each, a few", () => {
  const cities = Array.from({ length: 8 }, (_, i) => ({
    ...milan,
    label: `City ${i}`,
  }));
  const recent = cities.reduce(
    (list, city) => remember(list, city),
    [] as typeof cities,
  );
  expect(recent.length).toBe(MAX_RECENT);
  expect(recent[0].label).toBe("City 7");
  expect(remember(recent, recent[3])[0]).toBe(recent[3]);
  expect(remember(recent, recent[3]).length).toBe(MAX_RECENT);
});
