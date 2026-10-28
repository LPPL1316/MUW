import { HEALTH_CHOICE_FILE, keepHealthOn, loadHealthOn } from "./healthChoice";

// The phone's documents folder, in memory.
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
  }
  return { File, files, Paths: { document: { uri: "file:///documents/" } } };
});

const { files } = jest.requireMock<{ files: Map<string, string> }>("expo-file-system");

beforeEach(() => {
  files.clear();
});

test("never asked: off", () => {
  expect(loadHealthOn()).toBe(false);
});

test("the yes is kept, in health.json", () => {
  keepHealthOn();
  expect(loadHealthOn()).toBe(true);
  expect(files.get(`file:///documents/${HEALTH_CHOICE_FILE}`)).toBe('{"on":true}');
});

test("a file that does not read is no yes", () => {
  files.set(`file:///documents/${HEALTH_CHOICE_FILE}`, "{not json");
  expect(loadHealthOn()).toBe(false);
  files.set(`file:///documents/${HEALTH_CHOICE_FILE}`, '{"on":"yes"}');
  expect(loadHealthOn()).toBe(false);
});
