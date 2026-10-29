import type { ImageRouteRequest, LatLon } from "@shaperoute/shared-types";

import { canvasRequest } from "../mapdraw/canvasRequest";
import { newDrawing } from "../mapdraw/drawing";
import { fromPlane } from "../mapdraw/plane";
import { PhoneEngine } from "./phoneEngine";
import { phoneFirst, planOnPhone } from "./onPhone";
import type { ZoneEntry } from "./zones";

/**
 * A figure drawn by hand on the map (TASK-320, TASK-331) is asked for as a
 * picture's outline, an open line too: the phone does not draw it, even
 * with a zone around the start (TASK-214, «photos are drawn on the
 * server»); it goes to the server.
 */

const TRENTO: LatLon = [46.0671, 11.1214];

/** A zone saved around Trento, as the phone keeps one (TASK-214). */
const ZONE: ZoneEntry = {
  name: "foot_45.98370_11.00140_46.15030_11.24160.zone.json.gz",
  etag: null,
  bytes: 7,
  usedAt: 0,
};

test.each([
  [
    "a closed line",
    [
      [-500, -500],
      [500, -500],
      [500, 500],
      [-500, 500],
      [-500, -480],
    ],
  ],
  [
    "an open line",
    [
      [-500, 0],
      [0, 400],
      [500, 0],
    ],
  ],
])("%s drawn on the map goes to the server, as a photo does", async (_what, line) => {
  const drawn = newDrawing(line.map(([x, y]) => fromPlane(TRENTO, [x, y])));
  if (drawn === null || !("placed" in drawn)) throw new Error("no drawing");
  const request = canvasRequest(
    drawn.placed,
    false,
    "running",
    "km",
  ) as ImageRouteRequest;
  expect(request.outline.length).toBeGreaterThanOrEqual(4);
  expect(phoneFirst(request)).toBe(false);
  const engine = new PhoneEngine();
  const plan = jest.spyOn(engine, "plan");
  await expect(planOnPhone(request, { engine, zones: () => [ZONE] })).resolves.toEqual({
    kind: "skipped",
    why: "photos are drawn on the server",
  });
  expect(plan).not.toHaveBeenCalled();
});
