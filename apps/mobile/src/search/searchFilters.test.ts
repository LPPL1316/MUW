import { SHAPES } from "@shaperoute/shared-types";

import { CATEGORIES, categoryOf, holds, WORD_SHAPE } from "./categories";
import { activeCount, bandOf, NO_FILTERS, toggled } from "./searchFilters";

test("every shape of the catalogue is in one category, and only one", () => {
  for (const shape of SHAPES) {
    const of = CATEGORIES.filter((category) => holds(category, shape, null));
    expect(of).toHaveLength(1);
  }
  // A word drawn is «Words»; a run with neither shape nor word is in none.
  expect(holds(categoryOf("words"), null, "CIAO")).toBe(true);
  expect(holds(categoryOf("words"), null, null)).toBe(false);
  expect(categoryOf("words").shapes).toEqual([WORD_SHAPE]);
});

test("the badge counts each kind of filter once; the category is the chips'", () => {
  expect(activeCount(NO_FILTERS)).toBe(0);
  expect(activeCount({ ...NO_FILTERS, category: "animals" })).toBe(0);
  expect(
    activeCount({
      ...NO_FILTERS,
      distance: "10-30",
      activities: ["running", "cycling"],
      place: "  ",
      sort: "popular",
    }),
  ).toBe(3);
  expect(
    activeCount({ ...NO_FILTERS, place: "Trento", complexities: ["simple"] }),
  ).toBe(2);
});

test("the distance bands, and a value in and out", () => {
  expect(bandOf("0-10")).toEqual({ key: "0-10", min: 0, max: 10_000 });
  expect(bandOf("50+")?.max).toBeNull();
  expect(bandOf(null)).toBeNull();
  expect(toggled(["a"], "b")).toEqual(["a", "b"]);
  expect(toggled(["a", "b"], "a")).toEqual(["b"]);
});
