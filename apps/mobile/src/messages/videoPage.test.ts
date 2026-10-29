import { playerPage, posterMessageOf, posterPage, sharedFolder } from "./videoPage";

// The pages of the WebView for the videos of the messages (TASK-333).

test("the page of the first picture says what it made, or that it could not", () => {
  expect(posterMessageOf(JSON.stringify({ type: "poster", jpeg: "abc" }))).toEqual({
    type: "poster",
    jpeg: "abc",
  });
  expect(posterMessageOf(JSON.stringify({ type: "failed" }))).toEqual({
    type: "failed",
  });
  expect(posterMessageOf(JSON.stringify({ type: "poster", jpeg: "" }))).toBeNull();
  expect(posterMessageOf("not json")).toBeNull();
  expect(posterMessageOf("null")).toBeNull();
});

test("a video's address never closes the page's script", () => {
  const strange = "file:///cache/a</script><script>alert(1)</script>.mp4";
  for (const page of [playerPage(strange), posterPage(strange)]) {
    expect(page).not.toContain("</script><script>");
    expect(page).toContain("\\u003c/script>");
  }
});

test("the WebView reads the folder that holds the page and the video", () => {
  expect(
    sharedFolder(
      "file:///var/app/Caches/message-poster.html",
      "file:///var/app/Caches/ImagePicker/a.mov",
    ),
  ).toBe("file:///var/app/Caches/");
  expect(sharedFolder("file:///a/b/page.html", "file:///a/b/video.mp4")).toBe(
    "file:///a/b/",
  );
  expect(sharedFolder("file:///a/bc/page.html", "file:///a/bd/video.mp4")).toBe(
    "file:///a/",
  );
});
