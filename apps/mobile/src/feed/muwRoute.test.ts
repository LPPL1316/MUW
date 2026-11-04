import route from "@shaperoute/shared-types/fixtures/muw-route.json";
import list from "@shaperoute/shared-types/fixtures/muw-routes.json";
import type { MuwRoute } from "@shaperoute/shared-types";

import { toRequest } from "../explore/explored";
import { fetchMuwRoute, muwCardRoute, muwDetail } from "./muwRoute";

const CARD = list.routes[0] as unknown as MuwRoute;
const answering = (body: unknown, status = 200) =>
  jest.fn(() => Promise.resolve(Response.json(body, { status })));

test("a card opens as a route of «Explore», never with a catalogue id", () => {
  const shown = muwCardRoute(CARD);
  expect(shown.id).toBe("muw:star");
  expect(shown.shape).toBe("star");
  expect(shown.preview).toEqual(CARD.preview);
  expect(shown.rotation_deg).toBe(-30);
});

test("whole, it is planned again as a bike route of its shape", async () => {
  const fetchFn = answering(route);
  const whole = await fetchMuwRoute(CARD, { fetchFn, key: "k" })("http://api", "x");
  expect(fetchFn).toHaveBeenCalledWith("http://api/muw-routes/star", {
    headers: { "X-API-Key": "k" },
  });
  expect(whole.kind).toBe("route");
  if (whole.kind !== "route") return;
  expect(toRequest(whole.route)).toEqual({
    start: route.points[0],
    distance_m: route.route_m,
    activity: "cycling",
    shape: "star",
  });
});

test("a figure the catalogue does not have is asked with its outline", () => {
  const outline: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, -1],
  ];
  const detail = muwDetail({ ...route, shape: "boot", outline } as never);
  expect(toRequest(detail)).toMatchObject({ outline });
});

test("a word is asked as a word", () => {
  const detail = muwDetail({
    ...route,
    shape: null,
    word: "GO",
    style: "round",
  } as never);
  expect(toRequest(detail)).toMatchObject({ word: "GO", style: "round" });
});

test.each([
  ["a 404", answering({ detail: "Not Found" }, 404)],
  ["a file without its figure", answering({ ...route, shape: null, word: null })],
  ["no network", jest.fn(() => Promise.reject(new TypeError("offline")))],
])("%s fails as a route that does not load", async (_, fetchFn) => {
  const whole = await fetchMuwRoute(CARD, { fetchFn })("http://api", "x");
  expect(whole).toEqual({ kind: "failed" });
});
