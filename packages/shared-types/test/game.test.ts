import assert from "node:assert/strict";
import { test } from "node:test";

import catalog from "../fixtures/game-catalog.json" with { type: "json" };
import me from "../fixtures/game-me.json" with { type: "json" };
import run from "../fixtures/game-run.json" with { type: "json" };
import type { GameCatalog, GameMe, GameShape, RunGame } from "../src/index.ts";

// The shape game (TASK-296, ADR-0255): the examples the app's tests read,
// shaped as the API's game.py answers.
const shapes: GameShape[] = catalog.shapes.map((shape) => ({
  ...shape,
  goal:
    shape.goal.kind === "distance"
      ? {
          kind: "distance",
          total_m: shape.goal.total_m ?? 0,
          distance_m: null,
          pace_s: null,
        }
      : {
          kind: "pace",
          total_m: null,
          distance_m: shape.goal.distance_m ?? 0,
          pace_s: shape.goal.pace_s ?? 0,
        },
  outline: shape.outline.map(([x, y]) => [x, y] as [number, number]),
}));
const served: GameCatalog = { rules_version: catalog.rules_version, shapes };
const mine: GameMe = me;
const worth: RunGame = { ...run, reason: null };

test("each shape has a closed outline on the card and its five names", () => {
  for (const shape of served.shapes) {
    assert.deepEqual(shape.outline[0], shape.outline[shape.outline.length - 1]);
    assert.ok(shape.outline.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1));
    assert.deepEqual(Object.keys(shape.names).sort(), ["de", "en", "es", "fr", "it"]);
  }
});

test("the game of the account names every shape of the catalog", () => {
  assert.deepEqual(
    mine.shapes.map((shape) => shape.id),
    served.shapes.map((shape) => shape.id),
  );
  for (const shape of mine.shapes) {
    assert.equal(shape.progress === 1, shape.unlocked_at !== null);
    assert.ok(shape.progress <= 1);
  }
});

test("a run that unlocked a shape names one of the catalog", () => {
  assert.ok(worth.counted);
  assert.ok(worth.unlocked.every((id) => served.shapes.some((s) => s.id === id)));
});
