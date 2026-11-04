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
 * On «3D» (part D) the map leans on its hills: the page zooms it so the
 * line fills the drawing's box as the flat one does, takes the picture,
 * then tries the camera's turn on a dry run and measures what a picture
 * costs. Under the budget it keeps the map alive and draws it again for
 * every picture, the camera turning, the line laid on the hills each time
 * (mode `orbit`); over it, or when the time runs out, the one picture is
 * zoomed slowly instead (mode `still`). The video comes out either way.
 *
 * The app talks to it with `window.muwVideo.make(scene)`
 * (injectJavaScript); it answers with `ReactNativeWebView.postMessage`, one
 * JSON message each (`VideoPageMessage`). The pictures leave it encoded, in
 * base64, and the app puts them in an MP4 file (mp4.ts).
 */

/** The times a step took, in milliseconds, for the measures of TASK-351. */
export type PageTimes = Record<string, number>;

/** How the page draws the map under the pictures: the one picture of a
 * flat map; the one picture of the leaning map, zoomed slowly; or the
 * leaning map drawn again for every picture, the camera turning. */
export type MapMode = "flat" | "still" | "orbit";

/** What the page says to the app. */
export type VideoPageMessage =
  /** Loaded; `codec` is null when this WebView cannot encode the video. */
  | { type: "ready"; codec: string | null }
  /** Still waiting for the map's tiles: a word, so the app does not give up. */
  | { type: "waiting"; ms: number }
  /** The map's picture is there (`ok`), or not and why; `mode` how the
   * map will be drawn, when it is there. */
  | {
      type: "map";
      ok: boolean;
      why: string | null;
      ms: PageTimes;
      mode?: MapMode | null;
    }
  /** How to decode the pictures: the avcC record, in base64. */
  | { type: "config"; avcC: string }
  /** Encoded pictures, in order: `time` in microseconds, `data` in base64. */
  | { type: "chunks"; list: { key: boolean; time: number; data: string }[] }
  /** Pictures given to the encoder so far. */
  | { type: "progress"; frames: number }
  /** All the pictures given; `mode` how the map was drawn under them. */
  | { type: "done"; frames: number; ms: PageTimes; mode?: MapMode }
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
/** The map is drawn from a timer this often while its tiles come, and the
 * picture is taken once it has been whole for this many beats: the WebView
 * is kept out of sight, and iOS may then stop the page's animation frames,
 * which MapLibre draws on (TASK-351, the fix of 2026-11-03). */
const PULSE_MS = 100;
const PULSES_STILL = 3;
/** The dark under the words: as opaque as this at the bottom edge, along a
 * smoothstep from clear at the top (tools/ui_scrim.py), unless the scene's
 * op says how opaque (the light veil of «Day», TASK-351 part C). */
const SCRIM_PEAK = 0.82;
/** On «3D», the bearings the dry run draws the map at, from one end of the
 * turn to the other: once for the tiles of every bearing to come, once to
 * measure what a picture costs. */
