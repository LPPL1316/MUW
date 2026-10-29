import type { Place } from "../places/photon";
import { t, tLater } from "../i18n";

/**
 * The quick choices of "Explore" (TASK-134): cities from around the world,
 * and the categories of "Ask for a route", the four of our ideas first (the
 * user's choice of 2026-10-29). A city is a name only: its centre comes
 * from the API when it is tapped, never written here.
 */
export const FEATURED_CITIES = [
  "New York",
  "London",
  "Paris",
  "Tokyo",
  "Rome",
  "Milan",
  "Torino",
  "Barcelona",
  "Dubai",
  "Amsterdam",
  "Berlin",
  "Lisbon",
  "Sydney",
  "San Francisco",
] as const;

/** Each category is a theme of the API, named in words its tables read. */
export const CATEGORIES = [
  tLater("Famous Places"),
  tLater("Best Views"),
  tLater("Hidden Gems"),
  tLater("Photography"),
  tLater("Food"),
  tLater("Romantic"),
  tLater("Shopping"),
  tLater("Culture"),
  tLater("Nightlife"),
  tLater("Running"),
  tLater("Walking"),
  tLater("Family"),
  tLater("Local Experience"),
] as const;

export type Category = (typeof CATEGORIES)[number];

/** "Milan, Lombardy, Italy" → "Milan". */
export function cityShort(label: string): string {
  return label.split(",")[0].trim();
}

/** A place in a city rather than a city (TASK-138): "Arena di Verona". */
export function isSpot(place: Place | null): boolean {
  return place?.kind === "place";
}

/**
 * The words sent for a category: "Food in New York". For a place, the
 * category alone: the request starts from its point, as from the start, and
 * its name is no city to look up (TASK-138).
 */
export function requestFor(category: string, city: Place | null): string {
  return city === null || isSpot(city)
    ? category
    : `${category} in ${cityShort(city.label)}`;
}

/** Where the routes start, in words: "in Milan", "near Arena di Verona". */
export function whereFor(city: Place | null): string {
  if (city === null) {
    return t("near your start");
  }
  return isSpot(city)
    ? t("near {place}", { place: cityShort(city.label) })
    : t("in {city}", { city: cityShort(city.label) });
}

/** The hint in the request field, for the chosen city. */
export function exampleFor(city: Place | null): string {
  return city === null || isSpot(city)
    ? t("e.g. a romantic heart, famous places, food 8 km")
    : t("e.g. a romantic heart in {city}, 8 km", { city: cityShort(city.label) });
}

/**
 * The second line of a suggestion (TASK-138): a city is its centre, "City
 * centre · Veneto, Italy"; a place says its city, "Verona, Italy".
 */
export function suggestionDetail(place: Place): string {
  const rest = place.label
    .split(",")
    .slice(1)
    .map((part) => part.trim());
  const where = rest.filter((part) => part !== "").join(", ");
  if (isSpot(place)) {
    return where;
  }
  return where === "" ? t("City centre") : `${t("City centre")} · ${where}`;
}
