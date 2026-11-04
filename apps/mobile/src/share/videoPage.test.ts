/// <reference types="node" />

import type { LatLon } from "@shaperoute/shared-types";

import { MAPLIBRE_JS_SRI, MAPLIBRE_JS_URL } from "../map/mapPage";
import { mp4Of, type VideoSample } from "./mp4";
import { POST_RESULTS } from "./postRun";
import { bytesOfBase64, samplesOf } from "./videoFile";
import {
  makeCall,
  prepareMapCall,
  VIDEO_CODECS,
  VIDEO_PAGE,
  VIDEO_PAGE_BASE,
  type VideoPageMessage,
} from "./videoPage";
import { videoScene } from "./videoScene";

/** The scripts of the page without a source, as the WebView runs them:
 * the frames from a timer, then the page's own. */
function scripts(): string[] {
  return Array.from(VIDEO_PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g), (m) => m[1]);
}

/** The page's own script. */
function script(): string {
  const found = scripts();
  if (found.length < 2) {
    throw new Error("no script");
  }
  return found[found.length - 1];
}

type Init = {
  output: (
    chunk: FakeChunk,
    meta?: { decoderConfig?: { description?: ArrayBuffer } },
  ) => void;
  error: (error: Error) => void;
};
type FakeChunk = {
  type: "key" | "delta";
  timestamp: number;
  byteLength: number;
  copyTo: (bytes: Uint8Array) => void;
};
type Config = { codec: string; width: number; height: number };

/** The avcC the fake encoder gives. */
const AVCC = [1, 0x42, 0xe0, 0x28, 0xff];

/**
 * A stand-in for WebCodecs' VideoEncoder: each picture comes out at once,
 * three bytes long (its number, then 1, 2), the first with the avcC.
 * `supported` is the codecs it says yes to; `failAt` the picture it fails on.
 */
function fakeEncoder(supported: readonly string[], failAt = -1) {
  const made: FakeEncoder[] = [];
  class FakeEncoder {
    static isConfigSupported = async (config: Config) => ({
      supported: supported.includes(config.codec),
    });

    encodeQueueSize = 0;
    config: Config | null = null;
    count = 0;
    closed = false;

    constructor(private init: Init) {
      made.push(this);
    }

    configure(config: Config) {
      this.config = config;
    }

    encode(frame: { init: { timestamp: number } }, options: { keyFrame: boolean }) {
      const n = this.count;
      this.count += 1;
      if (n === failAt) {
        this.init.error(new Error("EncodingError"));
        return;
      }
      this.init.output(
        {
          type: options.keyFrame ? "key" : "delta",
          timestamp: frame.init.timestamp,
          byteLength: 3,
          copyTo: (bytes) => bytes.set([n & 0xff, 1, 2]),
        },
        n === 0
          ? { decoderConfig: { description: Uint8Array.from(AVCC).buffer } }
          : undefined,
      );
    }

    async flush() {}

    close() {
      this.closed = true;
    }
  }
  return { FakeEncoder, made };
}

class FakeFrame {
  constructor(
    public source: unknown,
    public init: { timestamp: number; duration: number },
  ) {}

  close() {}
}

/** What a fake map does once made: settles at once, fails a tile first,
 * never says a word, or has its tiles after two drawings but never says
 * idle (a page with no animation frames). */
type MapOutcome = "idle" | "error" | "never" | "silent";

type Handler = () => void;

type Camera = {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
};
type Padding = { top: number; bottom: number; left: number; right: number };

/** A stand-in for MapLibre's map: made, it says `load` and `idle` (or an
 * error first), remembers the camera it was given, and projects the world
 * flat about the padded middle of its 360 × 640 points, a degree being
 * 1000 · 2^(zoom − 13) points: enough for the page's fit to converge. */
