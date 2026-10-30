import { MAPLIBRE_JS_SRI, MAPLIBRE_JS_URL } from "../map/mapPage";

/**
 * The page of the hidden WebView that makes a run's video (TASK-295,
 * ADR-0254): it draws each picture of a `VideoScene` on a canvas and
 * encodes it as H.264 with WebCodecs, which every iPhone the app runs on
 * has (iOS 16.4 and later). Nothing native and nothing new in the app: the
 * WebView is the one the map and the engine use.
 *
 * Under the pictures there is the map of the run (TASK-351, ADR-0303): the
 * same MapLibre GL JS as the map page, pinned, draws it once, at the size
 * of a phone's screen times three, and the page keeps its picture. Asked
 * before the scene with `window.muwVideo.prepareMap(map)`, it answers
 * `map` with whether the picture is there; without it the app sends the
 * scene on the yellow of the post, so the video always comes out.
 *
 * The app talks to it with `window.muwVideo.make(scene)`
 * (injectJavaScript); it answers with `ReactNativeWebView.postMessage`, one
 * JSON message each (`VideoPageMessage`). The pictures leave it encoded, in
 * base64, and the app puts them in an MP4 file (mp4.ts).
 */

/** The times a step took, in milliseconds, for the measures of TASK-351. */
export type PageTimes = Record<string, number>;

/** What the page says to the app. */
export type VideoPageMessage =
  /** Loaded; `codec` is null when this WebView cannot encode the video. */
  | { type: "ready"; codec: string | null }
  /** Still waiting for the map's tiles: a word, so the app does not give up. */
  | { type: "waiting"; ms: number }
  /** The map's picture is there (`ok`), or not and why. */
  | { type: "map"; ok: boolean; why: string | null; ms: PageTimes }
  /** How to decode the pictures: the avcC record, in base64. */
  | { type: "config"; avcC: string }
  /** Encoded pictures, in order: `time` in microseconds, `data` in base64. */
  | { type: "chunks"; list: { key: boolean; time: number; data: string }[] }
  /** Pictures given to the encoder so far. */
  | { type: "progress"; frames: number }
  | { type: "done"; frames: number; ms: PageTimes }
  | { type: "failed"; error: string };

/**
 * H.264 Baseline only, at level 4 and up (1080 × 1920 needs it): Baseline
 * has no B-frames, so each picture shows in the order it is decoded and the
 * file needs no composition times. Main and High would allow them.
 */
export const VIDEO_CODECS = ["avc1.42e028", "avc1.42e02a", "avc1.420028"] as const;

/** Bits a second: a video of flat yellow and black lines needs far fewer. */
const BITRATE = 6_000_000;
/** Pictures waiting in the encoder before the page waits for it. */
const QUEUE = 3;
/** Encoded pictures in one message to the app. */
const BATCH = 10;
/** While the map's tiles come, a word to the app this often. */
const WAITING_EVERY_MS = 4000;
/** The dark under the words: as opaque as this at the bottom edge, along a
 * smoothstep from clear at the top (tools/ui_scrim.py). */
const SCRIM_PEAK = 0.82;

/** The app's own font on each phone, then any. */
const FONT = '-apple-system, system-ui, Roboto, "Helvetica Neue", sans-serif';

