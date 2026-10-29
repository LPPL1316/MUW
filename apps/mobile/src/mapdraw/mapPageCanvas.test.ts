/**
 * The map page's script run against a stand-in for MapLibre (TASK-281):
 * on «Draw on the map» the fingers are the page's own. With «Draw» one
 * finger draws a line and two zoom and move the map (TASK-331); with «Move»
 * one finger moves the figure or the map, two fingers size the figure or
 * zoom the map; with «Erase» a tap is told as a line.
 */
import vm from "node:vm";

import type { LatLon } from "@shaperoute/shared-types";

import {
  buildMapPage,
  CANVAS_ZOOM,
  ERASER_PX,
  FIGURE_PADDING_PX,
  HOLD_MS,
} from "../map/mapPage";
import {
  type CanvasMode,
  clearCanvas,
  type FromPage,
  parsePageMessage,
  setCanvas,
  type ToPage,
} from "../map/messages";

type Touch = { clientX: number; clientY: number };
type TouchEventLike = { touches: Touch[]; timeStamp: number };
type Listener = (event: TouchEventLike) => void;
type Drawn = {
  geometry?: { type: string; coordinates: unknown };
  features?: {
    properties: Record<string, unknown>;
    geometry: { coordinates: unknown };
  }[];
};

const WIDTH = 400;
const HEIGHT = 600;
/** Pixels per degree at CANVAS_ZOOM, north up, the same both ways. */
const PX_PER_DEG = 10_000;

/** A handler of MapLibre's own gestures, on until the page turns it off. */
function handler() {
  const state = { enabled: true };
  return {
    state,
    enable: () => {
      state.enabled = true;
    },
    disable: () => {
      state.enabled = false;
    },
    isEnabled: () => state.enabled,
  };
}

