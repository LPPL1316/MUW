import assert from "node:assert/strict";
import { test } from "node:test";

import skiNames from "../fixtures/ski-names.json" with { type: "json" };
import type { SkiNames, SkiUse } from "../src/index.ts";

// The same JSON is validated by the API's test_ski_names_api.py (TASK-375
// part D2).
test("the ski names are the type", () => {
  const names: SkiNames = skiNames;
  const uses: SkiUse[] = [...names.lifts, ...names.pistes];
  assert.ok(uses.length > 0);
  for (const use of uses) {
    assert.equal(typeof use.name, "string");
    assert.ok(use.name.length > 0);
    assert.equal(typeof use.type, "string");
    assert.ok(Number.isInteger(use.times) && use.times >= 1);
  }
});

test("an empty difficulty is kept as an empty text", () => {
  assert.ok(skiNames.pistes.some((use) => use.type === ""));
});
