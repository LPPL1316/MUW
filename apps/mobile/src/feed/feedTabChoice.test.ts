import { File, Paths } from "expo-file-system";

import { loadFeedTab, saveFeedTab } from "./feedTabChoice";

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

test("with nothing kept, the first tab is «All»", () => {
  expect(loadFeedTab()).toBe("all");
});

test("the tab chosen opens again", () => {
  saveFeedTab("following");
  expect(loadFeedTab()).toBe("following");
  saveFeedTab("all");
  expect(loadFeedTab()).toBe("all");
});

test.each(["not json", '{"tab":"mine"}', "null"])(
  "a file that cannot be read gives «All»: %s",
  (text) => {
    const file = new File(Paths.document, "feed-tab.json");
    file.create();
    file.write(text);
    expect(loadFeedTab()).toBe("all");
  },
);