const DRY_RUN_STEPS = 12;
/** The dry run's passes, and how long it waits for the tiles between them. */
const DRY_RUN_PASSES = 2;
const DRY_RUN_TILES_MS = 2000;

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
  var PULSE_MS = ${PULSE_MS};
  var PULSES_STILL = ${PULSES_STILL};
  var SCRIM_PEAK = ${SCRIM_PEAK};
  var DRY_RUN_STEPS = ${DRY_RUN_STEPS};
  var DRY_RUN_PASSES = ${DRY_RUN_PASSES};
  var DRY_RUN_TILES_MS = ${DRY_RUN_TILES_MS};
  var FONT = ${JSON.stringify(FONT)};
  var codec = null;
  var started = false;
  // The map's picture, once prepared, and how long its steps took.
  var background = null;
  var mapTimes = {};
  var preparing = false;
  // How the map is drawn under the pictures: "flat", "still" or "orbit".
  var mode = "flat";
  // On "orbit", the map kept alive for the video, with its box and what it
  // was prepared from; on «3D», the run's line as the map lays it on the
  // hills at rest, in pixels of the video, and the middle of the drawing's
  // box, in pixels, that the still picture is zoomed about.
  var live = null;
  var lineAtRest = null;
  var boxMiddle = null;

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

  // How long a path (x0, y0, x1, y1, …) is, in pixels.
  function lengthOf(path) {
    var length = 0;
    for (var i = 2; i < path.length; i += 2) {
      length += Math.hypot(path[i] - path[i - 2], path[i + 1] - path[i - 1]);
    }
    return length;
  }

  // The point upTo pixels along the path; its end past its length.
  function pointAlong(path, upTo) {
    var walked = 0;
    for (var i = 2; i < path.length; i += 2) {
      var step = Math.hypot(path[i] - path[i - 2], path[i + 1] - path[i - 1]);
      if (walked + step >= upTo && step > 0) {
        var share = (upTo - walked) / step;
        return [
          path[i - 2] + (path[i] - path[i - 2]) * share,
          path[i - 1] + (path[i + 1] - path[i - 1]) * share
        ];
      }
      walked += step;
    }
    return [path[path.length - 2], path[path.length - 1]];
  }

  // The run's line as the map lays it now, in pixels of the video.
  function projectLine(map, spec) {
    var out = [];
    for (var i = 0; i < spec.line.length; i += 1) {
      var at = map.project(spec.line[i]);
      out.push(at.x * spec.pixelRatio, at.y * spec.pixelRatio);
    }
    return out;
  }

  // The line zoomed about the box's middle, as the still picture is.
  function zoomedLine(path, zoom, middle) {
    var out = [];
    for (var i = 0; i < path.length; i += 2) {
      out.push(
        middle[0] + (path[i] - middle[0]) * zoom,
        middle[1] + (path[i + 1] - middle[1]) * zoom
      );
    }
    return out;
  }

  // The leaning map zoomed and moved so the line fills the drawing's box
  // as the flat one does: the box less the line's width, in points. Two
  // passes, as the perspective changes with the zoom.
  function fitLeaning(map, spec) {
    if (!spec.line || spec.line.length < 2) {
      return;
    }
    var p = spec.camera.padding;
    var innerWidth = spec.width - p.left - p.right - 2 * spec.pad;
    var innerHeight = spec.height - p.top - p.bottom - 2 * spec.pad;
    for (var pass = 0; pass < 2; pass += 1) {
      var minX = Infinity;
      var minY = Infinity;
      var maxX = -Infinity;
      var maxY = -Infinity;
      for (var i = 0; i < spec.line.length; i += 1) {
        var at = map.project(spec.line[i]);
        minX = Math.min(minX, at.x);
        maxX = Math.max(maxX, at.x);
        minY = Math.min(minY, at.y);
        maxY = Math.max(maxY, at.y);
      }
      var factor = Math.min(
        innerWidth / Math.max(maxX - minX, 1e-6),
        innerHeight / Math.max(maxY - minY, 1e-6)
      );
      var middle = map.unproject([(minX + maxX) / 2, (minY + maxY) / 2]);
      map.jumpTo({
        center: [middle.lng, middle.lat],
        zoom: map.getZoom() + Math.log2(factor)
      });
    }
  }

  // The map drawn once, at the camera the scene asks, and kept as a picture
  // (TASK-351). Every tile in view, or none: a hole is worse than no map.
  // On «3D», then the fit, the dry run of the turn, and the mode.
  function prepareMap(spec) {
    try {
      prepare(spec);
    } catch (error) {
      // Thrown before the map's timers were set, on a description the page
      // cannot read: the video goes on without the map, as without the
      // library.
      post({ type: "map", ok: false, why: messageOf(error), ms: mapTimes, mode: null });
    }
  }

  function prepare(spec) {
    if (preparing || background !== null) {
      return;
    }
    preparing = true;
    var t0 = now();
    var relief = !!spec.terrain;
    var settled = false;
    var errors = 0;
    var timer = null;
    var beat = null;
    var pulse = null;
    var pulses = 0;
    var still = 0;
    var busy = false;
    var terrainOn = false;
    // tiles → (fit →) shot → (dry →) done
    var phase = "tiles";
    var box = null;
    var map = null;
    mode = relief ? "still" : "flat";
    var pad = spec.camera.padding;
    boxMiddle = [
      ((pad.left + spec.width - pad.right) / 2) * spec.pixelRatio,
      ((pad.top + spec.height - pad.bottom) / 2) * spec.pixelRatio
    ];
    function release() {
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
      map = null;
      box = null;
    }
    function takePicture() {
      var t = now();
      // Drawn once more right now, so the picture is of the whole map
      // whatever the page's frames did.
      try {
        map.redraw();
      } catch (error) {
        // The picture is taken as it is.
      }
      var picture = document.createElement("canvas");
      picture.width = spec.width * spec.pixelRatio;
      picture.height = spec.height * spec.pixelRatio;
      picture.getContext("2d").drawImage(map.getCanvas(), 0, 0, picture.width, picture.height);
      background = picture;
      mapTimes.snapshot = Math.round(now() - t);
      if (relief) {
        lineAtRest = projectLine(map, spec);
      }
    }
    function finish(ok, why) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      clearInterval(beat);
      clearInterval(pulse);
      mapTimes.map = Math.round(now() - t0);
      mapTimes.pulses = pulses;
      try {
        var loads = performance.getEntriesByType("resource").filter(function (entry) {
          return entry.name.indexOf("maplibre") >= 0;
        });
        if (loads.length > 0) {
          mapTimes.lib = Math.round(loads[0].duration);
        }
      } catch (error) {
        // No timing of the library: nothing lost.
      }
      if (ok && background === null) {
        try {
          takePicture();
        } catch (error) {
          ok = false;
          why = messageOf(error);
        }
      }
      if (ok && mode === "orbit") {
        live = { map: map, box: box, spec: spec };
      } else {
        release();
      }
      post({ type: "map", ok: ok, why: why || null, ms: mapTimes, mode: ok ? mode : null });
    }
    // The camera's turn tried before the video: a pass for the tiles of
    // every bearing to come, then a pass to measure what a picture costs
    // (the map drawn and copied, the line laid on the hills), as the median.
    function dryRun() {
      return new Promise(function (resolve, reject) {
        var scratch = document.createElement("canvas");
        scratch.width = spec.width * spec.pixelRatio;
        scratch.height = spec.height * spec.pixelRatio;
        var g = scratch.getContext("2d");
        var costs = [];
        var pass = 0;
        var k = 0;
        var waited = 0;
        function step() {
          if (settled) {
            resolve(Infinity);
            return;
          }
          if (k >= DRY_RUN_STEPS) {
            k = 0;
            pass += 1;
            if (pass >= DRY_RUN_PASSES) {
              map.jumpTo({ bearing: spec.camera.bearing });
              costs.sort(function (a, b) { return a - b; });
              resolve(Math.round(costs[Math.floor(costs.length / 2)] * 10) / 10);
              return;
            }
            // The tiles of every bearing, before the measure.
            waited = 0;
            setTimeout(tiles, PULSE_MS);
            return;
          }
          var share = DRY_RUN_STEPS > 1 ? k / (DRY_RUN_STEPS - 1) : 0;
          var bearing = spec.camera.bearing + spec.turn.from + (spec.turn.to - spec.turn.from) * share;
          var t = now();
          try {
            map.jumpTo({ bearing: bearing });
            map.redraw();
            g.drawImage(map.getCanvas(), 0, 0, scratch.width, scratch.height);
            projectLine(map, spec);
          } catch (error) {
            reject(error);
            return;
          }
          if (pass === DRY_RUN_PASSES - 1) {
            costs.push(now() - t);
          }
          k += 1;
          setTimeout(step, 0);
        }
        function tiles() {
          if (settled) {
            resolve(Infinity);
            return;
          }
          waited += PULSE_MS;
          try {
            map.redraw();
          } catch (error) {
            reject(error);
            return;
          }
          if ((map.loaded() && map.areTilesLoaded()) || waited >= DRY_RUN_TILES_MS) {
            step();
          } else {
            setTimeout(tiles, PULSE_MS);
          }
        }
        step();
      });
    }
    // Every tile in view is there: the next step of the phase. A step
    // draws the map itself, and the map says idle again while it does,
    // from inside redraw: busy keeps that from starting the step again.
    function whole() {
      if (settled || busy) {
        return;
      }
      if (errors > 0) {
        finish(false, "tiles");
        return;
      }
      busy = true;
      try {
        if (phase === "tiles" && relief) {
          // Drawn again at the fitted camera, and whole once more.
          phase = "fit";
          still = 0;
          fitLeaning(map, spec);
          return;
        }
        phase = "shot";
        takePicture();
        if (relief && spec.turn) {
          // Busy until the dry run is over.
          phase = "dry";
          dryRun().then(
            function (frameMs) {
              if (settled) {
                return;
              }
              busy = false;
              mapTimes.frame = frameMs;
              mode = frameMs <= spec.budgetMs ? "orbit" : "still";
              finish(true, null);
            },
            function () {
              // The one picture, zoomed slowly, then.
              busy = false;
              finish(true, null);
            }
          );
          return;
        }
        finish(true, null);
      } catch (error) {
        finish(false, messageOf(error));
      } finally {
        if (phase !== "dry") {
          busy = false;
        }
      }
    }
    function raise() {
      if (relief && !terrainOn) {
        terrainOn = true;
        try {
          map.setTerrain(spec.terrain);
        } catch (error) {
          finish(false, messageOf(error));
        }
      }
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
      map.jumpTo({
        center: spec.camera.center,
        zoom: spec.camera.zoom,
        bearing: spec.camera.bearing,
        pitch: spec.camera.pitch
      });
    } catch (error) {
      finish(false, messageOf(error));
      return;
    }
    map.on("error", function () {
      errors += 1;
    });
    // The hills once the style is there, then every tile in view.
    map.on("load", raise);
    map.on("idle", whole);
    timer = setTimeout(function () {
      if (background !== null) {
        mode = "still";
        finish(true, null);
      } else {
        finish(false, "timeout");
      }
    }, spec.waitMs);
    beat = setInterval(function () { post({ type: "waiting", ms: Math.round(now() - t0) }); }, WAITING_EVERY_MS);
    // The map drawn from a timer as well, and the picture taken once every
    // tile in view has been there for a few beats: with no animation frames
    // MapLibre would neither ask for its tiles nor say idle.
    pulse = setInterval(function () {
      if (settled || busy) {
        return;
      }
      pulses += 1;
      try {
        map.redraw();
      } catch (error) {
        finish(false, messageOf(error));
        return;
      }
      if (settled) {
        // Whole on that drawing, and done.
        return;
      }
      if (!terrainOn && typeof map.isStyleLoaded === "function" && map.isStyleLoaded()) {
        raise();
      }
      if (map.loaded() && map.areTilesLoaded()) {
        still += 1;
        if (still >= PULSES_STILL) {
          still = 0;
          whole();
        }
      } else {
        still = 0;
      }
    }, PULSE_MS);
  }

  // The map let go after the video, when it was kept for the turn.
  function releaseLive() {
    if (live === null) {
      return;
    }
    try {
      live.map.remove();
      if (live.box.parentNode) {
        live.box.parentNode.removeChild(live.box);
      }
    } catch (error) {
      // Gone already.
    }
    live = null;
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
    // The run's line as the map lays it for this picture, on «3D».
    var laid = lineAtRest;
    for (var i = 0; i < ops.length; i += 1) {
      var op = ops[i];
      if (op.alpha <= 0) {
        continue;
      }
      g.globalAlpha = Math.min(1, op.alpha);
      if (op.k === "map") {
        if (live !== null && mode === "orbit") {
          live.map.jumpTo({ bearing: live.spec.camera.bearing + (op.turn || 0) });
          live.map.redraw();
          g.drawImage(live.map.getCanvas(), 0, 0, scene.width, scene.height);
          laid = projectLine(live.map, live.spec);
        } else if (background !== null) {
          var zoom = typeof op.zoom === "number" ? op.zoom : 1;
          if (zoom !== 1 && boxMiddle !== null) {
            g.save();
            g.translate(boxMiddle[0], boxMiddle[1]);
            g.scale(zoom, zoom);
            g.translate(-boxMiddle[0], -boxMiddle[1]);
            g.drawImage(background, 0, 0, scene.width, scene.height);
            g.restore();
            if (laid !== null) {
              laid = zoomedLine(laid, zoom, boxMiddle);
            }
          } else {
            g.drawImage(background, 0, 0, scene.width, scene.height);
          }
        }
      } else if (op.k === "scrim") {
        var shade = g.createLinearGradient(0, op.top, 0, scene.height);
        var rgb = rgbOf(scene.colors.scrim);
        var peak = typeof op.peak === "number" ? op.peak : SCRIM_PEAK;
        for (var s = 0; s <= 8; s += 1) {
          var t = s / 8;
          shade.addColorStop(t, "rgba(" + rgb + ", " + peak * t * t * (3 - 2 * t) + ")");
        }
        g.fillStyle = shade;
        g.fillRect(0, op.top, scene.width, scene.height - op.top);
      } else if (op.k === "rect") {
        roundRect(g, op.x, op.y, op.w, op.h, op.r);
        g.fillStyle = colorOf(scene, op.color);
        g.fill();
      } else if (op.k === "line") {
        var onHills = typeof op.share === "number" && laid !== null;
        var path = onHills ? laid : scene.paths[op.path];
        if (path && path.length >= 4) {
          g.strokeStyle = colorOf(scene, op.color);
          g.lineWidth = op.width;
          stroke(g, path, onHills ? op.share * lengthOf(path) : op.upTo);
        }
      } else if (op.k === "dot") {
        var x = op.x;
        var y = op.y;
        if (typeof op.share === "number" && laid !== null && laid.length >= 4) {
          var at = pointAlong(laid, op.share * lengthOf(laid));
          x = at[0];
          y = at[1];
        }
        g.beginPath();
        g.arc(x, y, op.r, 0, 2 * Math.PI);
        g.fillStyle = colorOf(scene, op.fill);
        g.fill();
        if (op.ring > 0) {
          // Inside the dot, as a border in the app.
          g.beginPath();
          g.arc(x, y, Math.max(0, op.r - op.ring / 2), 0, 2 * Math.PI);
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
    post({ type: "done", frames: scene.frames.length, ms: mapTimes, mode: mode });
  }

  window.muwVideo = {
    prepareMap: prepareMap,
    make: function (scene) {
      if (started) {
        return;
      }
      started = true;
      make(scene).then(releaseLive, function (error) {
        releaseLive();
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

/** A frame of animation from a timer, every this many milliseconds. */
const FRAME_MS = 16;

/**
 * Animation frames from a timer, put in place before MapLibre loads
 * (TASK-351, the fix of 2026-11-03): iOS gives a page it keeps out of
 * sight no animation frames, and MapLibre loads its style and draws on
 * them, so the map never came and the video fell back on the yellow. The
 * page's timers run wherever it is, as the pictures' encoding has shown
 * since TASK-295. Nothing here needs a smooth frame: a timer is enough.
 */
const FRAMES = String.raw`
(function () {
  "use strict";
  var FRAME_MS = ${FRAME_MS};
  var next = 0;
  var timers = {};
  window.requestAnimationFrame = function (callback) {
    next += 1;
    var id = next;
    timers[id] = setTimeout(function () {
      delete timers[id];
      callback(performance.now());
    }, FRAME_MS);
    return id;
  };
  window.cancelAnimationFrame = function (id) {
    clearTimeout(timers[id]);
    delete timers[id];
  };
})();
`;

/**
 * The whole page: the frames from a timer, MapLibre GL JS from the same
 * pinned address as the map page, for the map under the video, then the
 * script. Nothing else from the network: the tiles come through the map,
 * and only once the app asks.
 */
export const VIDEO_PAGE = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body>
<script>${FRAMES}</script>
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
