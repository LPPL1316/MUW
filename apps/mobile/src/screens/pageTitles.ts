import { t, tLater } from "../i18n";

/** The pages side by side, in their order (docs/UI.md): three named in the
 * header, then the account's own profile, reached by its circle (TASK-278). */
export type PageName = "feed" | "draw" | "explore" | "profile";

/** Their names in the header, in English (TASK-210): `pageTitle` translates.
 * The profile's is not shown there: it names the page for the tour and the
 * pager. */
const TITLES: Readonly<Record<PageName, string>> = {
  feed: tLater("Feed"),
  draw: tLater("Draw"),
  explore: tLater("Explore"),
  profile: tLater("Profile"),
};

/** The name of a page as the header shows it, in the app's language. */
export function pageTitle(page: PageName): string {
  return t(TITLES[page]);
}