// Plain ES2017 inside a template string: it runs in the WebView, not in
// Hermes, and is never transformed.
const SCRIPT = String.raw`
(function () {
  "use strict";
  var CODECS = ${JSON.stringify(VIDEO_CODECS)};
  var BITRATE = ${BITRATE};
  var QUEUE = ${QUEUE};
  var BATCH = ${BATCH};
  var WAITING_EVERY_MS = ${WAITING_EVERY_MS};
  var SCRIM_PEAK = ${SCRIM_PEAK};
  var FONT = ${JSON.stringify(FONT)};
  var codec = null;
  var started = false;
  // The map's picture, once prepared, and how long its steps took.
  var background = null;
  var mapTimes = {};
  var preparing = false;

  function post(message) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }

  function messageOf(error) {
    return String((error && error.message) || error);
  }

  function now() {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function bytesOf(source) {
    return source instanceof ArrayBuffer
      ? new Uint8Array(source)
      : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  }

  function base64(bytes) {
    var text = "";
    for (var i = 0; i < bytes.length; i += 0x8000) {
      text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(text);
  }

  function configOf(scene, name) {
    return {
      codec: name,
      width: scene.width,
      height: scene.height,
      bitrate: BITRATE,
      framerate: scene.fps,
      latencyMode: "realtime",
      avc: { format: "avc" }
    };
  }

  // The first codec this WebView encodes at the video's size.
  async function findCodec() {
    if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") {
      return null;
    }
    for (var i = 0; i < CODECS.length; i += 1) {
      try {
        var support = await VideoEncoder.isConfigSupported(
          configOf({ width: 1080, height: 1920, fps: 30 }, CODECS[i])
        );
        if (support.supported) {
          return CODECS[i];
        }
      } catch (error) {
        // Not this one.
      }
    }
    return null;
  }

  // The map drawn once, at the camera the scene asks, and kept as a picture
  // (TASK-351). Every tile in view, or none: a hole is worse than no map.
  function prepareMap(spec) {
    if (preparing || background !== null) {
      return;
    }
    preparing = true;
    var t0 = now();
    var settled = false;
    var errors = 0;
    var timer = null;
    var beat = null;
    var box = null;
    var map = null;
    function finish(ok, why) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      clearInterval(beat);
      mapTimes.map = Math.round(now() - t0);
      if (ok) {
        var t = now();
        var picture = document.createElement("canvas");
        picture.width = spec.width * spec.pixelRatio;
        picture.height = spec.height * spec.pixelRatio;
        picture.getContext("2d").drawImage(map.getCanvas(), 0, 0, picture.width, picture.height);
        background = picture;
        mapTimes.snapshot = Math.round(now() - t);
      }
      try {
        if (map !== null) {
          map.remove();
        }
        if (box !== null && box.parentNode) {
          box.parentNode.removeChild(box);
        }
      } catch (error) {
        // Gone already.
      }
      post({ type: "map", ok: ok, why: why || null, ms: mapTimes });
    }
    if (typeof maplibregl === "undefined") {
      finish(false, "no library");
      return;
    }
    try {
      box = document.createElement("div");
      box.style.width = spec.width + "px";
      box.style.height = spec.height + "px";
      document.body.appendChild(box);
      map = new maplibregl.Map({
        container: box,
        style: spec.style,
        center: spec.camera.center,
        zoom: spec.camera.zoom,
        bearing: spec.camera.bearing,
        pitch: spec.camera.pitch,
        interactive: false,
        attributionControl: false,
        fadeDuration: 0,
        pixelRatio: spec.pixelRatio,
        // Without it the canvas is empty by the time it is read.
        canvasContextAttributes: { preserveDrawingBuffer: true }
      });
      map.setPadding(spec.camera.padding);
      map.jumpTo({ center: spec.camera.center, zoom: spec.camera.zoom, bearing: spec.camera.bearing });
    } catch (error) {
      finish(false, messageOf(error));
      return;
    }
    map.on("error", function () {
      errors += 1;
    });
    // Every tile in view is drawn, or has failed.
    map.once("idle", function () {
      finish(errors === 0, errors === 0 ? null : "tiles");
    });
    timer = setTimeout(function () { finish(false, "timeout"); }, spec.waitMs);
    beat = setInterval(function () { post({ type: "waiting", ms: Math.round(now() - t0) }); }, WAITING_EVERY_MS);
  }

  // The path from its start to upTo pixels along it.
  function stroke(g, path, upTo) {
    g.beginPath();
    g.moveTo(path[0], path[1]);
    var walked = 0;
    for (var i = 2; i < path.length; i += 2) {
      var dx = path[i] - path[i - 2];
      var dy = path[i + 1] - path[i - 1];
      var step = Math.hypot(dx, dy);
      if (walked + step >= upTo) {
        var share = step > 0 ? (upTo - walked) / step : 0;
        g.lineTo(path[i - 2] + dx * share, path[i - 1] + dy * share);
        break;
      }
      g.lineTo(path[i], path[i + 1]);
      walked += step;
    }
    g.stroke();
  }

  // A square with round corners, as a path.
  function roundRect(g, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + radius, y);
    g.lineTo(x + w - radius, y);
    g.arc(x + w - radius, y + radius, radius, -Math.PI / 2, 0);
    g.lineTo(x + w, y + h - radius);
    g.arc(x + w - radius, y + h - radius, radius, 0, Math.PI / 2);
    g.lineTo(x + radius, y + h);
    g.arc(x + radius, y + h - radius, radius, Math.PI / 2, Math.PI);
    g.lineTo(x, y + radius);
    g.arc(x + radius, y + radius, radius, Math.PI, 1.5 * Math.PI);
    g.closePath();
  }

  // A colour as "r, g, b" for an rgba() string.
  function rgbOf(hex) {
    var n = parseInt(hex.slice(1, 7), 16);
    return ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255);
  }

  // Letters spaced by the canvas when it can, else one at a time.
  var spaced = typeof CanvasRenderingContext2D !== "undefined" &&
    "letterSpacing" in CanvasRenderingContext2D.prototype;

  function widthOf(g, text, tracking) {
    var width = g.measureText(text).width;
    return spaced || tracking === 0 ? width : width + tracking * Math.max(0, text.length - 1);
  }

  function write(g, text, x, y, align, tracking) {
    if (spaced || tracking === 0) {
      g.textAlign = align;
      g.fillText(text, x, y);
      return;
    }
    var width = widthOf(g, text, tracking);
    var at = align === "center" ? x - width / 2 : x;
    g.textAlign = "left";
    for (var i = 0; i < text.length; i += 1) {
      g.fillText(text[i], at, y);
      at += g.measureText(text[i]).width + tracking;
    }
  }

  // The words in at most "lines" lines of "width", the last cut with «…».
  function wrap(g, words, width, lines, tracking) {
    var out = [];
    var rest = words.split(" ");
    while (rest.length > 0 && out.length < lines) {
      var line = rest.shift();
      while (rest.length > 0 && widthOf(g, line + " " + rest[0], tracking) <= width) {
        line += " " + rest.shift();
      }
      out.push(line);
    }
    if (rest.length > 0) {
      out[out.length - 1] += " " + rest.join(" ");
    }
    var last = out[out.length - 1];
    if (widthOf(g, last, tracking) > width) {
      while (last.length > 1 && widthOf(g, last + "…", tracking) > width) {
        last = last.slice(0, -1);
      }
      out[out.length - 1] = last.trimEnd() + "…";
    }
    return out;
  }

  function colorOf(scene, role) {
    return scene.colors[role] || scene.colors.ink;
  }

  function draw(g, scene, ops) {
    g.globalAlpha = 1;
    g.fillStyle = scene.colors.paper;
    g.fillRect(0, 0, scene.width, scene.height);
    g.lineCap = "round";
    g.lineJoin = "round";
    if (spaced) {
      g.letterSpacing = "0px";
    }
    for (var i = 0; i < ops.length; i += 1) {
      var op = ops[i];
      if (op.alpha <= 0) {
        continue;
      }
      g.globalAlpha = Math.min(1, op.alpha);
      if (op.k === "map") {
        if (background !== null) {
          g.drawImage(background, 0, 0, scene.width, scene.height);
        }
      } else if (op.k === "scrim") {
        var shade = g.createLinearGradient(0, op.top, 0, scene.height);
        var rgb = rgbOf(scene.colors.scrim);
        for (var s = 0; s <= 8; s += 1) {
          var t = s / 8;
          shade.addColorStop(t, "rgba(" + rgb + ", " + SCRIM_PEAK * t * t * (3 - 2 * t) + ")");
        }
        g.fillStyle = shade;
        g.fillRect(0, op.top, scene.width, scene.height - op.top);
      } else if (op.k === "rect") {
        roundRect(g, op.x, op.y, op.w, op.h, op.r);
        g.fillStyle = colorOf(scene, op.color);
        g.fill();
      } else if (op.k === "line") {
        var path = scene.paths[op.path];
        if (path && path.length >= 4) {
          g.strokeStyle = colorOf(scene, op.color);
          g.lineWidth = op.width;
          stroke(g, path, op.upTo);
        }
      } else if (op.k === "dot") {
        g.beginPath();
        g.arc(op.x, op.y, op.r, 0, 2 * Math.PI);
        g.fillStyle = colorOf(scene, op.fill);
        g.fill();
        if (op.ring > 0) {
          // Inside the dot, as a border in the app.
          g.beginPath();
          g.arc(op.x, op.y, Math.max(0, op.r - op.ring / 2), 0, 2 * Math.PI);
          g.strokeStyle = colorOf(scene, op.ringColor);
          g.lineWidth = op.ring;
          g.stroke();
        }
      } else if (op.k === "text") {
        g.font = op.weight + " " + op.size + "px " + FONT;
        g.fillStyle = colorOf(scene, op.color);
        g.textBaseline = "middle";
        if (spaced) {
          g.letterSpacing = op.tracking + "px";
        }
        var lines = wrap(g, op.text, op.maxWidth, op.lines, op.tracking);
        for (var j = 0; j < lines.length; j += 1) {
          write(g, lines[j], op.x, op.y + op.size * 1.2 * (j + 0.5), op.align, op.tracking);
        }
        if (spaced) {
          g.letterSpacing = "0px";
        }
      } else if (op.k === "emoji") {
        g.font = op.size * op.scale + "px " + FONT;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(op.text, op.x, op.y);
      }
    }
  }

  async function make(scene) {
    var t0 = now();
    var canvas = document.createElement("canvas");
    canvas.width = scene.width;
    canvas.height = scene.height;
    var g = canvas.getContext("2d");
    var pending = [];
    var failure = null;
    var configured = false;
    function send() {
      if (pending.length > 0) {
        post({ type: "chunks", list: pending });
        pending = [];
      }
    }
    var encoder = new VideoEncoder({
      output: function (chunk, meta) {
        var config = meta && meta.decoderConfig;
        if (!configured && config && config.description) {
          configured = true;
          post({ type: "config", avcC: base64(bytesOf(config.description)) });
        }
        var bytes = new Uint8Array(chunk.byteLength);
        chunk.copyTo(bytes);
        pending.push({ key: chunk.type === "key", time: chunk.timestamp, data: base64(bytes) });
        if (pending.length >= BATCH) {
          send();
        }
      },
      error: function (error) {
        failure = messageOf(error);
      }
    });
    encoder.configure(configOf(scene, codec));
    var step = 1e6 / scene.fps;
    for (var i = 0; i < scene.frames.length; i += 1) {
      if (failure !== null) {
        throw new Error(failure);
      }
      draw(g, scene, scene.frames[i]);
      var frame = new VideoFrame(canvas, {
        timestamp: Math.round(i * step),
        duration: Math.round(step)
      });
      // A picture to start from every two seconds.
      encoder.encode(frame, { keyFrame: i % (scene.fps * 2) === 0 });
      frame.close();
      while (encoder.encodeQueueSize > QUEUE && failure === null) {
        await wait(4);
      }
      if (i % 15 === 0) {
        post({ type: "progress", frames: i });
      }
    }
    await encoder.flush();
    if (failure !== null) {
      throw new Error(failure);
    }
    encoder.close();
    if (!configured) {
      throw new Error("the encoder gave no avcC");
    }
    send();
    mapTimes.encode = Math.round(now() - t0);
    post({ type: "done", frames: scene.frames.length, ms: mapTimes });
  }

  window.muwVideo = {
    prepareMap: prepareMap,
    make: function (scene) {
      if (started) {
        return;
      }
      started = true;
      make(scene).catch(function (error) {
        post({ type: "failed", error: messageOf(error) });
      });
    }
  };

  findCodec().then(
    function (found) {
      codec = found;
      post({ type: "ready", codec: found });
    },
    function () {
      post({ type: "ready", codec: null });
    }
  );
})();
`;

/**
 * The whole page: MapLibre GL JS from the same pinned address as the map
 * page, for the map under the video, then the script. Nothing else from the
 * network: the tiles come through the map, and only once the app asks.
 */
export const VIDEO_PAGE = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body>
<script src="${MAPLIBRE_JS_URL}" integrity="${MAPLIBRE_JS_SRI}" crossorigin="anonymous"></script>
<script>${SCRIPT}</script>
</body>
</html>
`;

/** Where the page says it is: an https address, so WebCodecs, which only
 * secure pages have, is there. It never loads anything from it. */
export const VIDEO_PAGE_BASE = "https://video.muw.invalid/";

/** What the app asks the page to do: make the video of `sceneJson`. */
export function makeCall(sceneJson: string): string {
  return `window.muwVideo.make(${sceneJson}); true;`;
}

/** What the app asks first, on the map looks: draw the map of `mapJson`. */
export function prepareMapCall(mapJson: string): string {
  return `window.muwVideo.prepareMap(${mapJson}); true;`;
}
