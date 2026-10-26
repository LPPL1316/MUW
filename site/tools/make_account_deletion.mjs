/**
 * The account-deletion pages of the site, `getmuw.app/account-deletion/`
 * and `it/`, `de/`, `fr/`, `es/` (TASK-294 C, ADR-0253): the steps to
 * delete a MuW account, what is deleted and what stays, from
 * `account_deletion_text.mjs`. Google Play shows the address in the
 * store listing. Static pages, no script.
 *
 * Run from the repository root, no dependency:
 *
 *     node site/tools/make_account_deletion.mjs
 *
 * The output is deterministic; a test checks the pages match the texts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { escapeHtml } from "../render.js";
import { CONTACT, DELETION } from "./account_deletion_text.mjs";
import { LANGUAGES, folderOf } from "./make_support.mjs";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The page's folder under the site, the one Google Play links to. */
export const PAGE = "account-deletion";

function list(items, tag) {
  return `<${tag}>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</${tag}>`;
}

/** The whole account-deletion page of one language. */
export function deletionPage(language, text) {
  const depth = language.code === "en" ? 1 : 2;
  const up = "../".repeat(depth);
  const switcher = LANGUAGES.map((other) =>
    other.code === language.code
      ? `<span class="lang lang--current" aria-current="page">${other.name}</span>`
      : `<a class="lang" href="${up}${folderOf(PAGE, other.code)}/" hreflang="${other.code}" lang="${other.code}">${other.name}</a>`,
  ).join("");
  const privacy = `${up}${folderOf("privacy", language.code)}/`;
  return `<!doctype html>
<!-- Written by site/tools/make_account_deletion.mjs from account_deletion_text.mjs: do not edit by hand. -->
<html lang="${language.code}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(text.title)} — MuW</title>
    <meta name="theme-color" content="#0A0A0B" />
    <link rel="icon" href="${up}assets/muw-mark.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="${up}styles.css" />
  </head>
  <body>
    <header class="top">
      <a class="top__logo" href="${up}" aria-label="MuW, home">
        <img class="top__mark" src="${up}assets/muw-mark.svg" alt="" width="34" height="34" />
        <img class="top__word" src="${up}assets/muw-logo.svg" alt="MuW" width="84" height="24" />
      </a>
      <nav class="langs" aria-label="Language">${switcher}</nav>
    </header>

    <main id="main">
      <article class="legal">
        <h1>${escapeHtml(text.title)}</h1>
        <p>${escapeHtml(text.intro)}</p>
        <h2>${escapeHtml(text.inAppHeading)}</h2>
        ${list(text.inAppSteps, "ol")}
        <p>${escapeHtml(text.inAppNote)}</p>
        <h2>${escapeHtml(text.emailHeading)}</h2>
        <p>${escapeHtml(text.emailText)}</p>
        <p><a class="button button--primary support__mail" href="mailto:${CONTACT}">${CONTACT}</a></p>
        <p>${escapeHtml(text.emailNote)}</p>
        <h2>${escapeHtml(text.deletedHeading)}</h2>
        ${list(text.deleted, "ul")}
        <p>${escapeHtml(text.backupNote)}</p>
        <h2>${escapeHtml(text.keptHeading)}</h2>
        ${list(text.kept, "ul")}
        <h2>${escapeHtml(text.partialHeading)}</h2>
        <p>${escapeHtml(text.partialText)}</p>
        <p class="support__privacy">${escapeHtml(text.privacyLine)} <a href="${privacy}">${escapeHtml(text.privacy)}</a></p>
      </article>
    </main>

    <footer class="foot">
      <img src="${up}assets/muw-mark.svg" alt="" width="24" height="24" />
      <p>© 2026 MuW</p>
      <p><a class="foot__link" href="${privacy}">${escapeHtml(text.privacy)}</a></p>
    </footer>
  </body>
</html>
`;
}

/** Every page, as { "account-deletion/it/index.html": html }. */
export function deletionPages() {
  const pages = {};
  for (const language of LANGUAGES) {
    pages[`${folderOf(PAGE, language.code)}/index.html`] = deletionPage(
      language,
      DELETION[language.code],
    );
  }
  return pages;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [path, html] of Object.entries(deletionPages())) {
    mkdirSync(join(SITE, dirname(path)), { recursive: true });
    writeFileSync(join(SITE, path), html, "utf8");
  }
}
