import type { LatLon } from "@shaperoute/shared-types";

import type { Place } from "../places/photon";
import {
  AHEAD_ROOM_BYTES,
  aheadPoints,
  downloadAhead,
  featuredPlace,
  keepFeaturedPlace,
  readAhead,
} from "./aheadZones";
import { files } from "./memoryFiles";
import { DAY_MS, prefetchPausedUntil } from "./prefetch";
import {
  type Download,
  downloadZone,
  savedZones,
  SPACE_LIMIT_BYTES,
  zoneArea,
  type ZoneEntry,
  zoneUri,
} from "./zones";

jest.mock("expo-file-system", () => jest.requireActual("./memoryFiles"));
jest.mock("expo-file-system/legacy", () => ({ createDownloadResumable: jest.fn() }));

const STATE = "file:///documents/engine/ahead.json";
const INDEX = "file:///documents/engine/zones.json";
const API = "https://api.example";

const TRENTO = "foot_45.98370_11.00140_46.15030_11.24160.zone.json.gz";
const MILAN = "foot_45.38000_9.04000_45.54000_9.30000.zone.json.gz";
const ROME = "foot_41.80000_12.40000_42.00000_12.60000.zone.json.gz";

const HERE: LatLon = [46.0679, 11.1211];
const CENTRES: Record<string, LatLon> = {
  Milan: [45.4642, 9.19],
  Rome: [41.8933, 12.4829],
  // No zone on the server.
  Paris: [48.8566, 2.3522],
};
const VERONA: Place = { label: "Verona, Veneto, Italy", point: [45.4384, 10.9916] };
// Inside Trento's zone: held by the zone around the phone.
const DUOMO: Place = {
  label: "Duomo di Trento",
  point: [46.0672, 11.1216],
  kind: "place",
};

beforeEach(() => {
  files.clear();
});

/** The zone around the phone, saved before any round. */
function aroundThePhone(bytes = 10, usedAt = 500): void {
  const zone: ZoneEntry = { name: TRENTO, etag: null, bytes, usedAt };
  files.set(INDEX, JSON.stringify({ zones: [zone] }));
  files.set(zoneUri(zone), "zone");
}

/**
 * A server with `zones`: the smallest holding the point asked, else 404;
 * 429 for the points of `refuse`. Tells each point asked, and whether it
 * came as a zone ahead.
 */
function server(zones: string[], { refuse = [] as LatLon[] } = {}) {
  const asked: string[] = [];
  const inner: Download = async (url, fileUri): ReturnType<Download> => {
    const query = new URL(url).searchParams;
    const lat = Number(query.get("lat"));
    const lon = Number(query.get("lon"));
    asked.push(`${lat},${lon}${query.get("prefetch") === "1" ? " ahead" : ""}`);
    if (refuse.some(([la, lo]) => la === lat && lo === lon)) {
      return {
        uri: fileUri,
        status: 429,
        headers: { "Retry-After": "3600" },
        mimeType: null,
      };
    }
    const name = zones.find((each) => {
      const area = zoneArea(each);
      return (
        area !== null &&
        area.south <= lat &&
        lat <= area.north &&
        area.west <= lon &&
        lon <= area.east
      );
    });
    if (name === undefined) {
      return { uri: fileUri, status: 404, headers: {}, mimeType: null };
    }
    files.set(fileUri, "zone");
    return {
      uri: fileUri,
      status: 200,
      headers: { "Content-Disposition": `attachment; filename="${name}"`, ETag: '"1"' },
      mimeType: null,
    };
  };
  const download: typeof downloadZone = (baseUrl, network, point, options) =>
    downloadZone(baseUrl, network, point, {
      ...options,
      apiKey: null,
      download: inner,
    });
  return { asked, download: jest.fn(download) };
}

/** GET /cities: the centres above, no city for the other featured names. */
function cities(failing: string[] = []) {
  return jest.fn(async (_baseUrl: string, name: string): Promise<Place[] | null> => {
    if (failing.includes(name)) {
      return null;
    }
    const point = CENTRES[name];
    return point === undefined ? [] : [{ label: name, point, kind: "city" }];
  });
}

/** A server before TASK-236: no towns near. */
const noNearby = async (): Promise<Place[] | null> => null;
// Within 20 km of Trento, without a zone on the server.
const LEVICO: Place = { label: "Levico Terme", point: [46.0117, 11.302] };

const at = (time: number) => () => time;
const point = ([lat, lon]: LatLon, ahead = " ahead") => `${lat},${lon}${ahead}`;

