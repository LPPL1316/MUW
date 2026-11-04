import {
  ageIn,
  appBody,
  BODY_FILE,
  bodyOf,
  birthYears,
  loadBody,
  NO_BODY,
  saveBody,
  subscribeBody,
} from "./bodyProfile";

// The phone's documents folder, in memory, as in units.test.ts.

jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  const state = { failing: false };
  class File {
    uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
    }
    get exists(): boolean {
      return files.has(this.uri);
    }
    create(): void {
      if (state.failing) {
        throw new Error("No space left on device");
      }
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
  return { File, Paths: { document: { uri: "file:///documents/" } }, files, state };
});

const disk = jest.requireMock<{
  files: Map<string, string>;
  state: { failing: boolean };
}>("expo-file-system");
const BODY_URI = `file:///documents/${BODY_FILE}`;
const YEAR = 2026;

afterEach(() => {
  disk.files.clear();
  disk.state.failing = false;
});

test("with nothing kept, the body is empty", () => {
  expect(loadBody(YEAR)).toEqual(NO_BODY);
});

test("what is saved is read back at the next opening", () => {
  const body = {
    sex: "female",
    weightKg: 58.5,
    heightCm: 165,
    birthYear: 1994,
  } as const;
  saveBody(body, YEAR);
  expect(loadBody(YEAR)).toEqual(body);
  expect(appBody()).toEqual(body);
});

test("an empty body removes the file", () => {
  saveBody({ ...NO_BODY, weightKg: 70 }, YEAR);
  expect(disk.files.has(BODY_URI)).toBe(true);
  saveBody(NO_BODY, YEAR);
  expect(disk.files.has(BODY_URI)).toBe(false);
});

test("a field out of its limits is left empty", () => {
  expect(
    bodyOf({ sex: "other", weightKg: 12, heightCm: 400, birthYear: 2020 }, YEAR),
  ).toEqual(NO_BODY);
  expect(bodyOf({ weightKg: 300, heightCm: 100, birthYear: 1926 }, YEAR)).toEqual({
    sex: null,
    weightKg: 300,
    heightCm: 100,
    birthYear: 1926,
  });
  expect(birthYears(YEAR)).toEqual({ min: 1926, max: 2013 });
});

test("a file that does not read is an empty body", () => {
  disk.files.set(BODY_URI, "{not json");
  expect(loadBody(YEAR)).toEqual(NO_BODY);
});

test("the app follows a saved body at once, even if the phone refuses it", () => {
  const seen: unknown[] = [];
  const stop = subscribeBody((body) => seen.push(body));
  disk.state.failing = true;
  saveBody({ ...NO_BODY, weightKg: 80 }, YEAR);
  stop();
  expect(seen).toEqual([{ ...NO_BODY, weightKg: 80 }]);
  expect(appBody().weightKg).toBe(80);
});

test("the age is the year alone", () => {
  expect(ageIn({ ...NO_BODY, birthYear: 1990 }, YEAR)).toBe(36);
  expect(ageIn(NO_BODY, YEAR)).toBeNull();
});
