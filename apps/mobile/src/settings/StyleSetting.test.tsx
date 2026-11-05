import { fireEvent, render, screen } from "@testing-library/react-native";

import { forgetStyleInFeed, loadStyleInFeed } from "../feed/styleInFeedChoice";
import { StyleSetting } from "./StyleSetting";

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

test("the switch with its approved words, on at the start, and off with a touch", async () => {
  await render(<StyleSetting />);
  const row = screen.getByRole("switch", { name: "Style posts in the Feed" });
  expect(row.props.accessibilityState).toEqual({ checked: true });
  expect(
    screen.getByText("Outfits made with AI, with links to shops. They stay in Style."),
  ).toBeOnTheScreen();
  await fireEvent.press(row);
  expect(screen.getByRole("switch").props.accessibilityState).toEqual({
    checked: false,
  });
  expect(loadStyleInFeed()).toBe(false);
});
