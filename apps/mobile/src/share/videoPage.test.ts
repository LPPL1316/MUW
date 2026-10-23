import { makeCall, VIDEO_CODECS, VIDEO_PAGE, VIDEO_PAGE_BASE } from "./videoPage";

/** The script of the page, as the WebView runs it. */
function script(): string {
  const match = /<script>([\s\S]*)<\/script>/.exec(VIDEO_PAGE);
  if (match === null) {
    throw new Error("no script");
  }
  return match[1];
}

describe("the video page", () => {
  it("is plain JavaScript the WebView can run", () => {
    // Compiled, not run: a mistake in the template string fails here.
    expect(() => new Function(script())).not.toThrow();
  });

  it("asks only for Baseline H.264, at a level that holds 1080 × 1920", () => {
    for (const codec of VIDEO_CODECS) {
      const [, profile, , level] = /^avc1\.(..)(..)(..)$/.exec(codec) ?? [];
      expect(profile).toBe("42");
      expect(parseInt(level, 16)).toBeGreaterThanOrEqual(40);
      expect(script()).toContain(codec);
    }
  });

  it("says it is on an https page, so WebCodecs is there, and loads nothing", () => {
    expect(VIDEO_PAGE_BASE.startsWith("https://")).toBe(true);
    expect(VIDEO_PAGE).not.toMatch(/src=|href=|fetch\(|XMLHttpRequest/);
  });

  it("calls the page with the scene as it is", () => {
    expect(makeCall('{"fps":30}')).toBe('window.muwVideo.make({"fps":30}); true;');
  });
});