test("the towns near come first, then the cities chosen last, then the featured, nearest first", () => {
  expect(
    aheadPoints(HERE, [LEVICO], [VERONA], [CENTRES.Paris, CENTRES.Rome, CENTRES.Milan]),
  ).toEqual([LEVICO.point, VERONA.point, CENTRES.Milan, CENTRES.Rome, CENTRES.Paris]);
  expect(aheadPoints(HERE, [], [], [])).toEqual([]);
});

test("the towns near the phone are asked before any other city", async () => {
  aroundThePhone();
  const { asked, download } = server([TRENTO, MILAN, ROME]);
  const nearby = jest.fn(async (): Promise<Place[] | null> => [LEVICO, DUOMO]);
  expect(
    await downloadAhead(API, HERE, "foot", {
      now: at(1_000),
      download,
      search: cities(),
      nearby,
      recent: () => [VERONA],
    }),
  ).toBe("done");
  expect(nearby).toHaveBeenCalledWith(API, HERE);
  // The Duomo is in Trento's zone: not asked.
  expect(asked).toEqual([
    point(LEVICO.point),
    point(VERONA.point),
    point(CENTRES.Milan),
    point(CENTRES.Rome),
    point(CENTRES.Paris),
  ]);
});

test("a round asks each city once, as a zone ahead, and keeps what it learnt", async () => {
  aroundThePhone();
  const { asked, download } = server([TRENTO, MILAN, ROME]);
  const search = cities();
  expect(
    await downloadAhead(API, HERE, "foot", {
      now: at(1_000),
      download,
      search,
      nearby: noNearby,
      recent: () => [DUOMO, VERONA],
    }),
  ).toBe("done");
  // The Duomo is in Trento's zone: not asked.
  expect(asked).toEqual([
    point(VERONA.point),
    point(CENTRES.Milan),
    point(CENTRES.Rome),
    point(CENTRES.Paris),
  ]);
  expect(savedZones().map((zone) => [zone.name, zone.usedAt])).toEqual([
    [TRENTO, 500],
    [MILAN, 0],
    [ROME, 0],
  ]);
  expect(search).toHaveBeenCalledTimes(14);
  const labels = Object.fromEntries(Object.keys(CENTRES).map((name) => [name, name]));
  expect(readAhead()).toEqual({ centres: CENTRES, labels, doneAt: 1_000 });
  // «Explore» opens them from here (TASK-287).
  expect(featuredPlace("Milan")).toEqual({ label: "Milan", point: CENTRES.Milan });
  expect(featuredPlace("Tokyo")).toBeNull();
});

test("a centre kept before its label is asked once more; one kept by «Explore» is not", async () => {
  aroundThePhone();
  const { download } = server([TRENTO, MILAN, ROME]);
  files.set(STATE, JSON.stringify({ centres: { Milan: CENTRES.Milan }, doneAt: 0 }));
  expect(featuredPlace("Milan")).toBeNull();
  keepFeaturedPlace("Rome", { label: "Roma, Lazio, Italia", point: CENTRES.Rome });
  const search = cities();
  expect(
    await downloadAhead(API, HERE, "foot", {
      now: at(1_000),
      download,
      search,
      nearby: noNearby,
      recent: () => [],
    }),
  ).toBe("done");
  const asked = search.mock.calls.map((call) => call[1]);
  expect(asked).toContain("Milan");
  expect(asked).not.toContain("Rome");
  expect(featuredPlace("Milan")).toEqual({ label: "Milan", point: CENTRES.Milan });
  expect(featuredPlace("Rome")).toEqual({
    label: "Roma, Lazio, Italia",
    point: CENTRES.Rome,
  });
});

test("after a whole round, the next waits a day, and asks only what is missing", async () => {
  aroundThePhone();
  const { asked, download } = server([TRENTO, MILAN, ROME]);
  const search = cities();
  const round = (time: number) =>
    downloadAhead(API, HERE, "foot", {
      now: at(time),
      download,
      search,
      nearby: noNearby,
      recent: () => [VERONA],
    });
  expect(await round(1_000)).toBe("done");
  asked.length = 0;
  search.mockClear();

  expect(await round(1_000 + DAY_MS - 1)).toBe("lately");
  expect(asked).toEqual([]);

  expect(await round(1_000 + DAY_MS)).toBe("done");
  // Milan and Rome are on the phone; their centres too.
  expect(asked).toEqual([point(VERONA.point), point(CENTRES.Paris)]);
  expect(search.mock.calls.map((call) => call[1])).not.toContain("Milan");
});

