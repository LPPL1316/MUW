import type { ImageRouteRequest, LatLon } from "@shaperoute/shared-types";

import { type BoardPoint, freehandRequest, newFigure } from "../route/freehand";
import { PhoneEngine } from "./phoneEngine";
import { phoneFirst, planOnPhone } from "./onPhone";
import type { ZoneEntry } from "./zones";

/**
 * A figure drawn by hand in «Draw» (TASK-320) is asked for as a picture's
 * outline: the phone does not draw it, even with a zone around the start
 * (TASK-214, «photos are drawn on the server»); it goes to the server.
 */

const TRENTO: LatLon = [46.0671, 11.1214];

/** A zone saved around Trento, as the phone keeps one (TASK-214). */
const ZONE: ZoneEntry = {
  name: "foot_45.98370_11.00140_46.15030_11.24160.zone.json.gz",
  etag: null,
  bytes: 7,
  usedAt: 0,
};

function stroke(a: BoardPoint, b: BoardPoint, steps = 20): BoardPoint[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  });
}

test("a drawing of the board goes to the server, as a photo does", async () => {
  const added = newFigure([
    ...stroke([0.2, 0.2], [0.8, 0.2]),
    ...stroke([0.8, 0.2], [0.8, 0.8]).slice(1),
    ...stroke([0.8, 0.8], [0.2, 0.8]).slice(1),
    ...stroke([0.2, 0.8], [0.2, 0.22]).slice(1),
  ]);
  if (added === null || !("figure" in added)) throw new Error("no figure");
  const request: ImageRouteRequest = {
    start: TRENTO,
    ...freehandRequest(added.figure),
    distance_m: 5000,
    activity: "running",
  };
  expect(phoneFirst(request)).toBe(false);
  const engine = new PhoneEngine();
  const plan = jest.spyOn(engine, "plan");
  await expect(planOnPhone(request, { engine, zones: () => [ZONE] })).resolves.toEqual({
    kind: "skipped",
    why: "photos are drawn on the server",
  });
  expect(plan).not.toHaveBeenCalled();
});
