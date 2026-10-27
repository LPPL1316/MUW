/**
 * The map page's script run against a stand-in for MapLibre (TASK-303):
 * off the route, dots from the runner to where the route goes on, over the
 * route and apart from its dashes; none once back on it, or without a route.
 */
import type { LatLon } from "@shaperoute/shared-types";
import vm from "node:vm";

import { color, routeAhead, walk } from "../theme/tokens";
import {
  buildMapPage,
  REJOIN_COLOR,
  REJOIN_DASH,
  REJOIN_OPACITY,
  REJOIN_WIDTH,
} from "./mapPage";
import {
  clearRejoin,
  clearRoute,
  showRejoin,
  showRoute,
  type ToPage,
} from "./messages";

type Data = { type: string; geometry?: { type: string; coordinates: unknown } };
type Layer = {
  id: string;
  layout?: Record<string, unknown>;
  paint: Record<string, unknown>;
};

/** Just enough of MapLibre GL JS for the page's script. */
function runPage() {
  const sources = new Map<string, { data: Data; setData: (data: Data) => void }>();
  const layers: Layer[] = [];
  const once = new Map<string, () => void>();
  class Map_ {
    addControl() {}
    once(event: string, handler: () => void) {
      once.set(event, handler);
    }
    on() {}
    addSource(id: string, source: { data: Data }) {
      const entry = {
        data: source.data,
        setData(data: Data) {
          entry.data = data;
        },
      };
      sources.set(id, entry);
    }
    getSource(id: string) {
      return sources.get(id);
    }
    addLayer(layer: Layer) {
      layers.push(layer);
    }
    getLayer(id: string) {
      return layers.find((layer) => layer.id === id);
    }
    setPaintProperty() {}
    setFeatureState() {}
    fitBounds() {}
    flyTo() {}
    easeTo() {}
  }
  class LngLatBounds {
    extend() {
      return this;
    }
  }
  const context: Record<string, unknown> = {
    maplibregl: { Map: Map_, LngLatBounds, AttributionControl: class {} },
    JSON,
    Boolean,
    matchMedia: () => ({ matches: false }),
    setInterval: () => 0,
    clearInterval: () => {},
  };
  context.window = context;
  vm.createContext(context);
  for (const [, code] of buildMapPage().matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    vm.runInContext(code, context);
  }
  const page = context.shaperoute as { receive: (message: ToPage) => void };
  return {
    layers,
    styleLoads: () => once.get("style.load")!(),
    // Through JSON, as injectJavaScript delivers it.
    send: (message: ToPage) => page.receive(JSON.parse(JSON.stringify(message))),
    data: (id: string) => sources.get(id)?.data,
  };
}

const ROUTE: LatLon[] = [
  [46.0, 11.0],
  [46.001, 11.0],
  [46.002, 11.0],
];
const RUNNER: LatLon = [46.0012, 11.0013];
const BACK_TO: LatLon = [46.0011, 11.0];

test("the dots are their own layer, over the route, in the colour of text", () => {
  const page = runPage();
  page.styleLoads();
  const ids = page.layers.map((layer) => layer.id);
  expect(ids.indexOf("route")).toBeLessThan(ids.indexOf("rejoin"));
  expect(ids.indexOf("route-ahead")).toBeLessThan(ids.indexOf("rejoin"));
  const dots = page.layers.find((layer) => layer.id === "rejoin")!;
  expect(dots.layout?.["line-cap"]).toBe("round");
  expect(dots.paint["line-color"]).toBe(REJOIN_COLOR);
  expect(dots.paint["line-width"]).toBe(REJOIN_WIDTH);
  expect(dots.paint["line-opacity"]).toBe(REJOIN_OPACITY);
  expect(dots.paint["line-dasharray"]).toEqual(REJOIN_DASH);
  // Dots, not the dashes of the route left nor the grey of the walks.
  expect(REJOIN_DASH[0]).toBe(0);
  expect(REJOIN_DASH).not.toEqual(routeAhead.dash);
  expect(REJOIN_COLOR).toBe(color.text);
  expect(REJOIN_COLOR).not.toBe(walk.color);
  expect(page.data("rejoin")?.geometry).toBeUndefined();
});

test("off the route the dots go from the runner to the route, and go with them", () => {
  const page = runPage();
  page.styleLoads();
  page.send(showRoute(ROUTE));
  page.send(showRejoin(RUNNER, BACK_TO));
  expect(page.data("rejoin")?.geometry).toEqual({
    type: "LineString",
    coordinates: [
      [RUNNER[1], RUNNER[0]],
      [BACK_TO[1], BACK_TO[0]],
    ],
  });
  const further: LatLon = [46.0014, 11.0013];
  page.send(showRejoin(further, [46.0014, 11.0]));
  expect(page.data("rejoin")?.geometry?.coordinates).toEqual([
    [further[1], further[0]],
    [11.0, 46.0014],
  ]);
  // Back on the route: none.
  page.send(clearRejoin());
  expect(page.data("rejoin")?.geometry).toBeUndefined();
});

test("dots sent before the style loads are drawn with it", () => {
  const page = runPage();
  page.send(showRejoin(RUNNER, BACK_TO));
  page.styleLoads();
  expect(page.data("rejoin")?.geometry?.type).toBe("LineString");
});

test("without a route there are no dots", () => {
  const page = runPage();
  page.styleLoads();
  page.send(showRoute(ROUTE));
  page.send(showRejoin(RUNNER, BACK_TO));
  page.send(clearRoute());
  expect(page.data("rejoin")?.geometry).toBeUndefined();
});
