import assert from "node:assert/strict";
import { test } from "node:test";

import route from "../fixtures/muw-route.json" with { type: "json" };
import list from "../fixtures/muw-routes.json" with { type: "json" };
import type { MuwRouteDetail, MuwRoutesPage } from "../src/index.ts";

// The same JSON is what the API's test_muw_routes.py answers (TASK-365).
test("the fixtures are the types", () => {
  const detail = route as unknown as MuwRouteDetail;
  const page = list as unknown as MuwRoutesPage;
  assert.equal(page.routes[0]?.id, detail.id);
  assert.deepEqual(page.routes[0]?.preview, detail.points);
  assert.equal(page.routes[0]?.climb_m, detail.climb_m);
});

test("nothing says someone rode it", () => {
  const said = new Set([...Object.keys(route), ...Object.keys(list.routes[0] ?? {})]);
  for (const field of ["author", "started_at", "duration_s", "pace", "calories"]) {
    assert.equal(said.has(field), false);
  }
});
