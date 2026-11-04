import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// The swipe between the pages (TASK-379, ADR-0323) never takes a finger that
// starts on something of a page that slides sideways itself: a row of cards,
// the photos of a post. On iOS a scroll inside the strip of the pages keeps
// the finger that starts on it while it can move, and at its ends as long as
// it bounces; one that does not bounce hands the finger on at its end. The
// source is what is checked, so a row added or changed later is caught too.

const SRC = join(__dirname, "..");

/** Every horizontal scroll of the app but the strip itself and the card
 * below. Most lie in the pages; the others keep the same rule, so they may
 * move into one. */
const ROWS = [
  // In «Feed»: the photos of a post, and of the posts of a contest.
  "feed/FeedPost.tsx",
  "contest/ContestGallery.tsx",
  // In «Draw»: «NEAR YOU».
  "route/NearYou.tsx",
  // In «Explore», on land and on the water, and its search.
  "explore/CityWords.tsx",
  "explore/ExploreTools.tsx",
  "explore/IdeasFromEurope.tsx",
  "explore/NearbyTowns.tsx",
  "explore/RecommendedRow.tsx",
  "explore/RideItYourself.tsx",
  "paddle/PaddleExplore.tsx",
  "search/SearchScreen.tsx",
  "search/StartState.tsx",
  // Out of the pages: on the map («Draw on the map», a card over the map,
  // the photos of a themed route), in the game, in the route's panel.
  "mapdraw/FigureTiles.tsx",
  "route/ShapeTiles.tsx",
  "social/DrawingCard.tsx",
  "explore/StopPhotos.tsx",
  "game/NewChallenge.tsx",
  "route/WhileRouting.tsx",
];

/** The one that hands the finger on: the drawing, then the photo, of a card
 * (TASK-350), and the rows that hold such cards and keep it. */
const HANDS_ON = "explore/RouteCard.tsx";
const PHOTO_ROWS = ["explore/IdeasFromEurope.tsx", "explore/NearbyTowns.tsx"];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sources(path);
    }
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** The opening tags of `tag` in `code`, with their props: up to the `>`
 * that closes the tag, not one of an arrow or inside braces. */
function openingTags(code: string, tag: string): string[] {
  const tags: string[] = [];
  const start = new RegExp(`<${tag.replace(".", "\\.")}(?![\\w.])`, "g");
  for (const found of code.matchAll(start)) {
    let depth = 0;
    let end = found.index + found[0].length;
    for (; end < code.length; end += 1) {
      const char = code[end];
      if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
      } else if (char === ">" && depth === 0 && code[end - 1] !== "=") {
        break;
      }
    }
    tags.push(code.slice(found.index, end + 1));
  }
  return tags;
}

function horizontalScrolls(code: string): string[] {
  return ["ScrollView", "FlatList", "Animated.ScrollView", "Animated.FlatList"]
    .flatMap((tag) => openingTags(code, tag))
    .filter((props) => /\bhorizontal\b(?!=\{false\})/.test(props));
}

const read = (file: string) => readFileSync(join(SRC, file), "utf8");

test.each(ROWS)("%s keeps the finger that starts on it, at its ends too", (file) => {
  const scrolls = horizontalScrolls(read(file));
  // ContestGallery holds posts of the Feed: their photos are FeedPost's.
  if (file === "contest/ContestGallery.tsx") {
    expect(read(file)).toMatch(/<FeedPost\b/);
    return;
  }
  expect(scrolls.length).toBeGreaterThan(0);
  for (const props of scrolls) {
    expect(props).not.toMatch(/bounces=\{false\}/);
    expect(props).not.toMatch(/alwaysBounceHorizontal=\{false\}/);
  }
});

test("every horizontal scroll of the app is in the list", () => {
  const theStrip = "tabs/TabShell.tsx";
  const found = sources(SRC)
    .map((path) => relative(SRC, path))
    .filter(
      (file) => horizontalScrolls(readFileSync(join(SRC, file), "utf8")).length > 0,
    )
    .filter((file) => file !== theStrip && file !== HANDS_ON);
  expect(found.sort()).toEqual(
    ROWS.filter((file) => file !== "contest/ContestGallery.tsx").sort(),
  );
});

test("the drawing-then-photo card hands the finger on only inside a row that keeps it", () => {
  const [pages] = horizontalScrolls(read(HANDS_ON));
  expect(pages).toMatch(/pagingEnabled/);
  expect(pages).toMatch(/bounces=\{false\}/);
  // Only rows give a card its photo, so past the photo the row moves.
  const withPhoto = sources(SRC)
    .map((path) => relative(SRC, path))
    .filter((file) =>
      openingTags(readFileSync(join(SRC, file), "utf8"), "RouteCard").some((props) =>
        /\bphoto=/.test(props),
      ),
    );
  expect(withPhoto.sort()).toEqual(PHOTO_ROWS);
  for (const row of PHOTO_ROWS) {
    expect(horizontalScrolls(read(row)).length).toBeGreaterThan(0);
  }
});

test("no map to drag lies in a page: the map takes the whole screen, without the bar", () => {
  const withMap = sources(SRC)
    .map((path) => relative(SRC, path))
    .filter((file) =>
      /from "(\.\.\/map|\.)\/MapView"/.test(readFileSync(join(SRC, file), "utf8")),
    )
    .filter((file) => !file.startsWith("map/"));
  // The canvas of «Draw on the map» only drives the map App lays under it.
  expect(withMap).toEqual(["mapdraw/useMapCanvas.ts"]);
  expect(read("mapdraw/useMapCanvas.ts")).not.toMatch(/<MapView\b/);
});
