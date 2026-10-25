import catalog from "@shaperoute/shared-types/fixtures/game-catalog.json";
import type { GameCatalog } from "@shaperoute/shared-types";

import { answers, apiError } from "../account/testing";
import {
  forgetGameCatalog,
  GAME_CATALOG_FILE,
  gameCatalog,
  loadGameCatalog,
  refreshGameCatalog,
  setGameCatalog,
  subscribeGameCatalog,
} from "./gameCatalog";

// The phone's documents folder, in memory: the catalog kept.
jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  class File {
    uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
    }
    get exists(): boolean {
      return files.has(this.uri);
    }
    create(): void {
      files.set(this.uri, "");
    }
    write(text: string): void {
      files.set(this.uri, text);
    }
    textSync(): string {
      return files.get(this.uri) ?? "";
    }
    delete(): void {
      files.delete(this.uri);
    }
  }
  return { File, Paths: { document: { uri: "file:///documents/" } } };
});

const API = "http://api.test";
const CATALOG = catalog as GameCatalog;

/** The fake fetch, as the requests take it. */
const fake = (...list: Parameters<typeof answers>): jest.Mock => answers(...list);

afterEach(() => {
  forgetGameCatalog();
});

test("a phone that never heard from the API has no catalog", () => {
  expect(gameCatalog()).toBeNull();
  expect(loadGameCatalog()).toBeNull();
});

test("the catalog the API answers is shown and kept", async () => {
  const told = jest.fn();
  subscribeGameCatalog(told);
  await refreshGameCatalog(API, {
    fetchFn: fake({ status: 200, body: CATALOG }),
    key: null,
  });
  expect(gameCatalog()).toEqual(CATALOG);
  expect(loadGameCatalog()).toEqual(CATALOG);
  expect(told).toHaveBeenCalledTimes(1);
});

test("an API without the game takes the catalog away", async () => {
  setGameCatalog(CATALOG);
  await refreshGameCatalog(API, {
    fetchFn: fake({ status: 404, body: apiError("http_error") }),
    key: null,
  });
  expect(gameCatalog()).toBeNull();
  expect(loadGameCatalog()).toBeNull();
});

test("without a network the last answer stands", async () => {
  setGameCatalog(CATALOG);
  await refreshGameCatalog(API, { fetchFn: fake(new Error("offline")), key: null });
  expect(gameCatalog()).toEqual(CATALOG);
  // A broken answer changes nothing either.
  await refreshGameCatalog(API, {
    fetchFn: fake({ status: 500, body: apiError("internal_error") }),
    key: null,
  });
  expect(gameCatalog()).toEqual(CATALOG);
});

test("without an API nothing is asked", async () => {
  const fetchFn = fake();
  await refreshGameCatalog(null, { fetchFn, key: null });
  expect(fetchFn).not.toHaveBeenCalled();
});

test("a file kept that is not a catalog is nothing", () => {
  const { File, Paths } = jest.requireMock("expo-file-system");
  const file = new File(Paths.document, GAME_CATALOG_FILE);
  file.create();
  file.write("not a catalog");
  expect(loadGameCatalog()).toBeNull();
  expect(gameCatalog()).toBeNull();
});
