import { files } from "./memoryFiles";
import {
  addPlace,
  forgetPlaces,
  keepPlaces,
  type KeptPlace,
  LATER_MS,
  MAX_PLACES,
  readPlaces,
  removePlace,
  watchPlaces,
} from "./keptPlaces";
import { phoneId } from "./prefetch";
import {
  AROUND_MARGIN_M,
  savedZones,
  type ZoneDownload,
  type ZoneEntry,
  zoneUri,
} from "./zones";

jest.mock("expo-file-system", () => jest.requireActual("./memoryFiles"));
jest.mock("expo-file-system/legacy", () => ({ createDownloadResumable: jest.fn() }));

const BASE = "https://api.example";
const LEVICO: [number, number] = [46.0122, 11.2986];
const RIVA: [number, number] = [45.8858, 10.8411];
const LEVICO_ZONE = "foot_45.95830_11.22070_46.06620_11.37660.zone.json.gz";
const RIVA_ZONE = "foot_45.83180_10.76370_45.93980_10.91860.zone.json.gz";
const NOW = 1_000_000;

function saveZone(name: string, bytes = 6_000_000): ZoneEntry {
  const zone: ZoneEntry = { name, etag: '"1-2"', bytes, usedAt: NOW, kept: true };
  const zones = [...savedZones().filter((each) => each.name !== name), zone];
  files.set("file:///documents/engine/zones.json", JSON.stringify({ zones }));
  files.set(zoneUri(zone), "zone");
  return zone;
}

/** A download that saves `name`, as downloadZone leaves it. */
function saving(name: string) {
  return jest.fn(async (): Promise<ZoneDownload> => ({
    kind: "saved",
    zone: saveZone(name),
  }));
}

function answering(status: number, headers: Record<string, string> = {}) {
  return jest.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(status === 200 || status === 202 ? '{"state":"ready"}' : "{}", {
        status,
        headers,
      }),
  );
}

function only(): KeptPlace {
  const places = readPlaces();
  expect(places).toHaveLength(1);
  return places[0];
}

beforeEach(() => {
  files.clear();
});

test("a place is added once, for its network, and at most ten", () => {
  expect(addPlace("Levico Terme, Trentino", LEVICO, "foot")).toBe("added");
  expect(addPlace("Levico Terme, Trentino", LEVICO, "foot")).toBe("already");
  expect(addPlace("Levico Terme, Trentino", LEVICO, "bike")).toBe("added");
  expect(readPlaces()).toEqual([
    {
      label: "Levico Terme, Trentino",
      point: LEVICO,
      network: "foot",
      zone: null,
      status: "preparing",
      waitUntil: 0,
    },
    expect.objectContaining({ network: "bike" }),
  ]);
  for (let n = 2; n < MAX_PLACES; n += 1) {
    expect(addPlace(`Place ${n}`, [45 + n / 100, 11], "foot")).toBe("added");
  }
  expect(addPlace("Riva del Garda", RIVA, "foot")).toBe("full");
  expect(readPlaces()).toHaveLength(MAX_PLACES);
});

test("a place the server has ready is downloaded and kept", async () => {
  addPlace("Levico Terme", LEVICO, "foot");
  const fetchFn = answering(200);
  const download = saving(LEVICO_ZONE);
  await keepPlaces(BASE, { fetchFn, download, apiKey: "key", now: () => NOW });
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe(`${BASE}/phone-zones/foot/places`);
  expect(init?.method).toBe("POST");
  expect(JSON.parse(String(init?.body))).toEqual({ lat: 46.0122, lon: 11.2986 });
  expect(init?.headers).toEqual({
    "Content-Type": "application/json",
    "X-API-Key": "key",
    "X-Phone-Id": phoneId(),
  });
  expect(download.mock.calls).toEqual([
    [
      BASE,
      "foot",
      LEVICO,
      {
        apiKey: "key",
        now: expect.any(Function),
        marginM: AROUND_MARGIN_M,
        kept: true,
      },
    ],
  ]);
  expect(only()).toEqual(
    expect.objectContaining({ zone: LEVICO_ZONE, status: "ready", waitUntil: 0 }),
  );
  // Ready: not asked again.
  await keepPlaces(BASE, { fetchFn, download, now: () => NOW });
  expect(fetchFn).toHaveBeenCalledTimes(1);
});

test("a place being prepared is asked again, and downloaded once ready", async () => {
  addPlace("Riva del Garda", RIVA, "foot");
  const download = saving(RIVA_ZONE);
  await keepPlaces(BASE, { fetchFn: answering(202), download, now: () => NOW });
  expect(download).not.toHaveBeenCalled();
  expect(only().status).toBe("preparing");
  await keepPlaces(BASE, { fetchFn: answering(200), download, now: () => NOW });
  expect(only()).toEqual(expect.objectContaining({ zone: RIVA_ZONE, status: "ready" }));
});

