/**
 * POST /kept-routes (TASK-316, ADR-0276): the routes the API already keeps
 * for some requests, and nothing drawn. "Explore" asks a town's examples
 * with it as the app opens, so a phone never makes the server draw what
 * nobody tapped. The bodies are fixtures/kept-routes-request.json and
 * fixtures/kept-routes.json; the API's side is shaperoute_api/kept_routes.py.
 * In a file of its own, as signals.ts: index.ts is left as it is.
 */
import type { RouteRequest, RouteResult } from "./index.ts";

/** The most requests in one POST: a city's examples, with room for more. */
export const KEPT_ROUTES_MAX = 16;

/** Shapes and words only, as POST /route-jobs takes them: never an image. */
export interface KeptRoutesRequest {
  requests: RouteRequest[];
}

/** One for each request, in its order: the route kept, or null. */
export interface KeptRoutes {
  routes: (RouteResult | null)[];
}
