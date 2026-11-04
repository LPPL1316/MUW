import type {
  Activity,
  DrawingComplexity,
  DrawingSearchPage,
  DrawingSort,
} from "@shaperoute/shared-types";

import { type AccountOutcome, ask } from "./accounts";
import { isFeedPage } from "./feed";

/**
 * The search of the drawings (TASK-344, ADR-0297): GET /search/drawings of
 * docs/API.md, «Drawing search», with the session token. The drawings the
 * account may see that hold every word, capitals and accents aside, or are
 * of a shape the words name, and pass every filter. A page is the feed's.
 */

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** What a page is asked with; what is left out asks nothing. */
export type DrawingQuery = {
  q?: string;
  /** The shapes the words name in the app's language. */
  named?: readonly string[];
  /** The shapes of a category; "word" for a word drawn. */
  shapes?: readonly string[];
  activities?: readonly Activity[];
  minM?: number | null;
  maxM?: number | null;
  place?: string;
  complexities?: readonly DrawingComplexity[];
  sort?: DrawingSort;
  cursor?: string | null;
};

/** The query of a page: a list filter once for each of its values. */
export function searchDrawingsPath(query: DrawingQuery): string {
  const params = new URLSearchParams();
  const q = query.q?.trim() ?? "";
  if (q !== "") {
    params.set("q", q);
  }
  if (q !== "") {
    query.named?.forEach((shape) => params.append("named", shape));
  }
  query.shapes?.forEach((shape) => params.append("shape", shape));
  query.activities?.forEach((activity) => params.append("activity", activity));
  if (query.minM !== undefined && query.minM !== null && query.minM > 0) {
    params.set("min_m", String(query.minM));
  }
  if (query.maxM !== undefined && query.maxM !== null) {
    params.set("max_m", String(query.maxM));
  }
  const place = query.place?.trim() ?? "";
  if (place !== "") {
    params.set("place", place);
  }
  query.complexities?.forEach((complexity) => params.append("complexity", complexity));
  if (query.sort !== undefined && query.sort !== "recent") {
    params.set("sort", query.sort);
  }
  if (query.cursor !== undefined && query.cursor !== null) {
    params.set("cursor", query.cursor);
  }
  const text = params.toString();
  return text === "" ? "/search/drawings" : `/search/drawings?${text}`;
}

/** GET /search/drawings: a page; an older API has no search and says 404
 * `http_error`. */
export function searchDrawings(
  baseUrl: string,
  token: string,
  query: DrawingQuery,
  options: Options = {},
): Promise<AccountOutcome<DrawingSearchPage>> {
  return ask(
    baseUrl,
    searchDrawingsPath(query),
    { method: "GET", token },
    isFeedPage,
    options,
  );
}
