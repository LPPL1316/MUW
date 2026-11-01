import list from "@shaperoute/shared-types/fixtures/recommended-routes.json";

import type { RecommendedRoute } from "../explore/recommendedRoutes";
import { fetchRecommendedRow, recommendedRowUrl, ROW_SIZE } from "./recommended";

const API = "http://api.test";
const TRENTO: [number, number] = [46.067, 11.1215];
const routes = list.routes as RecommendedRoute[];

function answering(response: Response | Error) {
  return jest.fn((_url: RequestInfo | URL, _init?: RequestInit) =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
}

test("the row is asked near a point, as the other rows, ten at most", () => {
  expect(recommendedRowUrl(API, TRENTO)).toBe(
    `${API}/recommended?lat=46.07&lon=11.12&radius_m=5000&limit=${ROW_SIZE}`,
  );
  expect(ROW_SIZE).toBe(10);
});

test("the row comes with the session token and the API key", async () => {
  const fetchFn = answering(Response.json(list));
  const row = await fetchRecommendedRow(API, TRENTO, "tok", { fetchFn, key: "k" });
  expect(row).toEqual(routes);
  const headers = fetchFn.mock.calls[0][1]?.headers as Record<string, string>;
  expect(headers.Authorization).toBe("Bearer tok");
  expect(headers["X-API-Key"]).toBe("k");
});

test("never more than a row", async () => {
  const many = Array.from({ length: 15 }, (_, i) => ({ ...routes[0], id: `r${i}` }));
  const fetchFn = answering(Response.json({ routes: many }));
  const row = await fetchRecommendedRow(API, TRENTO, "tok", { fetchFn });
  expect(row.map((r) => r.id)).toEqual(many.slice(0, ROW_SIZE).map((r) => r.id));
});

test.each([
  ["no network", new TypeError("Network request failed")],
  [
    "signed out on the API",
    Response.json({ error: { code: "not_signed_in" } }, { status: 401 }),
  ],
  ["an API without the row", Response.json({ detail: "Not Found" }, { status: 404 })],
  [
    "no database",
    Response.json({ error: { code: "accounts_unavailable" } }, { status: 503 }),
  ],
  ["a body it does not know", Response.json({ routes: [{ id: 3 }] })],
  ["not JSON", new Response("<html>", { status: 200 })],
])("%s: no row, and nothing thrown", async (_, response) => {
  const fetchFn = answering(response);
  await expect(fetchRecommendedRow(API, TRENTO, "tok", { fetchFn })).resolves.toEqual(
    [],
  );
});
