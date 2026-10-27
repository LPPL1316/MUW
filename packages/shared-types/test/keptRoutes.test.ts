import assert from "node:assert/strict";
import { test } from "node:test";

import examples from "../fixtures/city-examples.json" with { type: "json" };
import answer from "../fixtures/kept-routes.json" with { type: "json" };
import request from "../fixtures/kept-routes-request.json" with { type: "json" };
import type { RouteRequest } from "../src/index.ts";
import {
  KEPT_ROUTES_MAX,
  type KeptRoutes,
  type KeptRoutesRequest,
} from "../src/keptRoutes.ts";

// The same JSON is read by the API's test_kept_routes.py (TASK-316).
const asked = request as KeptRoutesRequest;
const kept = answer as KeptRoutes;

test("a request asks a few shapes or words, never an image", () => {
  assert.ok(asked.requests.length >= 1 && asked.requests.length <= KEPT_ROUTES_MAX);
  for (const one of asked.requests) {
    assert.ok((one.shape ?? null) !== null || (one.word ?? null) !== null);
    assert.equal("outline" in one, false);
  }
});

test("the answer has one route or null for each request, in its order", () => {
  assert.equal(kept.routes.length, asked.requests.length);
  assert.equal(kept.routes[0]?.shape, asked.requests[0].shape);
  assert.equal(kept.routes[1], null);
});

test("a city's examples fit in one request", () => {
  const all = examples.requests as RouteRequest[];
  assert.ok(all.length <= KEPT_ROUTES_MAX);
});
