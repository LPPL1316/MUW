import { createDownloadResumable } from "expo-file-system/legacy";

import { files } from "./memoryFiles";
import { phoneId, prefetchPausedUntil } from "./prefetch";
import {
  AROUND_MARGIN_M,
  coveringZone,
  coveringZones,
  deleteZone,
  deleteZones,
  type Download,
  downloadTelling,
  downloadZone,
  ENGINE_ZONES,
  fileNameOf,
  overLimit,
  savedBytes,
  savedZones,
  SPACE_LIMIT_BYTES,
  touchZone,
  watchZones,
  zoneArea,
  ZONE_TAGS_HEADER,
  type ZoneEntry,
  zonesForEngine,
  zoneUri,
} from "./zones";

jest.mock("expo-file-system", () => jest.requireActual("./memoryFiles"));
jest.mock("expo-file-system/legacy", () => ({ createDownloadResumable: jest.fn() }));

const TRENTO = "foot_45.98370_11.00140_46.15030_11.24160.zone.json.gz";
const TRENTO_BIKE = "bike_45.98280_10.99990_46.15140_11.24290.zone.json.gz";
// Inside Trento's zone, smaller: the one to pick for a start in both.
const CENTRE = "foot_46.05000_11.10000_46.09000_11.14000.zone.json.gz";
const HERE: [number, number] = [46.0679, 11.1211];
const URL_BASE = "https://api.example";

function entry(name: string, bytes = 10, usedAt = 0): ZoneEntry {
  return { name, etag: null, bytes, usedAt };
}

/** A downloadAsync that writes `body` and answers `status` and `headers`. */
function answering(
  status: number,
  headers: Record<string, string> = {},
  body = "zone",
) {
  return jest.fn(async (_url: string, fileUri: string, _options?: object) => {
    files.set(fileUri, body);
    return { uri: fileUri, status, headers, mimeType: null };
  });
}

function zipHeaders(name: string, etag = '"1-2"') {
  return { "Content-Disposition": `attachment; filename="${name}"`, ETag: etag };
}

beforeEach(() => {
  files.clear();
});

test("a zone's name gives its network and area, as the API writes it", () => {
  expect(zoneArea(TRENTO)).toEqual({
    network: "foot",
    south: 45.9837,
    west: 11.0014,
    north: 46.1503,
    east: 11.2416,
  });
  expect(zoneArea("foot_1_2_3_4.zone.json.gz")).toBeNull();
  expect(
    zoneArea("../foot_45.98370_11.00140_46.15030_11.24160.zone.json.gz"),
  ).toBeNull();
  expect(zoneArea("water_45.98370_11.00140_46.15030_11.24160.zone.json.gz")).toBeNull();
  expect(
    zoneArea("foot_-33.94640_151.11610_-33.79330_151.30040.zone.json.gz"),
  ).not.toBeNull();
});

test("the zone for a start is the smallest of its network that holds it", () => {
  const zones = [entry(TRENTO), entry(CENTRE), entry(TRENTO_BIKE)];
  expect(coveringZone(zones, "foot", HERE)?.name).toBe(CENTRE);
  expect(coveringZone(zones, "foot", [46.0, 11.05])?.name).toBe(TRENTO);
  expect(coveringZone(zones, "bike", HERE)?.name).toBe(TRENTO_BIKE);
  expect(coveringZone(zones, "foot", [45.4642, 9.19])).toBeNull();
});

test("beyond the limit, the zones used longest ago go first, never the new one", () => {
  const zones = [
    entry("a", 5, 3),
    entry("b", 5, 1),
    entry("c", 5, 2),
    entry("new", 5, 0),
  ];
  expect(overLimit(zones, 20)).toEqual([]);
  expect(overLimit(zones, 15, "new").map((zone) => zone.name)).toEqual(["b"]);
  expect(overLimit(zones, 10, "new").map((zone) => zone.name)).toEqual(["b", "c"]);
  expect(overLimit(zones, 4, "new").map((zone) => zone.name)).toEqual(["b", "c", "a"]);
  expect(SPACE_LIMIT_BYTES).toBe(2_000_000_000);
});

test("the file name comes from Content-Disposition, only when it is a zone's", () => {
  expect(fileNameOf(`attachment; filename="${TRENTO}"`)).toBe(TRENTO);
  expect(fileNameOf(`attachment; filename=${TRENTO}`)).toBe(TRENTO);
  expect(fileNameOf('attachment; filename="../../etc/passwd"')).toBeNull();
  expect(fileNameOf(null)).toBeNull();
});

