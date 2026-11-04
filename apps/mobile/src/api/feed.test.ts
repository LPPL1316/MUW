import page from "@shaperoute/shared-types/fixtures/feed.json";
import { FEED_PAGE_SIZE } from "@shaperoute/shared-types";

import { answers, apiError } from "../account/testing";
import { feedPath, fetchFeed, isFeedPage, isFeedPost } from "./feed";

const URL = "http://api";
const TOKEN = "the-token";
const AUTH = { Authorization: `Bearer ${TOKEN}` };
const options = (fetchFn: jest.Mock) => ({ fetchFn, key: null });

test("the example of the API is what the app reads", () => {
  expect(isFeedPage(page)).toBe(true);
  expect(page.posts).toHaveLength(2);
  expect(isFeedPost(page.posts[0])).toBe(true);
  // A post is a drawing of a profile's list, with its author.
  expect(isFeedPost({ ...page.posts[0], author: null })).toBe(false);
  expect(isFeedPost({ ...page.posts[0], author: { username: "x" } })).toBe(false);
  expect(isFeedPost({ ...page.posts[0], track_preview: [[46]] })).toBe(false);
  // A run without a route or a title, drawn with a word, on a bike.
  expect(page.posts[1]).toMatchObject({
    title: null,
    shape: null,
    word: "ciao",
    score: null,
    activity: "cycling",
  });
  expect(isFeedPage({ ...page, next: null })).toBe(true);
  expect(isFeedPage({ ...page, next: 3 })).toBe(false);
  expect(isFeedPage({ posts: [{}], next: null })).toBe(false);
  expect(isFeedPage({ next: null })).toBe(false);
  expect(FEED_PAGE_SIZE).toBe(20);
});

test("the query says where the phone is, then the cursor", () => {
  expect(feedPath({})).toBe("/feed");
  expect(feedPath({ cursor: null, near: null })).toBe("/feed");
  expect(feedPath({ near: [46.0671, 11.1214] })).toBe("/feed?lat=46.07&lon=11.12");
  expect(feedPath({ cursor: page.next })).toBe(`/feed?cursor=${page.next}`);
  expect(feedPath({ cursor: page.next, near: [46.0671, 11.1214] })).toBe(
    `/feed?lat=46.07&lon=11.12&cursor=${page.next}`,
  );
});

test("the point never leaves the phone with more than two decimals", () => {
  expect(feedPath({ near: [-33.86785, 151.20732] })).toBe(
    "/feed?lat=-33.87&lon=151.21",
  );
  expect(feedPath({ near: [46.5, -0.001] })).toBe("/feed?lat=46.5&lon=0");
  // Every page of one read says the same point.
  const near: [number, number] = [46.0671, 11.1214];
  const first = new URLSearchParams(feedPath({ near }).split("?")[1]);
  const next = new URLSearchParams(feedPath({ near, cursor: page.next }).split("?")[1]);
  expect(next.get("lat")).toBe(first.get("lat"));
  expect(next.get("lon")).toBe(first.get("lon"));
});

test("a page is asked with the token, the next after the cursor", async () => {
  const fetchFn = answers(
    { status: 200, body: page },
    { status: 200, body: { ...page, next: null } },
  );
  const first = await fetchFeed(
    URL,
    TOKEN,
    { near: [46.0671, 11.1214] },
    options(fetchFn),
  );
  expect(first).toEqual({ kind: "ok", value: page });
  const second = await fetchFeed(
    URL,
    TOKEN,
    { cursor: page.next, near: [46.0671, 11.1214] },
    options(fetchFn),
  );
  expect(second).toEqual({ kind: "ok", value: { ...page, next: null } });
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe("http://api/feed?lat=46.07&lon=11.12");
  expect(init).toMatchObject({ method: "GET", headers: AUTH });
  expect(fetchFn.mock.calls[1][0]).toBe(
    `http://api/feed?lat=46.07&lon=11.12&cursor=${page.next}`,
  );
});

test("an older API without a feed, a session over, no network", async () => {
  const older = await fetchFeed(
    URL,
    TOKEN,
    {},
    options(answers({ status: 404, body: apiError("http_error") })),
  );
  expect(older).toMatchObject({ kind: "api_error", code: "http_error" });
  const ended = await fetchFeed(
    URL,
    TOKEN,
    {},
    options(answers({ status: 401, body: apiError("session_expired") })),
  );
  expect(ended).toMatchObject({ kind: "api_error", code: "session_expired" });
  const offline = await fetchFeed(
    URL,
    TOKEN,
    {},
    options(answers(new TypeError("Network request failed"))),
  );
  expect(offline).toMatchObject({ kind: "unreachable" });
  // An answer that is not a page.
  const odd = await fetchFeed(
    URL,
    TOKEN,
    {},
    options(answers({ status: 200, body: {} })),
  );
  expect(odd).toMatchObject({ kind: "bad_answer", status: 200 });
});
