import { Directory, File, Paths } from "expo-file-system";

/**
 * The files of the examples prepared ahead for the towns near and of the
 * region (TASK-316, ADR-0276): one a town, in the phone's cache, beside the
 * examples the page keeps (city-examples.json, eight cities chosen), which
 * these would push out. An index says when each town was asked and what it
 * has, so that the round that writes them (regionAhead.ts) reads no town's
 * routes to know whether to ask again. Nothing but the files is here, so
 * that the examples (exampleRoutes.ts) can read them and the round can read
 * the examples, as paddle/aheadStore.ts.
 */
export const REGION_DIRECTORY = "region-ahead";
const INDEX_FILE = "index.json";
/** The towns whose routes are kept in memory once read: those on the page. */
const READ_TOWNS = 8;
/** A town's file is read for this long; then its examples are asked again,
 * and the file goes when another town is written. */
export const KEEP_MS = 7 * 24 * 3600_000;

export type TownEntry = {
  /** When the town was last asked, in ms since 1970. */
  at: number;
  /** The names of the examples its file has: a shape, or "word:" and a word. */
  has: string[];
};

let index: Record<string, TownEntry> | null = null;
// The routes of the towns read last, the last read at the end.
const read = new Map<string, unknown[]>();

/** A file of the folder; made inside a `try`, as everything that may throw. */
function fileOf(name: string): File {
  return new File(new Directory(Paths.cache, REGION_DIRECTORY), name);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEntry(value: unknown): value is TownEntry {
  return (
    isRecord(value) &&
    typeof value.at === "number" &&
    Array.isArray(value.has) &&
    value.has.every((name) => typeof name === "string")
  );
}

function readJson(name: string): unknown {
  try {
    const file = fileOf(name);
    return file.exists ? (JSON.parse(file.textSync()) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

function writeJson(name: string, data: unknown): boolean {
  try {
    const file = fileOf(name);
    file.create({ overwrite: true, intermediates: true });
    file.write(JSON.stringify(data));
    return true;
  } catch {
    // A convenience: without the file the town's examples are asked on the page.
    return false;
  }
}

function indexOf(): Record<string, TownEntry> {
  if (index === null) {
    const data = readJson(INDEX_FILE);
    index = Object.fromEntries(
      Object.entries(isRecord(data) ? data : {}).filter(
        (entry): entry is [string, TownEntry] => isEntry(entry[1]),
      ),
    );
  }
  return index;
}

/** When a town was asked and what it has; null for a town never asked, or
 * asked longer than KEEP_MS ago. */
export function townEntry(key: string, now: number = Date.now()): TownEntry | null {
  const entry = indexOf()[key];
  return entry !== undefined && now - entry.at < KEEP_MS ? entry : null;
}

/** A town's routes whole, as the page's file keeps them, to read with
 * `readKept`; nothing for a town never asked, asked too long ago, or whose
 * file does not read. */
export function townRoutes(key: string, now: number = Date.now()): unknown[] {
  if (townEntry(key, now) === null) {
    return [];
  }
  const kept = read.get(key);
  if (kept !== undefined) {
    remember(key, kept);
    return kept;
  }
  const data = readJson(`${key}.json`);
  const routes = Array.isArray(data) ? data : [];
  remember(key, routes);
  return routes;
}

function remember(key: string, routes: unknown[]): void {
  read.delete(key);
  read.set(key, routes);
  while (read.size > READ_TOWNS) {
    read.delete(read.keys().next().value as string);
  }
}

/** Writes a town's routes, and in the index when and what; the towns asked
 * longer than KEEP_MS before `entry` go. */
export function writeTown(key: string, routes: unknown[], entry: TownEntry): void {
  if (!writeJson(`${key}.json`, routes)) {
    return;
  }
  remember(key, routes);
  const next: Record<string, TownEntry> = { [key]: entry };
  for (const [other, was] of Object.entries(indexOf())) {
    if (other === key) {
      continue;
    }
    if (entry.at - was.at < KEEP_MS) {
      next[other] = was;
    } else {
      read.delete(other);
      remove(`${other}.json`);
    }
  }
  index = next;
  writeJson(INDEX_FILE, index);
}

function remove(name: string): void {
  try {
    fileOf(name).delete();
  } catch {
    // Left in the cache, which the system empties when it wants.
  }
}

/** For tests: reads the files again. */
export function forgetRegionStore(): void {
  index = null;
  read.clear();
}