function fakeMapLibre(outcome: MapOutcome) {
  const made: FakeMap[] = [];
  class FakeMap {
    handlers: Record<string, Handler[]> = {};
    padding: Padding = { top: 0, bottom: 0, left: 0, right: 0 };
    jumped: unknown = null;
    jumps: Record<string, unknown>[] = [];
    camera: Camera;
    terrain: unknown = null;
    removed = false;
    redraws = 0;

    constructor(public options: Record<string, unknown>) {
      made.push(this);
      this.camera = {
        center: options.center as [number, number],
        zoom: options.zoom as number,
        bearing: options.bearing as number,
        pitch: options.pitch as number,
      };
      if (outcome !== "never" && outcome !== "silent") {
        setTimeout(() => {
          if (outcome === "error") {
            this.emit("error");
          }
          this.emit("load");
          this.emit("idle");
        }, 10);
      }
    }

    middle(): [number, number] {
      const p = this.padding;
      return [(p.left + 360 - p.right) / 2, (p.top + 640 - p.bottom) / 2];
    }

    scale(): number {
      return 1000 * 2 ** (this.camera.zoom - 13);
    }

    project([lng, lat]: [number, number]) {
      const [mx, my] = this.middle();
      const k = this.scale();
      return {
        x: mx + (lng - this.camera.center[0]) * k,
        y: my - (lat - this.camera.center[1]) * k,
      };
    }

    unproject([x, y]: [number, number]) {
      const [mx, my] = this.middle();
      const k = this.scale();
      return {
        lng: this.camera.center[0] + (x - mx) / k,
        lat: this.camera.center[1] - (y - my) / k,
      };
    }

    getZoom() {
      return this.camera.zoom;
    }

    setTerrain(spec: unknown) {
      this.terrain = spec;
    }

    isStyleLoaded() {
      return this.loaded();
    }

    on(event: string, handler: Handler) {
      (this.handlers[event] ??= []).push(handler);
    }

    once(event: string, handler: Handler) {
      this.on(event, handler);
    }

    emit(event: string) {
      for (const handler of this.handlers[event] ?? []) {
        handler();
      }
    }

    setPadding(padding: Padding) {
      this.padding = padding;
    }

    jumpTo(camera: Record<string, unknown>) {
      this.jumped = camera;
      this.jumps.push(camera);
      Object.assign(this.camera, camera);
    }

    getCanvas() {
      return { width: 1080, height: 1920 };
    }

    redraw() {
      this.redraws += 1;
      // As MapLibre does: idle again from inside a drawing, when whole.
      if (outcome === "idle" && this.loaded()) {
        this.emit("idle");
      }
    }

    loaded() {
      return outcome === "silent" ? this.redraws >= 2 : outcome !== "never";
    }

    areTilesLoaded() {
      return this.loaded();
    }

    remove() {
      this.removed = true;
    }
  }
  return { Map: FakeMap, made };
}

/** A 2D context that takes every call and remembers the words written. */
function fakeContext(written: string[]) {
  const calls: Record<string, jest.Mock> = {
    fillText: jest.fn((text: string) => written.push(text)),
    measureText: jest.fn((text: string) => ({ width: text.length * 20 })),
    createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
  };
  return new Proxy(calls, {
    get: (target, key: string) => (target[key] ??= jest.fn()),
    set: () => true,
  });
}

/** The page, run with these WebCodecs (undefined: none) and this MapLibre
 * (undefined: the library did not load), as in the WebView. */
