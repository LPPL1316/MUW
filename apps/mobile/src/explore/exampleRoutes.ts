import {
  type Activity,
  type LatLon,
  LETTER_DISTANCE_M,
  type RouteRequest,
  type RouteResult,
  type Shape,
} from "@shaperoute/shared-types";
import { File, Paths } from "expo-file-system";
import { useEffect, useSyncExternalStore } from "react";

import { type RouteQueue, routeQueue } from "../api/routeQueue";
import { requestRoute, type RouteOutcome } from "../api/routes";
import { metresBetween } from "../map/coordinates";
import { readAheadFile } from "../paddle/aheadStore";
import paddleExamples from "../paddle/paddleExamples.json";
import type { Place } from "../places/photon";
import { shapeAsked } from "../route/penUpShapes";
import { problemText } from "../route/problems";
import { walksOf } from "../route/walks";
import { cityShort } from "./presets";
import {
  isRecommendedDetail,
  type RecommendedRoute,
  type RecommendedRouteDetail,
  turnOf,
} from "./recommendedRoutes";

/**
 * Examples drawn at once for a city without recommended routes (TASK-143):
 * the simplest shapes, the heart the first card, asked one after the other
 * so the first downloads the zone and the others use it. Each opens on the
 * map as a recommended route. Kept in memory and in a file, for the next
 * time.
 */
export const EXAMPLE_SHAPES: readonly Shape[] = ["heart", "circle", "star"];
/**
 * Drawn after those, while they are looked at (TASK-176): the shapes of
 * the catalogue that come out best at this distance from a city's centre
 * (ADR-0144 has the numbers), one at a time as well. One is a card from
 * its turn on, and is left out when it does not come out. A city with
 * recommended routes gets them too: the shapes it has none of, added to
 * its cards.
 */
export const MORE_SHAPES: readonly Shape[] = [
  "moon",
  "horse",
  "snail",
  "dog_head",
  "rabbit_head",
];
/**
 * The order they are asked in: the circle before the heart, and the moon
 * first of the others. A shape's zone is a square around the centre, as
 * large as the shape reaches, and the API downloads one only when none on
 * its disk holds it: the circle's holds every other, and the moon's those
 * after it. With the heart first, as it was, a city new to the API had a
 * second zone downloaded for the circle, some 30 m larger a side.
 */
export const DRAW_ORDER: readonly Shape[] = ["circle", "heart", "star", ...MORE_SHAPES];
/** Short: the quickest to plan, and the smallest zone to download. */
export const EXAMPLE_DISTANCE_M = 5000;

/**
 * Words written from a city's centre after its shapes (TASK-279, the
 * user's choice of 2026-10-13): round letters, the pen up between them,
 * one at a time as the other shapes, and as quiet. Their cards show in
 * this order.
 */
export const EXAMPLE_WORDS: readonly string[] = [
  "CIAO",
  "LOVE",
  "AMORE",
  "RUN",
  "HELLO",
  "MUW",
];

/**
 * The distance a word is asked at: the least its letters may have,
 * LETTER_DISTANCE_M each, as «Use 12 km» in «Draw» (the user's choice). A
 * word of 5 km the API refuses.
 */
export function wordDistanceM(word: string): number {
  return word.length * LETTER_DISTANCE_M;
}

/**
 * The order the words are asked in: the longest first, as the circle among
 * the shapes. Every letter has the same distance, so a longer word reaches
 * farther from the centre, and the zone the API downloads for it holds the
 * shorter ones'.
 */
export function wordOrder(words: readonly string[]): string[] {
  return [...words].sort((a, b) => b.length - a.length);
}

/**
 * What a place's examples are drawn for (TASK-191): a run's from a city's
 * centre, or paddling's from a point on the shore of a lake or the sea,
 * 2 km; the first shapes and then the others, for both (TASK-227, the
 * user's choice). Each set keeps its examples apart from the other's, the
 * same point too: `prefix` comes before the place's key.
 */
export type ExampleSet = {
  activity: Activity;
  distance_m: number;
  /** The shapes after the first ones. */
  more: readonly Shape[];
  /** The words after the shapes (TASK-279): a run's only. */
  words?: readonly string[];
  prefix: string;
  /**
   * Examples that come with the app, drawn before it was built, by key
   * (TASK-227): ready at once, without the network, and never asked again.
   * Read before the file of the phone.
   */
  bundled?: Readonly<Record<string, ExampleDetail[]>>;
};

