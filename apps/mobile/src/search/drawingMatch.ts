import {
  DRAWING_MEDIUM_BELOW,
  DRAWING_SIMPLE_BELOW,
  type DrawingComplexity,
  type DrawingSort,
  type LatLon,
  SHAPES,
} from "@shaperoute/shared-types";

import { cityName } from "../explore/recommendedRoutes";
import type { SamplePost } from "../feed/sampleFeed";
import { t } from "../i18n";
import { shapeName } from "../i18n/shapeNames";
import { CATEGORIES, categoryOf, holds } from "./categories";
import { bandOf, type SearchFilters } from "./searchFilters";

/** At most this many points of a line count for its complexity, as the
 * preview the API keeps of a drawing (migration 0022). */
const PREVIEW_POINTS = 64;
/** Words longer than this are no search: the API's limit. */
export const MAX_QUERY_LENGTH = 80;

/**
 * `text` as the search compares it, on the phone as on the API (TASK-344,
 * ADR-0297): lower case, without accents. «Città» is «citta».
 */
export function normalized(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/ø/g, "o");
}

/** The words of what was typed, normalized; empty for none. */
export function wordsOf(typed: string): string[] {
  return normalized(typed.trim())
    .split(/\s+/)
    .filter((word) => word !== "");
}

/**
 * The shapes the words name in the app's language, for the API's `named`
 * (ADR-0297, point 3): «cuore» names `heart`, «cane» the dog's head, and
 * a category's name all of its shapes («animali»). A word of one letter
 * names nothing.
 */
export function namedShapes(words: readonly string[]): string[] {
  const named = new Set<string>();
  for (const word of words.filter((each) => each.length >= 2)) {
    for (const shape of SHAPES) {
      if (
        normalized(shapeName(shape)).includes(word) ||
        shape.replace(/_/g, " ").includes(word)
      ) {
        named.add(shape);
      }
    }
    for (const category of CATEGORIES) {
      if (normalized(t(category.label)).includes(word)) {
        category.shapes.forEach((shape) => named.add(shape));
      }
    }
  }
  return [...named];
}

/** `line` with at most PREVIEW_POINTS points, evenly spread by index, the
 * first and the last kept: as the API's preview. */
export function previewOf(line: readonly LatLon[]): LatLon[] {
  if (line.length <= PREVIEW_POINTS) {
    return [...line];
  }
  const step = (line.length - 1) / (PREVIEW_POINTS - 1);
  return Array.from({ length: PREVIEW_POINTS }, (_, i) => line[Math.round(i * step)]);
}

/**
 * How complex a line is (ADR-0297, point 5): its length over the diagonal
 * of the rectangle it fits in, on its preview, on a plane where longitudes
 * are shortened by the cosine of the latitude in the middle. As the API
 * reads it.
 */
export function complexityOf(line: readonly LatLon[]): DrawingComplexity {
  const points = previewOf(line);
  if (points.length < 2) {
    return "simple";
  }
  const lats = points.map(([lat]) => lat);
  const lons = points.map(([, lon]) => lon);
  const middle = (Math.min(...lats) + Math.max(...lats)) / 2;
  const squeeze = Math.cos((middle * Math.PI) / 180);
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [lat0, lon0] = points[i - 1];
    const [lat1, lon1] = points[i];
    length += Math.hypot(lat1 - lat0, (lon1 - lon0) * squeeze);
  }
  const diagonal = Math.hypot(
    Math.max(...lats) - Math.min(...lats),
    (Math.max(...lons) - Math.min(...lons)) * squeeze,
  );
  if (diagonal === 0) {
    return "simple";
  }
  const winding = length / diagonal;
  if (winding < DRAWING_SIMPLE_BELOW) {
    return "simple";
  }
  return winding < DRAWING_MEDIUM_BELOW ? "medium" : "complex";
}

/** The words an example is found by: its title, its runner, its shape (in
 * the app's language and as the catalogue writes it), its town. */
function wordsOfExample(post: SamplePost): string {
  return normalized(
    [
      post.title,
      post.user,
      shapeName(post.shape),
      post.shape.replace(/_/g, " "),
      post.what ?? "",
      cityName(post.city),
    ].join(" "),
  );
}

/**
 * Whether an example drawing of «Feed» is found by `words` (or is of a
 * shape in `named`) and passes `filters`: the API's rules (ADR-0297) on
 * the phone, for the examples the API does not hold.
 */
export function exampleMatches(
  post: SamplePost,
  words: readonly string[],
  named: readonly string[],
  filters: SearchFilters,
): boolean {
  if (words.length > 0) {
    const text = wordsOfExample(post);
    if (!named.includes(post.shape) && !words.every((word) => text.includes(word))) {
      return false;
    }
  }
  if (
    filters.category !== null &&
    !holds(categoryOf(filters.category), post.shape, post.what)
  ) {
    return false;
  }
  if (
    filters.activities.length > 0 &&
    !filters.activities.includes(post.activity ?? "running")
  ) {
    return false;
  }
  const band = bandOf(filters.distance);
  if (
    band !== null &&
    (post.route_m < band.min || (band.max !== null && post.route_m > band.max))
  ) {
    return false;
  }
  const place = normalized(filters.place.trim());
  if (place !== "" && !normalized(cityName(post.city)).includes(place)) {
    return false;
  }
  return (
    filters.complexities.length === 0 ||
    filters.complexities.includes(complexityOf(post.line))
  );
}

/**
 * The examples in the order asked. They have no day of their own: «most
 * recent» keeps the order of «Feed»; their score stands for how liked
 * they are (the user's choice, ADR-0297).
 */
export function sortedExamples(
  posts: readonly SamplePost[],
  sort: DrawingSort,
): SamplePost[] {
  const kept = [...posts];
  if (sort === "longest") {
    kept.sort((a, b) => b.route_m - a.route_m);
  } else if (sort === "popular") {
    kept.sort((a, b) => b.score - a.score);
  }
  return kept;
}

/** The examples found, in their order: `examples` is SAMPLE_FEED in the app. */
export function foundExamples(
  examples: readonly SamplePost[],
  typed: string,
  filters: SearchFilters,
): SamplePost[] {
  if (typed.trim().length > MAX_QUERY_LENGTH) {
    return [];
  }
  const words = wordsOf(typed);
  const named = namedShapes(words);
  return sortedExamples(
    examples.filter((post) => exampleMatches(post, words, named, filters)),
    filters.sort,
  );
}
