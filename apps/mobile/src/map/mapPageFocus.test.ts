/**
 * The map page's script run against a stand-in for MapLibre (TASK-329): a
 * place of a themed route tapped under the map takes the map there, as
 * close as a street, never farther than it was, and keeps the map turned
 * as it is.
 */
import vm from "node:vm";

import { buildMapPage, PLACE_ZOOM } from "./mapPage";
import { focus, turn, type ToPage } from "./messages";

type Flight = { center: [number, number]; zoom: number; bearing: number };

/** The page's own scripts, the ones with no `src`, run in order. */
function runPage(zoom: number) {
  const flights: Flight[] = [];
  const surface = { style: { touchAction: "" }, addEventListener() {} };
  class Map_ {
    dragPan = { enable() {}, disable() {} };
    doubleClickZoom = { enable() {}, disable() {} };
    addControl() {}
    on() {}
    once(event: string, then: () => void) {
      if (event === "style.load") {
        then();
      }
    }
    addSource() {}
    addLayer() {}
    getSource() {
      return undefined;
    }
    setFeatureState() {}
    fitBounds() {}
    getCanvasContainer() {
      return surface;
    }
    getCenter() {
      return { lng: 12.5, lat: 42 };
    }
    getZoom() {
      return zoom;
    }
    getBearing() {
      return 0;
    }
    flyTo(options: Flight) {
      flights.push(options);
    }
    easeTo() {}
    jumpTo() {}
    rotateTo() {}
  }
  class Bounds {
    extend() {
      return this;
    }
  }
  const context: Record<string, unknown> = {
    maplibregl: {
      Map: Map_,
      LngLatBounds: Bounds,
      AttributionControl: class {},
      Marker: class {},
    },
    ReactNativeWebView: { postMessage() {} },
  };
  context.window = context;
  vm.createContext(context);
  const scripts = [...buildMapPage().matchAll(/<script>([\s\S]*?)<\/script>/g)];
  for (const [, code] of scripts) {
    vm.runInContext(code, context);
  }
  const page = context.shaperoute as { receive: (message: ToPage) => void };
  return {
    flights,
    // Through JSON, as injectJavaScript delivers it.
    send: (message: ToPage) => page.receive(JSON.parse(JSON.stringify(message))),
  };
}

test("a place tapped takes the map there, as close as a street", () => {
  const page = runPage(13);
  page.send(focus([41.8902, 12.4922]));
  expect(page.flights).toEqual([
    { center: [12.4922, 41.8902], zoom: PLACE_ZOOM, bearing: 0 },
  ]);
});

test("closer already, the map keeps its zoom; turned, it stays turned", () => {
  const page = runPage(18);
  page.send(turn(40));
  page.send(focus([41.8902, 12.4922]));
  expect(page.flights.at(-1)).toEqual({
    center: [12.4922, 41.8902],
    zoom: 18,
    bearing: 40,
  });
});
