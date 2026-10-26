import type {
  ImageRouteRequest,
  LatLon,
  OutlinePoint,
  RouteRequest,
} from "@shaperoute/shared-types";

import { isImageRequest } from "../api/routes";
import { metresBetween } from "../map/coordinates";
import { sameRequest } from "../route/useRouteRequest";
import { canvasRequest } from "./canvasRequest";
import { newDrawing, withDetail } from "./drawing";
import { distanceOf, type Placed, placeAt, placedLines } from "./figure";
import { isSimpleRing } from "./geometry";
import { fromPlane } from "./plane";

const TRENTO: LatLon = [46.0671, 11.1214];

function drawnCircle(radius: number): { line: LatLon[]; placed: Placed } {
  const line = Array.from({ length: 240 }, (_, i) => {
    const a = (2 * Math.PI * 0.97 * i) / 239;
    return fromPlane(TRENTO, [radius * Math.cos(a), radius * Math.sin(a)]);
  });
  const drawn = newDrawing(line);
  if (drawn === null || !("placed" in drawn)) throw new Error("no drawing");
  return { line, placed: drawn.placed };
}

function asImage(request: ReturnType<typeof canvasRequest>): ImageRouteRequest {
  // A drawing on the map has no pieces (TASK-297): never the pen up.
  if (!isImageRequest(request) || request.pen_up)
    throw new Error("not an image request");
  return request;
}

function asShape(request: ReturnType<typeof canvasRequest>): RouteRequest {
  if (isImageRequest(request)) throw new Error("an image request");
  return request;
}

/** What the API checks of an outline sent back (ADR-0069). */
function expectValidOutline(outline: OutlinePoint[]) {
  expect(outline.length).toBeGreaterThanOrEqual(4);
  expect(outline.length).toBeLessThanOrEqual(101);
  expect(outline[outline.length - 1]).toEqual(outline[0]);
  for (const [x, y] of outline) {
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    expect(Math.abs(x)).toBeLessThanOrEqual(1);
    expect(Math.abs(y)).toBeLessThanOrEqual(1);
  }
  // Centred and scaled into the frame: it touches its edge.
  expect(Math.max(...outline.flat().map(Math.abs))).toBe(1);
  expect(isSimpleRing(outline)).toBe(true);
}

test("a line drawn by finger is an image request: closed in [-1, 1], from where it starts", () => {
  const { line, placed } = drawnCircle(1000);
  const request = asImage(canvasRequest(placed, true, "running"));
  expectValidOutline(request.outline);
  expect(request.strokes).toBeUndefined();
  // The first point drawn is where the route starts.
  expect(metresBetween(request.start, line[0])).toBeLessThan(15);
  // The distance is the line's, to the tenth of a km: about the circle's.
  expect(Number.isInteger(request.distance_m)).toBe(true);
  expect(request.distance_m).toBe(Math.round(distanceOf(placed) / 100) * 100);
  expect(request.distance_m).toBeGreaterThan(0.97 * 2 * Math.PI * 1000);
  expect(request.distance_m).toBeLessThan(1.01 * 2 * Math.PI * 1000);
  expect(request.activity).toBe("running");
  expect("pen_up" in request).toBe(false);
});

test("the details of a drawing go as strokes, starting on the outline", () => {
  const { placed } = drawnCircle(1000);
  const hung = withDetail(placed, [
    fromPlane(TRENTO, [0, -960]),
    fromPlane(TRENTO, [0, -400]),
    fromPlane(TRENTO, [0, 0]),
  ]);
  if (hung === null || !("placed" in hung)) throw new Error("no detail");
  const request = asImage(canvasRequest(hung.placed, false, "cycling"));
  expectValidOutline(request.outline);
  expect(request.strokes).toHaveLength(1);
  const [stroke] = request.strokes ?? [];
  // Its first point on a side of the outline, within the engine's 1e-3.
  const [x, y] = stroke[0];
  const onSide = request.outline.slice(1).some((b, i) => {
    const a = request.outline[i];
    const t = Math.max(
      0,
      Math.min(
        1,
        ((x - a[0]) * (b[0] - a[0]) + (y - a[1]) * (b[1] - a[1])) /
          ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2),
      ),
    );
    return (
      Math.hypot(a[0] + t * (b[0] - a[0]) - x, a[1] + t * (b[1] - a[1]) - y) < 1e-3
    );
  });
  expect(onSide).toBe(true);
  expect(request.activity).toBe("cycling");
});

test("a shape of the catalogue is a route request by its name, from its first point", () => {
  const heart = placeAt({ kind: "shape", shape: "heart" }, TRENTO, 6200);
  const request = asShape(canvasRequest(heart, true, "running"));
  expect(request).toEqual({
    start: placedLines(heart)[0][0],
    shape: "heart",
    distance_m: 6200,
    activity: "running",
  });
  // A shape in pieces with the pen up, as «Draw» asks it: sized by its pieces.
  const smiley = placeAt({ kind: "shape", shape: "smiley" }, TRENTO, 5000, true);
  const lifted = asShape(canvasRequest(smiley, true, "running"));
  expect(lifted.pen_up).toBe(true);
  expect(lifted.distance_m).toBe(5000);
  // In miles, to the tenth of a mile: the route says «target 3.6 mi».
  const odd = placeAt({ kind: "shape", shape: "heart" }, TRENTO, 5748);
  expect(asShape(canvasRequest(odd, true, "running", "km")).distance_m).toBe(5700);
  expect(asShape(canvasRequest(odd, true, "running", "mi")).distance_m).toBe(
    Math.round(3.6 * 1609.344),
  );
  // Off, the same figure is drawn with the pen down: longer for its size.
  const down = asShape(canvasRequest(smiley, false, "running"));
  expect("pen_up" in down).toBe(false);
  expect(down.distance_m).toBeGreaterThan(5000);
});

test("a photo's outline goes as it was traced, its other subjects as strokes", () => {
  const outline: OutlinePoint[] = [
    [-1, -0.8],
    [1, -0.8],
    [0, 1],
    [-1, -0.8],
  ];
  const strokes: OutlinePoint[][] = [
    [
      [0, -0.8],
      [0, -1],
      [0.3, -1],
      [0, -1],
    ],
  ];
  const placed = placeAt({ kind: "picture", outline, strokes }, TRENTO, 8000);
  const request = asImage(canvasRequest(placed, true, "running"));
  expect(request.outline).toEqual(outline);
  expect(request.strokes).toEqual(strokes);
  expect(request.distance_m).toBe(8000);
});

test("the same figure moved or sized keeps its arrays: the app knows its route", () => {
  const { placed } = drawnCircle(800);
  const first = canvasRequest(placed, true, "running");
  const again = canvasRequest({ ...placed }, true, "running");
  expect(sameRequest(first, again)).toBe(true);
  const sized = canvasRequest(
    { ...placed, unitM: placed.unitM * 1.2 },
    true,
    "running",
  );
  expect(asImage(sized).outline).toBe(asImage(first).outline);
  expect(sameRequest(first, sized)).toBe(false);
});
