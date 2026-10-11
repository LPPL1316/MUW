import {
  fetchNearbyCities,
  forgetNearby,
  knownNearby,
  MAX_NEARBY,
  nearbyKey,
} from "./nearbyCities";

const API = "http://api.test";
const CALDONAZZO: [number, number] = [46.0036, 11.2647];
const levico = {
  label: "Levico Terme, Trentino – Alto Adige/Südtirol, Italy",
  point: [46.0091259, 11.3017774],
  away_m: 2929,
};
const pergine = {
  label: "Pergine Valsugana, Trentino – Alto Adige/Südtirol, Italy",
  point: [46.0605291, 11.2406747],
  away_m: 6594,
};

beforeEach(forgetNearby);

function answering(body: unknown, status = 200): jest.Mock {
  return jest.fn(() => Promise.resolve(Response.json(body, { status })));
}

test("the towns near the start, with the key, to about a kilometre (TASK-254), and no position kept twice", async () => {
  const fetchFn = answering({ places: [levico, pergine] });
  const towns = await fetchNearbyCities(API, CALDONAZZO, { fetchFn, key: "K" });
  // How far each is, measured here: Pergine's 6594 of the API becomes 6596.
  expect(towns).toEqual([levico, { ...pergine, away_m: 6596 }]);
  expect(fetchFn).toHaveBeenCalledWith(
    `${API}/nearby-cities?lat=46.00&lon=11.26`,
    expect.objectContaining({ headers: { "X-API-Key": "K" } }),
  );
  // The same square again, a few metres away: nothing is asked, and the
  // distances are from there.
  const moved = await fetchNearbyCities(API, [46.0012, 11.2629], { fetchFn });
  expect(moved?.map((town) => town.label)).toEqual(towns?.map((town) => town.label));
  expect(moved?.[0].away_m).toBeGreaterThan(towns?.[0].away_m ?? 0);
  expect(fetchFn).toHaveBeenCalledTimes(1);
  expect(knownNearby(API, CALDONAZZO)).toEqual(towns);
});

test("another square, or another API, asks again", async () => {
  const fetchFn = answering({ places: [levico] });
  await fetchNearbyCities(API, CALDONAZZO, { fetchFn });
  await fetchNearbyCities(API, [46.0679, 11.1211], { fetchFn });
  await fetchNearbyCities("http://other.test", CALDONAZZO, { fetchFn });
  expect(fetchFn).toHaveBeenCalledTimes(3);
  expect(nearbyKey(API, CALDONAZZO)).toBe(`${API} 46.00,11.26`);
});

test("six at most, and what does not read is left out", async () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ ...levico, label: `Town ${i}` }));
  const broken = [
    null,
    { label: "No point", away_m: 10 },
    { label: "", point: [46, 11], away_m: 10 },
    { label: "Three numbers", point: [46, 11, 0], away_m: 10 },
  ];
  const fetchFn = answering({ places: [...broken, ...many] });
  const towns = await fetchNearbyCities(API, CALDONAZZO, { fetchFn });
  expect(towns?.map((town) => town.label)).toEqual(
    Array.from({ length: MAX_NEARBY }, (_, i) => `Town ${i}`),
  );
});

test("a town's photo and its credit, when the API gives them (TASK-283)", async () => {
  const fetchFn = answering({
    places: [
      {
        ...levico,
        photo: { url: "/city-photos/Q1.jpg", credit: "© A · CC BY-SA 4.0" },
      },
      { ...pergine, photo: { url: "/city-photos/Q2.jpg", credit: null } },
    ],
  });
  const towns = await fetchNearbyCities(API, CALDONAZZO, { fetchFn });
  expect(towns?.map((town) => town.photo)).toEqual([
    { url: "/city-photos/Q1.jpg", credit: "© A · CC BY-SA 4.0" },
    { url: "/city-photos/Q2.jpg", credit: null },
  ]);
  // Kept with the towns: there again at once.
  expect(knownNearby(API, CALDONAZZO)?.[0].photo?.url).toBe("/city-photos/Q1.jpg");
});

test("a photo that does not read, or not on the API, is none: the town stays", async () => {
  const odd = [
    null,
    { photo: null },
    { photo: { credit: "x" } },
    { photo: { url: "https://elsewhere.test/a.jpg", credit: null } },
    { photo: { url: "//elsewhere.test/a.jpg", credit: null } },
    { photo: { url: "@elsewhere.test/a.jpg", credit: null } },
  ];
  const fetchFn = answering({
    places: odd.map((extra, i) => ({ ...levico, label: `Town ${i}`, ...extra })),
  });
  const towns = await fetchNearbyCities(API, CALDONAZZO, { fetchFn });
  expect(towns).toHaveLength(MAX_NEARBY);
  expect(towns?.every((town) => town.photo === undefined)).toBe(true);
});

test("no towns around is an answer, and is kept", async () => {
  const fetchFn = answering({ places: [] });
  expect(await fetchNearbyCities(API, CALDONAZZO, { fetchFn })).toEqual([]);
  expect(knownNearby(API, CALDONAZZO)).toEqual([]);
});

test("an API that does not answer is null, and is asked again", async () => {
  const off = answering({ error: { code: "unavailable", message: "off" } }, 503);
  expect(await fetchNearbyCities(API, CALDONAZZO, { fetchFn: off })).toBeNull();
  const odd = answering({ routes: [] });
  expect(await fetchNearbyCities(API, CALDONAZZO, { fetchFn: odd })).toBeNull();
  const down = jest.fn(() => Promise.reject(new Error("no network")));
  expect(await fetchNearbyCities(API, CALDONAZZO, { fetchFn: down })).toBeNull();
  expect(knownNearby(API, CALDONAZZO)).toBeNull();
  const fetchFn = answering({ places: [levico] });
  expect(await fetchNearbyCities(API, CALDONAZZO, { fetchFn })).toEqual([levico]);
});

test("how far a town is, and the order, are the phone's, from the start as it is (TASK-254)", async () => {
  // The API hears the start to about a kilometre ([46.00, 11.26]: 400 m
  // south and 360 m west of here) and measures from there. A town 1.2 km
  // north-east is 1.7 km for it; one 1.6 km south is 1.2 km for it.
  const northEast = {
    label: "North-east, Italy",
    point: [46.009, 11.27815],
    away_m: 1722,
  };
  const south = { label: "South, Italy", point: [45.98921, 11.2647], away_m: 1200 };
  const fetchFn = answering({ places: [south, northEast] });
  const towns = await fetchNearbyCities(API, CALDONAZZO, { fetchFn });
  expect(towns?.map((town) => town.label)).toEqual([
    "North-east, Italy",
    "South, Italy",
  ]);
  expect(towns?.[0].away_m).toBeGreaterThan(1150);
  expect(towns?.[0].away_m).toBeLessThan(1250);
  expect(towns?.[1].away_m).toBeGreaterThan(1550);
  expect(towns?.[1].away_m).toBeLessThan(1650);
  // A place without the API's distance is a town all the same.
  const { away_m: _, ...bare } = northEast;
  const spare = answering({ places: [bare] });
  expect(await fetchNearbyCities(API, [46.1, 11.1], { fetchFn: spare })).toHaveLength(
    1,
  );
});
