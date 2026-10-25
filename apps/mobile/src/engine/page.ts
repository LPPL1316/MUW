/**
 * The page of the hidden WebView that draws routes on the phone (TASK-214,
 * ADR-0177): Python in WebAssembly (Pyodide) runs the API's own route job,
 * `shaperoute_api.on_phone`, on the zones saved on the phone.
 *
 * Everything it runs comes with the app: `pyodide.zip` and `engine.zip`
 * (assets/engine/, built by tools/phone_engine/phone_engine.py), read from
 * the phone's files. Pyodide asks for its files with `fetch`: the page
 * answers from the zip in memory, and refuses every other address, so
 * nothing here uses the network.
 *
 * The app talks to it with `window.sgrava.boot(...)` and
 * `window.sgrava.plan(...)` (injectJavaScript); it answers with
 * `ReactNativeWebView.postMessage`, one JSON message each (`PageMessage`).
 */

/** What the page says to the app. */
export type PageMessage =
  | { type: "ready"; ms: number }
  | { type: "failed"; error: string }
  | { type: "result"; id: number; json: string; ms: number; memoryMb: number }
  /** `fatal`: Python can no longer be used; the app starts a new page. */
  | { type: "error"; id: number; error: string; fatal: boolean };

/** A zone file for the page: its name, as the API names it, and where it is. */
export type PageZone = { name: string; uri: string; version: string };

export type BootArgs = { pyodide: string; engine: string };
export type PlanArgs = { id: number; body: string; zones: PageZone[] };
/** The zone a route of `activity` from `point` will use, read into memory
 * ahead (part E); answered as a result whose JSON is true or false. */
export type WarmArgs = {
  id: number;
  zones: PageZone[];
  activity: string;
  point: [number, number];
};

/** Where Pyodide believes its files are; only the page answers there. */
const BASE = "https://engine.sgrava.invalid/";
const ZONES = "/zones/";

