/**
 * The account-deletion pages (TASK-294 C): the steps to delete a MuW
 * account, what is deleted and what stays, in each of the app's languages.
 * `cd site && npm test`.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { CONTACT, DAYS, DELETION } from "../tools/account_deletion_text.mjs";
import { PAGE, deletionPages } from "../tools/make_account_deletion.mjs";
import { LANGUAGES, folderOf } from "../tools/make_support.mjs";
import { CONTACT as SUPPORT_CONTACT } from "../tools/support_text.mjs";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP_EN = join(SITE, "..", "apps", "mobile", "src", "about", "content", "en.ts");
const pages = deletionPages();

test("the pages match their texts: run make_account_deletion.mjs after a change", () => {
  assert.deepEqual(Object.keys(pages).sort(), [
    "account-deletion/de/index.html",
    "account-deletion/es/index.html",
    "account-deletion/fr/index.html",
    "account-deletion/index.html",
    "account-deletion/it/index.html",
  ]);
  for (const [path, html] of Object.entries(pages)) {
    assert.equal(readFileSync(join(SITE, path), "utf8"), html, `${path} is out of date`);
  }
});

test("every language has the same parts", () => {
  const english = DELETION.en;
  for (const language of LANGUAGES) {
    const text = DELETION[language.code];
    for (const key of [
      "title",
      "intro",
      "inAppHeading",
      "inAppNote",
      "emailHeading",
      "emailText",
      "emailNote",
      "deletedHeading",
      "backupNote",
      "keptHeading",
      "partialHeading",
      "partialText",
      "privacy",
      "privacyLine",
    ]) {
      assert.ok(typeof text[key] === "string" && text[key].trim(), `${language.code}: ${key}`);
    }
    for (const key of ["inAppSteps", "deleted", "kept"]) {
      assert.equal(text[key].length, english[key].length, `${language.code}: ${key}`);
      for (const item of text[key]) {
        assert.ok(item.trim(), `${language.code}: ${key}`);
      }
    }
    // What Google Play asks of the page: the app's name, and the days.
    assert.ok(text.intro.includes("MuW"), `${language.code}: names the app`);
    assert.ok(text.emailNote.includes(String(DAYS)), `${language.code}: the days`);
    assert.ok(text.backupNote.includes("13") && text.backupNote.includes("14"), language.code);
  }
});

test("the steps name the app's buttons as the app shows them", () => {
  assert.ok(DELETION.en.inAppSteps[2].includes("«Delete account»"));
  assert.ok(DELETION.it.inAppSteps[2].includes("«Elimina account»"));
  assert.ok(DELETION.de.inAppSteps[2].includes("«Konto löschen»"));
  assert.ok(DELETION.fr.inAppSteps[2].includes("«Supprimer le compte»"));
  assert.ok(DELETION.es.inAppSteps[2].includes("«Eliminar cuenta»"));
  assert.ok(DELETION.en.inAppSteps[1].includes("«Settings»"));
  assert.ok(DELETION.it.inAppSteps[1].includes("«Impostazioni»"));
  assert.ok(DELETION.de.inAppSteps[1].includes("«Einstellungen»"));
  assert.ok(DELETION.fr.inAppSteps[1].includes("«Réglages»"));
  assert.ok(DELETION.es.inAppSteps[1].includes("«Ajustes»"));
});

test("what is deleted and what stays follow the privacy policy", () => {
  const privacy = readFileSync(APP_EN, "utf8");
  assert.ok(privacy.includes("kept for 13 days"), "the backups' 13 days");
  assert.ok(privacy.includes("out of every backup within 14 days"), "the 14 days");
  assert.ok(privacy.includes("The routes our engine drew stay"), "the routes stay");
  assert.ok(privacy.includes("the pieces you ran stay for the others, without your name"));
});

test("where to write is the address of the privacy policy and the support page", () => {
  assert.equal(CONTACT, SUPPORT_CONTACT);
  assert.ok(readFileSync(APP_EN, "utf8").includes(CONTACT), "the app's privacy text names it");
  for (const html of Object.values(pages)) {
    assert.ok(html.includes(`href="mailto:${CONTACT}">${CONTACT}</a>`));
  }
});

test("each page is in its language, links to the others and to its privacy page", () => {
  for (const language of LANGUAGES) {
    const html = pages[`${folderOf(PAGE, language.code)}/index.html`];
    assert.match(html, new RegExp(`<html lang="${language.code}">`));
    assert.ok(html.includes(`<title>${DELETION[language.code].title} — MuW</title>`));
    assert.match(html, new RegExp(`aria-current="page">${language.name}</span>`));
    for (const other of LANGUAGES.filter((item) => item !== language)) {
      assert.ok(html.includes(`hreflang="${other.code}"`), `${language.code} → ${other.code}`);
    }
    const privacy = `${folderOf("privacy", language.code)}/`;
    assert.ok(html.includes(`${privacy}">${DELETION[language.code].privacy}</a>`), language.code);
  }
});

test("every page points at files that exist; the only address elsewhere is the mail", () => {
  for (const [path, html] of Object.entries(pages)) {
    const folder = dirname(join(SITE, path));
    for (const [, target] of html.matchAll(/\s(?:src|href)="([^"]+)"/g)) {
      if (target.startsWith("mailto:")) {
        assert.equal(target, `mailto:${CONTACT}`);
        continue;
      }
      assert.doesNotMatch(target, /^[a-z]+:/i, `${path}: ${target}`);
      assert.ok(existsSync(join(folder, target)), `${path}: ${target} is missing`);
    }
  }
});

test("the server's copy takes the pages", () => {
  const deploy = readFileSync(join(SITE, "..", "docs", "DEPLOY.md"), "utf8");
  const line = deploy.match(/git archive origin\/main ((?:site\/\S+ ?)+)\|/);
  assert.ok(
    line && line[1].split(/\s+/).includes(`site/${PAGE}`),
    "DEPLOY.md F.14 copies site/account-deletion",
  );
});
