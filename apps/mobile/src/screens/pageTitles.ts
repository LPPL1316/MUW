import { t, tLater } from "../i18n";

/** The pages of the tab bar, in their order (TASK-367, docs/UI.md), each
 * named by its icon to the screen reader and the tour. «Play», the shape
 * game (TASK-296), is no page since TASK-327: its name is on its row in
 * «Draw» and over the game. */
export type PageName = "feed" | "draw" | "messages" | "explore" | "play" | "profile";

/** Their names, in English (TASK-210): `pageTitle` translates. */
const TITLES: Readonly<Record<PageName, string>> = {
  feed: tLater("Feed"),
  draw: tLater("Draw"),
  messages: tLater("Messages"),
  explore: tLater("Explore"),
  play: tLater("Play"),
  profile: tLater("Profile"),
};

/** The name of a page, in the app's language. */
export function pageTitle(page: PageName): string {
  return t(TITLES[page]);
}