function runPage() {
  const listeners = new Map<string, Listener[]>();
  const sources = new Map<string, Drawn>();
  const mapEvents = new Map<string, (() => void)[]>();
  const surface = {
    style: { touchAction: "" },
    clientWidth: WIDTH,
    clientHeight: HEIGHT,
    addEventListener(type: string, listener: Listener, options: unknown) {
      // Never in the way of MapLibre's own gestures.
      expect(options).toEqual({ passive: true });
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
  };
  const view = { lng: 11, lat: 46, zoom: CANVAS_ZOOM };
  const scale = () => PX_PER_DEG * 2 ** (view.zoom - CANVAS_ZOOM);
  const framed: { bounds: unknown; options: unknown }[] = [];
  const eased: Record<string, unknown>[] = [];
  const halts = { times: 0 };
  // The time of the touches, and the paint of the layers as the page sets it.
  const clock = { now: 0 };
  const paints: Record<string, unknown> = {};
  const handlers = {
    dragPan: handler(),
    touchZoomRotate: handler(),
    doubleClickZoom: handler(),
    dragRotate: handler(),
    touchPitch: handler(),
  };
  class Map_ {
    dragPan = handlers.dragPan;
    touchZoomRotate = handlers.touchZoomRotate;
    doubleClickZoom = handlers.doubleClickZoom;
    dragRotate = handlers.dragRotate;
    touchPitch = handlers.touchPitch;
    addControl() {}
    on(event: string, then: () => void) {
      mapEvents.set(event, [...(mapEvents.get(event) ?? []), then]);
    }
    once(event: string, then: () => void) {
      if (event === "style.load") {
        then();
      }
    }
    addSource(name: string, source: { data: Drawn }) {
      sources.set(name, source.data);
    }
    addLayer() {}
    getLayer(id: string) {
      return { id };
    }
    setPaintProperty(layer: string, name: string, value: unknown) {
      paints[`${layer} ${name}`] = value;
    }
    getSource(name: string) {
      return sources.has(name)
        ? { setData: (data: Drawn) => sources.set(name, data) }
        : undefined;
    }
    setFeatureState() {}
    fitBounds(bounds: unknown, options: unknown) {
      framed.push({ bounds, options });
    }
    easeTo(options: Record<string, unknown>) {
      eased.push(options);
    }
    stop() {
      halts.times += 1;
    }
    getCanvasContainer() {
      return surface;
    }
    getCenter() {
      return { lng: view.lng, lat: view.lat };
    }
    getZoom() {
      return view.zoom;
    }
    jumpTo({ zoom }: { zoom: number }) {
      view.zoom = zoom;
    }
    panBy([dx, dy]: [number, number]) {
      view.lng += dx / scale();
      view.lat -= dy / scale();
    }
    project(lngLat: [number, number] | { lng: number; lat: number }) {
      const [lng, lat] = Array.isArray(lngLat) ? lngLat : [lngLat.lng, lngLat.lat];
      return {
        x: WIDTH / 2 + (lng - view.lng) * scale(),
        y: HEIGHT / 2 - (lat - view.lat) * scale(),
      };
    }
    unproject([x, y]: [number, number]) {
      return {
        lng: view.lng + (x - WIDTH / 2) / scale(),
        lat: view.lat - (y - HEIGHT / 2) / scale(),
      };
    }
  }
  class Bounds {
    points: unknown[];
    constructor(a: unknown, b: unknown) {
      this.points = [a, b];
    }
    extend(point: unknown) {
      this.points.push(point);
      return this;
    }
  }
  const posted: string[] = [];
  const context: Record<string, unknown> = {
    maplibregl: { Map: Map_, LngLatBounds: Bounds, AttributionControl: class {} },
    ReactNativeWebView: { postMessage: (data: string) => posted.push(data) },
  };
  context.window = context;
  vm.createContext(context);
  const scripts = [...buildMapPage().matchAll(/<script>([\s\S]*?)<\/script>/g)];
  for (const [, code] of scripts) {
    vm.runInContext(code, context);
  }
  const page = context.shaperoute as { receive: (message: ToPage) => void };
  const fire = (type: string, touches: Touch[]) =>
    (listeners.get(type) ?? []).forEach((listener) =>
      listener({ touches, timeStamp: clock.now }),
    );
  /** Fingers at x, y, then x, y of the next one. */
  const at = (...xy: number[]): Touch[] =>
    Array.from({ length: xy.length / 2 }, (_, i) => ({
      clientX: xy[2 * i],
      clientY: xy[2 * i + 1],
    }));
  return {
    view,
    surface,
    handlers,
    framed,
    eased,
    halts,
    // Through JSON, as injectJavaScript delivers it.
    send: (message: ToPage) => page.receive(JSON.parse(JSON.stringify(message))),
    /** What the page told the app, read as the app reads it. */
    told: () =>
      posted
        .map((data) => parsePageMessage(data))
        .filter((message): message is FromPage => message !== null),
    drawn: (name: string) => sources.get(name)?.geometry?.coordinates,
    /** The dots a source holds: where, and whether each is the first. */
    dots: (name: string) =>
      (sources.get(name)?.features ?? []).map((f) => ({
        at: f.geometry.coordinates,
        first: f.properties.first,
      })),
    paints,
    /** Time goes by between touches. */
    wait: (ms: number) => {
      clock.now += ms;
    },
    down: (...xy: number[]) => fire("touchstart", at(...xy)),
    to: (...xy: number[]) => fire("touchmove", at(...xy)),
    /** Fingers lifted; those given stay on the map. */
    up: (...left: number[]) => fire("touchend", at(...left)),
    stopped: () => (mapEvents.get("moveend") ?? []).forEach((then) => then()),
  };
}

/** A square figure 0.01° wide around the middle of the map: on the screen,
 * from (150, 250) to (250, 350). */
const SQUARE: [number, number][] = [
  [45.995, 10.995],
  [45.995, 11.005],
  [46.005, 11.005],
  [46.005, 10.995],
  [45.995, 10.995],
];

function canvas(
  mode: CanvasMode,
  withFigure = true,
  frame = false,
  more: { lines?: LatLon[][]; links?: boolean[]; marks?: LatLon[] } = {},
) {
  const lines = more.lines ?? (withFigure ? [SQUARE] : []);
  return setCanvas({
    mode,
    lines,
    links: more.links ?? lines.map(() => false),
    bendable: lines.map((_, i) => i),
    marks: more.marks ?? [],
    centre: withFigure ? [46, 11] : null,
    shrink: 0.5,
    grow: 2,
    frame,
  });
}

function only<T extends FromPage["type"]>(
  told: FromPage[],
  type: T,
): Extract<FromPage, { type: T }>[] {
  return told.filter((m): m is Extract<FromPage, { type: T }> => m.type === type);
}

test("on the canvas MapLibre's gestures are off, and given back after", () => {
  const page = runPage();
  page.send(canvas("draw"));
  for (const one of Object.values(page.handlers)) {
    expect(one.state.enabled).toBe(false);
  }
  expect(page.surface.style.touchAction).toBe("none");
  expect(page.drawn("canvas")).toHaveLength(1);

  page.send(clearCanvas());
  for (const one of Object.values(page.handlers)) {
    expect(one.state.enabled).toBe(true);
  }
  expect(page.surface.style.touchAction).toBe("");
  expect(page.drawn("canvas")).toBeUndefined();
});

test("with «Draw» one finger draws a line, and the map keeps still", () => {
  const page = runPage();
  page.send(canvas("draw", false));
  page.down(100, 100);
  page.to(110, 100);
  page.to(111, 100); // under a finger's step: not a point
  page.to(120, 120);
  page.to(140, 100);
  expect(page.drawn("ink")).toHaveLength(4);
  page.up();
  expect(page.view).toEqual({ lng: 11, lat: 46, zoom: CANVAS_ZOOM });
  const [drawn] = only(page.told(), "drawn");
  expect(drawn.line).toHaveLength(4);
  expect(drawn.line[0][0]).toBeCloseTo(11 + (100 - 200) / PX_PER_DEG, 9);
  expect(drawn.line[0][1]).toBeCloseTo(46 - (100 - 300) / PX_PER_DEG, 9);
  // The line stays until the app answers with the figure.
  expect(page.drawn("ink")).toHaveLength(4);
  page.send(canvas("draw"));
  expect(page.drawn("ink")).toBeUndefined();
});

test("with «Draw» a second finger drops the line, and two fingers zoom the map (TASK-331)", () => {
  const page = runPage();
  page.send(canvas("draw", false));
  page.down(100, 100);
  page.to(130, 130);
  page.down(130, 130, 200, 200);
  page.to(120, 120, 220, 220);
  page.up();
  expect(only(page.told(), "drawn")).toHaveLength(0);
  expect(page.drawn("ink")).toBeUndefined();
  // Apart by 100 √2 px from 70 √2: the map zooms in, and says where it is.
  expect(page.view.zoom).toBeCloseTo(CANVAS_ZOOM + Math.log2(100 / 70), 9);
  expect(only(page.told(), "centre")).toHaveLength(1);
});

test("with «Draw» two fingers on the figure move the map, not the figure", () => {
  const page = runPage();
  page.send(canvas("draw"));
  page.down(180, 300, 220, 300);
  page.to(170, 300, 230, 300);
  page.up();
  expect(only(page.told(), "figure")).toHaveLength(0);
  expect(page.view.zoom).toBeCloseTo(CANVAS_ZOOM + Math.log2(1.5), 9);
});

test("with «Erase» a tap is told as a line of one point, and a finger's line as a line", () => {
  const page = runPage();
  page.send(canvas("erase"));
  page.down(200, 300);
  page.up();
  page.down(100, 100);
  page.to(120, 100);
  page.up();
  const told = only(page.told(), "drawn");
  expect(told.map((m) => m.line.length)).toEqual([1, 2]);
  // The map keeps still.
  expect(page.view).toEqual({ lng: 11, lat: 46, zoom: CANVAS_ZOOM });
});

test("with «Move» one finger on the figure drags it, and the app is told where", () => {
  const page = runPage();
  page.send(canvas("move"));
  page.down(200, 300);
  page.to(250, 280);
  page.up();
  // The map stays; the figure goes 50 px east and 20 px north.
  expect(page.view).toEqual({ lng: 11, lat: 46, zoom: CANVAS_ZOOM });
  const [moved] = only(page.told(), "figure");
  expect(moved.done).toBe(true);
  expect(moved.factor).toBe(1);
  expect(moved.centre[0]).toBeCloseTo(11.005, 9);
  expect(moved.centre[1]).toBeCloseTo(46.002, 9);
  const shown = page.drawn("canvas") as number[][][];
  expect(shown[0][0][0]).toBeCloseTo(10.995 + 0.005, 9);
});

test("with «Move» a finger that barely moves leaves the figure where it was", () => {
  const page = runPage();
  page.send(canvas("move"));
  page.down(200, 300);
  page.to(203, 302);
  page.up();
  expect(only(page.told(), "figure")).toHaveLength(0);
});

test("with «Move» one finger away from the figure moves the map", () => {
  const page = runPage();
  page.send(canvas("move"));
  page.down(50, 550);
  page.to(80, 520);
  page.to(100, 500);
  page.up();
  // The map follows the finger: what was under it stays under it.
  expect(page.view.lng).toBeCloseTo(11 - 50 / PX_PER_DEG, 9);
  expect(page.view.lat).toBeCloseTo(46 - 50 / PX_PER_DEG, 9);
  expect(only(page.told(), "figure")).toHaveLength(0);
  const [where] = only(page.told(), "centre");
  expect(where.lngLat[0]).toBeCloseTo(page.view.lng, 9);
});

test("two fingers on the figure size it, within the distances, telling as they go", () => {
  const page = runPage();
  page.send(canvas("move"));
  page.down(180, 300, 220, 300);
  page.to(170, 300, 230, 300); // 1.5 times
  page.to(100, 300, 300, 300); // 5 times: no more than 2
  page.up(300, 300);
  const sized = only(page.told(), "figure");
  expect(sized.filter((m) => !m.done).map((m) => m.factor)).toEqual([1.5, 2]);
  const [done] = sized.filter((m) => m.done);
  expect(done.factor).toBe(2);
  // About the figure's middle, which stays where it was.
  expect(done.centre[0]).toBeCloseTo(11, 9);
  expect(done.centre[1]).toBeCloseTo(46, 9);
  expect(page.view.zoom).toBe(CANVAS_ZOOM);
  // The finger left does nothing until it is lifted.
  page.to(320, 330);
  page.up();
  expect(only(page.told(), "figure")).toHaveLength(3);

  // Sized once to the most, it grows no more: what is left of the room.
  page.down(180, 300, 220, 300);
  page.to(160, 300, 240, 300);
  page.up();
  expect(only(page.told(), "figure").filter((m) => m.done)).toHaveLength(1);
});

test("two fingers away from the figure zoom the map, and leave the figure", () => {
  const page = runPage();
  page.send(canvas("move"));
  page.down(40, 500, 80, 500);
  page.to(20, 500, 100, 500);
  page.up();
  expect(page.view.zoom).toBeCloseTo(CANVAS_ZOOM + 1, 9);
  expect(only(page.told(), "figure")).toHaveLength(0);
  expect(only(page.told(), "centre")).toHaveLength(1);
});

test("framed as the screen opens: on the figure, or on the town around the start", () => {
  const page = runPage();
  page.send(canvas("move", true, true));
  expect(page.framed).toHaveLength(1);
  expect(page.framed[0].options).toEqual({ padding: FIGURE_PADDING_PX, bearing: 0 });
  page.send(canvas("move", true, false));
  expect(page.framed).toHaveLength(1);

  const empty = runPage();
  empty.send(canvas("draw", false, true));
  expect(empty.eased).toEqual([
    expect.objectContaining({ zoom: CANVAS_ZOOM, bearing: 0 }),
  ]);
  // Once still, the app is told where the map is.
  empty.stopped();
  expect(only(empty.told(), "centre")).toEqual([{ type: "centre", lngLat: [11, 46] }]);
});

test("a finger on the map stops it easing, so a line is drawn where the finger is", () => {
  const page = runPage();
  page.send(canvas("draw", false, true));
  page.down(100, 100);
  expect(page.halts.times).toBe(1);
});

test("grown past the screen, the map steps back to show the figure whole", () => {
  const page = runPage();
  page.send(
    setCanvas({
      mode: "move",
      lines: [SQUARE],
      links: [false],
      bendable: [],
      marks: [],
      centre: [46, 11],
      shrink: 0.1,
      grow: 10,
      frame: false,
    }),
  );
  // Twice as big: 200 px, still on the screen.
  page.down(180, 300, 220, 300);
  page.to(160, 300, 240, 300);
  page.up();
  expect(page.framed).toHaveLength(0);
  // Four times bigger again: 800 px, wider than the screen.
  page.down(180, 300, 220, 300);
  page.to(120, 300, 280, 300);
  page.up();
  expect(page.framed).toHaveLength(1);
  // Shrunk, it stays where it is.
  page.down(150, 300, 250, 300);
  page.to(190, 300, 210, 300);
  page.up();
  expect(page.framed).toHaveLength(1);
});

/** The point of the map at x, y on the screen, north up at CANVAS_ZOOM. */
function lngLatOf(x: number, y: number): [number, number] {
  return [11 + (x - 200) / PX_PER_DEG, 46 - (y - 300) / PX_PER_DEG];
}

test("with «Line» a band goes from the last point to the finger, and the point lifted is told (TASK-331 B)", () => {
  const page = runPage();
  page.send(canvas("line", false, false, { marks: [[46, 11]] }));
  expect(page.dots("canvas-marks")).toEqual([{ at: [11, 46], first: false }]);
  page.down(250, 300);
  expect(page.drawn("ink")).toEqual([[11, 46], lngLatOf(250, 300)]);
  page.to(260, 310);
  expect(page.drawn("ink")).toEqual([[11, 46], lngLatOf(260, 310)]);
  page.up();
  const [tapped] = only(page.told(), "drawn");
  expect(tapped.line).toHaveLength(1);
  tapped.line[0].forEach((value, i) =>
    expect(value).toBeCloseTo(lngLatOf(260, 310)[i], 9),
  );
  expect(tapped.metresPerPx).toBeGreaterThan(0);
  // The map keeps still; with two points the first is the larger one.
  expect(page.view).toEqual({ lng: 11, lat: 46, zoom: CANVAS_ZOOM });
  page.send(
    canvas("line", false, false, {
      marks: [
        [46, 11],
        [46.001, 11],
      ],
    }),
  );
  expect(page.dots("canvas-marks").map((dot) => dot.first)).toEqual([true, false]);
  expect(page.drawn("ink")).toBeUndefined();
});

test("with «Erase» the ink is the eraser's wide pale band, and the line says how big a pixel is", () => {
  const page = runPage();
  page.send(canvas("erase"));
  expect(page.paints["ink line-width"]).toBe(2 * ERASER_PX);
  page.down(100, 100);
  page.to(120, 100);
  page.up();
  const [rubbed] = only(page.told(), "drawn");
  // 0.01° of longitude at 46° N over 100 px.
  expect(rubbed.metresPerPx).toBeCloseTo(
    (0.01 * Math.PI * 6_371_000 * Math.cos((46 * Math.PI) / 180)) / 180 / 100,
    6,
  );
  page.send(canvas("draw"));
  expect(page.paints["ink line-width"]).not.toBe(2 * ERASER_PX);
});

test("a line whose first side is a link is drawn without it, and the link dashed apart", () => {
  const page = runPage();
  const detail: LatLon[] = [
    [46, 11.005],
    [46, 11.01],
    [46.002, 11.01],
  ];
  page.send(
    canvas("draw", true, false, { lines: [SQUARE, detail], links: [false, true] }),
  );
  const flipped = (line: LatLon[]) => line.map(([lat, lng]) => [lng, lat]);
  expect(page.drawn("canvas")).toEqual([flipped(SQUARE), flipped(detail.slice(1))]);
  expect(page.drawn("canvas-links")).toEqual([flipped(detail.slice(0, 2))]);
});

test("with «Move» a line held still, then dragged, bends there and is told; a quick drag moves the figure", () => {
  const page = runPage();
  page.send(canvas("move"));
  // The middle of the right side, held still, then dragged out.
  page.down(250, 300);
  page.wait(HOLD_MS);
  page.to(290, 300);
  const [preview] = page.drawn("canvas") as [number, number][][];
  expect(preview).toHaveLength(6);
  preview[2].forEach((value, i) => expect(value).toBeCloseTo(lngLatOf(290, 300)[i], 9));
  page.up();
  expect(only(page.told(), "figure")).toHaveLength(0);
  const [held] = only(page.told(), "bent");
  held.from.forEach((value, i) => expect(value).toBeCloseTo(lngLatOf(250, 300)[i], 9));
  held.to.forEach((value, i) => expect(value).toBeCloseTo(lngLatOf(290, 300)[i], 9));
  expect(held.metresPerPx).toBeGreaterThan(0);

  // Not held still: the figure moves.
  page.send(canvas("move"));
  page.down(250, 300);
  page.wait(HOLD_MS / 2);
  page.to(290, 300);
  page.up();
  expect(only(page.told(), "bent")).toHaveLength(1);
  expect(only(page.told(), "figure")).toHaveLength(1);
});
