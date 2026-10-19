/**
 * The map page's script run against a stand-in for MapLibre (TASK-292):
 * while the start is chosen on the map, a pin like the start's stays in
 * the middle of the map as the fingers move it, and the app is told where
 * the middle is each time the map stops.
 */
import vm from "node:vm";

import { buildMapPage, POSITION_COLOR, START_ZOOM } from "./mapPage";
import {
  type FromPage,
  parsePageMessage,
  setPick,
  setPosition,
  type ToPage,
} from "./messages";

type Point = { lng: number; lat: number };

/** The page's own scripts, the ones with no `src`, run in order. */
function runPage() {
  const sources = new Map<string, unknown>();
  const events = new Map<string, (() => void)[]>();
  const view = { lng: 12.5, lat: 42, zoom: 5 };
  const eased: Record<string, unknown>[] = [];
  const markers: Marker_[] = [];
  const fire = (event: string) => (events.get(event) ?? []).forEach((then) => then());
  const goTo = (options: { center?: Point; zoom?: number }) => {
    if (options.center) {
      view.lng = options.center.lng;
      view.lat = options.center.lat;
    }
    view.zoom = options.zoom ?? view.zoom;
    fire("move");
    fire("moveend");
  };
  const surface = { style: { touchAction: "" }, addEventListener() {} };
  class Marker_ {
    color: string | undefined;
    at: Point | null = null;
    shown = false;
    element = { style: { visibility: "" } };
    constructor(options: { color?: string }) {
      this.color = options.color;
      markers.push(this);
    }
    setLngLat(p: [number, number] | Point) {
      this.at = Array.isArray(p)
        ? { lng: p[0], lat: p[1] }
        : { lng: p.lng, lat: p.lat };
      return this;
    }
    getLngLat() {
      return this.at;
    }
    addTo() {
      this.shown = true;
      return this;
    }
    remove() {
      this.shown = false;
      return this;
    }
    getElement() {
      return this.element;
    }
  }
  class Map_ {
    dragPan = { enable() {}, disable() {} };
    doubleClickZoom = { enable() {}, disable() {} };
    addControl() {}
    on(event: string, then: () => void) {
      events.set(event, [...(events.get(event) ?? []), then]);
    }
    once(event: string, then: () => void) {
      if (event === "style.load") {
        then();
      }
    }
    addSource(name: string, source: { data: unknown }) {
      sources.set(name, source.data);
    }
    addLayer() {}
    getSource(name: string) {
      return sources.has(name)
        ? { setData: (data: unknown) => sources.set(name, data) }
        : undefined;
    }
    setFeatureState() {}
    fitBounds() {}
    getCanvasContainer() {
      return surface;
    }
    getCenter() {
      return { lng: view.lng, lat: view.lat };
    }
    getBearing() {
      return 0;
    }
    flyTo(options: { center?: [number, number]; zoom?: number }) {
      goTo({
        center: options.center && { lng: options.center[0], lat: options.center[1] },
        zoom: options.zoom,
      });
    }
    easeTo(options: { center?: Point; zoom?: number }) {
      eased.push(options);
      goTo(options);
    }
  }
  class Bounds {
    extend() {
      return this;
    }
  }
  const posted: string[] = [];
  const context: Record<string, unknown> = {
    maplibregl: {
      Map: Map_,
      LngLatBounds: Bounds,
      AttributionControl: class {},
      Marker: Marker_,
    },
    ReactNativeWebView: { postMessage: (data: string) => posted.push(data) },
  };
  context.window = context;
  vm.createContext(context);
  const scripts = [...buildMapPage().matchAll(/<script>([\s\S]*?)<\/script>/g)];
  for (const [, code] of scripts) {
    vm.runInContext(code, context);
  }
  const page = context.shaperoute as { receive: (message: ToPage) => void };
  return {
    markers,
    eased,
    view,
    // Through JSON, as injectJavaScript delivers it.
    send: (message: ToPage) => page.receive(JSON.parse(JSON.stringify(message))),
    /** Fingers move the map there, and lift. */
    pan: (lng: number, lat: number) => goTo({ center: { lng, lat } }),
    /** Where the app was told the middle of the map is, in order. */
    centres: () =>
      posted
        .map((data) => parsePageMessage(data))
        .filter(
          (message): message is Extract<FromPage, { type: "centre" }> =>
            message?.type === "centre",
        )
        .map((message) => message.lngLat),
  };
}

test("while picking, a pin like the start's stays in the middle of the map", () => {
  const page = runPage();
  page.send(setPosition([46.07, 11.12]));
  const [start] = page.markers;
  page.send(setPick(true));

  // Framed on the start, north up, close enough to see the streets.
  expect(page.eased.at(-1)).toMatchObject({
    center: { lng: 11.12, lat: 46.07 },
    zoom: START_ZOOM,
    bearing: 0,
  });
  expect(page.markers).toHaveLength(2);
  const pin = page.markers[1];
  expect(pin.color).toBe(POSITION_COLOR);
  expect(pin.shown).toBe(true);
  expect(start.element.style.visibility).toBe("hidden");
  expect(page.centres().at(-1)).toEqual([11.12, 46.07]);

  page.pan(11.2, 46.1);
  expect(pin.at).toEqual({ lng: 11.2, lat: 46.1 });
  expect(page.centres().at(-1)).toEqual([11.2, 46.1]);
  // The start's own pin has not moved.
  expect(start.at).toEqual({ lng: 11.12, lat: 46.07 });
});

test("done picking, the start's pin is back and the map is told nothing more", () => {
  const page = runPage();
  page.send(setPosition([46.07, 11.12]));
  const [start] = page.markers;
  page.send(setPick(true));
  const pin = page.markers[1];
  page.send(setPick(false));

  expect(pin.shown).toBe(false);
  expect(start.element.style.visibility).toBe("");
  const told = page.centres().length;
  page.pan(11.3, 46.2);
  expect(page.centres()).toHaveLength(told);
  // Asked again, a new pin.
  page.send(setPick(true));
  expect(page.markers).toHaveLength(3);
});

test("without a start, the pin is in the middle of the map where it is", () => {
  const page = runPage();
  page.send(setPick(true));

  expect(page.eased).toHaveLength(0);
  expect(page.markers[0].at).toEqual({ lng: 12.5, lat: 42 });
  expect(page.centres()).toEqual([[12.5, 42]]);
  // Asked twice, still one pin.
  page.send(setPick(true));
  expect(page.markers).toHaveLength(1);
});
