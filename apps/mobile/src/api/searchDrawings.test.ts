import feed from "@shaperoute/shared-types/fixtures/feed.json";

import { searchDrawings, searchDrawingsPath } from "./searchDrawings";

test("nothing asked is the plain path", () => {
  expect(searchDrawingsPath({})).toBe("/search/drawings");
  expect(searchDrawingsPath({ q: "  ", sort: "recent", minM: 0 })).toBe(
    "/search/drawings",
  );
});

test("a list filter once for each value; `named` only with words", () => {
  const path = searchDrawingsPath({
    q: "cuore trento",
    named: ["heart"],
    shapes: ["heart", "word"],
    activities: ["running", "cycling"],
    minM: 10_000,
    maxM: 30_000,
    place: " Levico ",
    complexities: ["simple"],
    sort: "popular",
    cursor: "popular-3-0123",
  });
  const query = new URLSearchParams(path.split("?")[1]);
  expect(path.startsWith("/search/drawings?")).toBe(true);
  expect(query.get("q")).toBe("cuore trento");
  expect(query.getAll("named")).toEqual(["heart"]);
  expect(query.getAll("shape")).toEqual(["heart", "word"]);
  expect(query.getAll("activity")).toEqual(["running", "cycling"]);
  expect(query.get("min_m")).toBe("10000");
  expect(query.get("max_m")).toBe("30000");
  expect(query.get("place")).toBe("Levico");
  expect(query.getAll("complexity")).toEqual(["simple"]);
  expect(query.get("sort")).toBe("popular");
  expect(query.get("cursor")).toBe("popular-3-0123");
  expect(searchDrawingsPath({ named: ["heart"] })).toBe("/search/drawings");
});

test("GET with the token; a page is the feed's", async () => {
  const fetchFn = jest.fn(async () => Response.json(feed));
  const outcome = await searchDrawings(
    "http://api",
    "tok",
    { q: "star" },
    { fetchFn: fetchFn as unknown as typeof fetch, key: null },
  );
  expect(outcome.kind).toBe("ok");
  const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("http://api/search/drawings?q=star");
  expect(init.method).toBe("GET");
  expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
});