test("after a 429 or a 503 the place waits for Retry-After", async () => {
  addPlace("Riva del Garda", RIVA, "foot");
  const download = saving(RIVA_ZONE);
  const refused = answering(429, { "Retry-After": "600" });
  await keepPlaces(BASE, { fetchFn: refused, download, now: () => NOW });
  expect(only()).toEqual(
    expect.objectContaining({ status: "later", waitUntil: NOW + 600_000 }),
  );
  const busy = answering(503, { "Retry-After": "3600" });
  await keepPlaces(BASE, { fetchFn: busy, download, now: () => NOW + 599_999 });
  expect(busy).not.toHaveBeenCalled();
  await keepPlaces(BASE, { fetchFn: busy, download, now: () => NOW + 600_000 });
  expect(only()).toEqual(
    expect.objectContaining({ status: "later", waitUntil: NOW + 600_000 + 3_600_000 }),
  );
  expect(download).not.toHaveBeenCalled();
});

test("a server without the places gives what it has there, else later", async () => {
  addPlace("Levico Terme", LEVICO, "foot");
  addPlace("Riva del Garda", RIVA, "foot");
  const old = answering(404);
  const download = jest.fn(
    async (
      _base: string,
      _network: string,
      point: [number, number],
    ): Promise<ZoneDownload> =>
      point[0] === LEVICO[0]
        ? { kind: "saved", zone: saveZone(LEVICO_ZONE) }
        : { kind: "none" },
  );
  await keepPlaces(BASE, { fetchFn: old, download, now: () => NOW });
  expect(readPlaces().map(({ status, waitUntil }) => [status, waitUntil])).toEqual([
    ["ready", 0],
    ["later", NOW + LATER_MS],
  ]);
});

test("a download that failed is tried again at the next call", async () => {
  addPlace("Levico Terme", LEVICO, "foot");
  const failed = jest.fn(async (): Promise<ZoneDownload> => ({
    kind: "failed",
    why: "the download stopped",
  }));
  await keepPlaces(BASE, { fetchFn: answering(200), download: failed, now: () => NOW });
  expect(only()).toEqual(
    expect.objectContaining({ status: "preparing", waitUntil: 0 }),
  );
});

test("offline, nothing changes and the other places are not asked", async () => {
  addPlace("Levico Terme", LEVICO, "foot");
  addPlace("Riva del Garda", RIVA, "foot");
  const offline = jest.fn(async () => {
    throw new TypeError("Network request failed");
  });
  const download = saving(LEVICO_ZONE);
  await keepPlaces(BASE, { fetchFn: offline, download, now: () => NOW });
  expect(offline).toHaveBeenCalledTimes(1);
  expect(readPlaces().map((place) => place.status)).toEqual(["preparing", "preparing"]);
});

test("a call while one is going waits for that one", async () => {
  addPlace("Levico Terme", LEVICO, "foot");
  const fetchFn = answering(202);
  const first = keepPlaces(BASE, { fetchFn, now: () => NOW });
  const second = keepPlaces(BASE, { fetchFn, now: () => NOW });
  expect(second).toBe(first);
  await first;
  expect(fetchFn).toHaveBeenCalledTimes(1);
});

test("a ready place whose zone is gone is prepared again", () => {
  addPlace("Levico Terme", LEVICO, "foot");
  const ready = { ...readPlaces()[0], zone: LEVICO_ZONE, status: "ready" };
  files.set(
    "file:///documents/engine/places.json",
    JSON.stringify({ places: [ready] }),
  );
  expect(only().status).toBe("preparing");
  expect(only().zone).toBeNull();
  saveZone(LEVICO_ZONE);
  expect(only().status).toBe("ready");
});

test("removing a place deletes its zone, unless another place keeps it", async () => {
  addPlace("Levico Terme", LEVICO, "foot");
  addPlace("Levico", [46.0123, 11.2987], "foot");
  addPlace("Riva del Garda", RIVA, "foot");
  const download = jest.fn(
    async (
      _base: string,
      _network: string,
      point: [number, number],
    ): Promise<ZoneDownload> => ({
      kind: "saved",
      zone: saveZone(point[0] === RIVA[0] ? RIVA_ZONE : LEVICO_ZONE),
    }),
  );
  await keepPlaces(BASE, { fetchFn: answering(200), download, now: () => NOW });
  removePlace(0);
  expect(savedZones().map((zone) => zone.name)).toEqual([LEVICO_ZONE, RIVA_ZONE]);
  removePlace(0);
  expect(savedZones().map((zone) => zone.name)).toEqual([RIVA_ZONE]);
  expect(readPlaces().map((place) => place.label)).toEqual(["Riva del Garda"]);
  removePlace(5); // no such place: nothing
  expect(readPlaces()).toHaveLength(1);
});

test("the watchers hear every change, and «Delete» forgets the places", () => {
  const heard = jest.fn();
  const stop = watchPlaces(heard);
  addPlace("Levico Terme", LEVICO, "foot");
  forgetPlaces();
  expect(readPlaces()).toEqual([]);
  expect(heard).toHaveBeenCalledTimes(2);
  stop();
  addPlace("Levico Terme", LEVICO, "foot");
  expect(heard).toHaveBeenCalledTimes(2);
});

test("a list that does not read is no list", () => {
  files.set("file:///documents/engine/places.json", "{");
  expect(readPlaces()).toEqual([]);
  files.set(
    "file:///documents/engine/places.json",
    JSON.stringify({ places: [{ label: "x" }, null, 3] }),
  );
  expect(readPlaces()).toEqual([]);
});
