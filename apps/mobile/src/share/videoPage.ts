/**
 * The page of the hidden WebView that makes a run's video (TASK-295,
 * ADR-0254): it draws each picture of a `VideoScene` on a canvas and
 * encodes it as H.264 with WebCodecs, which every iPhone the app runs on
 * has (iOS 16.4 and later). Nothing native and nothing new in the app: the
 * WebView is the one the map and the engine use.
 *
 * The app talks to it with `window.muwVideo.make(scene)`
 * (injectJavaScript); it answers with `ReactNativeWebView.postMessage`, one
 * JSON message each (`VideoPageMessage`). The pictures leave it encoded, in
 * base64, and the app puts them in an MP4 file (mp4.ts).
 */

/** What the page says to the app. */
export type VideoPageMessage =
  /** Loaded; `codec` is null when this WebView cannot encode the video. */
  | { type: "ready"; codec: string | null }
  /** How to decode the pictures: the avcC record, in base64. */
  | { type: "config"; avcC: string }
  /** Encoded pictures, in order: `time` in microseconds, `data` in base64. */
  | { type: "chunks"; list: { key: boolean; time: number; data: string }[] }
  /** Pictures given to the encoder so far. */
  | { type: "progress"; frames: number }
  | { type: "done"; frames: number }
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
  var FONT = ${JSON.stringify(FONT)};
  var codec = null;
  var started = false;

  function post(message) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }

  function messageOf(error) {
    return String((error && error.message) || error);
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

  // The words in at most "lines" lines of "width", the last cut with «…».
  function wrap(g, words, width, lines) {
    var out = [];
    var rest = words.split(" ");
    while (rest.length > 0 && out.length < lines) {
      var line = rest.shift();
      while (rest.length > 0 && g.measureText(line + " " + rest[0]).width <= width) {
        line += " " + rest.shift();
      }
      out.push(line);
    }
    if (rest.length > 0) {
      out[out.length - 1] += " " + rest.join(" ");
    }
    var last = out[out.length - 1];
    if (g.measureText(last).width > width) {
      while (last.length > 1 && g.measureText(last + "…").width > width) {
        last = last.slice(0, -1);
      }
      out[out.length - 1] = last.trimEnd() + "…";
    }
    return out;
  }

  function draw(g, scene, ops) {
    g.globalAlpha = 1;
    g.fillStyle = scene.paper;
    g.fillRect(0, 0, scene.width, scene.height);
    g.lineCap = "round";
    g.lineJoin = "round";
    for (var i = 0; i < ops.length; i += 1) {
      var op = ops[i];
      if (op.alpha <= 0) {
        continue;
      }
      g.globalAlpha = Math.min(1, op.alpha);
      if (op.k === "line") {
        var path = scene.paths[op.path];
        if (path && path.length >= 4) {
          g.strokeStyle = scene.ink;
          g.lineWidth = op.width;
          stroke(g, path, op.upTo);
        }
      } else if (op.k === "dot") {
        g.beginPath();
        g.arc(op.x, op.y, op.r, 0, 2 * Math.PI);
        g.fillStyle = op.fill;
        g.fill();
        if (op.ring > 0) {
          // Inside the dot, as a border in the app.
          g.beginPath();
          g.arc(op.x, op.y, Math.max(0, op.r - op.ring / 2), 0, 2 * Math.PI);
          g.strokeStyle = scene.ink;
          g.lineWidth = op.ring;
          g.stroke();
        }
      } else if (op.k === "text") {
        g.font = (op.bold ? "700 " : "500 ") + op.size + "px " + FONT;
        g.fillStyle = scene.ink;
        g.textAlign = op.align;
        g.textBaseline = "middle";
        var lines = wrap(g, op.text, op.maxWidth, op.lines);
        for (var j = 0; j < lines.length; j += 1) {
          g.fillText(lines[j], op.x, op.y + op.size * 1.2 * (j + 0.5));
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
    post({ type: "done", frames: scene.frames.length });
  }

  window.muwVideo = {
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

/** The whole page: a script, no network. */
export const VIDEO_PAGE = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body><script>${SCRIPT}</script></body>
</html>
`;

/** Where the page says it is: an https address, so WebCodecs, which only
 * secure pages have, is there. It never loads anything from it. */
export const VIDEO_PAGE_BASE = "https://video.muw.invalid/";

/** What the app asks the page to do: make the video of `sceneJson`. */
export function makeCall(sceneJson: string): string {
  return `window.muwVideo.make(${sceneJson}); true;`;
}