test("a downloaded zone is saved under the API's name, with its ETag", async () => {
  const download = answering(200, zipHeaders(TRENTO), "0123456789");
  const answer = await downloadZone(URL_BASE, "foot", HERE, {
    apiKey: "key",
    now: () => 1000,
    download,
  });
  expect(download).toHaveBeenCalledWith(
    `${URL_BASE}/phone-zones/foot?lat=46.0679&lon=11.1211`,
    expect.stringContaining(".foot.download"),
    { headers: { "X-API-Key": "key" } },
    undefined,
  );
  expect(answer).toEqual({
    kind: "saved",
    zone: { name: TRENTO, etag: '"1-2"', bytes: 10, usedAt: 1000 },
  });
  expect(savedZones()).toEqual([answer.kind === "saved" && answer.zone]);
  expect(files.get(zoneUri(savedZones()[0]))).toBe("0123456789");
  expect([...files.keys()].some((uri) => uri.endsWith(".download"))).toBe(false);
});

test("a zone the phone has is asked with its ETag, and a 304 keeps it", async () => {
  await downloadZone(URL_BASE, "foot", HERE, {
    apiKey: null,
    now: () => 1000,
    download: answering(200, zipHeaders(TRENTO)),
  });
  const again = answering(304);
  const answer = await downloadZone(URL_BASE, "foot", HERE, {
    apiKey: null,
    now: () => 2000,
    download: again,
  });
  expect(again.mock.calls[0][2]).toEqual({ headers: { "If-None-Match": '"1-2"' } });
  expect(answer).toMatchObject({ kind: "unchanged", zone: { name: TRENTO } });
  expect(savedZones()[0].usedAt).toBe(2000);
});

describe("more room around the phone (part E)", () => {
  async function saved(name: string, etag: string, at: number) {
    await downloadZone(URL_BASE, "foot", HERE, {
      apiKey: null,
      now: () => at,
      download: answering(200, zipHeaders(name, etag)),
    });
  }

  test("the room is asked for, and the zone held is kept beside the smaller", async () => {
    await saved(CENTRE, '"c"', 1000);
    const download = answering(200, zipHeaders(TRENTO, '"t"'));
    const answer = await downloadZone(URL_BASE, "foot", HERE, {
      apiKey: null,
      now: () => 2000,
      download,
      marginM: AROUND_MARGIN_M,
    });
    expect(download.mock.calls[0][0]).toBe(
      `${URL_BASE}/phone-zones/foot?lat=46.0679&lon=11.1211&margin_m=6000`,
    );
    expect(answer).toMatchObject({ kind: "saved", zone: { name: TRENTO } });
    expect(savedZones().map((zone) => zone.name)).toEqual([CENTRE, TRENTO]);
  });

  test("every zone held is asked with its ETag, and the 304 keeps the one it names", async () => {
    await saved(CENTRE, '"c"', 1000);
    await saved(TRENTO, '"t"', 1000);
    const again = answering(304, { ETag: '"t"' });
    const answer = await downloadZone(URL_BASE, "foot", HERE, {
      apiKey: null,
      now: () => 3000,
      download: again,
      marginM: AROUND_MARGIN_M,
    });
    // The smallest one's where a server before part E looks, as before.
    expect(again.mock.calls[0][2]).toEqual({
      headers: { "If-None-Match": '"c"', [ZONE_TAGS_HEADER]: '"t"' },
    });
    expect(answer).toMatchObject({ kind: "unchanged", zone: { name: TRENTO } });
    const used = Object.fromEntries(
      savedZones().map((zone) => [zone.name, zone.usedAt]),
    );
    expect(used).toEqual({ [CENTRE]: 1000, [TRENTO]: 3000 });
  });

  test("a server before part E answers as it always did", async () => {
    await saved(CENTRE, '"c"', 1000);
    await saved(TRENTO, '"t"', 1000);
    // It ignores margin_m and X-Zone-ETags: the 3 km zone, the smallest.
    const before = answering(304, { ETag: '"c"' });
    const answer = await downloadZone(URL_BASE, "foot", HERE, {
      apiKey: null,
      now: () => 3000,
      download: before,
      marginM: AROUND_MARGIN_M,
    });
    expect(answer).toMatchObject({ kind: "unchanged", zone: { name: CENTRE } });
    expect(savedZones().map((zone) => zone.name)).toEqual([CENTRE, TRENTO]);
  });

  test("the zones for the engine are all those holding the start, the smallest first", () => {
    const zones = [entry(TRENTO), entry(TRENTO_BIKE), entry(CENTRE)];
    expect(coveringZones(zones, "foot", HERE).map((zone) => zone.name)).toEqual([
      CENTRE,
      TRENTO,
    ]);
    expect(zonesForEngine(zones, "foot", HERE)).toEqual([
      { name: CENTRE, uri: zoneUri(entry(CENTRE)), version: "10" },
      { name: TRENTO, uri: zoneUri(entry(TRENTO)), version: "10" },
    ]);
    expect(zonesForEngine(zones, "foot", [45.4642, 9.19])).toEqual([]);
  });

  test(`at most ${ENGINE_ZONES} zones go to the engine`, () => {
    const nested = [0, 1, 2, 3].map((i) =>
      entry(
        `foot_${(46.0 - i * 0.01).toFixed(5)}_${(11.1 - i * 0.01).toFixed(5)}_${(
          46.1 +
          i * 0.01
        ).toFixed(5)}_${(11.2 + i * 0.01).toFixed(5)}.zone.json.gz`,
      ),
    );
    const given = zonesForEngine(nested, "foot", [46.05, 11.15]);
    expect(given.map((zone) => zone.name)).toEqual(
      nested.slice(0, ENGINE_ZONES).map((zone) => zone.name),
    );
  });
});

