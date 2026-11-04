import type { LatLon, OutlinePoint } from "@shaperoute/shared-types";

import { t, tLater } from "../i18n";
import { shapeName } from "../i18n/shapeNames";
import data from "./bikeIdeas.json";
import type { RecommendedRoute, RecommendedRouteDetail } from "./recommendedRoutes";

/**
 * The routes of «RIDE IT YOURSELF» in «Explore» (TASK-364, ADR-0309): bike
 * routes the route engine planned once, chosen by the user on 2026-10-31 (Mushroom and GO
 * went to the Feed instead, TASK-365) and
 * written by `tools/bike_ideas.py`. They are whole on the phone, so one opens
 * and starts with no server. Nobody has ridden them: no time, no calories.
 */
export type BikeIdea = {
  id: string;
  city: string;
  shape: string | null;
  word: string | null;
  style: string | null;
  activity: "cycling";
  route_m: number;
  similarity: number;
  license: string;
  preview: LatLon[];
  points: LatLon[];
  outline?: OutlinePoint[];
};

export const BIKE_IDEAS = data.ideas as unknown as readonly BikeIdea[];

/** Their cities, in English as the tool names them. */
export const BIKE_IDEA_CITIES = [
  tLater("Barcelona"),
  tLater("Madrid"),
  tLater("Turin"),
] as const;

/** The name of a figure the catalogue does not have, in the app's language. */
const OWN_NAMES: Readonly<Record<string, string>> = {
  bat: tLater("Bat"),
};

export function bikeIdeaName(idea: BikeIdea): string {
  if (idea.word !== null) {
    return idea.word;
  }
  const shape = idea.shape ?? "";
  const own = OWN_NAMES[shape];
  return own !== undefined ? t(own) : shapeName(shape);
}

/** A card's route, as the rest of «Explore» opens it. */
export function bikeIdeaRoute(idea: BikeIdea): RecommendedRoute {
  return {
    id: idea.id,
    city: idea.city,
    shape: idea.shape,
    word: idea.word,
    style: idea.style,
    distance_m: idea.route_m,
    route_m: idea.route_m,
    similarity: idea.similarity,
    start: idea.points[0],
    away_m: 0,
    preview: idea.preview,
  };
}

/** The whole route of a card, or undefined for any other id. */
export function bikeIdeaDetail(id: string): RecommendedRouteDetail | undefined {
  const idea = BIKE_IDEAS.find((one) => one.id === id);
  if (idea === undefined) {
    return undefined;
  }
  return {
    id: idea.id,
    city: idea.city,
    shape: idea.shape,
    word: idea.word,
    style: idea.style,
    distance_m: idea.route_m,
    route_m: idea.route_m,
    similarity: idea.similarity,
    points: idea.points,
    license: idea.license,
    activity: idea.activity,
    ...(idea.outline !== undefined ? { outline: idea.outline } : {}),
  };
}
