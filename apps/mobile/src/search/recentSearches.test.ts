import {
  loadRecent,
  MAX_RECENT,
  saveRecent,
  withoutRecent,
  withRecent,
} from "./recentSearches";

// The documents of the phone, in memory (as storage/keptList.test.ts).
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

test("the last search first, once whatever its capitals, at most eight", () => {
  expect(withRecent([], "  cuore ")).toEqual(["cuore"]);
  expect(withRecent(["cane", "cuore"], "Cuore")).toEqual(["Cuore", "cane"]);
  expect(withRecent(["cane"], "   ")).toEqual(["cane"]);
  const many = Array.from({ length: MAX_RECENT }, (_, i) => `s${i}`);
  expect(withRecent(many, "new")).toEqual(["new", ...many.slice(0, MAX_RECENT - 1)]);
  expect(withoutRecent(["a", "b"], "a")).toEqual(["b"]);
});

test("kept on the phone, and gone once removed", () => {
  expect(saveRecent(["cuore", "cane"])).toBe(true);
  expect(loadRecent()).toEqual(["cuore", "cane"]);
  expect(saveRecent([])).toBe(true);
  expect(loadRecent()).toEqual([]);
});