test("no zone on the server, or a refusal, saves nothing", async () => {
  expect(
    await downloadZone(URL_BASE, "foot", HERE, {
      apiKey: null,
      download: answering(404),
    }),
  ).toEqual({ kind: "none" });
  expect(
    await downloadZone(URL_BASE, "foot", HERE, {
      apiKey: null,
      download: answering(401),
    }),
  ).toEqual({ kind: "failed", why: "the server answered 401" });
  expect(savedZones()).toEqual([]);
  expect(files.size).toBe(0);
});

test("a file that is not a zone of the network asked is not kept", async () => {
  const answer = await downloadZone(URL_BASE, "foot", HERE, {
    apiKey: null,
    download: answering(200, zipHeaders(TRENTO_BIKE)),
  });
  expect(answer).toMatchObject({ kind: "failed" });
  expect(savedZones()).toEqual([]);
});

test("no network: the download fails quietly", async () => {
  const answer = await downloadZone(URL_BASE, "foot", HERE, {
    apiKey: null,
    download: jest.fn().mockRejectedValue(new Error("offline")),
  });
  expect(answer).toEqual({ kind: "failed", why: "Error: offline" });
});

test("a zone used by a route moves to the back of the deletion line", async () => {
  await downloadZone(URL_BASE, "foot", HERE, {
    apiKey: null,
    now: () => 1,
    download: answering(200, zipHeaders(TRENTO)),
  });
  touchZone(TRENTO, 50);
  expect(savedZones()[0].usedAt).toBe(50);
});

test("«Delete» removes every zone and the index", async () => {
  await downloadZone(URL_BASE, "foot", HERE, {
    apiKey: null,
    download: answering(200, zipHeaders(TRENTO)),
  });
  deleteZones();
  expect(savedZones()).toEqual([]);
  expect([...files.keys()].filter((uri) => uri.endsWith(".gz"))).toEqual([]);
});

test("an index that does not read, or names a missing file, gives no zone", () => {
  files.set("file:///documents/engine/zones.json", "not json");
  expect(savedZones()).toEqual([]);
  files.set(
    "file:///documents/engine/zones.json",
    JSON.stringify({ zones: [entry(TRENTO)] }),
  );
  expect(savedZones()).toEqual([]);
});

test("the size the server sends is told once, as the first bytes arrive", async () => {
  const result = { uri: "file:///x", status: 200, headers: {}, mimeType: null };
  jest.mocked(createDownloadResumable).mockImplementation(
    (_url, _fileUri, _options, callback) =>
      ({
        downloadAsync: async () => {
          for (const written of [100, 5_000, 7_000_000]) {
            callback?.({
              totalBytesWritten: written,
              totalBytesExpectedToWrite: 7_000_000,
            });
          }
          return result;
        },
      }) as unknown as ReturnType<typeof createDownloadResumable>,
  );
  const onSize = jest.fn();
  expect(await downloadTelling("https://api/x", "file:///x", {}, onSize)).toBe(result);
  expect(onSize.mock.calls).toEqual([[7_000_000]]);
});

