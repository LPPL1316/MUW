import { isPreview, updateChannel } from "./channel";

describe("the update channel", () => {
  it("is the preview only on the testers' channel", () => {
    expect(isPreview("preview")).toBe(true);
    expect(isPreview("production")).toBe(false);
    expect(isPreview(null)).toBe(false);
  });

  it("reads this copy's channel by default", () => {
    // jest-expo's expo-updates reports the channel "mock": not the preview.
    expect(updateChannel()).toBe("mock");
    expect(isPreview()).toBe(false);
  });
});
