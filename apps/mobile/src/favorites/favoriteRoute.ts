import {
  type Activity,
  type ImageRouteRequest,
  type LatLon,
  type OutlinePoint,
  type RouteResult,
  type Stretch,
  type Walk,
  MAX_OUTLINE_POINTS,
} from "@shaperoute/shared-types";

import {
  type Favorite,
  favoriteActivity,
  type FavoriteDetail,
  type FavoriteRequest,
} from "../api/favorites";
import { type Explored, toRequest, toResult } from "../explore/explored";
import {
  cityName,
  type RecommendedRoute,
  type RecommendedRouteDetail,
  turnOf,
} from "../explore/recommendedRoutes";
import type { ThemedResult } from "../explore/themedRoutes";
import { isImageRequest } from "../api/routes";
import { t, tLater } from "../i18n";
import { shapeName } from "../i18n/shapeNames";
import { isDrawnOutline } from "../mapdraw/canvasRequest";
import { onFootOf } from "../route/onFoot";
import { isPenUpShape } from "../route/penUpShapes";
import type { AnyRouteRequest } from "../route/useRouteRequest";
import { walksOf } from "../route/walks";
import { distanceLabel } from "../units/format";
import { favoriteKey } from "./favoriteKey";

/**
 * A route on the map as a favorite keeps it (TASK-171): its key, and what
 * PUT /me/favorites/{key} takes. Made once per route shown, so the heart
 * knows the route by this object.
 */
export type Keepable = { id: string; request: FavoriteRequest };

/** The API's limits (favorites.py): longer texts are cut, not refused. */
const MAX_CITY = 80;
const MAX_TITLE = 60;
/** The points of the preview of a favorite just kept, before the API's. */
const PREVIEW_POINTS = 64;
/** The title kept for the outline of an image: data, in English; shown with
 * `t(IMAGE_TITLE)`. */
const IMAGE_TITLE = tLater("Image");
/** The same for a figure drawn by hand on the map (TASK-320, TASK-331):
 * the app knows its outline by the arrays the request was made of. */
const DRAWING_TITLE = tLater("Drawing");

/** "Image", or "Drawing" for the outline of a drawing on the map. */
function outlineTitle(request: AnyRouteRequest): string {
  return isImageRequest(request) && isDrawnOutline(request.outline)
    ? DRAWING_TITLE
    : IMAGE_TITLE;
}

/**
 * The walks of a word with the pen up, as a favorite keeps them (TASK-199):
 * only those that fit the line, and only for a word or a shape in pieces
 * (TASK-223). Nothing for any other route: its request is the one of
 * before, field for field.
 */
function penUp(
  drawn: { word: string | null; shape: string | null },
  points: readonly LatLon[],
  walks: readonly Walk[] | null | undefined,
): { walks?: Walk[] } {
  const lifts = drawn.word !== null || isPenUpShape(drawn.shape);
  const fit = lifts ? walksOf(points, walks) : [];
  return fit.length === 0 ? {} : { walks: fit.map(([from, to]): Walk => [from, to]) };
}

/**
 * The stretches of a bike route with the bike on foot, as a favorite keeps
 * them (TASK-206): only those that fit the line. Nothing for any other
 * route: its request is the one of before, field for field.
 */
function onFoot(
  points: readonly LatLon[],
  stretches: readonly Stretch[] | null | undefined,
): { on_foot?: Stretch[] } {
  const fit = onFootOf(points, stretches);
  return fit.length === 0
    ? {}
    : { on_foot: fit.map(([from, to]): Stretch => [from, to]) };
}

/**
 * The activity a favorite keeps (TASK-200): only when it is not a run, so a
 * run's request is the one of before, field for field.
 */
function drawnFor(activity: Activity): { activity?: Activity } {
  return activity === "running" ? {} : { activity };
}

function keepable(fields: Omit<FavoriteRequest, "similarity">, similarity: number) {
  return {
    id: favoriteKey(fields.points),
    request: {
      ...fields,
      city: fields.city.trim().slice(0, MAX_CITY),
      title: fields.title === null ? null : fields.title.slice(0, MAX_TITLE),
      similarity: Math.min(1, Math.max(0, similarity)),
    },
  };
}

/**
 * A route drawn in «Draw»; `place` is the place searched for, if any. It
 * keeps the activity it was asked for (TASK-200). The routes of «Explore»
 * and the themed ones are runs, but an example on the water (TASK-191).
 */