test("without Content-Length, no size is told", async () => {
  jest.mocked(createDownloadResumable).mockImplementation(
    (_url, _fileUri, _options, callback) =>
      ({
        downloadAsync: async () => {
          callback?.({ totalBytesWritten: 100, totalBytesExpectedToWrite: -1 });
          return undefined;
        },
      }) as unknown as ReturnType<typeof createDownloadResumable>,
  );
  const onSize = jest.fn();
  expect(
    await downloadTelling("https://api/x", "file:///x", {}, onSize),
  ).toBeUndefined();
  expect(onSize).not.toHaveBeenCalled();
});

test("the size goes to the download, and a download cut short saves nothing", async () => {
  const onSize = jest.fn();
  const download = jest.fn(async (..._args: Parameters<Download>) => undefined);
  const answer = await downloadZone(URL_BASE, "foot", HERE, {
    apiKey: null,
    download,
    onSize,
  });
  expect(download.mock.calls[0][3]).toBe(onSize);
  expect(answer).toEqual({ kind: "failed", why: "the download stopped" });
  expect(savedZones()).toEqual([]);
});

test("a watcher hears each change of the zones, until it stops", async () => {
  const watcher = jest.fn();
  const stop = watchZones(watcher);
  await downloadZone(URL_BASE, "foot", HERE, {
    apiKey: null,
    download: answering(200, zipHeaders(TRENTO), "0123456789"),
  });
  expect(watcher).toHaveBeenCalledTimes(1);
  expect(savedBytes()).toBe(10);
  deleteZones();
  expect(watcher).toHaveBeenCalledTimes(2);
  expect(savedBytes()).toBe(0);
  stop();
  touchZone(TRENTO);
  expect(watcher).toHaveBeenCalledTimes(2);
});

test("the space of the zones is the sum of their sizes", () => {
  expect(savedBytes([entry(TRENTO, 7), entry(TRENTO_BIKE, 12)])).toBe(19);
  expect(savedBytes([])).toBe(0);
});

test("a zone ahead says so, with the phone's id; the zone around it does not", async () => {
  const download = answering(200, zipHeaders(TRENTO));
  await downloadZone(URL_BASE, "foot", HERE, { apiKey: "k", download });
  await downloadZone(URL_BASE, "foot", [45.4642, 9.19], {
    apiKey: "k",
    download,
    prefetch: true,
  });
  const [around, ahead] = download.mock.calls;
  expect(around[0]).toBe(`${URL_BASE}/phone-zones/foot?lat=46.0679&lon=11.1211`);
  expect(around[2]).toEqual({ headers: { "X-API-Key": "k" } });
  expect(ahead[0]).toBe(`${URL_BASE}/phone-zones/foot?lat=45.4642&lon=9.19&prefetch=1`);
  expect(ahead[2]).toEqual({
    headers: { "X-API-Key": "k", "X-Phone-Id": phoneId() },
  });
});

test("past the day's cap, no zone ahead is asked before Retry-After", async () => {
  const refused = answering(429, { "Retry-After": "21600" }, '{"error":{}}');
  const at = (now: number) => ({ apiKey: null, now: () => now, prefetch: true });
  expect(
    await downloadZone(URL_BASE, "bike", HERE, { ...at(1_000), download: refused }),
  ).toEqual({ kind: "later", retryAt: 1_000 + 21_600_000 });
  expect(prefetchPausedUntil()).toBe(1_000 + 21_600_000);
  expect(savedZones()).toEqual([]);
  expect([...files.keys()].some((uri) => uri.includes(".download"))).toBe(false);

  const saved = answering(200, zipHeaders(TRENTO_BIKE));
  expect(
    await downloadZone(URL_BASE, "bike", HERE, { ...at(21_600_999), download: saved }),
  ).toEqual({ kind: "later", retryAt: 21_601_000 });
  expect(saved).not.toHaveBeenCalled();
  // The zone around the phone is never held back.
  await downloadZone(URL_BASE, "bike", HERE, { apiKey: null, download: saved });
  expect(saved).toHaveBeenCalledTimes(1);

  files.delete(`file:///documents/engine/zones/${TRENTO_BIKE}`);
  expect(
    await downloadZone(URL_BASE, "bike", HERE, { ...at(21_601_000), download: saved }),
  ).toMatchObject({ kind: "saved" });
});

