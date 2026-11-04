import list from "@shaperoute/shared-types/fixtures/muw-routes.json";

import { fetchMuwRoutes, isMuwRoute } from "./muwRoutes";

const API = "http://api.test";

function answering(response: Response | Error) {
  return jest.fn((_url: RequestInfo | URL, _init?: RequestInit) =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
}

test("the routes come with the API key, without a token", async () => {
  const fetchFn = answering(Response.json(list));
  const routes = await fetchMuwRoutes(API, { fetchFn, key: "k" });
  expect(routes).toEqual(list.routes);
  expect(fetchFn.mock.calls[0][0]).toBe(`${API}/muw-routes`);
  const headers = fetchFn.mock.calls[0][1]?.headers as Record<string, string>;
  expect(headers["X-API-Key"]).toBe("k");
  expect(headers.Authorization).toBeUndefined();
});

test.each([
  ["no network", new TypeError("Network request failed")],
  ["an API before TASK-365", Response.json({ detail: "Not Found" }, { status: 404 })],
  ["a body it does not know", Response.json({ routes: "none" })],
  ["no body", new Response("not json")],
])("%s is no route, and never an error", async (_, answer) => {
  await expect(fetchMuwRoutes(API, { fetchFn: answering(answer) })).resolves.toEqual(
    [],
  );
});

test("a route it cannot show is left out, the others kept", async () => {
  const good = list.routes[0];
  const fetchFn = answering(
    Response.json({
      routes: [good, { ...good, id: "x", activity: "flying" }, { id: 3 }],
    }),
  );
  expect((await fetchMuwRoutes(API, { fetchFn })).map((r) => r.id)).toEqual([good.id]);
});

test("a route needs a title in English and a line", () => {
  const good = list.routes[0];
  expect(isMuwRoute(good)).toBe(true);
  expect(isMuwRoute({ ...good, titles: { it: "Stella" } })).toBe(false);
  expect(isMuwRoute({ ...good, preview: [good.start] })).toBe(false);
});
