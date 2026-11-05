import type {
  StyleGender,
  StylePage,
  StylePost,
  StyleShop,
  StyleTag,
  StyleTheme,
} from "@shaperoute/shared-types";

import { apiKey, keyHeaders } from "./apiUrl";

/**
 * MuW Style (TASK-384, ADR-0326): GET /style of docs/API.md, «Style», and the
 * two counts. Posts of MuW, not of a member: no token, since they say
 * nothing about who asks, and the counts are only a number for the day.
 * The bodies are packages/shared-types/fixtures/style-page.json and
 * style-post.json.
 */

type Options = { fetchFn?: typeof fetch; key?: string | null; signal?: AbortSignal };

/** What the lens asks: a theme, a gender, the page after `before`. */
export type StyleQuery = {
  theme?: StyleTheme | null;
  gender?: StyleGender | null;
  before?: string | null;
  limit?: number;
};

const THEMES = new Set(["running", "trail", "bike", "gym", "athleisure"]);
const GENDERS = new Set(["women", "men"]);
const RETAILERS = new Set(["zalando", "amazon", "decathlon"]);

function isFraction(value: unknown): boolean {
  return typeof value === "number" && value >= 0 && value <= 1;
}

/** A dot the app can show: where it is, the product and its shop. */
export function isStyleTag(value: unknown): value is StyleTag {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "number" &&
    isFraction(r.x) &&
    isFraction(r.y) &&
    typeof r.item === "string" &&
    typeof r.brand === "string" &&
    typeof r.product_name === "string" &&
    typeof r.retailer === "string" &&
    RETAILERS.has(r.retailer) &&
    (r.price_eur === null || typeof r.price_eur === "number") &&
    (r.price_seen_on === null || typeof r.price_seen_on === "string")
  );
}

/** A post the app can show: a photo and at least one dot it knows. */
export function isStylePost(value: unknown): value is StylePost {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.theme === "string" &&
    THEMES.has(r.theme) &&
    typeof r.gender === "string" &&
    GENDERS.has(r.gender) &&
    typeof r.title === "object" &&
    r.title !== null &&
    typeof r.image_url === "string" &&
    r.image_url.startsWith("/") &&
    typeof r.published_at === "string" &&
    Array.isArray(r.tags) &&
    r.tags.some(isStyleTag)
  );
}

/** The post with only the dots the app knows. */
function shownPost(post: StylePost): StylePost {
  return { ...post, tags: post.tags.filter(isStyleTag) };
}

/**
 * One page of posts, the newest first. Null when it cannot be read (no
 * network, an API before TASK-384 that answers 404, a body it does not
 * know): the Feed is then as before. Never throws.
 */
export async function fetchStylePage(
  baseUrl: string,
  query: StyleQuery = {},
  { fetchFn = fetch, key = apiKey(), signal }: Options = {},
): Promise<StylePage | null> {
  const params = new URLSearchParams();
  if (query.theme) {
    params.set("theme", query.theme);
  }
  if (query.gender) {
    params.set("gender", query.gender);
  }
  if (query.before) {
    params.set("before", query.before);
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  const search = params.toString();
  try {
    const response = await fetchFn(`${baseUrl}/style${search ? `?${search}` : ""}`, {
      headers: keyHeaders(key),
      signal,
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as Partial<StylePage> | null;
    if (!Array.isArray(body?.posts)) {
      return null;
    }
    return {
      posts: body.posts.filter(isStylePost).map(shownPost),
      before: typeof body.before === "string" ? body.before : null,
    };
  } catch {
    return null;
  }
}

/** The photo of a post, asked with the key: without it the API answers 401. */
export function styleImageSource(
  baseUrl: string,
  post: Pick<StylePost, "image_url">,
  key: string | null = apiKey(),
): { uri: string; headers: Record<string, string> } {
  return { uri: `${baseUrl}${post.image_url}`, headers: keyHeaders(key) };
}

/**
 * One more opening of a product for the day. Nothing comes back, and
 * nothing goes wrong for the user when it is not counted.
 */
export async function countStyleOpen(
  baseUrl: string,
  tagId: number,
  { fetchFn = fetch, key = apiKey() }: Options = {},
): Promise<void> {
  try {
    await fetchFn(`${baseUrl}/style/tags/${tagId}/open`, {
      method: "POST",
      headers: keyHeaders(key),
    });
  } catch {
    // Only a count.
  }
}

/**
 * «Shop»: one more for the day, and the page to open, the shop's or Awin's
 * link to it. Null when the API does not answer one: only an https page is
 * opened.
 */
export async function fetchStyleShop(
  baseUrl: string,
  tagId: number,
  { fetchFn = fetch, key = apiKey() }: Options = {},
): Promise<string | null> {
  try {
    const response = await fetchFn(`${baseUrl}/style/tags/${tagId}/shop`, {
      method: "POST",
      headers: keyHeaders(key),
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as Partial<StyleShop> | null;
    return typeof body?.url === "string" && body.url.startsWith("https://")
      ? body.url
      : null;
  } catch {
    return null;
  }
}
