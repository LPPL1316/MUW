import { act, renderHook } from "@testing-library/react-native";
import { File, Paths } from "expo-file-system";

import { loadFeedTab, saveFeedTab } from "./feedTabChoice";
import {
  forgetStyleInFeed,
  loadStyleInFeed,
  saveStyleInFeed,
  useStyleInFeed,
} from "./styleInFeedChoice";

jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  class MockFile {
    private readonly path: string;
    constructor(_directory: string, name: string) {
      this.path = name;
    }
    get exists() {
      return files.has(this.path);
    }
    create() {
      files.set(this.path, "");
    }
    write(text: string) {
      files.set(this.path, text);
    }
    textSync() {
      return files.get(this.path) ?? "";
    }
  }
  return { File: MockFile, Paths: { document: "doc" } };
});

beforeEach(forgetStyleInFeed);

test("on at the start, off once turned off, and kept", () => {
  expect(loadStyleInFeed()).toBe(true);
  saveStyleInFeed(false);
  expect(loadStyleInFeed()).toBe(false);
  saveStyleInFeed(true);
  expect(loadStyleInFeed()).toBe(true);
});

test.each(["not json", '{"on":"no"}', "null"])(
  "a file that cannot be read is on: %s",
  (text) => {
    const file = new File(Paths.document, "style-in-feed.json");
    file.create();
    file.write(text);
    expect(loadStyleInFeed()).toBe(true);
  },
);

test("«Feed» hears the switch at once", async () => {
  saveStyleInFeed(true);
  const { result } = await renderHook(() => useStyleInFeed());
  expect(result.current).toBe(true);
  await act(() => saveStyleInFeed(false));
  expect(result.current).toBe(false);
});

test("the tab «Style» opens again, as the others", () => {
  saveFeedTab("style");
  expect(loadFeedTab()).toBe("style");
});
