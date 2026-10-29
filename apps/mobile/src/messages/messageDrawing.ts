import type { DrawingDetail, LatLon, MessageDrawing } from "@shaperoute/shared-types";

import type { ActivityDetail } from "../api/activities";
import type { FavoriteDetail } from "../api/favorites";
import { favoriteKey } from "../favorites/favoriteKey";
import type { Keepable } from "../favorites/favoriteRoute";
import { POST_CUT_M, withoutEnds } from "../share/postRun";

/**
 * A drawing sent in a message (TASK-333, ADR-0289, point 2): a copy of the
 * route, the body a favorite keeps (PUT /me/favorites/{key}). A route
 * planned (in «Draw», «Explore», the favorites) goes whole, with its start:
 * it is sent to be run. A run goes as the Feed shows it, without its first
 * and last 200 m (ADR-0159): one's own is cut here, another's comes cut.
 */

/** The API's limits (favorites.py): longer texts are cut, never refused. */
const MAX_CITY = 80;
const MAX_TITLE = 60;
const MAX_NAME = 40;
const MAX_ROUTE_M = 100_000;
const MAX_POINTS = 20_000;

function name(text: string | null, most = MAX_NAME): string | null {
  return text === null || text === "" ? null : text.slice(0, most);
}

function styleOf(style: string | null): MessageDrawing["style"] {
  return style === "round" || style === "block" ? style : null;
}

function metres(distance: number): number {
  return Math.min(MAX_ROUTE_M, Math.max(1, Math.round(distance)));
}

/** At most MAX_POINTS points, the first and last kept: a run of hours. */
export function fewerPoints(points: LatLon[]): LatLon[] {
  if (points.length <= MAX_POINTS) {
    return points;
  }
  const step = (points.length - 1) / (MAX_POINTS - 1);
  return Array.from({ length: MAX_POINTS }, (_, i) => points[Math.round(i * step)]);
}

/** A route planned, as the heart of its card keeps it. */
export function drawingOfRoute(route: Keepable): MessageDrawing {
  return { ...route.request };
}

/** A favorite, whole as GET /me/favorites/{key} gives it. */
export function drawingOfFavorite(favorite: FavoriteDetail): MessageDrawing {
  return {
    city: favorite.city,
    shape: favorite.shape,
    word: favorite.word,
    style: styleOf(favorite.style),
    title: favorite.title,
    distance_m: favorite.distance_m,
    route_m: favorite.route_m,
    similarity: favorite.similarity,
    points: favorite.points,
    ...(favorite.walks === undefined || favorite.walks.length === 0
      ? {}
      : { walks: favorite.walks }),
    ...(favorite.on_foot === undefined || favorite.on_foot.length === 0
      ? {}
      : { on_foot: favorite.on_foot }),
    ...(favorite.activity === undefined
      ? {}
      : { activity: favorite.activity as MessageDrawing["activity"] }),
    ...(favorite.rotation_deg === undefined || favorite.rotation_deg === null
      ? {}
      : { rotation_deg: favorite.rotation_deg }),
  };
}

type RunFields = Pick<
  ActivityDetail,
  | "place"
  | "shape"
  | "word"
  | "style"
  | "title"
  | "distance_m"
  | "fidelity"
  | "rotation_deg"
> & { activity?: MessageDrawing["activity"] };

function drawingOfTrack(run: RunFields, points: LatLon[]): MessageDrawing | null {
  if (points.length < 2) {
    return null;
  }
  const distance = metres(run.distance_m);
  return {
    city: (run.place ?? "").slice(0, MAX_CITY),
    shape: name(run.shape),
    word: name(run.word),
    style: styleOf(run.style),
    title: name(run.title, MAX_TITLE),
    distance_m: distance,
    route_m: distance,
    // How much the run looks like its shape, as the run says it.
    similarity: Math.min(1, Math.max(0, (run.fidelity ?? 0) / 100)),
    points: fewerPoints(points),
    ...(run.activity === undefined ? {} : { activity: run.activity }),
    ...(run.rotation_deg === undefined || run.rotation_deg === null
      ? {}
      : { rotation_deg: run.rotation_deg }),
  };
}

/** One's own run of «My activities»: its track without its ends. Null for
 * a run too short to keep any of it. */
export function drawingOfRun(run: ActivityDetail): MessageDrawing | null {
  return drawingOfTrack(run, withoutEnds(run.track, POST_CUT_M));
}

/** A drawing of the Feed or of a profile: its track as the API gives it,
 * already cut. Null without a line. */
export function drawingOfDrawing(drawing: DrawingDetail): MessageDrawing | null {
  return drawingOfTrack(
    {
      place: drawing.place,
      shape: drawing.shape,
      word: drawing.word,
      style: drawing.style,
      title: drawing.title ?? drawing.route_title,
      distance_m: drawing.distance_m,
      fidelity: drawing.fidelity,
      rotation_deg: drawing.rotation_deg ?? null,
      activity: drawing.activity,
    },
    drawing.track,
  );
}

/**
 * What the map opens of a drawing received: a favorite named by its line,
 * so its heart keeps it as any route and «Start», «Export GPX» and «Draw it
 * near me» are those of a favorite (TASK-333, the user's choice 4).
 */
export function favoriteOfMessage(drawing: MessageDrawing, now: Date): FavoriteDetail {
  return {
    id: favoriteKey(drawing.points),
    city: drawing.city,
    shape: drawing.shape,
    word: drawing.word,
    style: drawing.style,
    title: drawing.title,
    distance_m: drawing.distance_m,
    route_m: drawing.route_m,
    similarity: drawing.similarity,
    created_at: now.toISOString(),
    points: drawing.points,
    walks: drawing.walks ?? [],
    on_foot: drawing.on_foot ?? [],
    ...(drawing.activity === undefined ? {} : { activity: drawing.activity }),
    ...(drawing.rotation_deg === undefined
      ? {}
      : { rotation_deg: drawing.rotation_deg }),
  };
}
