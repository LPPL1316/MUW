import type { LatLon, RouteRequest, Shape } from "@shaperoute/shared-types";
import { File, Paths } from "expo-file-system";
import { useEffect, useSyncExternalStore } from "react";

import { type RouteQueue, routeQueue } from "../api/routeQueue";
import { requestRoute, type RouteOutcome } from "../api/routes";
import { featuredPlace, keepFeaturedPlace } from "../engine/aheadZones";
import { requestRouteOnPhoneFirst } from "../engine/onPhone";
import { savedZones, type ZoneEntry, zonesForEngine } from "../engine/zones";
import { searchCities } from "../explore/cities";
import {
  asRecommended,
  cardOf,
  DRAW_ORDER,
  EXAMPLE_SHAPES,
  type ExampleDetail,
  keepSample,
  keepWhole,
  readKept,
  readyExample,
  requestOf,
  RUN_EXAMPLES,
} from "../explore/exampleRoutes";
import { FEATURED_CITIES } from "../explore/presets";
import type { RecommendedRoute } from "../explore/recommendedRoutes";
import { metresBetween } from "../map/coordinates";
import type { Place } from "../places/photon";

/**
 * «NEAR YOU» under the distance of «Draw» (TASK-306, ADR-0266; the user's
 * request and choices of 2026-10-26): a circle, a heart and a star of 5 km
 * from the phone's position, drawn by the phone when it has the maps around
 * (the server when it has not), and kept in a file with the point they
 * start from: drawn again only more than REDRAW_AFTER_M from it.
 *
 * A shape that does not come out near (refused, or no answer) gives its
 * place to a shape already drawn in a featured city of «Explore», a city
 * each, at random, the simplest shapes first (DRAW_ORDER). Without the
 * position, or with none of the three, ELSEWHERE_ONLY of them. Only what
 * the API has ready at once (its kept examples, ADR-0136): the cards open
 * without a wait. Each route opens as an example of «Explore».
 */

/** The shapes drawn near, in the order they are asked and shown. */
export const NEAR_SHAPES: readonly Shape[] = DRAW_ORDER.filter((shape) =>
  EXAMPLE_SHAPES.includes(shape),
);
/** Farther than this from where they start, they are drawn again. */
export const REDRAW_AFTER_M = 1000;
/** The cards of other cities when nothing comes out near. */
export const ELSEWHERE_ONLY = 6;
/** The cities a shape of the others is asked in before it is left out. */
export const CITIES_PER_SHAPE = 3;
/**
 * How long the shapes near wait for the maps around the phone, which the
 * app downloads as it opens (usePhoneZones.ts): with them the phone draws,
 * without them the server. Checked every ZONE_CHECK_MS.
 */
export const ZONE_WAIT_MS = 45_000;
export const ZONE_CHECK_MS = 3000;
export const NEAR_FILE = "near-you.json";
const ID_PREFIX = "near-you:";

/** A shape near, by how it is going. */
type Near =
  | { status: "waiting" | "drawing" }
  /** Refused by the engine here: kept in the file, not asked again. */
  | { status: "refused" }
  /** No answer this time: asked again the next time. */
  | { status: "failed" }
  | { status: "ready"; route: RecommendedRoute };

/** A card of the row: being drawn near, or ready, near or in a city. */
export type NearCard =
  | { shape: Shape; near: true; status: "drawing" }
  | { shape: Shape; near: boolean; status: "ready"; route: RecommendedRoute };

/** What the file keeps: the point the shapes start from, and each shape's
 * route whole, or null where the engine refused it. */
export type NearKept = {
  point: LatLon;
  shapes: Partial<Record<Shape, ExampleDetail | null>>;
};

export type NearStorage = {
  load: () => NearKept | null;
  save: (kept: NearKept) => void;
};