test("a zone ahead is saved as never used: beyond the limit it goes first", async () => {
  const own = entry(TRENTO, SPACE_LIMIT_BYTES - 12, 500);
  files.set("file:///documents/engine/zones.json", JSON.stringify({ zones: [own] }));
  files.set(zoneUri(own), "zone");
  const milan = "foot_45.38000_9.04000_45.54000_9.30000.zone.json.gz";
  expect(
    await downloadZone(URL_BASE, "foot", [45.4642, 9.19], {
      apiKey: null,
      now: () => 800,
      download: answering(200, zipHeaders(milan), "abc"),
      prefetch: true,
    }),
  ).toEqual({
    kind: "saved",
    zone: { name: milan, etag: '"1-2"', bytes: 3, usedAt: 0 },
  });
  await downloadZone(URL_BASE, "bike", HERE, {
    apiKey: null,
    now: () => 900,
    download: answering(200, zipHeaders(TRENTO_BIKE), "0123456789"),
  });
  // The zone the phone was in stays; the one ahead, never used, goes.
  expect(savedZones().map((zone) => zone.name)).toEqual([TRENTO, TRENTO_BIKE]);
});

test("a 429 for the zone around the phone is a failure, not a pause", async () => {
  expect(
    await downloadZone(URL_BASE, "foot", HERE, {
      apiKey: null,
      download: answering(429, { "Retry-After": "60" }),
    }),
  ).toEqual({ kind: "failed", why: "the server answered 429" });
  expect(prefetchPausedUntil()).toBe(0);
});

describe("the zones of the places the user keeps (TASK-334)", () => {
  test("beyond the limit they are neither counted nor deleted", () => {
    const zones = [
      { ...entry("kept", 50, 0), kept: true },
      entry("a", 5, 3),
      entry("b", 5, 1),
    ];
    expect(overLimit(zones, 10)).toEqual([]);
    expect(overLimit(zones, 5).map((zone) => zone.name)).toEqual(["b"]);
    expect(overLimit(zones, 0).map((zone) => zone.name)).toEqual(["b", "a"]);
  });

  test("a kept zone downloads to its own file and is saved as kept", async () => {
    const download = answering(200, zipHeaders(TRENTO), "0123456789");
    const answer = await downloadZone(URL_BASE, "foot", HERE, {
      apiKey: null,
      now: () => 1000,
      download,
      marginM: AROUND_MARGIN_M,
      kept: true,
    });
    expect(download.mock.calls[0][1]).toEqual(
      expect.stringContaining(".foot.place.download"),
    );
    expect(answer).toEqual({
      kind: "saved",
      zone: { name: TRENTO, etag: '"1-2"', bytes: 10, usedAt: 1000, kept: true },
    });
    // Saved again around the phone, it stays kept.
    await downloadZone(URL_BASE, "foot", HERE, {
      apiKey: null,
      now: () => 2000,
      download: answering(200, zipHeaders(TRENTO, '"3-4"')),
    });
    expect(savedZones()).toEqual([
      { name: TRENTO, etag: '"3-4"', bytes: 4, usedAt: 2000, kept: true },
    ]);
  });

  test("a zone the phone has becomes kept with a 304", async () => {
    await downloadZone(URL_BASE, "foot", HERE, {
      apiKey: null,
      now: () => 1000,
      download: answering(200, zipHeaders(TRENTO)),
    });
    expect(savedZones()[0].kept).toBeUndefined();
    const answer = await downloadZone(URL_BASE, "foot", HERE, {
      apiKey: null,
      now: () => 2000,
      download: answering(304, { ETag: '"1-2"' }),
      kept: true,
    });
    expect(answer).toMatchObject({ kind: "unchanged", zone: { name: TRENTO } });
    expect(savedZones()[0]).toEqual(
      expect.objectContaining({ usedAt: 2000, kept: true }),
    );
  });

  test("one zone is deleted with its file", async () => {
    for (const name of [TRENTO, TRENTO_BIKE]) {
      await downloadZone(URL_BASE, name.startsWith("bike") ? "bike" : "foot", HERE, {
        apiKey: null,
        now: () => 1000,
        download: answering(200, zipHeaders(name)),
      });
    }
    const gone = savedZones()[0];
    deleteZone(TRENTO);
    expect(savedZones().map((zone) => zone.name)).toEqual([TRENTO_BIKE]);
    expect(files.has(zoneUri(gone))).toBe(false);
  });
});
