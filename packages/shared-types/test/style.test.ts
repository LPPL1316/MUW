import assert from "node:assert/strict";
import { test } from "node:test";

import post from "../fixtures/style-post.json" with { type: "json" };
import page from "../fixtures/style-page.json" with { type: "json" };
import { STYLE_THEMES, type StylePage, type StylePost } from "../src/index.ts";

// The same JSON is what the API's test_style_posts.py answers (TASK-384).
test("the fixtures are the types", () => {
  const one = post as unknown as StylePost;
  const list = page as unknown as StylePage;
  assert.deepEqual(list.posts[0], one);
  assert.equal(list.before, null);
  assert.ok(STYLE_THEMES.includes(one.theme));
  assert.deepEqual(Object.keys(one.title).sort(), ["de", "en", "es", "fr", "it"]);
});

test("an old price is not said", () => {
  const [jacket, shoes] = (post as unknown as StylePost).tags;
  assert.equal(jacket?.price_eur, 84.99);
  assert.equal(shoes?.price_eur, null);
  assert.equal(shoes?.price_seen_on, null);
});