// Plain ES2017 inside a template string: it runs in the WebView, not in
// Hermes, and is never transformed.
const SCRIPT = String.raw`
(function () {
  "use strict";
  var BASE = ${JSON.stringify(BASE)};
  var ZONES = ${JSON.stringify(ZONES)};
  var files = new Map();
  var py = null;
  var zones = new Map();

  function post(message) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }

  function messageOf(error) {
    var text = String((error && error.message) || error);
    return text.split("\n").slice(-8).join("\n");
  }

  // A file of the phone, whole. fetch does not read file: URLs in WebKit.
  function read(uri) {
    return new Promise(function (resolve, reject) {
      var request = new XMLHttpRequest();
      request.open("GET", uri);
      request.responseType = "arraybuffer";
      request.onload = function () {
        if ((request.status === 200 || request.status === 0) && request.response) {
          resolve(new Uint8Array(request.response));
        } else {
          reject(new Error("cannot read " + uri + " (" + request.status + ")"));
        }
      };
      request.onerror = function () {
        reject(new Error("cannot read " + uri));
      };
      request.send();
    });
  }

  // The files of a zip written without compression, by name.
  function unzip(bytes) {
    var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var end = bytes.length - 22;
    while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1;
    if (end < 0) throw new Error("not a zip");
    var count = view.getUint16(end + 10, true);
    var at = view.getUint32(end + 16, true);
    var names = new TextDecoder();
    var out = new Map();
    for (var i = 0; i < count; i += 1) {
      if (view.getUint32(at, true) !== 0x02014b50) throw new Error("bad zip");
      var method = view.getUint16(at + 10, true);
      var size = view.getUint32(at + 20, true);
      var nameLength = view.getUint16(at + 28, true);
      var extraLength = view.getUint16(at + 30, true);
      var commentLength = view.getUint16(at + 32, true);
      var local = view.getUint32(at + 42, true);
      var name = names.decode(bytes.subarray(at + 46, at + 46 + nameLength));
      if (method !== 0) throw new Error(name + " is compressed");
      var start =
        local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      out.set(name, bytes.subarray(start, start + size));
      at += 46 + nameLength + extraLength + commentLength;
    }
    return out;
  }

  function blobUrl(bytes) {
    return URL.createObjectURL(new Blob([bytes], { type: "text/javascript" }));
  }

  function addScript(bytes) {
    return new Promise(function (resolve, reject) {
      var tag = document.createElement("script");
      tag.src = blobUrl(bytes);
      tag.onload = function () {
        resolve();
      };
      tag.onerror = function () {
        reject(new Error("a script of Pyodide did not load"));
      };
      document.head.appendChild(tag);
    });
  }

  window.fetch = function (input) {
    var url = typeof input === "string" ? input : input.url || String(input);
    if (url.indexOf(BASE) !== 0) {
      return Promise.reject(new TypeError("the engine does not use the network"));
    }
    var data = files.get(url.slice(BASE.length));
    if (!data) return Promise.resolve(new Response(null, { status: 404 }));
    var type = /\.wasm$/.test(url) ? "application/wasm" : "application/octet-stream";
    return Promise.resolve(
      new Response(data, { status: 200, headers: { "Content-Type": type } }),
    );
  };

  function setUp() {
    py.runPython(
      [
        "import sys",
        "sys.path.insert(0, '/engine')",
        "from pathlib import Path",
        "from shaperoute_api import on_phone",
        "GRAPHS = on_phone.phone_graphs(Path('" + ZONES + "'))",
        "JOBS = on_phone.PhoneJobs(GRAPHS)",
      ].join("\n"),
    );
  }

  async function boot(args) {
    var started = performance.now();
    try {
      files = unzip(await read(args.pyodide));
      var lock = JSON.parse(new TextDecoder().decode(files.get("pyodide-lock.json")));
      await addScript(files.get("pyodide.js"));
      // A module: import() does not go through fetch.
      var module = await import(blobUrl(files.get("pyodide.asm.mjs")));
      py = await loadPyodide({
        createPyodideModule: module.default,
        indexURL: BASE,
        packageBaseUrl: BASE,
        lockFileContents: lock,
        stdout: function () {},
        stderr: function () {},
      });
      await py.loadPackage(Object.keys(lock.packages), {
        messageCallback: function () {},
        checkIntegrity: false,
      });
      py.unpackArchive(await read(args.engine), "zip", { extractDir: "/engine" });
      files = new Map();
      py.FS.mkdirTree(ZONES);
      setUp();
      post({ type: "ready", ms: Math.round(performance.now() - started) });
    } catch (error) {
      files = new Map();
      post({ type: "failed", error: messageOf(error) });
    }
  }

  // Only the zones of this request stay in Python's files; a zone saved
  // again under the same name is read again, by new jobs.
  async function placeZones(wanted) {
    var changed = false;
    zones.forEach(function (version, name) {
      var kept = wanted.some(function (zone) {
        return zone.name === name && zone.version === version;
      });
      if (!kept) {
        py.FS.unlink(ZONES + name);
        zones.delete(name);
        changed = true;
      }
    });
    for (var i = 0; i < wanted.length; i += 1) {
      var zone = wanted[i];
      if (!zones.has(zone.name)) {
        py.FS.writeFile(ZONES + zone.name, await read(zone.uri));
        zones.set(zone.name, zone.version);
      }
    }
    if (changed) setUp();
  }

  async function run(args, python) {
    var started = performance.now();
    try {
      if (!py) throw new Error("the engine is not ready");
      await placeZones(args.zones);
      var json = python();
      post({
        type: "result",
        id: args.id,
        json: json,
        ms: Math.round(performance.now() - started),
        memoryMb: Math.round(py._module.HEAP8.length / 1e6),
      });
    } catch (error) {
      // A C++ exception that Python could not catch stops Python for good.
      var fatal = Boolean(error && error.pyodide_fatal_error) || /fatally failed/.test(String(error));
      post({ type: "error", id: args.id, error: messageOf(error), fatal: fatal });
    }
  }

  function plan(args) {
    return run(args, function () {
      py.globals.set("BODY", args.body);
      return py.runPython("on_phone.plan_json(BODY, JOBS)");
    });
  }

  function warm(args) {
    return run(args, function () {
      py.globals.set("ACTIVITY", args.activity);
      py.globals.set("LAT", args.point[0]);
      py.globals.set("LON", args.point[1]);
      return JSON.stringify(Boolean(py.runPython("on_phone.warm(GRAPHS, ACTIVITY, LAT, LON)")));
    });
  }

  window.sgrava = { boot: boot, plan: plan, warm: warm };
})();
`;

export const ENGINE_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MuW engine</title>
</head>
<body>
<script>${SCRIPT}</script>
</body>
</html>
`;

/** The JavaScript that asks the page to do `call` with `args`. */
export function pageCall(
  call: "boot" | "plan" | "warm",
  args: BootArgs | PlanArgs | WarmArgs,
): string {
  return `window.sgrava.${call}(${JSON.stringify(args)}); true;`;
}