function page(
  VideoEncoder?: unknown,
  VideoFrame: unknown = FakeFrame,
  maplibregl?: ReturnType<typeof fakeMapLibre>,
) {
  const posted: VideoPageMessage[] = [];
  const written: string[] = [];
  const context = fakeContext(written);
  const window: Record<string, unknown> = {
    ReactNativeWebView: {
      postMessage: (text: string) => posted.push(JSON.parse(text) as VideoPageMessage),
    },
  };
  const document = {
    body: { appendChild: jest.fn(), removeChild: jest.fn() },
    createElement: () => ({
      width: 0,
      height: 0,
      style: {},
      parentNode: null,
      getContext: () => context,
    }),
  };
  const btoa = (text: string) => Buffer.from(text, "latin1").toString("base64");
  new Function(
    "window",
    "document",
    "VideoEncoder",
    "VideoFrame",
    "btoa",
    "maplibregl",
    script(),
  )(window, document, VideoEncoder, VideoFrame, btoa, maplibregl);
  const api = window.muwVideo as {
    make: (scene: unknown) => void;
    prepareMap: (map: unknown) => void;
  };
  return { posted, written, context, make: api.make, prepareMap: api.prepareMap };
}

/** Until the page says `type`, or three seconds go by. */
async function until(posted: VideoPageMessage[], ...types: string[]) {
  for (let i = 0; i < 600 && !posted.some((m) => types.includes(m.type)); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function north(metres: number): LatLon[] {
  return Array.from({ length: metres / 50 + 1 }, (_, i): LatLon => [
    46.07 + (i * 50) / 111_195,
    11.12,
  ]);
}

const RUN = {
  key: null,
  title: "Heart in Trento",
  track: north(5200),
  distanceM: 5200,
  durationMs: (28 * 60 + 10) * 1000,
};
const STICKERS = [{ id: 1, emoji: "🔥", x: 0.5, y: 0.5 }];
const SCENE = videoScene(RUN, POST_RESULTS, STICKERS, "paper");
const NIGHT_SCENE = videoScene(RUN, POST_RESULTS, STICKERS, "night");
const RELIEF_SCENE = videoScene(RUN, POST_RESULTS, STICKERS, "3d");

describe("the video page", () => {
  it("is plain JavaScript the WebView can run", () => {
    // Compiled, not run: a mistake in the template string fails here.
    expect(() => new Function(script())).not.toThrow();
  });

  it("gives itself animation frames from a timer before MapLibre loads, so a page kept out of sight still draws", async () => {
    const [frames] = scripts();
    expect(VIDEO_PAGE.indexOf(frames)).toBeLessThan(
      VIDEO_PAGE.indexOf(MAPLIBRE_JS_URL),
    );
    const window: Record<string, unknown> = {};
    new Function("window", "performance", frames)(window, { now: () => 42 });
    const request = window.requestAnimationFrame as (cb: (t: number) => void) => number;
    const cancel = window.cancelAnimationFrame as (id: number) => void;
    const given: number[] = [];
    const first = request((at) => given.push(at));
    const second = request((at) => given.push(at + 1));
    cancel(second);
    expect(first).not.toBe(second);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(given).toEqual([42]);
  });

  it("asks only for Baseline H.264, at a level that holds 1080 × 1920", () => {
    for (const codec of VIDEO_CODECS) {
      const [, profile, , level] = /^avc1\.(..)(..)(..)$/.exec(codec) ?? [];
      expect(profile).toBe("42");
      expect(parseInt(level, 16)).toBeGreaterThanOrEqual(40);
      expect(script()).toContain(codec);
    }
  });

  it("says it is on an https page, so WebCodecs is there, and loads only MapLibre, pinned as the map page has it", () => {
    expect(VIDEO_PAGE_BASE.startsWith("https://")).toBe(true);
    expect(VIDEO_PAGE).toContain(
      `<script src="${MAPLIBRE_JS_URL}" integrity="${MAPLIBRE_JS_SRI}" crossorigin="anonymous">`,
    );
    expect(VIDEO_PAGE.match(/src=/g)).toHaveLength(1);
    expect(VIDEO_PAGE).not.toMatch(/href=|fetch\(|XMLHttpRequest/);
  });

  it("calls the page with the scene, and the map, as they are", () => {
    expect(makeCall('{"fps":30}')).toBe('window.muwVideo.make({"fps":30}); true;');
    expect(prepareMapCall('{"zoom":13}')).toBe(
      'window.muwVideo.prepareMap({"zoom":13}); true;',
    );
  });
});

describe("the video page, with a fake encoder", () => {
  it("is ready with the first codec the encoder takes", async () => {
    const { FakeEncoder } = fakeEncoder(["avc1.42e02a", "avc1.420028"]);
    const { posted } = page(FakeEncoder);
    await until(posted, "ready");
    expect(posted).toEqual([{ type: "ready", codec: "avc1.42e02a" }]);
  });

  it("says it cannot when the WebView has no WebCodecs, or no codec of ours", async () => {
    const none = page(undefined, undefined);
    await until(none.posted, "ready");
    expect(none.posted).toEqual([{ type: "ready", codec: null }]);
    const other = page(fakeEncoder(["avc1.640028"]).FakeEncoder);
    await until(other.posted, "ready");
    expect(other.posted).toEqual([{ type: "ready", codec: null }]);
  });

  it("encodes every picture of the scene, in order, into a whole MP4", async () => {
    const { FakeEncoder, made } = fakeEncoder([VIDEO_CODECS[0]]);
    const { posted, written, make } = page(FakeEncoder);
    await until(posted, "ready");
    make(SCENE);
    await until(posted, "done", "failed");

    const encoder = made[0];
    expect(encoder.config).toEqual(
      expect.objectContaining({ codec: VIDEO_CODECS[0], width: 1080, height: 1920 }),
    );
    expect(encoder.closed).toBe(true);
    expect(posted[posted.length - 1]).toEqual({
      type: "done",
      frames: 360,
      ms: { encode: expect.any(Number) },
      mode: "flat",
    });
    expect(posted.filter((m) => m.type === "progress").length).toBeGreaterThan(10);

    const config = posted.find((m) => m.type === "config");
    expect(config?.type === "config" && Array.from(bytesOfBase64(config.avcC))).toEqual(
      AVCC,
    );
    const samples: VideoSample[] = posted.flatMap((m) =>
      m.type === "chunks" ? samplesOf(m) : [],
    );
    expect(samples).toHaveLength(360);
    expect(samples.map((s) => s.time)).toEqual(
      Array.from({ length: 360 }, (_, i) => Math.round((i * 1e6) / 30)),
    );
    // A picture to start from every two seconds.
    expect(samples.flatMap((s, i) => (s.key ? [i] : []))).toEqual([
      0, 60, 120, 180, 240, 300,
    ]);
    expect(Array.from(samples[7].data)).toEqual([7, 1, 2]);
    // What the scene says is drawn.
    expect(written).toEqual(expect.arrayContaining(["MuW", "Heart in Trento", "🔥"]));

    const file = mp4Of({
      width: 1080,
      height: 1920,
      fps: 30,
      avcC: bytesOfBase64(config?.type === "config" ? config.avcC : ""),
      samples,
    });
    expect(String.fromCharCode(...file.subarray(4, 8))).toBe("ftyp");
    // 360 pictures of 3 bytes after the index.
    expect(file.length).toBeGreaterThan(360 * 3);
  });

  it("makes one video only, however often it is asked", async () => {
    const { FakeEncoder, made } = fakeEncoder([VIDEO_CODECS[0]]);
    const { posted, make } = page(FakeEncoder);
    await until(posted, "ready");
    make(SCENE);
    make(SCENE);
    await until(posted, "done", "failed");
    expect(made).toHaveLength(1);
    expect(posted.filter((m) => m.type === "done")).toHaveLength(1);
  });

  it("says it failed when the encoder fails, and stops there", async () => {
    const { FakeEncoder, made } = fakeEncoder([VIDEO_CODECS[0]], 5);
    const { posted, make } = page(FakeEncoder);
    await until(posted, "ready");
    make(SCENE);
    await until(posted, "done", "failed");
    expect(posted[posted.length - 1]).toEqual({
      type: "failed",
      error: "EncodingError",
    });
    expect(posted.some((m) => m.type === "done")).toBe(false);
    expect(made[0].count).toBeLessThan(10);
  });
});

describe("the video page, with a fake map", () => {
  it("draws the map once, keeps its picture, and lays every picture of the video over it", async () => {
    const maplibre = fakeMapLibre("idle");
    const { FakeEncoder } = fakeEncoder([VIDEO_CODECS[0]]);
    const { posted, context, make, prepareMap } = page(
      FakeEncoder,
      FakeFrame,
      maplibre,
    );
    await until(posted, "ready");
    prepareMap(NIGHT_SCENE.map);
    await until(posted, "map");
    const answer = posted[posted.length - 1];
    expect(answer).toEqual({
      type: "map",
      ok: true,
      why: null,
      mode: "flat",
      ms: expect.objectContaining({
        map: expect.any(Number),
        snapshot: expect.any(Number),
      }),
    });
    const map = maplibre.made[0];
    expect(map.options).toEqual(
      expect.objectContaining({
        style: NIGHT_SCENE.map?.style,
        pixelRatio: 3,
        interactive: false,
        attributionControl: false,
        canvasContextAttributes: { preserveDrawingBuffer: true },
      }),
    );
    expect(map.padding).toEqual(NIGHT_SCENE.map?.camera.padding);
    expect(map.jumped).toEqual({
      center: NIGHT_SCENE.map?.camera.center,
      zoom: NIGHT_SCENE.map?.camera.zoom,
      bearing: 0,
      pitch: 0,
    });
    expect(map.terrain).toBeNull();
    // Taken as a picture, then let go.
    expect(context.drawImage).toHaveBeenCalledTimes(1);
    expect(map.removed).toBe(true);

    make(NIGHT_SCENE);
    await until(posted, "done", "failed");
    expect(posted[posted.length - 1]).toEqual({
      type: "done",
      frames: 360,
      ms: expect.objectContaining({ encode: expect.any(Number) }),
      mode: "flat",
    });
    // The picture under every one of the 360 but the first, where the map
    // has not come in yet: 359, and the snapshot before them.
    expect(context.drawImage).toHaveBeenCalledTimes(360);
    expect(context.createLinearGradient).toHaveBeenCalled();
  });

  it("draws the map from a timer when the page gets no animation frames, and takes the picture once it is whole", async () => {
    const maplibre = fakeMapLibre("silent");
    const { posted, context, prepareMap } = page(
      fakeEncoder([VIDEO_CODECS[0]]).FakeEncoder,
      FakeFrame,
      maplibre,
    );
    await until(posted, "ready");
    prepareMap(NIGHT_SCENE.map);
    await until(posted, "map");
    expect(posted[posted.length - 1]).toEqual(
      expect.objectContaining({
        type: "map",
        ok: true,
        why: null,
        ms: expect.objectContaining({ pulses: expect.any(Number) }),
      }),
    );
    const map = maplibre.made[0];
    // Drawn on the beats until its tiles were there, kept a few beats more,
    // then drawn once again for the picture.
    expect(map.redraws).toBeGreaterThanOrEqual(5);
    expect(context.drawImage).toHaveBeenCalledTimes(1);
    expect(map.removed).toBe(true);
  });

  it("raises the veil as opaque as the scene asks", async () => {
    const maplibre = fakeMapLibre("idle");
    const { posted, context, make, prepareMap } = page(
      fakeEncoder([VIDEO_CODECS[0]]).FakeEncoder,
      FakeFrame,
      maplibre,
    );
    await until(posted, "ready");
    const day = videoScene(RUN, POST_RESULTS, STICKERS, "day");
    prepareMap(day.map);
    await until(posted, "map");
    make(day);
    await until(posted, "done", "failed");
    expect(posted[posted.length - 1]).toEqual(
      expect.objectContaining({ type: "done" }),
    );
    const gradient = context.createLinearGradient.mock.results[0].value as {
      addColorStop: jest.Mock;
    };
    const stops = gradient.addColorStop.mock.calls;
    expect(stops[0]).toEqual([0, expect.stringMatching(/, 0\)$/)]);
    expect(stops[stops.length - 1]).toEqual([1, expect.stringMatching(/, 0\.94\)$/)]);
  });

  it("gives the map up when a tile fails: a hole is worse than no map", async () => {
    const maplibre = fakeMapLibre("error");
    const { posted, prepareMap } = page(
      fakeEncoder([VIDEO_CODECS[0]]).FakeEncoder,
      FakeFrame,
      maplibre,
    );
    await until(posted, "ready");
    prepareMap(NIGHT_SCENE.map);
    await until(posted, "map");
    expect(posted[posted.length - 1]).toEqual(
      expect.objectContaining({ type: "map", ok: false, why: "tiles" }),
    );
    expect(maplibre.made[0].removed).toBe(true);
  });

  it("gives the map up after its time, saying it waits meanwhile", async () => {
    const maplibre = fakeMapLibre("never");
    const { posted, prepareMap } = page(
      fakeEncoder([VIDEO_CODECS[0]]).FakeEncoder,
      FakeFrame,
      maplibre,
    );
    await until(posted, "ready");
    prepareMap({ ...NIGHT_SCENE.map, waitMs: 40 });
    await until(posted, "map");
    expect(posted[posted.length - 1]).toEqual(
      expect.objectContaining({ type: "map", ok: false, why: "timeout" }),
    );
    expect(maplibre.made[0].removed).toBe(true);
  });

  it("says so at once when MapLibre did not load", async () => {
    const { posted, prepareMap } = page(
      fakeEncoder([VIDEO_CODECS[0]]).FakeEncoder,
      FakeFrame,
      undefined,
    );
    await until(posted, "ready");
    prepareMap(NIGHT_SCENE.map);
    await until(posted, "map");
    expect(posted[posted.length - 1]).toEqual({
      type: "map",
      ok: false,
      why: "no library",
      ms: expect.any(Object),
      mode: null,
    });
  });

  it("says why when the map's description cannot be read, so the video still comes", async () => {
    const { posted, prepareMap } = page(
      fakeEncoder([VIDEO_CODECS[0]]).FakeEncoder,
      FakeFrame,
      fakeMapLibre("idle"),
    );
    await until(posted, "ready");
    prepareMap({ width: 360 });
    await until(posted, "map");
    expect(posted[posted.length - 1]).toEqual({
      type: "map",
      ok: false,
      why: expect.any(String),
      ms: expect.any(Object),
      mode: null,
    });
  });

  it("makes the video on paper, with no map asked, as before", async () => {
    const { posted, context, make } = page(
      fakeEncoder([VIDEO_CODECS[0]]).FakeEncoder,
      FakeFrame,
      fakeMapLibre("idle"),
    );
    await until(posted, "ready");
    make(SCENE);
    await until(posted, "done", "failed");
    expect(posted[posted.length - 1]).toEqual(
      expect.objectContaining({ type: "done", frames: 360 }),
    );
    expect(context.drawImage).not.toHaveBeenCalled();
    expect(context.createLinearGradient).not.toHaveBeenCalled();
  });
});

describe("the video page, with a fake map, in 3D", () => {
  /** Where the fake map lays the scene's line now, in points. */
  function laid(map: { project: (p: [number, number]) => { x: number; y: number } }) {
    const points = RELIEF_SCENE.map?.line.map((p) => map.project(p)) ?? [];
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    return {
      left: Math.min(...xs),
      right: Math.max(...xs),
      top: Math.min(...ys),
      bottom: Math.max(...ys),
    };
  }

  it("raises the hills, fits the leaning line in its box, tries the turn and, cheap, turns the camera for every picture", async () => {
    const maplibre = fakeMapLibre("idle");
    const { posted, context, make, prepareMap } = page(
      fakeEncoder([VIDEO_CODECS[0]]).FakeEncoder,
      FakeFrame,
      maplibre,
    );
    await until(posted, "ready");
    prepareMap(RELIEF_SCENE.map);
    await until(posted, "map");
    expect(posted[posted.length - 1]).toEqual({
      type: "map",
      ok: true,
      why: null,
      mode: "orbit",
      ms: expect.objectContaining({
        frame: expect.any(Number),
        snapshot: expect.any(Number),
      }),
    });
    const map = maplibre.made[0];
    expect(map.options.pitch).toBe(55);
    expect(map.terrain).toEqual(RELIEF_SCENE.map?.terrain);
    // The line fills the drawing's box, less the line's width, as the flat
    // one does: a straight line north as tall as the box.
    const spec = RELIEF_SCENE.map;
    if (spec === null) {
      throw new Error("no map");
    }
    const p = spec.camera.padding;
    const box = laid(map);
    expect(box.left).toBeGreaterThanOrEqual(p.left + spec.pad - 0.5);
    expect(box.right).toBeLessThanOrEqual(360 - p.right - spec.pad + 0.5);
    expect(box.top).toBeCloseTo(p.top + spec.pad, 0);
    expect(box.bottom).toBeCloseTo(640 - p.bottom - spec.pad, 0);
    // Tried from one end of the turn to the other, then back; and kept.
    const bearings = map.jumps.flatMap((j) =>
      typeof j.bearing === "number" ? [j.bearing] : [],
    );
    expect(Math.min(...bearings)).toBeCloseTo(-10, 5);
    expect(Math.max(...bearings)).toBeCloseTo(10, 5);
    expect(map.camera.bearing).toBe(0);
    expect(map.removed).toBe(false);

    const drawnBefore = context.drawImage.mock.calls.length;
    make(RELIEF_SCENE);
    await until(posted, "done", "failed");
    expect(posted[posted.length - 1]).toEqual(
      expect.objectContaining({ type: "done", frames: 360, mode: "orbit" }),
    );
    // Drawn again for every picture but the first, where the map has not
    // come in yet, the camera turning up to the last picture; then let go.
    expect(context.drawImage.mock.calls.length - drawnBefore).toBe(359);
    const last = map.jumps[map.jumps.length - 1];
    expect(last.bearing).toBeCloseTo(10, 1);
    expect(map.removed).toBe(true);
  });

  it("stands still with a slow zoom about the drawing when a picture of the turn costs more than the budget", async () => {
    const maplibre = fakeMapLibre("idle");
    const { posted, context, make, prepareMap } = page(
      fakeEncoder([VIDEO_CODECS[0]]).FakeEncoder,
      FakeFrame,
      maplibre,
    );
    await until(posted, "ready");
    // A budget no picture meets: the fake's cost rounds to 0 ms.
    prepareMap({ ...RELIEF_SCENE.map, budgetMs: -1 });
    await until(posted, "map");
    expect(posted[posted.length - 1]).toEqual(
      expect.objectContaining({ type: "map", ok: true, mode: "still" }),
    );
    // The one picture is enough: let go at once.
    expect(maplibre.made[0].removed).toBe(true);
    make(RELIEF_SCENE);
    await until(posted, "done", "failed");
    expect(posted[posted.length - 1]).toEqual(
      expect.objectContaining({ type: "done", frames: 360, mode: "still" }),
    );
    // Zoomed on every picture but the first ones, where the zoom still
    // rounds to 1 and the map has not come in.
    const zooms = context.scale.mock.calls.map((call) => call[0] as number);
    expect(zooms.length).toBeGreaterThan(300);
    expect(Math.min(...zooms)).toBeGreaterThan(1);
    expect(Math.max(...zooms)).toBeCloseTo(1.06, 2);
    // About the middle of the drawing's box, in pixels.
    expect(context.translate).toHaveBeenCalledWith(540, 864);
  });
});