export const RUN_EXAMPLES: ExampleSet = {
  activity: "running",
  distance_m: EXAMPLE_DISTANCE_M,
  more: MORE_SHAPES,
  words: EXAMPLE_WORDS,
  prefix: "",
};

/**
 * On the water, the shapes of the run (TASK-227, the user's choice: the
 * samples judged fit on the four places). The places of «Explore» come with
 * the app (paddleExamples.json, written by `python -m
 * shaperoute_api.paddle_examples`, which says the engine it was drawn by);
 * «Near me» is drawn as a run's examples.
 */
export const PADDLE_EXAMPLES: ExampleSet = {
  activity: "paddling",
  distance_m: 2000,
  more: MORE_SHAPES,
  prefix: "paddling:",
  bundled: readKept(paddleExamples.examples),
};

/**
 * How a set asks for `shape`. On the water a shape in pieces is drawn piece
 * by piece, the pen up between them, as «Draw» asks for it (TASK-226); a
 * run's examples are drawn in one line, as they always were.
 */
function shapeOf(shape: Shape, set: ExampleSet): ReturnType<typeof shapeAsked> {
  return set.activity === "paddling" ? shapeAsked(shape, true, "paddling") : { shape };
}

/** What a set asks the API for `shape` from `city`: an example's request. */
export function requestOf(city: Place, shape: Shape, set: ExampleSet): RouteRequest {
  return {
    ...shapeOf(shape, set),
    distance_m: set.distance_m,
    start: city.point,
    activity: set.activity,
  };
}

/** What a set asks the API for `word` from `city` (TASK-279): the pen up. */
export function wordRequestOf(
  city: Place,
  word: string,
  set: ExampleSet,
): RouteRequest {
  return {
    word,
    style: "round",
    pen_up: true,
    distance_m: wordDistanceM(word),
    start: city.point,
    activity: set.activity,
  };
}

/** A set's shapes, as its cards show them: the heart first. */
function setShapes(set: ExampleSet): readonly Shape[] {
  return [...EXAMPLE_SHAPES, ...set.more];
}

/** Every shape of `set` at `key` came with the app: nothing to ask. */
function comesWithTheApp(set: ExampleSet, key: string): boolean {
  const bundled = set.bundled?.[key] ?? [];
  return setShapes(set).every((shape) => bundled.some((d) => d.shape === shape));
}

/** A set's shapes, in the order they are asked (DRAW_ORDER). */
export function drawOrderOf(set: ExampleSet): readonly Shape[] {
  return DRAW_ORDER.filter((shape) => !isMore(shape) || set.more.includes(shape));
}
/** The cities whose examples the file keeps, the last first. */
export const MAX_KEPT_CITIES = 8;
export const EXAMPLES_FILE = "city-examples.json";
const ID_PREFIX = "example:";
/** Points of the thumbnail: as light as the list's previews. */
const PREVIEW_POINTS = 60;
const LICENSE =
  "Routes on OpenStreetMap data, (c) OpenStreetMap contributors, ODbL 1.0: https://www.openstreetmap.org/copyright";

/**
 * An example whole, with the other routes to choose from (TASK-151): the
 * API's alternatives, each a whole route. Without the field the example was
 * kept before them, and is drawn again.
 */
export type ExampleDetail = RecommendedRouteDetail & {
  alternatives?: RecommendedRouteDetail[];
  /**
   * On the water, where the engine placed the shape (RouteResult.centre):
   * what «Move the shape» moves (TASK-244). An example kept before it, or
   * drawn by an API older than TASK-238, has none and is not moved.
   */
  centre?: LatLon;
};

/** Where an example is: to ask, being drawn, drawn, or not. */
type Progress =
  | { status: "waiting" }
  | { status: "drawing" }
  | { status: "ready"; route: RecommendedRoute }
  | { status: "failed"; message: string };

export type Example = { shape: Shape } & Progress;

/** A word of a city (TASK-279): as one of its other shapes. */
export type WordExample = { word: string } & Progress;

/** One of the shapes drawn after the first ones. */
export function isMore(shape: Shape): boolean {
  return !EXAMPLE_SHAPES.includes(shape);
}

/** The first shapes of a city, whatever they are doing. */
export function firstExamples(list: Example[]): Example[] {
  return list.filter((e) => !isMore(e.shape));
}

