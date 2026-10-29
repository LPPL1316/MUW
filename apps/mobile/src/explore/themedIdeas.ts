import type { LatLon } from "@shaperoute/shared-types";

import { tLater } from "../i18n";
import { metresBetween } from "../map/coordinates";
import ideas from "./themedIdeas.json";
import { isThemedResult, type ThemedRequest, type ThemedResult } from "./themedRoutes";

/**
 * The ideas of «Ask for a route» (the user's choice of 2026-10-29): themed
 * routes in big cities of Europe, simple shapes through their famous places,
 * views, hidden gems and photo spots. `tools/themed_ideas.py` planned them
 * once through the API's own themed jobs, so one opens at once, as a route
 * asked for; people take ideas from them, and «Make it near me» asks the
 * same words from their start.
 */
export type ThemedIdea = {
  id: string;
  city: string;
  /** A category of «Ask for a route», in the words the API reads. */
  category: string;
  /** The request as the app sends it: "Famous Places star 8 km". */
  text: string;
  /** The line of its card: the route with fewer points. */
  preview: LatLon[];
  result: ThemedResult;
};

/** The ideas' cities, in English as the tool names them: each is shown in
 * the app's language, «Roma». */
export const IDEA_CITIES = [
  tLater("Rome"),
  tLater("Paris"),
  tLater("London"),
  tLater("Barcelona"),
  tLater("Amsterdam"),
  tLater("Lisbon"),
  tLater("Prague"),
  tLater("Berlin"),
] as const;

/** Within this of an idea's city, it is there to run: «Start» shows. */
export const HERE_M = 20_000;

function isPoint(value: unknown): value is LatLon {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

export function isThemedIdea(value: unknown): value is ThemedIdea {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const idea = value as Record<string, unknown>;
  return (
    typeof idea.id === "string" &&
    typeof idea.city === "string" &&
    typeof idea.category === "string" &&
    typeof idea.text === "string" &&
    Array.isArray(idea.preview) &&
    idea.preview.length >= 2 &&
    idea.preview.every(isPoint) &&
    isThemedResult(idea.result)
  );
}

/** In the order of the row, as the tool writes them. */
export const THEMED_IDEAS: readonly ThemedIdea[] = (ideas.ideas as unknown[]).filter(
  isThemedIdea,
);

/** How an idea is opened: as the request that made it, from its city. */
export function ideaRequest(idea: ThemedIdea): ThemedRequest {
  return { text: idea.text, centre: idea.result.centre, city: idea.city };
}

/** The idea's words from `start`: the same kind of route, made near it. */
export function nearMeRequest(idea: ThemedIdea, start: LatLon): ThemedRequest {
  return { text: idea.text, centre: start, city: null };
}

/** Whether `start` is in the idea's city, where «Start» runs it. */
export function isHere(idea: ThemedIdea, start: LatLon | null): boolean {
  return start !== null && metresBetween(start, idea.result.centre) <= HERE_M;
}
