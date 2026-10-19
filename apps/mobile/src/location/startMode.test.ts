import { chooseStart, showsSearch } from "./startMode";
import type { PositionState } from "./useCurrentPosition";

const gps: PositionState = { status: "ok", point: [46.0671, 11.1214] };
const levico = { point: [46.0122, 11.2986] as [number, number], label: "Levico Terme" };

test("with the GPS on, My position starts from it, even with a place searched", () => {
  expect(chooseStart("gps", gps, levico)).toEqual({
    point: [46.0671, 11.1214],
    source: "gps",
  });
});

test("Another place starts from the place, even with the GPS on", () => {
  expect(chooseStart("place", gps, levico)).toEqual({
    point: levico.point,
    source: "search",
    label: "Levico Terme",
  });
  expect(chooseStart("place", gps, null)).toBeNull();
});

test("without the GPS, a searched place stands in for it", () => {
  expect(chooseStart("gps", { status: "denied" }, levico)?.source).toBe("search");
  expect(chooseStart("gps", { status: "loading" }, null)).toBeNull();
});

test("the search shows for another place, or when the GPS cannot help", () => {
  expect(showsSearch("place", gps)).toBe(true);
  expect(showsSearch("gps", gps)).toBe(false);
  expect(showsSearch("gps", { status: "loading" })).toBe(false);
  expect(showsSearch("gps", { status: "denied" })).toBe(true);
  expect(showsSearch("gps", { status: "unavailable" })).toBe(true);
});

test("a point chosen on the map starts as a place does, with no name (TASK-292)", () => {
  const pinned = { point: [46.07, 11.12] as [number, number], label: null };
  expect(chooseStart("place", gps, pinned)).toEqual({
    point: [46.07, 11.12],
    source: "map",
  });
  expect(chooseStart("gps", { status: "denied" }, pinned)?.source).toBe("map");
  expect(chooseStart("gps", gps, pinned)?.source).toBe("gps");
});
