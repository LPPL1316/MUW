import places from "@shaperoute/shared-types/fixtures/places.json";

import photon from "./fixtures/photon-via-belenzani-trento.json";
import { API_PAUSE_MS, isPlaces, placeFinder, placesUrl } from "./placeFinder";

const API = "http://100.84.99.112:8000";
const NEAR: [number, number] = [46.07, 11.12];

function reply(status: number, body: unknown): Response {
  return {
    ok: status === 200,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

/** The API at API answers `api`; anything else is Photon. */
function network(api: () => Promise<Response>) {
  return jest.fn((url: string) =>
    url.startsWith(API) ? api() : Promise.resolve(reply(200, photon)),
  ) as jest.Mock & typeof fetch;
}

function asked(fetchFn: jest.Mock): string[] {
  return fetchFn.mock.calls.map(([url]) => String(url));
}

test("the API's body is the shared contract", () => {
  expect(isPlaces(places)).toBe(true);
  expect(isPlaces({ places: [{ label: "A", point: [1] }] })).toBe(false);
  expect(isPlaces({ places: [{ label: 1, point: [1, 2] }] })).toBe(false);
  expect(isPlaces(null)).toBe(false);
});

test("the URL carries the text and the point", () => {
  expect(placesUrl(API, " via bel ", NEAR)).toBe(
    `${API}/places?q=via%20bel&lat=46.07&lon=11.12`,
  );
  expect(placesUrl(API, "trento", null)).toBe(`${API}/places?q=trento`);
});

test("places come from the API, with its key", async () => {
  const fetchFn = network(() => Promise.resolve(reply(200, places)));
  const find = placeFinder({ baseUrl: API, key: "k".repeat(16), fetchFn });
  expect(await find("via bel", NEAR)).toEqual(places.places);
  expect(asked(fetchFn)).toHaveLength(1);
  expect(fetchFn.mock.calls[0][1].headers).toEqual({ "X-API-Key": "k".repeat(16) });
});

test("without an API, Photon", async () => {
  const fetchFn = network(() => Promise.reject(new Error("not asked")));
  const find = placeFinder({ baseUrl: null, fetchFn });
  const found = await find("via bel", NEAR);
  expect(found[0].label).toBe("Via Rodolfo Belenzani, Trento");
  expect(asked(fetchFn)[0]).toContain("photon.komoot.io");
});

test("an API without the key is not asked again", async () => {
  const fetchFn = network(() => Promise.resolve(reply(503, {})));
  const find = placeFinder({ baseUrl: API, fetchFn });
  await find("via bel", NEAR);
  await find("via bele", NEAR);
  expect(asked(fetchFn).filter((url) => url.startsWith(API))).toHaveLength(1);
  expect(asked(fetchFn).filter((url) => url.includes("photon"))).toHaveLength(2);
});

test("an API that fails or is slow gives Photon, and is left alone a few minutes", async () => {
  jest.useFakeTimers();
  try {
    // The API never answers; the abort rejects, as fetch does.
    const fetchFn = jest.fn((url: string, init?: RequestInit) =>
      url.startsWith(API)
        ? new Promise<Response>((_, reject) =>
            init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
          )
        : Promise.resolve(reply(200, photon)),
    ) as jest.Mock & typeof fetch;
    const find = placeFinder({ baseUrl: API, fetchFn, timeoutMs: 100 });
    const fromApi = () => asked(fetchFn).filter((url) => url.startsWith(API));
    const found = find("via bel", NEAR);
    await jest.advanceTimersByTimeAsync(100);
    expect((await found)[0].label).toBe("Via Rodolfo Belenzani, Trento");
    // The next letters go to Photon at once (TASK-287): no wait for the API.
    expect((await find("via bele", NEAR))[0].label).toBe(
      "Via Rodolfo Belenzani, Trento",
    );
    expect(fromApi()).toHaveLength(1);
    // A few minutes later the API is asked again.
    await jest.advanceTimersByTimeAsync(API_PAUSE_MS);
    const again = find("via belen", NEAR);
    await jest.advanceTimersByTimeAsync(100);
    await again;
    expect(fromApi()).toHaveLength(2);
  } finally {
    jest.useRealTimers();
  }
});
