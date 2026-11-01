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

/** The script of the page, as the WebView runs it. */
function script(): string {
  const match = /<script>([\s\S]*)<\/script>/.exec(VIDEO_PAGE);
  if (match === null) {
    throw new Error("no script");
  }
  return match[1];
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

/** What a fake map does once made: settles at once, fails a tile first, or never. */
type MapOutcome = "idle" | "error" | "never";

type Handler = () => void;

/** A stand-in for MapLibre's map: made, it says `idle` (or an error first),
 * and remembers the camera it was given. */
function fakeMapLibre(outcome: MapOutcome) {
  const made: FakeMap[] = [];
  class FakeMap {
    handlers: Record<string, Handler[]> = {};
    padding: unknown = null;
    jumped: unknown = null;
    removed = false;

    constructor(public options: Record<string, unknown>) {
      made.push(this);
      if (outcome !== "never") {
        setTimeout(() => {
          if (outcome === "error") {
            this.emit("error");
          }
          this.emit("idle");
        }, 10);
      }
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

    setPadding(padding: unknown) {
      this.padding = padding;
    }

    jumpTo(camera: unknown) {
      this.jumped = camera;
    }

    getCanvas() {
      return { width: 1080, height: 1920 };
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

/** Until the page says `type`, or a second goes by. */
async function until(posted: VideoPageMessage[], ...types: string[]) {
  for (let i = 0; i < 200 && !posted.some((m) => types.includes(m.type)); i += 1) {
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

describe("the video page", () => {
  it("is plain JavaScript the WebView can run", () => {
    // Compiled, not run: a mistake in the template string fails here.
    expect(() => new Function(script())).not.toThrow();
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
    });
    // Taken as a picture, then let go.
    expect(context.drawImage).toHaveBeenCalledTimes(1);
    expect(map.removed).toBe(true);

    make(NIGHT_SCENE);
    await until(posted, "done", "failed");
    expect(posted[posted.length - 1]).toEqual({
      type: "done",
      frames: 360,
      ms: expect.objectContaining({ encode: expect.any(Number) }),
    });
    // The picture under every one of the 360 but the first, where the map
    // has not come in yet: 359, and the snapshot before them.
    expect(context.drawImage).toHaveBeenCalledTimes(360);
    expect(context.createLinearGradient).toHaveBeenCalled();
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
