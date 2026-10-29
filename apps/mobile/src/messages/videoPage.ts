import { color } from "../theme/tokens";

/**
 * The two pages of the WebView for the videos of the messages (TASK-333,
 * ADR-0289, points 6 and 9): nothing native, the WebView the map and the
 * engine use. Each is written in the cache beside the files it reads, and
 * the WebView may read that folder only, as the engine's (PhoneEngineView).
 */

/** The longer side of a video's first picture, in pixels. */
export const POSTER_SIDE = 720;
/** How long the first picture may take before the video goes without. */
export const POSTER_WAIT_MS = 10_000;

/** What the page of the first picture says to the app. */
export type PosterMessage = { type: "poster"; jpeg: string } | { type: "failed" };

/** A message of the page, or null for anything else. */
export function posterMessageOf(data: string): PosterMessage | null {
  try {
    const message: unknown = JSON.parse(data);
    if (typeof message !== "object" || message === null) {
      return null;
    }
    const { type, jpeg } = message as { type?: unknown; jpeg?: unknown };
    if (type === "poster" && typeof jpeg === "string" && jpeg !== "") {
      return { type, jpeg };
    }
    return type === "failed" ? { type } : null;
  } catch {
    return null;
  }
}

/** A text inside the page's script: quoted, never closing the tag. */
function quoted(text: string): string {
  return JSON.stringify(text).replace(/</g, "\\u003c");
}

/**
 * The page that plays a video of a message from the cache, with the
 * phone's own controls, as big as the screen allows.
 */
export function playerPage(videoUri: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>html,body{margin:0;height:100%;background:${color.scrim}}
video{width:100%;height:100%;object-fit:contain;background:${color.scrim}}</style>
</head><body><video id="v" controls playsinline autoplay></video>
<script>document.getElementById("v").src=${quoted(videoUri)};</script>
</body></html>`;
}

/**
 * The page that takes a video's first picture: the video loaded muted, a
 * tenth of a second in, drawn on a canvas and sent as a JPEG in base64.
 */
export function posterPage(videoUri: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
(function () {
  var sent = false;
  function say(message) {
    if (sent) { return; }
    sent = true;
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }
  var video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.addEventListener("loadeddata", function () {
    video.currentTime = Math.min(0.1, (video.duration || 0.2) / 2);
  });
  video.addEventListener("seeked", function () {
    try {
      var scale = Math.min(1, ${POSTER_SIDE} / Math.max(video.videoWidth, video.videoHeight));
      var canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      say({ type: "poster", jpeg: canvas.toDataURL("image/jpeg", 0.8).split(",")[1] });
    } catch (e) {
      say({ type: "failed" });
    }
  });
  video.addEventListener("error", function () { say({ type: "failed" }); });
  video.src = ${quoted(videoUri)};
  video.load();
})();
</script></body></html>`;
}

/** The folder the WebView may read: the longest one that holds both. */
export function sharedFolder(a: string, b: string): string {
  const one = a.slice(0, a.lastIndexOf("/") + 1);
  const two = b.slice(0, b.lastIndexOf("/") + 1);
  let end = 0;
  while (end < one.length && one[end] === two[end]) {
    end += 1;
  }
  return one.slice(0, one.lastIndexOf("/", end - 1) + 1);
}