function isPoint(value: unknown): value is LatLon {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/** The file's content, checked: what does not read is drawn again. */
export function readNear(data: unknown): NearKept | null {
  if (typeof data !== "object" || data === null || !("point" in data)) {
    return null;
  }
  const { point } = data;
  if (!isPoint(point)) {
    return null;
  }
  const shapes: NearKept["shapes"] = {};
  const kept = "shapes" in data ? data.shapes : null;
  if (typeof kept === "object" && kept !== null) {
    for (const shape of NEAR_SHAPES) {
      const detail: unknown = (kept as Record<string, unknown>)[shape];
      if (detail === null) {
        shapes[shape] = null;
      } else if (detail !== undefined) {
        const read = readKept({ [shape]: [detail] })[shape]?.[0];
        if (read !== undefined && read.shape === shape) {
          shapes[shape] = read;
        }
      }
    }
  }
  return { point: [point[0], point[1]], shapes };
}

/** The file in the app's documents. Only this module writes it. */
export const nearFile: NearStorage = {
  load() {
    try {
      const file = new File(Paths.document, NEAR_FILE);
      return file.exists ? readNear(JSON.parse(file.textSync())) : null;
    } catch {
      return null;
    }
  },
  save(kept) {
    try {
      const file = new File(Paths.document, NEAR_FILE);
      file.create({ overwrite: true });
      file.write(JSON.stringify(kept));
    } catch {
      // A convenience: without the file the shapes are drawn again.
    }
  },
};

// Where the shapes near start from, and how each is going.
let anchor: LatLon | null = null;
let near: Partial<Record<Shape, Near>> = {};
// The routes whole of the shapes near, for the file.
let wholes: NearKept["shapes"] = {};
// The shapes of other cities, ready, in the order found.
let elsewhere: { shape: Shape; city: string; route: RecommendedRoute }[] = [];
// A shape and a city the API had not ready: not asked again in this run.
const tried = new Set<string>();
// The featured cities in this run's order: new at each opening.
let cityOrder: string[] | null = null;
let running: AbortController | null = null;
const listeners = new Set<() => void>();
let version = 0;

function changed(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setNear(shape: Shape, state: Near): void {
  near = { ...near, [shape]: state };
  changed();
}

/** For tests: forgets every shape and the order of the cities; stops. */
export function forgetNearYou(): void {
  running?.abort();
  running = null;
  anchor = null;
  near = {};
  wholes = {};
  elsewhere = [];
  tried.clear();
  cityOrder = null;
  changed();
}

/** The featured cities shuffled once a run of the app (Fisher–Yates). */
export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A shape near `point` as a card and whole, with an id of its own: the
 * point stays out of it. */
function nearRoute(
  point: LatLon,
  shape: Shape,
  detail: ExampleDetail,
): { route: RecommendedRoute; detail: ExampleDetail } {
  const id = `${ID_PREFIX}${shape}`;
  const whole: ExampleDetail = {
    ...detail,
    id,
    city: "",
    ...(detail.alternatives
      ? {
          alternatives: detail.alternatives.map((other, i) => ({
            ...other,
            id: `${id}:${i + 1}`,
            city: "",
          })),
        }
      : {}),
  };
  return { route: cardOf(placeAt(point), whole), detail: whole };
}

/** The phone's position as a place of the examples: it has no name. */
function placeAt(point: LatLon): Place {
  return { label: "", point };
}

/** What a shape near asks: a run's example, from the phone's position. */
function nearRequest(point: LatLon, shape: Shape): RouteRequest {
  return requestOf(placeAt(point), shape, RUN_EXAMPLES);
}

/** The shapes near as the file had them, when it is about `here`. */
function fromFile(here: LatLon, storage: NearStorage): boolean {
  const kept = storage.load();
  if (kept === null || metresBetween(kept.point, here) > REDRAW_AFTER_M) {
    return false;
  }
  anchor = kept.point;
  near = {};
  wholes = {};
  for (const shape of NEAR_SHAPES) {
    const detail = kept.shapes[shape];
    if (detail === null) {
      near[shape] = { status: "refused" };
      wholes[shape] = null;
    } else if (detail !== undefined) {
      const { route, detail: whole } = nearRoute(kept.point, shape, detail);
      keepWhole(whole, nearRequest(kept.point, shape));
      near[shape] = { status: "ready", route };
      wholes[shape] = whole;
    }
  }
  return true;
}

/** The cards of the row now. `here` null: no position. */
export function nearYouCards(here: LatLon | null): NearCard[] {
  const cards: NearCard[] = [];
  // Nothing before the row is first filled: no card says «Drawing…» while
  // nothing is drawn.
  if (here !== null && anchor !== null) {
    for (const shape of NEAR_SHAPES) {
      const state = near[shape] ?? { status: "waiting" };
      if (state.status === "ready") {
        cards.push({ shape, near: true, status: "ready", route: state.route });
      } else if (state.status === "waiting" || state.status === "drawing") {
        cards.push({ shape, near: true, status: "drawing" });
      }
    }
  }
  const taken = new Set(cards.map((card) => card.shape));
  for (const other of elsewhereShown(here)) {
    if (!taken.has(other.shape)) {
      cards.push({
        shape: other.shape,
        near: false,
        status: "ready",
        route: other.route,
      });
    }
  }
  return cards;
}

/** The shapes ready near now. */
function readyNear(): Set<Shape> {
  return new Set(NEAR_SHAPES.filter((shape) => near[shape]?.status === "ready"));
}

/** How many shapes of other cities the row wants: one a shape that did not
 * come out near, ELSEWHERE_ONLY without the position or with none near. */
function wanted(here: LatLon | null): number {
  if (here === null || anchor === null) {
    return here === null ? ELSEWHERE_ONLY : 0;
  }
  const out = NEAR_SHAPES.filter((shape) => {
    const status = near[shape]?.status;
    return status === "refused" || status === "failed";
  }).length;
  return out === NEAR_SHAPES.length ? ELSEWHERE_ONLY : out;
}

/** The shapes of other cities the row shows, the simplest first: none a
 * shape ready near. */
function elsewhereShown(here: LatLon | null) {
  const mine = here === null ? new Set<Shape>() : readyNear();
  return elsewhere
    .filter((other) => !mine.has(other.shape))
    .sort((a, b) => DRAW_ORDER.indexOf(a.shape) - DRAW_ORDER.indexOf(b.shape))
    .slice(0, wanted(here));
}

/** Waits `ms`, or until `signal` aborts: it never rejects. */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
  });
}

