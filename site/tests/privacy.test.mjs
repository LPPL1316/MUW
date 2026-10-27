/**
 * The privacy pages: the same text as the app's «Privacy», in each of the
 * app's languages. `cd site && npm test`.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  LANGUAGES,
  folderOf,
  markedText,
  privacyPages,
} from "../tools/make_privacy.mjs";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const pages = await privacyPages();

test("the pages say what the app says: run make_privacy.mjs after a change there", () => {
  assert.deepEqual(Object.keys(pages).sort(), [
    "privacy/de/index.html",
    "privacy/es/index.html",
    "privacy/fr/index.html",
    "privacy/index.html",
    "privacy/it/index.html",
  ]);
  for (const [path, html] of Object.entries(pages)) {
    assert.equal(
      readFileSync(join(SITE, path), "utf8"),
      html,
      `${path} is out of date`,
    );
  }
});

test("each page is in its language and links to the others", () => {
  for (const language of LANGUAGES) {
    const html = pages[`${folderOf(language.code)}/index.html`];
    assert.ok(html.startsWith("<!doctype html>"));
    assert.match(html, new RegExp(`<html lang="${language.code}">`));
    assert.match(html, /<title>[^<]+ — MuW<\/title>/);
    assert.match(html, new RegExp(`aria-current="page">${language.name}</span>`));
    for (const other of LANGUAGES.filter((item) => item !== language)) {
      assert.ok(
        html.includes(`hreflang="${other.code}"`),
        `${language.code} → ${other.code}`,
      );
    }
  }
});

test("every page points at files that exist and loads nothing from elsewhere", () => {
  for (const [path, html] of Object.entries(pages)) {
    const folder = dirname(join(SITE, path));
    const targets = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map(
      (match) => match[1],
    );
    assert.ok(targets.length > 5);
    for (const target of targets) {
      assert.doesNotMatch(target, /^[a-z]+:/i, `${path}: ${target}`);
      assert.ok(existsSync(join(folder, target)), `${path}: ${target} is missing`);
    }
  }
});

test("the policy is final: its day, no draft notice, nothing left to fill (TASK-237 D, TASK-267 B)", () => {
  const days = {
    "privacy/index.html": "Last updated: 27 October 2026",
    "privacy/it/index.html": "Ultimo aggiornamento: 27 ottobre 2026",
    "privacy/de/index.html": "Zuletzt aktualisiert: 27. Oktober 2026",
    "privacy/fr/index.html": "Dernière mise à jour : 27 octobre 2026",
    "privacy/es/index.html": "Última actualización: 27 de octubre de 2026",
  };
  for (const [path, html] of Object.entries(pages)) {
    assert.ok(html.includes(`<p class="legal__updated">${days[path]}</p>`), path);
    assert.doesNotMatch(html, /legal__draft|class="placeholder"/, path);
    assert.ok(
      html.includes("Luca Pallaoro") && html.includes("muw2610@gmail.com"),
      path,
    );
    assert.doesNotMatch(html.replace(/<!--[\s\S]*?-->/, ""), /\[[^\]]+\]/, path);
  }
});

test("the policy says MuW has no ads: no AdMob, no ad network (TASK-267 B)", () => {
  for (const [path, html] of Object.entries(pages)) {
    assert.doesNotMatch(html, /AdMob/i, path);
  }
});

test("a draft would say so first, with its day, and mark what is left to fill", async () => {
  const { privacyPage } = await import("../tools/make_privacy.mjs");
  const html = privacyPage(
    LANGUAGES[0],
    {
      title: "Privacy policy",
      draft: true,
      updated: "1 May 2027",
      sections: [{ heading: "Who", blocks: ["Write to [contact email]."] }],
    },
    { draft: "Draft — not final yet.", updated: "Last updated: {date}" },
  );
  assert.match(
    html,
    /<div class="legal__draft" role="note"><strong>Draft — not final yet\.<\/strong><span>Last updated: 1 May 2027<\/span><\/div>/,
  );
  assert.ok(
    html.includes('Write to <mark class="placeholder">[contact email]</mark>.'),
  );
});

test("texts are escaped, places to fill marked", () => {
  assert.equal(
    markedText("Write to [contact email] <now> & then"),
    'Write to <mark class="placeholder">[contact email]</mark> &lt;now&gt; &amp; then',
  );
});

test("the home page links to the privacy page", () => {
  const html = readFileSync(join(SITE, "index.html"), "utf8");
  assert.ok(html.includes('<a class="foot__link" href="privacy/">Privacy</a>'));
});

test("the server's copy (DEPLOY.md F.14) takes every file the pages load", () => {
  const deploy = readFileSync(join(SITE, "..", "docs", "DEPLOY.md"), "utf8");
  const line = deploy.match(/git archive origin\/main ((?:site\/\S+ ?)+)\|/);
  assert.ok(line, "DEPLOY.md F.14 has the git archive line");
  const copied = line[1]
    .trim()
    .split(/\s+/)
    .map((path) => path.replace(/^site\//, ""));
  const loaded = new Set();
  const pagesToCheck = {
    "index.html": readFileSync(join(SITE, "index.html"), "utf8"),
    ...pages,
  };
  for (const [path, html] of Object.entries(pagesToCheck)) {
    loaded.add(path);
    for (const [, target] of html.matchAll(/\s(?:src|href)="([^"#]+)"/g)) {
      if (/^[a-z]+:/i.test(target)) {
        continue;
      }
      const file = join(dirname(path), target).replace(/\/$/, "/index.html");
      loaded.add(file === "." || file === "index.html/" ? "index.html" : file);
    }
  }
  // The scripts the page imports, and what they import, are under the same names.
  for (const file of [
    "main.js",
    "render.js",
    "content.js",
    "config.js",
    "data/drawings.js",
  ]) {
    loaded.add(file);
  }
  for (const file of loaded) {
    const normal =
      file === "./index.html" || file === "/index.html" ? "index.html" : file;
    assert.ok(
      copied.some((path) => normal === path || normal.startsWith(`${path}/`)),
      `${normal} is not in the copy of DEPLOY.md F.14`,
    );
  }
});
