import { keptList } from "../storage/keptList";

/** The file of the documents the recent searches are kept in. */
export const RECENT_SEARCHES_FILE = "recent-searches.json";
/** At most this many, the last first. */
export const MAX_RECENT = 8;

function isSearch(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

const kept = keptList(RECENT_SEARCHES_FILE, isSearch);

/** The searches kept on the phone, the last first (TASK-344). */
export function loadRecent(): string[] {
  return kept.load().slice(0, MAX_RECENT);
}

/**
 * `typed` first in `recent`: once, whatever its capitals, and at most
 * MAX_RECENT of them. The list as it is for nothing typed.
 */
export function withRecent(recent: readonly string[], typed: string): string[] {
  const search = typed.trim();
  if (search === "") {
    return [...recent];
  }
  const others = recent.filter((each) => each.toLowerCase() !== search.toLowerCase());
  return [search, ...others].slice(0, MAX_RECENT);
}

/** `recent` without `search`. */
export function withoutRecent(recent: readonly string[], search: string): string[] {
  return recent.filter((each) => each !== search);
}

/** Writes the list; false when the phone refuses (it stays as it was). */
export function saveRecent(recent: readonly string[]): boolean {
  return kept.save([...recent]);
}