/**
 * The cards a city shows: its first shapes always; another shape while it
 * is drawn and once it is ready. Waiting it is not announced, and failed
 * it is left out: nobody asked for it.
 */
export function shownExamples(list: Example[]): Example[] {
  return list.filter((e) => !isMore(e.shape) || arrived(e));
}

/**
 * The cards added to a city that has routes of its own: every shape drawn
 * for it, from its turn on, but those the city `has` already.
 */
export function addedExamples(list: Example[], has: readonly string[]): Example[] {
  return list.filter((e) => !has.includes(e.shape) && arrived(e));
}

/**
 * The cards of a city's words (TASK-279), as its other shapes: one while it
 * is drawn and once it is ready; one that does not come out is none.
 */
export function shownWords(list: WordExample[]): WordExample[] {
  return list.filter(arrived);
}

function arrived(example: Progress): boolean {
  return example.status === "drawing" || example.status === "ready";
}

/** The shapes among a city's routes, as the API names them; a word is none. */
export function shapesOf(routes: readonly { shape: string | null }[]): string[] {
  return Array.from(
    new Set(routes.flatMap((r) => (r.shape === null ? [] : [r.shape]))),
  );
}

/** The words among a city's routes, in capitals (TASK-279). */
export function wordsOf(routes: readonly { word: string | null }[]): string[] {
  return Array.from(
    new Set(routes.flatMap((r) => (r.word === null ? [] : [r.word.toUpperCase()]))),
  );
}

/** One city's examples: the same point, the same examples. */
export function cityKey(point: LatLon): string {
  return `${point[0].toFixed(4)},${point[1].toFixed(4)}`;
}

/** The key of a place's examples in a set: a run's is the city's key. */
export function examplesKey(point: LatLon, set: ExampleSet = RUN_EXAMPLES): string {
  return `${set.prefix}${cityKey(point)}`;
}

/** Every `step`-th point and the last: the line's look, a few points. */
export function thinned(points: LatLon[], most: number = PREVIEW_POINTS): LatLon[] {
  if (points.length <= most) {
    return points;
  }
  const step = (points.length - 1) / (most - 1);
  return Array.from({ length: most }, (_, i) => points[Math.round(i * step)]);
}

/** What an example draws: a shape, or a word (TASK-279). */
type Drawn = {
  /** In its id, before the place's key. */
  name: string;
  shape: Shape | null;
  word: string | null;
  style: "round" | null;
  distance_m: number;
};

/** A planned route as one of the list, and whole: it opens like one. An
 * example that is not a run says its activity (TASK-191). */
export function asRecommended(
  city: Place,
  shape: Shape,
  result: RouteResult,
  set: ExampleSet = RUN_EXAMPLES,
): { route: RecommendedRoute; detail: ExampleDetail } {
  const drawn: Drawn = {
    name: shape,
    shape,
    word: null,
    style: null,
    distance_m: set.distance_m,
  };
  return asExample(city, drawn, result, set);
}

/** The same for a word with the pen up (TASK-279), at its own distance. */
export function asWord(
  city: Place,
  word: string,
  result: RouteResult,
  set: ExampleSet = RUN_EXAMPLES,
): { route: RecommendedRoute; detail: ExampleDetail } {
  const drawn: Drawn = {
    name: `word:${word}`,
    shape: null,
    word,
    style: "round",
    distance_m: wordDistanceM(word),
  };
  return asExample(city, drawn, result, set);
}

function asExample(
  city: Place,
  { name: drawnName, shape, word, style, distance_m }: Drawn,
  result: RouteResult,
  set: ExampleSet,
): { route: RecommendedRoute; detail: ExampleDetail } {
  const id = `${ID_PREFIX}${drawnName}:${examplesKey(city.point, set)}`;
  const name = cityShort(city.label);
  const whole = (of: RouteResult, routeId: string): RecommendedRouteDetail => ({
    id: routeId,
    city: name,
    shape,
    word,
    style,
    distance_m,
    route_m: of.distance_m,
    similarity: of.similarity,
    points: of.points,
    license: LICENSE,
    ...(set.activity === "running" ? {} : { activity: set.activity }),
    ...penUp(of),
    // Turned to follow the roads or the shore: its card and its map turn
    // back (TASK-232). Each alternative has its own.
    ...turnOf(of),
  });
  const { points, license, walks, ...common } = whole(result, id);
  return {
    route: {
      ...common,
      start: points[0],
      away_m: metresBetween(city.point, points[0]),
      ...previewOf(points, walks),
    },
    detail: {
      ...common,
      points,
      license,
      ...(walks !== undefined ? { walks } : {}),
      ...(result.centre ? { centre: result.centre } : {}),
      // B, C: the routes the engine found besides its own (TASK-093).
      alternatives: (result.alternatives ?? []).map((other, i) =>
        whole(other, `${id}:${i + 1}`),
      ),
    },
  };
}

