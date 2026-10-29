import { MAX_FILE_BYTES } from "./importFile";
import { filePickerAvailable, pickActivityFile } from "./pickActivityFile";

// The file picked in «Files» (TASK-312): read on the phone, its copy in the
// cache deleted once read, a file over 25 MB never read.

let mockNativeThere = true;
jest.mock("expo", () => ({
  requireOptionalNativeModule: (name: string) =>
    name === "ExpoDocumentPicker" && mockNativeThere ? {} : null,
}));

// Loading expo-document-picker in a binary without its native module
// throws: it is loaded only at the first pick.
let mockPickerLoaded = false;
const mockGetDocument = jest.fn();
jest.mock("expo-document-picker", () => {
  mockPickerLoaded = true;
  return { getDocumentAsync: (...args: unknown[]) => mockGetDocument(...args) };
});

const mockDeleted: string[] = [];
const mockSizes = new Map<string, number>();
jest.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get size(): number {
      return mockSizes.get(this.uri) ?? 0;
    }
    async bytes(): Promise<Uint8Array> {
      return new Uint8Array([60, 103, 112, 120]);
    }
    delete(): void {
      mockDeleted.push(this.uri);
    }
  },
}));

const URI = "file:///cache/DocumentPicker/run.gpx";

beforeEach(() => {
  mockGetDocument.mockReset();
  mockDeleted.length = 0;
  mockSizes.clear();
});

test("«From a file» is offered only in an app built with the picker", () => {
  mockNativeThere = true;
  expect(filePickerAvailable()).toBe(true);
  // The store's 1.0, until the native build 1.0.1.
  mockNativeThere = false;
  expect(filePickerAvailable()).toBe(false);
  // Asking did not load the package.
  expect(mockPickerLoaded).toBe(false);
});

test("one file of any kind, copied to the cache, read and deleted", async () => {
  mockGetDocument.mockResolvedValue({
    canceled: false,
    assets: [{ uri: URI, name: "run.gpx", size: 4 }],
  });
  expect(await pickActivityFile()).toEqual({
    kind: "picked",
    bytes: new Uint8Array([60, 103, 112, 120]),
  });
  expect(mockGetDocument).toHaveBeenCalledWith({
    type: "*/*",
    multiple: false,
    copyToCacheDirectory: true,
  });
  expect(mockDeleted).toEqual([URI]);
});

test("nothing chosen is nothing read", async () => {
  mockGetDocument.mockResolvedValue({ canceled: true, assets: null });
  expect(await pickActivityFile()).toEqual({ kind: "canceled" });
  expect(mockDeleted).toEqual([]);
});

test("a file over 25 MB is not read, and its copy goes", async () => {
  mockGetDocument.mockResolvedValue({
    canceled: false,
    assets: [{ uri: URI, name: "huge.fit", size: MAX_FILE_BYTES + 1 }],
  });
  expect(await pickActivityFile()).toEqual({ kind: "too_big" });
  expect(mockDeleted).toEqual([URI]);
  // Without the size from the picker, the file's own.
  mockSizes.set(URI, MAX_FILE_BYTES + 1);
  mockGetDocument.mockResolvedValue({
    canceled: false,
    assets: [{ uri: URI, name: "huge.fit" }],
  });
  expect(await pickActivityFile()).toEqual({ kind: "too_big" });
});

test("a picker that fails is a file that cannot be read", async () => {
  mockGetDocument.mockRejectedValue(new Error("iCloud"));
  expect(await pickActivityFile()).toEqual({ kind: "unreadable" });
});
