import {
  pageRound,
  pagesAround,
  placeAt,
  placesInView,
  restsOnPlace,
  STRIP_PLACES,
  STRIP_START,
  stripAt,
} from "./tabStrip";

test("the pages go round: after the last the first, before the first the last", () => {
  expect(pageRound(4, 1, 5)).toBe(0);
  expect(pageRound(0, -1, 5)).toBe(4);
  expect(pageRound(2, 1, 5)).toBe(3);
  expect(pageRound(1, -7, 5)).toBe(4);
  expect(pageRound(3, 12, 5)).toBe(0);
  expect(pageRound(3, 1, 0)).toBe(0);
});

test("a scroll offset is nearest to one place, within the strip", () => {
  expect(placeAt(390 * 1000, 390)).toBe(1000);
  expect(placeAt(390 * 1000 + 194, 390)).toBe(1000);
  expect(placeAt(390 * 1000 + 196, 390)).toBe(1001);
  expect(placeAt(-40, 390)).toBe(0);
  expect(placeAt(390 * STRIP_PLACES * 2, 390)).toBe(STRIP_PLACES - 1);
  // Before the window is measured, the middle.
  expect(placeAt(100, 0)).toBe(STRIP_START);
});

test("a scroll offset shows the place it rests on, or the two it is between", () => {
  expect(placesInView(390 * 1000, 390)).toEqual([1000]);
  // A scroll at rest is never exactly on the place.
  expect(placesInView(390 * 1000 - 0.3, 390)).toEqual([1000]);
  expect(placesInView(390 * 1000 + 0.4, 390)).toEqual([1000]);
  expect(placesInView(390 * 1000 + 12, 390)).toEqual([1000, 1001]);
  expect(placesInView(390 * 1000 - 12, 390)).toEqual([999, 1000]);
  expect(placesInView(100, 0)).toEqual([]);
});

test("a finger lifted right on a place rests there, half way it does not", () => {
  expect(restsOnPlace(390 * 1001, 390)).toBe(true);
  expect(restsOnPlace(390 * 1001 - 0.5, 390)).toBe(true);
  expect(restsOnPlace(390 * 1001 - 150, 390)).toBe(false);
  expect(restsOnPlace(0, 0)).toBe(false);
});

test("one place on is the next page, one back the one before, round the pages", () => {
  const onProfile = { page: 4, place: 1000 };
  expect(stripAt(onProfile, 1001, 5)).toEqual({ page: 0, place: 1001 });
  expect(stripAt(onProfile, 999, 5)).toEqual({ page: 3, place: 999 });
  // The same place is the same strip, as it was.
  expect(stripAt(onProfile, 1000, 5)).toBe(onProfile);
  const onFeed = { page: 0, place: 1000 };
  expect(stripAt(onFeed, 999, 5)).toEqual({ page: 4, place: 999 });
});

test("the page on screen lies between the one before and the one after", () => {
  expect([...pagesAround({ page: 1, place: 1000 }, 5)]).toEqual([
    [1, 1000],
    [2, 1001],
    [0, 999],
  ]);
  // Round: beside the profile lies «Feed», beside «Feed» the profile.
  expect(pagesAround({ page: 4, place: 1000 }, 5).get(0)).toBe(1001);
  expect(pagesAround({ page: 0, place: 1000 }, 5).get(4)).toBe(999);
  // Nobody lies on two places, and nothing past the ends of the strip.
  expect([...pagesAround({ page: 0, place: 1000 }, 2)]).toEqual([
    [0, 1000],
    [1, 1001],
  ]);
  expect([...pagesAround({ page: 0, place: 0 }, 5)]).toEqual([
    [0, 0],
    [1, 1],
  ]);
  expect(pagesAround({ page: 0, place: 0 }, 0).size).toBe(0);
});