/**
 * An example with its route drawn again, its shape moved (TASK-244): what
 * the engine answered in place of its line, the rest as it was. Only for
 * the map it is open on: the list keeps the example as it was drawn.
 */
export function movedExample(
  detail: ExampleDetail,
  result: RouteResult,
): ExampleDetail {
  const { id, city, shape, word, style, distance_m, license, activity } = detail;
  return {
    id,
    city,
    shape,
    word,
    style,
    distance_m,
    route_m: result.distance_m,
    similarity: result.similarity,
    points: result.points,
    license,
    ...(activity !== undefined ? { activity } : {}),
    ...penUp(result),
    ...turnOf(result),
    ...(result.centre ? { centre: result.centre } : {}),
    alternatives: [],
  };
}

/**
 * The line a card draws for a route: a few of its points, or, drawn in
 * pieces, all of them with the points the pen comes to without drawing
 * (`gaps`): thinned, a walk would fall between two points kept (TASK-226).
 */
function previewOf(
  points: LatLon[],
  walks: readonly (readonly [number, number])[] | undefined,
): Pick<RecommendedRoute, "preview" | "gaps"> {
  if (walks === undefined || walks.length === 0) {
    return { preview: thinned(points) };
  }
  const gaps = walks.flatMap(([from, to]) =>
    Array.from({ length: to - from }, (_, i) => from + 1 + i),
  );
  return { preview: points, gaps };
}

/** The stretches with the pen up of a planned route, when it has some: a
 * shape drawn in pieces on the water (TASK-226). */
function penUp(result: RouteResult): Pick<RecommendedRouteDetail, "walks"> {
  const walks = walksOf(result.points, result.walks);
  return walks.length > 0 ? { walks: walks.map(([from, to]) => [from, to]) } : {};
}

/** What a card says when its route could not be drawn: on the water in the
 * water's words (TASK-191). */
export function failureText(
  outcome: RouteOutcome,
  activity: Activity = "running",
): string {
  if (outcome.kind === "route" || outcome.kind === "cancelled") {
    return "";
  }
  return problemText(outcome, "shape", activity).text;
}

/** No other shape will do better: the zone or the API is the trouble. */
function stopsAll(outcome: RouteOutcome): boolean {
  return (
    outcome.kind === "unreachable" ||
    (outcome.kind === "api_error" && outcome.code === "map_data_unavailable")
  );
}

/** The API looked for the shape here and did not find it: so it would again. */
function cannotBeDrawn(outcome: RouteOutcome): boolean {
  return outcome.kind === "api_error" && outcome.code === "shape_not_drawable";
}

// The examples of every city asked in this run of the app, and their routes
// whole, to open. Outside the screen: going to the map stops nothing.
const examples = new Map<string, Example[]>();
// Their words, after the shapes (TASK-279).
const words = new Map<string, WordExample[]>();
const details = new Map<string, ExampleDetail>();
// How each was asked, to ask for it again with its shape moved (TASK-244).
const asked = new Map<string, RouteRequest>();
const listeners = new Set<() => void>();
// The other shapes and the words the API could not draw in a city, in this
// run of the app: asked again they would fail the same, at the cost of a
// whole search.
const leftOut = new Set<string>();
// The city drawing now; `save` writes what it drew since the last write.
let running: { key: string; controller: AbortController; save: () => void } | null =
  null;

function show(key: string, list: Example[]): void {
  examples.set(key, list);
  listeners.forEach((listener) => listener());
}

function showWords(key: string, list: WordExample[]): void {
  words.set(key, list);
  listeners.forEach((listener) => listener());
}

/**
 * Every example of `key` not ready yet, of the shapes `which` says and of
 * the words, failed with `message`: they are asked again the next time.
 */