test("past the server's cap, nothing more until Retry-After, then on", async () => {
  aroundThePhone();
  const { asked, download } = server([TRENTO, MILAN, ROME], { refuse: [CENTRES.Rome] });
  const search = cities();
  const round = (time: number) =>
    downloadAhead(API, HERE, "foot", {
      now: at(time),
      download,
      search,
      nearby: noNearby,
      recent: () => [],
    });
  expect(await round(1_000)).toBe("later");
  expect(asked).toEqual([point(CENTRES.Milan), point(CENTRES.Rome)]);
  expect(prefetchPausedUntil()).toBe(1_000 + 3_600_000);
  expect(readAhead().doneAt).toBe(0);

  asked.length = 0;
  search.mockClear();
  expect(await round(3_600_999)).toBe("later");
  expect(asked).toEqual([]);
  expect(search).not.toHaveBeenCalled();

  const after = server([TRENTO, MILAN, ROME]);
  expect(
    await downloadAhead(API, HERE, "foot", {
      now: at(3_601_000),
      download: after.download,
      search,
      nearby: noNearby,
      recent: () => [],
    }),
  ).toBe("done");
  expect(after.asked).toEqual([point(CENTRES.Rome), point(CENTRES.Paris)]);
});

test("a download cut short stops the round; the next opening goes on", async () => {
  aroundThePhone();
  const offline = jest.fn(async (): ReturnType<typeof downloadZone> => ({
    kind: "failed",
    why: "offline",
  }));
  expect(
    await downloadAhead(API, HERE, "foot", {
      now: at(1_000),
      download: offline,
      search: cities(),
      nearby: noNearby,
      recent: () => [],
    }),
  ).toBe("stopped");
  expect(offline).toHaveBeenCalledTimes(1);
  expect(readAhead().doneAt).toBe(0);

  const { asked, download } = server([TRENTO, MILAN, ROME]);
  expect(
    await downloadAhead(API, HERE, "foot", {
      now: at(2_000),
      download,
      search: cities(),
      nearby: noNearby,
      recent: () => [],
    }),
  ).toBe("done");
  expect(asked).toHaveLength(3);
});

test("a centre that did not come is asked again next opening", async () => {
  aroundThePhone();
  const { asked, download } = server([TRENTO, MILAN, ROME]);
  const round = (search: ReturnType<typeof cities>) =>
    downloadAhead(API, HERE, "foot", {
      now: at(1_000),
      download,
      search,
      nearby: noNearby,
      recent: () => [],
    });
  expect(await round(cities(["Milan"]))).toBe("stopped");
  // The other cities do not wait for it.
  expect(asked).toEqual([point(CENTRES.Rome), point(CENTRES.Paris)]);
  expect(readAhead().centres.Milan).toBeUndefined();

  const search = cities();
  expect(await round(search)).toBe("done");
  expect(search.mock.calls.map((call) => call[1])).toContain("Milan");
  expect(savedZones().map((zone) => zone.name)).toContain(MILAN);
});

test("close to 2 GB, nothing is downloaded ahead", async () => {
  aroundThePhone(SPACE_LIMIT_BYTES - AHEAD_ROOM_BYTES + 1);
  const { asked, download } = server([TRENTO, MILAN, ROME]);
  expect(
    await downloadAhead(API, HERE, "foot", {
      now: at(1_000),
      download,
      search: cities(),
      nearby: noNearby,
      recent: () => [VERONA],
    }),
  ).toBe("full");
  expect(asked).toEqual([]);
});

test("one round at a time", async () => {
  aroundThePhone();
  let finish: () => void = () => undefined;
  const slow = jest.fn(
    () =>
      new Promise<Awaited<ReturnType<typeof downloadZone>>>((resolve) => {
        finish = () => resolve({ kind: "none" });
      }),
  );
  const options = {
    now: at(1_000),
    download: slow,
    search: cities(),
    nearby: noNearby,
    recent: () => [VERONA],
  };
  const first = downloadAhead(API, HERE, "foot", options);
  expect(await downloadAhead(API, HERE, "foot", options)).toBe("busy");
  // Verona, then the three featured cities.
  for (let each = 0; each < 4; each += 1) {
    await new Promise((resolve) => setImmediate(resolve));
    finish();
  }
  expect(await first).toBe("done");
});

test("a file that does not read is no centre and no round", () => {
  expect(readAhead()).toEqual({ centres: {}, labels: {}, doneAt: 0 });
  files.set(STATE, "{not json");
  expect(readAhead()).toEqual({ centres: {}, labels: {}, doneAt: 0 });
  files.set(
    STATE,
    JSON.stringify({
      centres: { Milan: [45.4, 9.1], Rome: ["x", 1], Paris: [1] },
      labels: { Milan: "Milano, Lombardia, Italia", Rome: 3 },
      doneAt: "x",
    }),
  );
  expect(readAhead()).toEqual({
    centres: { Milan: [45.4, 9.1] },
    labels: { Milan: "Milano, Lombardia, Italia" },
    doneAt: 0,
  });
});