export function drawnKeepable(
  request: AnyRouteRequest,
  result: RouteResult,
  place: string | null,
): Keepable {
  const word = result.word ?? null;
  return keepable(
    {
      city: place ?? "",
      shape: result.shape,
      word,
      style: word !== null && "style" in request ? (request.style ?? "round") : null,
      // Neither a shape nor a word: the outline of an image, or a drawing.
      title: result.shape === null && word === null ? outlineTitle(request) : null,
      distance_m: request.distance_m,
      route_m: Math.round(result.distance_m),
      points: result.points,
      // A word with the pen up keeps its walks (TASK-199), so a shape in
      // pieces (TASK-223).
      ...penUp({ word, shape: result.shape }, result.points, result.walks),
      // A bike route keeps its stretches with the bike on foot (TASK-206).
      ...onFoot(result.points, result.on_foot),
      ...drawnFor(request.activity),
      // A turned shape keeps its turn (TASK-232): only when it is.
      ...turnOf(result),
    },
    result.similarity,
  );
}

/** A route of «Explore», as its card on the map has it: a run, or an
 * example on the water, which keeps its activity (TASK-191). */
export function exploredKeepable(
  route: RecommendedRoute,
  detail: RecommendedRouteDetail,
): Keepable {
  return keepable(
    {
      city: route.city,
      shape: detail.shape,
      word: detail.word,
      style: detail.style === "block" || detail.style === "round" ? detail.style : null,
      title: null,
      distance_m: detail.distance_m,
      route_m: Math.round(detail.route_m),
      points: detail.points,
      // An example in pieces keeps its walks (TASK-254): a dog's head on
      // the water opened again has its eyes apart, and Start pauses there.
      ...penUp({ word: detail.word, shape: detail.shape }, detail.points, detail.walks),
      ...drawnFor(detail.activity ?? "running"),
      ...turnOf(detail),
    },
    detail.similarity,
  );
}

/** A themed route of «Explore»: its theme is its title. */
export function themedKeepable(result: ThemedResult): Keepable {
  return keepable(
    {
      city: result.city ?? "",
      shape: result.shape,
      word: null,
      style: null,
      title: result.theme_label,
      distance_m: Math.round(result.target_m),
      route_m: Math.round(result.distance_m),
      points: result.points,
    },
    result.similarity,
  );
}

/** At most `size` points of the line, evenly spread, first and last kept. */
function spread<T>(points: T[], size: number): T[] {
  if (points.length <= size) {
    return points;
  }
  const step = (points.length - 1) / (size - 1);
  return Array.from({ length: size }, (_, i) => points[Math.round(i * step)]);
}

/** The favorite as the list shows it at once, before the API answers. */
export function keptNow({ id, request }: Keepable, now: Date): Favorite {
  // The list has no walks, nor stretches on foot: only a favorite opened
  // whole has them.
  const { points, walks: _walks, on_foot: _onFoot, ...fields } = request;
  return {
    ...fields,
    id,
    start: points[0],
    preview: spread(points, PREVIEW_POINTS),
    created_at: now.toISOString(),
  };
}

/** What a favorite draws, in a word or two: "CIAO", "Fountains", "Star".
 * The outline of an image is kept as "Image" and shown in the app's
 * language, «Immagine» (TASK-210), and so a figure drawn by hand, kept as
 * "Drawing" (TASK-320); a themed route keeps the API's title. */
export function favoriteTitle(favorite: {
  shape: string | null;
  word: string | null;
  title: string | null;
}): string {
  if (
    favorite.word === null &&
    (favorite.title === IMAGE_TITLE || favorite.title === DRAWING_TITLE)
  ) {
    return t(favorite.title);
  }
  return (
    favorite.word ??
    favorite.title ??
    (favorite.shape === null ? t("Route") : shapeName(favorite.shape))
  );
}

/** "Star · 5.1 km": the first line of a favorite's card, in the app's
 * units (TASK-182: "Star · 3.2 mi"). */
export function favoriteHeading(favorite: Favorite): string {
  return `${favoriteTitle(favorite)} · ${distanceLabel(favorite.route_m)}`;
}

/** Where a favorite is, as its card says it; null when nobody knows. */
export function favoritePlace(favorite: { city: string }): string | null {
  return favorite.city === "" ? null : cityName(favorite.city);
}

/**
 * The line as the outline of an image: closed, centred and scaled into
 * [-1, 1], y upwards. What the GPX export sends for a favorite that has
 * neither a shape nor a word, whose own outline the phone no longer has.
 */