function failRest(
  key: string,
  message: string,
  which: (shape: Shape) => boolean,
): void {
  show(
    key,
    (examples.get(key) ?? []).map((e) =>
      which(e.shape) && e.status !== "ready"
        ? { shape: e.shape, status: "failed", message }
        : e,
    ),
  );
  showWords(
    key,
    (words.get(key) ?? []).map((e) =>
      e.status !== "ready" ? { word: e.word, status: "failed", message } : e,
    ),
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A run's examples of `city` as they are now: in memory, else the file's. */
function runExamplesOf(city: Place, storage: Storage): Example[] {
  const key = examplesKey(city.point);
  return (
    examples.get(key) ??
    fromFile(savedOf(storage, key, RUN_EXAMPLES), city, RUN_EXAMPLES)
  );
}

/**
 * A shape of `city` drawn as a sample of the towns near (TASK-236): a ready
 * example of the city from now on, whole, so that choosing the town opens
 * it without asking the API again (TASK-287). In memory only: the file is
 * for the cities chosen, and gets it if the town is.
 */
export function keepSample(
  city: Place,
  shape: Shape,
  result: RouteResult,
  storage: Storage = fileStorage,
): RecommendedRoute {
  const { route, detail } = asRecommended(city, shape, result);
  details.set(detail.id, detail);
  asked.set(detail.id, requestOf(city, shape, RUN_EXAMPLES));
  show(
    examplesKey(city.point),
    runExamplesOf(city, storage).map((e) =>
      e.shape === shape && e.status !== "ready" ? { shape, status: "ready", route } : e,
    ),
  );
  return route;
}

/** A run's example of `shape` from `city` already ready, in memory or in the
 * file: a sample of it needs no request (TASK-287). */
export function readyExample(
  city: Place,
  shape: Shape,
  storage: Storage = fileStorage,
): RecommendedRoute | null {
  const example = runExamplesOf(city, storage).find((e) => e.shape === shape);
  return example?.status === "ready" ? example.route : null;
}

/**
 * A route drawn whole outside a city's examples, kept to open as one of
 * them, without asking the API: the shapes near the phone in «Draw»
 * (TASK-306). `request` is what it was drawn for.
 */
export function keepWhole(detail: ExampleDetail, request: RouteRequest): void {
  details.set(detail.id, detail);
  asked.set(detail.id, request);
}

/** The route whole of a ready example, to open without asking the API. */
export function exampleDetail(id: string): ExampleDetail | undefined {
  return details.get(id);
}

/**
 * The request a ready example was drawn for: from its place, not from where
 * its route begins, so the API reads the same zone or water again.
 */
export function exampleRequest(id: string): RouteRequest | undefined {
  return asked.get(id);
}

export type Storage = {
  load: () => Record<string, ExampleDetail[]>;
  save: (kept: Record<string, ExampleDetail[]>) => void;
};

// The file as last read or written (TASK-287): it holds whole routes of
// eight cities, too much to read again for each one asked. Only this
// module writes it.
let fileRead: Record<string, ExampleDetail[]> | null = null;

/** The file in the app's documents, as the recent cities (recentCities.ts). */
export const fileStorage: Storage = {
  load() {
    if (fileRead !== null) {
      return { ...fileRead };
    }
    try {
      const file = new File(Paths.document, EXAMPLES_FILE);
      if (!file.exists) {
        return {};
      }
      const data: unknown = JSON.parse(file.textSync());
      fileRead = readKept(data);
      return { ...fileRead };
    } catch {
      return {};
    }
  },
  save(kept) {
    try {
      const file = new File(Paths.document, EXAMPLES_FILE);
      file.create({ overwrite: true });
      file.write(JSON.stringify(kept));
      fileRead = { ...kept };
    } catch {
      // A convenience: without the file the examples are drawn again.
      fileRead = null;
    }
  },
};

/** The file's routes, checked one by one: what does not read is dropped. */
export function readKept(data: unknown): Record<string, ExampleDetail[]> {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return {};
  }
  const kept: Record<string, ExampleDetail[]> = {};
  for (const [key, list] of Object.entries(data)) {
    if (Array.isArray(list)) {
      kept[key] = list
        .filter(isRecommendedDetail)
        .map(readAlternatives)
        .map(readCentre)
        .map(readTurn);
    }
  }
  return kept;
}

/** Alternatives that do not read are as none kept: the example is drawn again. */
function readAlternatives(detail: ExampleDetail): ExampleDetail {
  const { alternatives, ...route } = detail;
  return Array.isArray(alternatives) && alternatives.every(isRecommendedDetail)
    ? detail
    : route;
}

/** A centre that does not read is as none kept: the example is not moved. */
function readCentre(detail: ExampleDetail): ExampleDetail {
  const { centre, ...route } = detail;
  return centre === undefined || isPoint(centre) ? detail : route;
}

/** A turn that does not read is as none kept: the route stays north up. */
function upright<T extends RecommendedRouteDetail>(route: T): T {
  if (route.rotation_deg === undefined || turnOf(route).rotation_deg !== undefined) {
    return route;
  }
  const read = { ...route };
  delete read.rotation_deg;
  return read;
}

/** The same for an example and for each of its alternatives. */
function readTurn(detail: ExampleDetail): ExampleDetail {
  const read = upright(detail);
  return read.alternatives === undefined
    ? read
    : { ...read, alternatives: read.alternatives.map(upright) };
}

function isPoint(value: unknown): value is LatLon {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/** `city`'s routes first in the file, its words too, the oldest cities out.
 * Nothing for a city forgotten meanwhile. */
function keep(storage: Storage, key: string): void {
  if (!examples.has(key) && !words.has(key)) {
    return;
  }
  const all = [...(examples.get(key) ?? []), ...(words.get(key) ?? [])];
  const ready = all.flatMap((e) => {
    const detail = e.status === "ready" ? details.get(e.route.id) : undefined;
    return detail === undefined ? [] : [detail];
  });
  const kept = storage.load();
  delete kept[key];
  const order = [key, ...Object.keys(kept)].slice(0, MAX_KEPT_CITIES);
  const next: Record<string, ExampleDetail[]> = {};
  for (const k of order) {
    next[k] = k === key ? ready : kept[k];
  }
  storage.save(next);
}

/**
 * What was kept for this place: what came with the app first, then what the
 * phone drew ahead of the page (TASK-246); the phone's file is for the rest.
 */
function savedOf(storage: Storage, key: string, set: ExampleSet): ExampleDetail[] {
  return [
    ...(set.bundled?.[key] ?? []),
    ...(set.activity === "paddling"
      ? (readKept({ [key]: readAheadFile().examples[key] })[key] ?? [])
      : []),
    ...(storage.load()[key] ?? []),
  ];
}

/**
 * The examples the file had for this city, as ready cards. One kept before
 * the alternatives (TASK-151) is drawn again, to have them.
 */
function fromFile(saved: ExampleDetail[], city: Place, set: ExampleSet): Example[] {
  return setShapes(set).map((shape): Example => {
    const detail = saved.find((d) => d.shape === shape);
    if (
      detail === undefined ||
      detail.alternatives === undefined ||
      // Kept in one line before the pieces (TASK-226): drawn again.
      ("pen_up" in shapeOf(shape, set) && detail.walks === undefined)
    ) {
      return { shape, status: "waiting" };
    }
    details.set(detail.id, detail);
    asked.set(detail.id, requestOf(city, shape, set));
    return { shape, status: "ready", route: cardOf(city, detail) };
  });
}

/**
 * The words the file had for this city (TASK-279), as ready cards. One kept
 * at another distance, or without its walks, is drawn again.
 */
function wordsFromFile(
  saved: ExampleDetail[],
  city: Place,
  set: ExampleSet,
): WordExample[] {
  return (set.words ?? []).map((word): WordExample => {
    const detail = saved.find((d) => d.shape === null && d.word === word);
    if (
      detail === undefined ||
      detail.distance_m !== wordDistanceM(word) ||
      detail.walks === undefined
    ) {
      return { word, status: "waiting" };
    }
    details.set(detail.id, detail);
    asked.set(detail.id, wordRequestOf(city, word, set));
    return { word, status: "ready", route: cardOf(city, detail) };
  });
}

/** A kept example as its card shows it. */
export function cardOf(city: Place, detail: ExampleDetail): RecommendedRoute {
  const {
    id,
    city: name,
    shape,
    word,
    style,
    distance_m,
    route_m,
    similarity,
  } = detail;
  return {
    id,
    city: name,
    shape,
    word,
    style,
    distance_m,
    route_m,
    similarity,
    start: detail.points[0],
    away_m: metresBetween(city.point, detail.points[0]),
    ...previewOf(detail.points, walksOf(detail.points, detail.walks)),
    ...turnOf(detail),
  };
}

/** One example to ask for: a shape of the city, or one of its words. */
type Ask = {
  /** As `leftOut` knows it, after the place's key. */
  name: string;
  /** The file is written once a group is drawn (TASK-287): the first
   * shapes, the others, the words. */
  group: "first" | "more" | "words";
  /** Nobody waits for it: it fails without a card or a word. */
  quiet: boolean;
  request: RouteRequest;
  status: () => Progress["status"] | undefined;
  put: (progress: Progress) => void;
  made: (result: RouteResult) => { route: RecommendedRoute; detail: ExampleDetail };
};

type Options = {
  request?: typeof requestRoute;
  storage?: Storage;
  /**
   * The shapes among the city's recommended routes, when it has some
   * (TASK-176): those are not drawn, and the others are drawn as the
   * shapes after the first ones, a card from their turn on and no word
   * when they fail. Without it the city has no routes: the first shapes
   * are its examples, announced at once. Its words too (wordsOf): those are
   * not written again (TASK-279).
   */
  has?: readonly string[];
  /** What the examples are for: a run's unless said (TASK-191). */
  set?: ExampleSet;
  /** The app's one queue of route requests (TASK-287). */
  queue?: Pick<RouteQueue, "background">;
};

/**
 * Draws what `city` misses, one shape after the other: the first ones, then
 * the others (TASK-176). Nothing when it is already drawing or every
 * example is ready; another city stops the one drawing. Failed examples are
 * asked again, but for the other shapes the API could not draw.
 */
export function drawExamples(
  apiUrl: string,
  city: Place,
  {
    request = requestRoute,
    storage = fileStorage,
    has,
    set = RUN_EXAMPLES,
    queue = routeQueue,
  }: Options = {},
): void {
  const key = examplesKey(city.point, set);
  if (running?.key === key) {
    return;
  }
  // Nobody waits for these: they fail without a card or a word.
  const quiet = (shape: Shape) => has !== undefined || isMore(shape);
  // The file is read once, and only when the memory has nothing.
  let saved: ExampleDetail[] | undefined;
  const kept = () => (saved ??= savedOf(storage, key, set));
  const before = examples.get(key) ?? fromFile(kept(), city, set);
  const list = setShapes(set).flatMap((shape): Example[] => {
    const was = before.find((e) => e.shape === shape);
    if (was?.status === "ready") {
      return [was];
    }
    if (has?.includes(shape)) {
      return [];
    }
    return [
      was !== undefined && leftOut.has(`${key} ${shape}`)
        ? was
        : { shape, status: "waiting" },
    ];
  });
  // The words after the shapes (TASK-279), as the other shapes; those the
  // city has among its routes are not written again.
  const wordsBefore = words.get(key) ?? wordsFromFile(kept(), city, set);
  const wordList = (set.words ?? []).flatMap((word): WordExample[] => {
    const was = wordsBefore.find((e) => e.word === word);
    if (was?.status === "ready") {
      return [was];
    }
    if (has?.includes(word)) {
      return [];
    }
    return [
      was !== undefined && leftOut.has(`${key} ${word}`)
        ? was
        : { word, status: "waiting" },
    ];
  });
  show(key, list);
  showWords(key, wordList);
  if ([...list, ...wordList].every((e) => e.status !== "waiting")) {
    return;
  }
  if (running !== null) {
    const stopped = running.key;
    running.save();
    running.controller.abort();
    show(
      stopped,
      (examples.get(stopped) ?? []).map((e) =>
        e.status === "drawing" ? { shape: e.shape, status: "waiting" } : e,
      ),
    );
    showWords(
      stopped,
      (words.get(stopped) ?? []).map((e) =>
        e.status === "drawing" ? { word: e.word, status: "waiting" } : e,
      ),
    );
  }
  const shapeAsk = (shape: Shape): Ask => ({
    name: shape,
    group: isMore(shape) ? "more" : "first",
    quiet: quiet(shape),
    request: requestOf(city, shape, set),
    status: () => examples.get(key)?.find((e) => e.shape === shape)?.status,
    put: (progress) =>
      show(
        key,
        (examples.get(key) ?? []).map((e) =>
          e.shape === shape ? { shape, ...progress } : e,
        ),
      ),
    made: (result) => asRecommended(city, shape, result, set),
  });
  const wordAsk = (word: string): Ask => ({
    name: word,
    group: "words",
    quiet: true,
    request: wordRequestOf(city, word, set),
    status: () => words.get(key)?.find((e) => e.word === word)?.status,
    put: (progress) =>
      showWords(
        key,
        (words.get(key) ?? []).map((e) =>
          e.word === word ? { word, ...progress } : e,
        ),
      ),
    made: (result) => asWord(city, word, result, set),
  });
  const asks = [
    ...drawOrderOf(set).map(shapeAsk),
    ...wordOrder(set.words ?? []).map(wordAsk),
  ];
  const controller = new AbortController();
  const { signal } = controller;
  // Examples ready since the file was last written: it is written once a
  // group is drawn (TASK-287), or when another city stops this one.
  let unsaved = false;
  const save = () => {
    if (unsaved) {
      unsaved = false;
      keep(storage, key);
    }
  };
  running = { key, controller, save };
  void (async () => {
    for (const [i, ask] of asks.entries()) {
      if (i > 0 && asks[i - 1].group !== ask.group) {
        save();
      }
      if (ask.status() !== "waiting") {
        continue;
      }
      // A first card shows at once; another only from its turn in the
      // app's queue of route requests (routeQueue.ts).
      if (!ask.quiet) {
        ask.put({ status: "drawing" });
      }
      const outcome = await queue.background(
        "visible",
        () => request(apiUrl, ask.request, { signal }),
        {
          signal,
          onTurn: ask.quiet ? () => ask.put({ status: "drawing" }) : undefined,
        },
      );
      if (signal.aborted || outcome.kind === "cancelled") {
        return;
      }
      if (outcome.kind === "route") {
        const { route, detail } = ask.made(outcome.result);
        details.set(detail.id, detail);
        asked.set(detail.id, ask.request);
        ask.put({ status: "ready", route });
        unsaved = true;
        continue;
      }
      const message = failureText(outcome, set.activity);
      if (ask.quiet) {
        if (cannotBeDrawn(outcome)) {
          leftOut.add(`${key} ${ask.name}`);
          ask.put({ status: "failed", message });
          continue;
        }
        // Trouble that is not this shape's (no network, too many requests):
        // the other shapes and the words are for the next time, and the
        // first stay as they are.
        failRest(key, message, quiet);
        break;
      }
      if (stopsAll(outcome)) {
        failRest(key, message, () => true);
        break;
      }
      ask.put({ status: "failed", message });
    }
    if (running?.key === key) {
      running = null;
    }
  })().finally(save);
}

/** For tests: forgets every city, stops what is drawing, empties the
 * minute of the route requests (as each kind's own count did before). */
export function forgetExamples(): void {
  running?.controller.abort();
  running = null;
  examples.clear();
  words.clear();
  details.clear();
  asked.clear();
  leftOut.clear();
  fileRead = null;
  routeQueue.forget();
}

/**
 * The shapes drawn for `city` while it is chosen: its examples when it has
 * no recommended routes, or the shapes it does not `has` yet; null without
 * a city. They start at once, and go on when the screen closes. Then its
 * words, a run's (TASK-279).
 */
export function useCityExamples(
  apiUrl: string | null,
  city: Place | null,
  options: Options = {},
): { examples: Example[] | null; words: WordExample[] | null; retry: () => void } {
  const { request, storage, has, set } = options;
  const key = city === null ? null : examplesKey(city.point, set);
  const list = useSyncExternalStore(subscribe, () =>
    key === null ? null : (examples.get(key) ?? null),
  );
  const wordList = useSyncExternalStore(subscribe, () =>
    key === null ? null : (words.get(key) ?? null),
  );
  // The same shapes in another array are the same city's routes.
  const hasKey = has?.join(",");
  useEffect(() => {
    if (city === null) {
      return;
    }
    if (apiUrl !== null) {
      drawExamples(apiUrl, city, { request, storage, has, set });
    } else if (key !== null && set !== undefined && comesWithTheApp(set, key)) {
      // Nothing to ask: they show without an API.
      drawExamples("", city, { request, storage, has, set });
    }
    // The city's point and the set are the key: a new label changes nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, key, request, storage, hasKey]);
  return {
    examples: list,
    words: wordList,
    retry: () => {
      if (apiUrl !== null && city !== null) {
        drawExamples(apiUrl, city, { request, storage, has, set });
      }
    },
  };
}