export type NearOptions = {
  /** The shapes near: the phone first, the server when it cannot. */
  drawNear?: typeof requestRouteOnPhoneFirst;
  /** The shapes of other cities: the API's examples. */
  drawElsewhere?: typeof requestRoute;
  queue?: Pick<RouteQueue, "background">;
  storage?: NearStorage;
  zones?: () => ZoneEntry[];
  search?: typeof searchCities;
  featured?: (name: string) => Place | null;
  keepFeatured?: (name: string, place: Place) => void;
  random?: () => number;
  zoneWaitMs?: number;
  zoneCheckMs?: number;
};

/**
 * Fills the row for `here` (null: no position): first the shapes near that
 * are missing, then the shapes of other cities the row wants. Each request
 * waits for its turn in the app's queue, after the user's. It goes on
 * until it is done or `stop` is called: what is drawn stays, and the next
 * call goes on from it. Trouble that is not a shape's (no network) ends it.
 */
export function fillNearYou(
  apiUrl: string,
  here: LatLon | null,
  {
    drawNear = requestRouteOnPhoneFirst,
    drawElsewhere = requestRoute,
    queue = routeQueue,
    storage = nearFile,
    zones = savedZones,
    search = searchCities,
    featured = featuredPlace,
    keepFeatured = keepFeaturedPlace,
    random = Math.random,
    zoneWaitMs = ZONE_WAIT_MS,
    zoneCheckMs = ZONE_CHECK_MS,
  }: NearOptions = {},
): () => void {
  running?.abort();
  const controller = new AbortController();
  running = controller;
  const { signal } = controller;

  if (
    here !== null &&
    (anchor === null || metresBetween(anchor, here) > REDRAW_AFTER_M)
  ) {
    if (!fromFile(here, storage)) {
      anchor = here;
      near = {};
      wholes = {};
    }
    changed();
  }

  const save = () => {
    if (anchor !== null) {
      storage.save({ point: anchor, shapes: wholes });
    }
  };

  const drawShapesNear = async (from: LatLon): Promise<boolean> => {
    const missing = NEAR_SHAPES.filter((shape) => {
      const status = near[shape]?.status;
      return (
        status === undefined ||
        status === "waiting" ||
        status === "drawing" ||
        status === "failed"
      );
    });
    if (missing.length === 0) {
      return true;
    }
    // The maps around the phone, if they are on their way: the phone draws.
    for (
      let waited = 0;
      waited < zoneWaitMs && zonesForEngine(zones(), "foot", from).length === 0;
      waited += zoneCheckMs
    ) {
      await pause(zoneCheckMs, signal);
      if (signal.aborted) {
        return false;
      }
    }
    for (const shape of missing) {
      if (signal.aborted) {
        return false;
      }
      setNear(shape, { status: "drawing" });
      const request = nearRequest(from, shape);
      const outcome = await queue.background(
        "visible",
        () => drawNear(apiUrl, request, { signal }),
        { signal },
      );
      if (signal.aborted || outcome.kind === "cancelled") {
        setNear(shape, { status: "waiting" });
        return false;
      }
      if (outcome.kind === "route") {
        const { route, detail } = nearRoute(
          from,
          shape,
          asRecommended(placeAt(from), shape, outcome.result).detail,
        );
        keepWhole(detail, request);
        wholes = { ...wholes, [shape]: detail };
        setNear(shape, { status: "ready", route });
        save();
      } else if (
        outcome.kind === "api_error" &&
        outcome.code === "shape_not_drawable"
      ) {
        wholes = { ...wholes, [shape]: null };
        setNear(shape, { status: "refused" });
        save();
      } else {
        setNear(shape, { status: "failed" });
      }
    }
    return true;
  };

  /** A featured city's centre, from the phone or asked once; null when
   * the API cannot be reached, undefined for a city it does not find. */
  const placeOf = async (name: string): Promise<Place | null | undefined> => {
    const known = featured(name);
    if (known !== null) {
      return known;
    }
    const found = await search(apiUrl, name, { signal });
    if (found === null) {
      return null;
    }
    if (found.length === 0) {
      return undefined;
    }
    keepFeatured(name, found[0]);
    return found[0];
  };

  /** The API's example of `shape` from `city`, only if it is ready at once:
   * one it would draw now is let go. */
  const readyAtOnce = (city: Place, shape: Shape): Promise<RouteOutcome> => {
    const attempt = new AbortController();
    const stop = () => attempt.abort();
    signal.addEventListener("abort", stop, { once: true });
    return drawElsewhere(apiUrl, requestOf(city, shape, RUN_EXAMPLES), {
      signal: attempt.signal,
      onStatus: stop,
    }).finally(() => signal.removeEventListener("abort", stop));
  };

  const findElsewhere = async (): Promise<void> => {
    cityOrder ??= shuffled(FEATURED_CITIES, random);
    const want = wanted(here);
    const shown = elsewhereShown(here);
    const mine = here === null ? new Set<Shape>() : readyNear();
    const used = new Set(shown.map((other) => other.city));
    let count = shown.length;
    for (const shape of DRAW_ORDER) {
      if (count >= want) {
        return;
      }
      if (mine.has(shape) || shown.some((other) => other.shape === shape)) {
        continue;
      }
      let asked = 0;
      for (const name of cityOrder) {
        if (asked >= CITIES_PER_SHAPE || signal.aborted) {
          break;
        }
        if (used.has(name) || tried.has(`${shape} ${name}`)) {
          continue;
        }
        const city = await placeOf(name);
        if (signal.aborted || city === null) {
          return;
        }
        if (city === undefined) {
          continue;
        }
        const ready = readyExample(city, shape);
        if (ready !== null) {
          elsewhere = [...elsewhere, { shape, city: name, route: ready }];
          used.add(name);
          count += 1;
          changed();
          break;
        }
        asked += 1;
        const outcome = await queue.background(
          "visible",
          () => readyAtOnce(city, shape),
          { signal },
        );
        if (signal.aborted) {
          return;
        }
        if (outcome.kind === "route") {
          const route = keepSample(city, shape, outcome.result);
          elsewhere = [...elsewhere, { shape, city: name, route }];
          used.add(name);
          count += 1;
          changed();
          break;
        }
        if (
          outcome.kind === "cancelled" ||
          (outcome.kind === "api_error" && outcome.code === "shape_not_drawable")
        ) {
          tried.add(`${shape} ${name}`);
          continue;
        }
        // No network, too many requests: the next time.
        return;
      }
    }
  };

  void (async () => {
    if (here !== null && anchor !== null && !(await drawShapesNear(anchor))) {
      return;
    }
    if (!signal.aborted) {
      await findElsewhere();
    }
  })();
  return () => controller.abort();
}

/**
 * The row while `active`: it fills as soon as it is, and stops when it is
 * not (a run, the navigation, the app in the background), to go on later.
 * `here` undefined: the position is not known yet, nothing is asked.
 */
export function useNearYou(
  apiUrl: string | null,
  here: LatLon | null | undefined,
  active: boolean,
  options: NearOptions = {},
): NearCard[] {
  const lat = here?.[0];
  const lon = here?.[1];
  const none = here === null;
  useEffect(() => {
    if (!active || apiUrl === null || here === undefined) {
      return;
    }
    return fillNearYou(apiUrl, here, options);
    // The point's numbers are the key: a new array of the same is the same.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, apiUrl, lat, lon, none]);
  useSyncExternalStore(subscribe, () => version);
  return here === undefined ? [] : nearYouCards(here);
}
