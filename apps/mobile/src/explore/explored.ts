import {
  type LatLon,
  type LetterStyle,
  type RouteResult,
  type Shape,
  SHAPES,
} from "@shaperoute/shared-types";
import { useCallback, useMemo, useRef, useState } from "react";

import { isPenUpShape } from "../route/penUpShapes";
import type { AnyRouteRequest } from "../route/useRouteRequest";
import { bikeIdeaDetail } from "./bikeIdeas";
import { type ExampleDetail, exampleDetail } from "./exampleRoutes";
import {
  type DetailOutcome,
  fetchRecommendedRoute,
  type RecommendedRoute,
  type RecommendedRouteDetail,
  turnOf,
} from "./recommendedRoutes";

/** A route of "Explore" opened on the map. */
export type Explored =
  | { status: "loading"; route: RecommendedRoute }
  | {
      status: "done";
      route: RecommendedRoute;
      detail: RecommendedRouteDetail;
      /** As a drawn route has them: for the GPX export. */
      request: AnyRouteRequest;
      result: RouteResult;
      /**
       * The routes to choose from, A first (TASK-151): a city's example with
       * the API's alternatives, or the route alone. `route`, `detail`,
       * `request` and `result` are those of the one chosen.
       */
      choices: RouteResult[];
      chosen: number;
      choose: (index: number) => void;
      /** The lines of the routes not chosen, grey on the map (TASK-155). */
      others: LatLon[][];
    }
  | { status: "failed"; route: RecommendedRoute };

/** One route to choose, as the card, the map, Start and the export read it. */
type Option = {
  route: RecommendedRoute;
  detail: RecommendedRouteDetail;
  request: AnyRouteRequest;
  result: RouteResult;
};

type Opened =
  | { status: "loading"; route: RecommendedRoute }
  | { status: "done"; options: Option[]; chosen: number }
  | { status: "failed"; route: RecommendedRoute };

/**
 * The route opened and the others to choose from, each made once: Start
 * and the export know a route by its result (useStartDirections).
 */
export function optionsOf(
  route: RecommendedRoute,
  detail: RecommendedRouteDetail,
  others: RecommendedRouteDetail[] = [],
): Option[] {
  return [detail, ...others].flatMap((one) => {
    const request = toRequest(one);
    if (request === null) {
      return [];
    }
    const shown: RecommendedRoute = {
      ...route,
      route_m: one.route_m,
      similarity: one.similarity,
      start: one.points[0],
      // Each route of the choice is turned as its own drawing (TASK-232).
      rotation_deg: turnOf(one).rotation_deg,
    };
    return [{ route: shown, detail: one, request, result: toResult(one) }];
  });
}

function isShape(value: string | null): value is Shape {
  return value !== null && (SHAPES as readonly string[]).includes(value);
}

/** The request a drawn route would have had: what the GPX export sends,
 * and Start reads (on the water there are no directions to ask, TASK-191). */
export function toRequest(detail: RecommendedRouteDetail): AnyRouteRequest | null {
  const base = {
    start: detail.points[0],
    distance_m: detail.distance_m,
    activity: detail.activity ?? "running",
  };
  // A figure the catalogue does not have (TASK-364): its own outline.
  if (detail.outline !== undefined) {
    return { ...base, outline: detail.outline };
  }
  if (detail.word !== null) {
    const style: LetterStyle = detail.style === "block" ? "block" : "round";
    return { ...base, word: detail.word, style };
  }
  if (!isShape(detail.shape)) {
    return null;
  }
  // Drawn in pieces, the pen up between them (TASK-226): asked so again.
  return detail.walks !== undefined && isPenUpShape(detail.shape)
    ? { ...base, shape: detail.shape, pen_up: true }
    : { ...base, shape: detail.shape };
}

export function toResult(
  detail: RecommendedRouteDetail & Pick<ExampleDetail, "centre">,
): RouteResult {
  return {
    points: detail.points,
    distance_m: detail.route_m,
    similarity: detail.similarity,
    shape: isShape(detail.shape) ? detail.shape : null,
    warnings: [],
    // Planned ahead, without turn-by-turn: Start asks for them (TASK-145).
    directions: [],
    word: detail.word,
    ...(detail.walks !== undefined ? { walks: detail.walks } : {}),
    // Turned, the map turns the other way (TASK-232).
    ...turnOf(detail),
    // An example on the water says where its shape is (TASK-244).
    ...(detail.centre !== undefined ? { centre: detail.centre } : {}),
  };
}

/**
 * How a route is fetched whole: by its id, unless who opens it knows a
 * surer way (a drawing of «Feed», TASK-188).
 */
export type FetchWhole = (apiUrl: string, id: string) => Promise<DetailOutcome>;

/**
 * Opens a route of "Explore": fetches it whole; a city's example (TASK-143)
 * is already whole on the phone. The last one asked wins.
 */
export function useExplored(apiUrl: string | null): {
  explored: Explored | null;
  open: (route: RecommendedRoute, fetchWhole?: FetchWhole) => void;
  close: () => void;
  /**
   * The example on the map drawn again with its shape moved (TASK-244):
   * `detail` takes its place, alone. Nothing when another route is open.
   */
  redraw: (detail: ExampleDetail) => void;
} {
  const [opened, setOpened] = useState<Opened | null>(null);
  const asked = useRef<string | null>(null);

  const open = useCallback(
    (route: RecommendedRoute, fetchWhole: FetchWhole = fetchRecommendedRoute) => {
      asked.current = route.id;
      const bikeIdea = bikeIdeaDetail(route.id);
      const example = exampleDetail(route.id);
      // On the phone already: no server asked (TASK-364).
      const examples =
        bikeIdea !== undefined
          ? optionsOf(route, bikeIdea)
          : example === undefined
            ? []
            : optionsOf(route, example, example.alternatives);
      if (examples.length > 0) {
        setOpened({ status: "done", options: examples, chosen: 0 });
        return;
      }
      if (apiUrl === null) {
        setOpened({ status: "failed", route });
        return;
      }
      setOpened({ status: "loading", route });
      void fetchWhole(apiUrl, route.id).then((outcome) => {
        if (asked.current !== route.id) {
          return;
        }
        const options = outcome.kind === "route" ? optionsOf(route, outcome.route) : [];
        setOpened(
          options.length > 0
            ? { status: "done", options, chosen: 0 }
            : { status: "failed", route },
        );
      });
    },
    [apiUrl],
  );

  const close = useCallback(() => {
    asked.current = null;
    setOpened(null);
  }, []);

  const redraw = useCallback((detail: ExampleDetail) => {
    setOpened((now) => {
      if (now?.status !== "done" || now.options[now.chosen].detail.id !== detail.id) {
        return now;
      }
      const options = optionsOf(now.options[now.chosen].route, detail);
      return options.length > 0 ? { status: "done", options, chosen: 0 } : now;
    });
  }, []);

  const choose = useCallback((index: number) => {
    setOpened((now) =>
      now?.status === "done" && index >= 0 && index < now.options.length
        ? { ...now, chosen: index }
        : now,
    );
  }, []);

  const explored = useMemo((): Explored | null => {
    if (opened === null || opened.status !== "done") {
      return opened;
    }
    return {
      status: "done",
      ...opened.options[opened.chosen],
      choices: opened.options.map((option) => option.result),
      chosen: opened.chosen,
      choose,
      others: opened.options
        .filter((_, index) => index !== opened.chosen)
        .map((option) => option.detail.points),
    };
  }, [opened, choose]);

  return { explored, open, close, redraw };
}
