import page from "@shaperoute/shared-types/fixtures/style-page.json";
import post from "@shaperoute/shared-types/fixtures/style-post.json";

import { API_KEY_HEADER } from "./apiUrl";
import {
  countStyleOpen,
  fetchStylePage,
  fetchStyleShop,
  isStylePost,
  styleImageSource,
} from "./style";

const API = "http://api";
const answering = (body: unknown, status = 200) =>
  jest.fn<Promise<Response>, Parameters<typeof fetch>>(() =>
    Promise.resolve(Response.json(body, { status })),
  );

test("a page of the shared fixture is read as it is", async () => {
  const fetchFn = answering(page);
  expect(await fetchStylePage(API, {}, { fetchFn, key: "k" })).toEqual(page);
  expect(fetchFn).toHaveBeenCalledWith(`${API}/style`, {
    headers: { [API_KEY_HEADER]: "k" },
    signal: undefined,
  });
});

test("the lens asks its theme, gender and page", async () => {
  const fetchFn = answering(page);
  await fetchStylePage(
    API,
    { theme: "trail", gender: "women", before: "MS-002", limit: 20 },
    { fetchFn, key: null },
  );
  expect(fetchFn.mock.calls[0][0]).toBe(
    `${API}/style?theme=trail&gender=women&before=MS-002&limit=20`,
  );
});

test.each([
  ["an API before Style", answering({ error: {} }, 404)],
  ["a body it does not know", answering({ routes: [] })],
  ["no network", jest.fn(() => Promise.reject(new Error("offline")))],
])("%s is no page, never an error", async (_, fetchFn) => {
  expect(await fetchStylePage(API, {}, { fetchFn, key: null })).toBeNull();
});

test("a post without a dot the app knows, or of a theme it does not, is left out", async () => {
  const strange = {
    ...post,
    id: "MS-002",
    tags: [{ ...post.tags[0], retailer: "shein" }],
  };
  const swim = { ...post, id: "MS-003", theme: "swimming" };
  const fetchFn = answering({ posts: [post, strange, swim], before: null });
  const read = await fetchStylePage(API, {}, { fetchFn, key: null });
  expect(read?.posts.map((p) => p.id)).toEqual(["MS-001"]);
  expect(isStylePost({ ...post, image_url: "https://elsewhere/x.jpg" })).toBe(false);
});

test("the photo is asked with the key", () => {
  expect(styleImageSource(API, post, "k")).toEqual({
    uri: `${API}/style/MS-001/image`,
    headers: { [API_KEY_HEADER]: "k" },
  });
});

test("opening a product is one POST, and a failure is silent", async () => {
  const fetchFn = jest.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  await countStyleOpen(API, 1, { fetchFn, key: null });
  expect(fetchFn).toHaveBeenCalledWith(`${API}/style/tags/1/open`, {
    method: "POST",
    headers: {},
  });
  const failing = jest.fn(() => Promise.reject(new Error("offline")));
  await expect(countStyleOpen(API, 1, { fetchFn: failing })).resolves.toBeUndefined();
});

test("«Shop» answers the page to open, only an https one", async () => {
  const page = "https://www.zalando.it/x.html";
  expect(await fetchStyleShop(API, 1, { fetchFn: answering({ url: page }) })).toBe(
    page,
  );
  expect(
    await fetchStyleShop(API, 1, {
      fetchFn: answering({ url: "javascript:alert(1)" }),
    }),
  ).toBeNull();
  expect(await fetchStyleShop(API, 9, { fetchFn: answering({}, 404) })).toBeNull();
});