export function outlineOf(points: LatLon[]): OutlinePoint[] {
  const midLat = points.reduce((sum, [lat]) => sum + lat, 0) / points.length;
  const k = Math.cos((midLat * Math.PI) / 180);
  const xs = points.map(([, lon]) => lon * k);
  const ys = points.map(([lat]) => lat);
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const half = Math.max(
    (Math.max(...xs) - Math.min(...xs)) / 2,
    (Math.max(...ys) - Math.min(...ys)) / 2,
    1e-9,
  );
  const all = points.map((_, i): OutlinePoint => [
    (xs[i] - midX) / half,
    (ys[i] - midY) / half,
  ]);
  const outline = spread(all, MAX_OUTLINE_POINTS);
  const [first, last] = [outline[0], outline[outline.length - 1]];
  return first[0] === last[0] && first[1] === last[1] ? outline : [...outline, first];
}

function imageRequest(
  detail: RecommendedRouteDetail,
  activity: Activity,
): ImageRouteRequest {
  return {
    start: detail.points[0],
    outline: outlineOf(detail.points),
    distance_m: detail.distance_m,
    activity,
  };
}

function noChoice(): void {}

/** A favorite on the map: a route of «Explore», and itself to keep again. */
export type OpenedFavorite = Extract<Explored, { status: "done" }> & {
  keepable: Keepable;
};

/**
 * A favorite opened on the map, as a route of «Explore» is (explored.ts):
 * the same card shows it, starts it and exports it. Made once per opening:
 * Start and the export know a route by its result. A word with the pen up
 * has its walks in the result, as a word just drawn has them (TASK-199):
 * the map draws them dashed, Start pauses on them, the GPX and the score
 * leave them out; its request asks for the pen up, as the export wants.
 * Its request has the activity it was kept with (TASK-200), whatever sport
 * «Settings» has: a bike route is exported as one, and has its stretches
 * with the bike on foot in the result (TASK-206), marked on the map. A
 * turned shape opens with the map turned, as it was kept (TASK-232).
 */
export function openedFavorite(favorite: FavoriteDetail): OpenedFavorite {
  const detail: RecommendedRouteDetail = {
    id: favorite.id,
    city: favorite.city,
    shape: favorite.shape,
    word: favorite.word,
    style: favorite.style,
    distance_m: favorite.distance_m,
    route_m: favorite.route_m,
    similarity: favorite.similarity,
    points: favorite.points,
    license: "",
    ...turnOf(favorite),
  };
  const route: RecommendedRoute = {
    id: favorite.id,
    // The card reads "Star · Trento · looks 97% like it": with no city, what
    // the route is to its owner.
    // Data, not a text: kept in English, as a heart on this card keeps it.
    city: favorite.city === "" ? "favorite" : favorite.city,
    // The card's title: the word comes first there too.
    shape: favoriteTitle(favorite).toLowerCase(),
    word: favorite.word,
    style: favorite.style,
    distance_m: favorite.distance_m,
    route_m: favorite.route_m,
    similarity: favorite.similarity,
    start: favorite.points[0],
    away_m: 0,
    preview: [],
    ...turnOf(favorite),
  };
  const walked = penUp(favorite, favorite.points, favorite.walks);
  const stretches = onFoot(favorite.points, favorite.on_foot);
  const result: RouteResult = { ...toResult(detail), ...walked, ...stretches };
  const activity = favoriteActivity(favorite);
  // A word with the pen up is asked for as «Draw» asks for it, and so a
  // shape in pieces (TASK-223).
  const asked = {
    start: favorite.points[0],
    distance_m: favorite.distance_m,
    activity,
  };
  const request: AnyRouteRequest =
    walked.walks !== undefined && favorite.word !== null
      ? {
          ...asked,
          word: favorite.word,
          style: favorite.style === "block" ? "block" : "round",
          pen_up: true,
        }
      : walked.walks !== undefined && isPenUpShape(favorite.shape)
        ? { ...asked, shape: favorite.shape, pen_up: true }
        : // In the place of `running`: a run's request is the one of before.
          { ...(toRequest(detail) ?? imageRequest(detail, activity)), activity };
  return {
    status: "done",
    route,
    detail,
    request,
    result,
    choices: [result],
    chosen: 0,
    choose: noChoice,
    others: [],
    // With the key the API has it under: its heart is full, and tapped
    // twice keeps it as it was.
    keepable: {
      id: favorite.id,
      request: {
        city: favorite.city,
        shape: favorite.shape,
        word: favorite.word,
        style:
          favorite.style === "round" || favorite.style === "block"
            ? favorite.style
            : null,
        title: favorite.title,
        distance_m: favorite.distance_m,
        route_m: favorite.route_m,
        similarity: favorite.similarity,
        points: favorite.points,
        ...walked,
        ...stretches,
        ...drawnFor(activity),
        ...turnOf(favorite),
      },
    },
  };
}
