import { File, Paths } from "expo-file-system";

import type { FeedTab } from "./FeedTabs";

/** Where the last tab of «Feed» is kept, as the sport is. It stays on the
 * phone: the API is never told. */
const FEED_TAB_FILE = "feed-tab.json";

const FIRST_TAB: FeedTab = "all";

/**
 * The tab of «Feed» chosen last (TASK-362, ADR-0308; «Style», TASK-384): «All» when none was
 * chosen, or the file cannot be read.
 */
export function loadFeedTab(): FeedTab {
  try {
    const file = new File(Paths.document, FEED_TAB_FILE);
    if (!file.exists) {
      return FIRST_TAB;
    }
    const data: unknown = JSON.parse(file.textSync());
    const tab =
      typeof data === "object" && data !== null && "tab" in data ? data.tab : null;
    return tab === "following" || tab === "style" ? tab : FIRST_TAB;
  } catch {
    return FIRST_TAB;
  }
}

/** Keeps the choice for the next opening; a phone that refuses keeps nothing. */
export function saveFeedTab(tab: FeedTab): void {
  try {
    const file = new File(Paths.document, FEED_TAB_FILE);
    file.create({ overwrite: true });
    file.write(JSON.stringify({ tab }));
  } catch {
    // The choice still holds while the app is open.
  }
}
