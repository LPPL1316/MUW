import cyclingFavorite from "@shaperoute/shared-types/fixtures/favorite-cycling.json";
import cyclingRequest from "@shaperoute/shared-types/fixtures/favorite-request-cycling.json";
import walkedRequest from "@shaperoute/shared-types/fixtures/favorite-request-walks.json";
import walkedFavorite from "@shaperoute/shared-types/fixtures/favorite-walks.json";
import favorite from "@shaperoute/shared-types/fixtures/favorite.json";
import favorites from "@shaperoute/shared-types/fixtures/favorites.json";
import detail from "@shaperoute/shared-types/fixtures/recommended-route.json";
import list from "@shaperoute/shared-types/fixtures/recommended-routes.json";
import result from "@shaperoute/shared-types/fixtures/route-result.json";
import wordResult from "@shaperoute/shared-types/fixtures/route-result-word.json";
import imageResult from "@shaperoute/shared-types/fixtures/route-result-image.json";
import penUpResult from "@shaperoute/shared-types/fixtures/route-result-pen-up.json";
import {
  type LatLon,
  MAX_OUTLINE_POINTS,
  type RouteResult,
  type Walk,
} from "@shaperoute/shared-types";

import type { Favorite, FavoriteDetail } from "../api/favorites";
import type {
  RecommendedRoute,
  RecommendedRouteDetail,
} from "../explore/recommendedRoutes";
import type { ThemedResult } from "../explore/themedRoutes";
import { favoriteKey } from "./favoriteKey";
import {
  drawnKeepable,
  exploredKeepable,
  favoriteHeading,
  favoritePlace,
  favoriteTitle,
  keptNow,
  openedFavorite,
  outlineOf,
  themedKeepable,
} from "./favoriteRoute";

const START: LatLon = [46.067, 11.1215];
const [KEPT_STAR, KEPT_WORD] = favorites.favorites as Favorite[];

test("a shape drawn is kept with its shape, its two distances and its line", () => {
  const drawn = result as unknown as RouteResult;
  const kept = drawnKeepable(
    { start: START, shape: "heart", distance_m: 5000, activity: "running" },
    drawn,
    null,
  );
  expect(kept.id).toBe(favoriteKey(drawn.points));
  expect(kept.request).toEqual({
    city: "",
    shape: drawn.shape,
    word: null,
    style: null,
    title: null,
    distance_m: 5000,
    route_m: Math.round(drawn.distance_m),
    similarity: drawn.similarity,
    points: drawn.points,
  });
});

test("a word drawn is kept with its style, and the place searched for", () => {
  const drawn = wordResult as unknown as RouteResult;
  const kept = drawnKeepable(
    {
      start: START,
      word: "CIAO",
      style: "block",
      distance_m: 12000,
      activity: "running",
    },
    drawn,
    "  Piazza Duomo, Trento ",
  );
  expect(kept.request).toMatchObject({
    city: "Piazza Duomo, Trento",
    shape: null,
    word: drawn.word,
    style: "block",
    title: null,
  });
});

test("an image drawn has neither: it is called «Image»", () => {
  const drawn = imageResult as unknown as RouteResult;
  const kept = drawnKeepable(
    {
      start: START,
      outline: [
        [0, 1],
        [1, -1],
        [-1, -1],
        [0, 1],
      ],
      distance_m: 15000,
      activity: "running",
    },
    drawn,
    null,
  );
  expect(kept.request).toMatchObject({
    shape: null,
    word: null,
    style: null,
    title: "Image",
  });
  expect(favoriteTitle(kept.request)).toBe("Image");
});

test("a route of «Explore» is kept as its card has it", () => {
  const route = list.routes[0] as RecommendedRoute;
  const kept = exploredKeepable(route, detail as RecommendedRouteDetail);
  expect(kept.id).toBe(favoriteKey(detail.points as LatLon[]));
  expect(kept.request).toMatchObject({
    city: "trento",
    shape: "star",
    word: null,
    style: null,
    title: null,
    distance_m: detail.distance_m,
    route_m: detail.route_m,
  });
});

test("an example of «Explore» on the water keeps its activity (TASK-191)", () => {
  const route = list.routes[0] as RecommendedRoute;
  const kept = exploredKeepable(route, {
    ...(detail as RecommendedRouteDetail),
    distance_m: 2000,
    activity: "paddling",
  });
  expect(kept.request).toMatchObject({
    shape: "star",
    distance_m: 2000,
    activity: "paddling",
  });
});

test("a themed route is kept under its theme; what the API would refuse is cut", () => {
  const themed: ThemedResult = {
    points: detail.points as LatLon[],
    distance_m: 5120.4,
    similarity: 1.0000001,
    shape: "star",
    theme: "fountain",
    theme_label: "Fountains ".repeat(8),
    target_m: 5000,
    city: null,
    centre: START,
    stops: [],
    license: "",
  };
  const kept = themedKeepable(themed);
  expect(kept.request.title).toHaveLength(60);
  expect(kept.request.city).toBe("");
  expect(kept.request.similarity).toBe(1);
  expect(kept.request.route_m).toBe(5120);
  expect(favoriteTitle({ ...kept.request, title: "Fountains" })).toBe("Fountains");
});

test("a card reads «Star · 5.1 km», and the city when there is one", () => {
  expect(favoriteHeading(KEPT_STAR)).toBe("Star · 5.1 km");
  expect(favoritePlace(KEPT_STAR)).toBe("Trento");
  expect(favoriteHeading(KEPT_WORD)).toBe("CIAO · 12.5 km");
  expect(favoritePlace(KEPT_WORD)).toBeNull();
  expect(favoriteTitle({ shape: "christmas_tree", word: null, title: null })).toBe(
    "Christmas tree",
  );
  expect(favoriteTitle({ shape: null, word: null, title: null })).toBe("Route");
});

test("kept now, the list shows it before the API answers", () => {
  const points = Array.from({ length: 500 }, (_, i): LatLon => [46 + i * 1e-4, 11]);
  const kept = keptNow(
    {
      id: "0123456789abcdef",
      request: {
        city: "trento",
        shape: "star",
        word: null,
        style: null,
        title: null,
        distance_m: 5000,
        route_m: 5120,
        similarity: 0.996,
        points,
      },
    },
    new Date("2026-10-02T09:00:00Z"),
  );
  expect(kept).toMatchObject({ city: "trento", shape: "star", route_m: 5120 });
  expect(kept.id).toBe("0123456789abcdef");
  expect(kept.start).toEqual(points[0]);
  expect(kept.preview).toHaveLength(64);
  expect(kept.preview[63]).toEqual(points[499]);
  expect(kept.created_at).toBe("2026-10-02T09:00:00.000Z");
  expect(kept).not.toHaveProperty("points");
});

test("the outline of a line is closed, inside [-1, 1], north up, and short", () => {
  // Twice as wide as tall, around Trento.
  const k = Math.cos((46.005 * Math.PI) / 180);
  const box: LatLon[] = [
    [46, 11],
    [46, 11 + 0.02 / k],
    [46.01, 11 + 0.02 / k],
    [46.01, 11],
    [46, 11],
  ];
  const outline = outlineOf(box);
  expect(outline).toHaveLength(5);
  const expected = [
    [-1, -0.5],
    [1, -0.5],
    [1, 0.5],
    [-1, 0.5],
    [-1, -0.5],
  ];
  outline.forEach(([x, y], i) => {
    expect(x).toBeCloseTo(expected[i][0], 3);
    expect(y).toBeCloseTo(expected[i][1], 3);
  });

  const long = Array.from({ length: 3000 }, (_, i): LatLon => {
    const turn = (i / 3000) * 2 * Math.PI;
    return [46 + 0.01 * Math.sin(turn), 11 + 0.01 * Math.cos(turn)];
  });
  const short = outlineOf(long);
  // Not closed as it was cut: the first point closes it.
  expect(short).toHaveLength(MAX_OUTLINE_POINTS + 1);
  expect(short[short.length - 1]).toEqual(short[0]);
  expect(short.flat().every((n) => n >= -1 && n <= 1)).toBe(true);
});

test("a favorite opens as a route of «Explore», with itself to keep again", () => {
  const opened = openedFavorite(favorite as FavoriteDetail);
  expect(opened.status).toBe("done");
  expect(opened.route).toMatchObject({
    id: favorite.id,
    city: "trento",
    shape: "star",
  });
  expect(opened.detail.points).toBe(favorite.points);
  expect(opened.result).toMatchObject({
    points: favorite.points,
    distance_m: favorite.route_m,
    similarity: favorite.similarity,
    shape: "star",
    directions: [],
  });
  expect(opened.request).toEqual({
    start: favorite.points[0],
    distance_m: favorite.distance_m,
    activity: "running",
    shape: "star",
  });
  expect(opened.choices).toEqual([opened.result]);
  expect(opened.others).toEqual([]);
  expect(opened.keepable.id).toBe(favorite.id);
  expect(opened.keepable.request.points).toBe(favorite.points);
});

test("a favorite with no city and no shape still has a card and a GPX", () => {
  const image: FavoriteDetail = {
    ...(favorite as FavoriteDetail),
    city: "",
    shape: null,
    title: "Image",
  };
  const opened = openedFavorite(image);
  // The card reads "image · Favorite · looks 100% like it".
  expect(opened.route.shape).toBe("image");
  expect(opened.route.city).toBe("favorite");
  // The export sends the line as the outline the phone no longer has.
  expect(opened.request).toMatchObject({
    start: favorite.points[0],
    distance_m: favorite.distance_m,
    outline: outlineOf(favorite.points as LatLon[]),
  });
  expect(opened.result.shape).toBeNull();
  // Kept again, it is what it was: no city, its title.
  expect(opened.keepable.request).toMatchObject({
    city: "",
    shape: null,
    title: "Image",
  });
});

// --- A word with the pen up (TASK-199) ---

test("a route without walks is kept with the request of before, byte for byte", () => {
  const drawn = result as unknown as RouteResult;
  const request = { start: START, shape: "heart" as const, distance_m: 5000 };
  // The text sent before TASK-199: an older API refuses a field it does not
  // know.
  const before = JSON.stringify({
    city: "",
    shape: drawn.shape,
    word: null,
    style: null,
    title: null,
    distance_m: 5000,
    route_m: Math.round(drawn.distance_m),
    points: drawn.points,
    similarity: drawn.similarity,
  });
  for (const walks of [undefined, []]) {
    const kept = drawnKeepable(
      { ...request, activity: "running" },
      { ...drawn, walks },
      null,
    );
    expect(JSON.stringify(kept.request)).toBe(before);
  }
  // A word drawn with the pen down, from an API that sends `walks: []`.
  const word = wordResult as unknown as RouteResult;
  const kept = drawnKeepable(
    {
      start: START,
      word: "CIAO",
      style: "round",
      distance_m: 12000,
      activity: "running",
    },
    { ...word, walks: [] },
    null,
  );
  expect(kept.request).not.toHaveProperty("walks");
  // And a favorite opened again keeps itself as it was kept.
  const opened = openedFavorite(favorite as FavoriteDetail);
  expect(opened.keepable.request).not.toHaveProperty("walks");
  expect(opened.result).not.toHaveProperty("walks");
  expect(opened.request).not.toHaveProperty("pen_up");
});

test("a word drawn with the pen up is kept with its walks", () => {
  const drawn = penUpResult as unknown as RouteResult;
  const kept = drawnKeepable(
    {
      start: START,
      word: "IO",
      style: "round",
      distance_m: 6000,
      activity: "running",
      pen_up: true,
    },
    drawn,
    null,
  );
  expect(kept.id).toBe(favoriteKey(drawn.points));
  expect(kept.request.walks).toEqual([[2, 5]]);
  // The fields of the contract's example, no more and no fewer.
  expect(Object.keys(kept.request).sort()).toEqual(Object.keys(walkedRequest).sort());
  // The list shows it before the API answers, without walks, as the API's.
  expect(keptNow(kept, new Date("2026-10-02T09:00:00Z"))).not.toHaveProperty("walks");
});

test("walks that do not fit the line, or of no word, are not kept", () => {
  const drawn = penUpResult as unknown as RouteResult;
  const word = {
    start: START,
    word: "IO",
    style: "round" as const,
    distance_m: 6000,
    activity: "running" as const,
  };
  for (const walks of [
    [[2, 99]],
    [[5, 2]],
    [
      [2, 5],
      [3, 6],
    ],
  ] as Walk[][]) {
    expect(drawnKeepable(word, { ...drawn, walks }, null).request).not.toHaveProperty(
      "walks",
    );
  }
  const shape = { start: START, shape: "heart" as const, distance_m: 5000 };
  expect(
    drawnKeepable(
      { ...shape, activity: "running" },
      { ...drawn, word: null, shape: "heart" },
      null,
    ).request,
  ).not.toHaveProperty("walks");
  const nowhere = openedFavorite({
    ...(walkedFavorite as FavoriteDetail),
    walks: [[2, 99]],
  });
  expect(nowhere.result).not.toHaveProperty("walks");
  expect(nowhere.request).not.toHaveProperty("pen_up");
});

test("a favorite with the pen up opens as a word just drawn with it", () => {
  const opened = openedFavorite(walkedFavorite as FavoriteDetail);
  // The map draws the walks dashed, Start pauses on them, the score and the
  // GPX leave them out: all read them from the result.
  expect(opened.result).toMatchObject({
    points: walkedFavorite.points,
    word: "II",
    walks: [[2, 5]],
    distance_m: walkedFavorite.route_m,
    similarity: walkedFavorite.similarity,
  });
  // The export asks for a word with the pen up.
  expect(opened.request).toEqual({
    start: walkedFavorite.points[0],
    distance_m: walkedFavorite.distance_m,
    activity: "running",
    word: "II",
    style: "block",
    pen_up: true,
  });
  // Kept again, it is what it was: its walks too.
  expect(opened.keepable.id).toBe(walkedFavorite.id);
  expect(opened.keepable.request).toEqual(walkedRequest);
  // An API older than TASK-199 sends no walks: one line, as before.
  const { walks: _walks, ...older } = walkedFavorite;
  expect(openedFavorite(older as FavoriteDetail).result).not.toHaveProperty("walks");
});

test("a shape in pieces drawn with the pen up is kept and opens with its walks", () => {
  // TASK-223: the walks of a word's example, on a smiley.
  const drawn = { ...(penUpResult as unknown as RouteResult), word: null };
  const smiley = { ...drawn, shape: "smiley" as const };
  const kept = drawnKeepable(
    {
      start: START,
      shape: "smiley",
      distance_m: 6000,
      activity: "running",
      pen_up: true,
    },
    smiley,
    null,
  );
  expect(kept.request).toMatchObject({ shape: "smiley", word: null, walks: [[2, 5]] });
  const favorite = {
    ...(walkedFavorite as FavoriteDetail),
    shape: "smiley",
    word: null,
    style: null,
  };
  const opened = openedFavorite(favorite);
  expect(opened.result).toMatchObject({ shape: "smiley", word: null, walks: [[2, 5]] });
  expect(opened.request).toEqual({
    start: favorite.points[0],
    distance_m: favorite.distance_m,
    activity: "running",
    shape: "smiley",
    pen_up: true,
  });
});

// --- The activity a route was drawn for (TASK-200) ---

/** A heart drawn by bike: JSON's empty `walks` is not a tuple to tsc. */
const BIKE = cyclingFavorite as unknown as FavoriteDetail;

test("a route drawn by bike is kept with its activity; a run says nothing", () => {
  const drawn = { ...(result as unknown as RouteResult), shape: "heart" as const };
  const asked = { start: START, shape: "heart" as const, distance_m: 20000 };
  const bike = drawnKeepable({ ...asked, activity: "cycling" }, drawn, null);
  expect(bike.request.activity).toBe("cycling");
  // The fields of the contract's example, no more and no fewer.
  expect(Object.keys(bike.request).sort()).toEqual(Object.keys(cyclingRequest).sort());
  // The same line is the same favorite, whatever it was drawn for.
  const run = drawnKeepable({ ...asked, activity: "running" }, drawn, null);
  expect(run.id).toBe(bike.id);
  expect(run.request).not.toHaveProperty("activity");
  const { activity: _activity, ...asRun } = bike.request;
  expect(JSON.stringify(run.request)).toBe(JSON.stringify(asRun));
  // The list shows it with its activity before the API answers.
  expect(keptNow(bike, new Date("2026-10-02T09:00:00Z")).activity).toBe("cycling");
});

test("the routes of «Explore» and the themed ones are runs: they say nothing", () => {
  const route = list.routes[0] as RecommendedRoute;
  expect(
    exploredKeepable(route, detail as RecommendedRouteDetail).request,
  ).not.toHaveProperty("activity");
  const themed: ThemedResult = {
    points: detail.points as LatLon[],
    distance_m: 5120,
    similarity: 0.9,
    shape: "star",
    theme: "fountain",
    theme_label: "Fountains",
    target_m: 5000,
    city: "trento",
    centre: START,
    stops: [],
    license: "",
  };
  expect(themedKeepable(themed).request).not.toHaveProperty("activity");
});

test("a bike favorite opens as a bike route, and is kept again as one", () => {
  const opened = openedFavorite(BIKE);
  // What «Export GPX» sends: the activity it was kept with.
  expect(opened.request).toEqual({
    start: cyclingFavorite.points[0],
    distance_m: cyclingFavorite.distance_m,
    activity: "cycling",
    shape: "heart",
  });
  expect(opened.keepable.id).toBe(cyclingFavorite.id);
  expect(opened.keepable.request).toEqual(cyclingRequest);
  // An image, and a word with the pen up, by bike too.
  const image = openedFavorite({
    ...BIKE,
    shape: null,
    title: "Image",
  });
  expect(image.request).toMatchObject({
    activity: "cycling",
    outline: outlineOf(cyclingFavorite.points as LatLon[]),
  });
  const word = openedFavorite({
    ...(walkedFavorite as FavoriteDetail),
    activity: "cycling",
  });
  expect(word.request).toMatchObject({ activity: "cycling", word: "II", pen_up: true });
  expect(word.keepable.request).toMatchObject({ activity: "cycling", walks: [[2, 5]] });
});

test("a favorite of before, or of an activity unknown here, opens as a run", () => {
  for (const kept of [
    favorite as FavoriteDetail,
    { ...BIKE, activity: "running" },
    { ...BIKE, activity: "hiking" },
  ]) {
    const opened = openedFavorite(kept);
    expect(opened.request.activity).toBe("running");
    expect(opened.keepable.request).not.toHaveProperty("activity");
  }
  // The export of a run: the request of before, byte for byte.
  expect(JSON.stringify(openedFavorite(favorite as FavoriteDetail).request)).toBe(
    JSON.stringify({
      start: favorite.points[0],
      distance_m: favorite.distance_m,
      activity: "running",
      shape: "star",
    }),
  );
});

test("an example of «Explore» in pieces keeps its walks (TASK-254)", () => {
  // A dog's head on the water: the eyes apart from the head, the pen up.
  const route = list.routes[0] as RecommendedRoute;
  const pieces = {
    ...(detail as RecommendedRouteDetail),
    activity: "paddling" as const,
  };
  const dog = exploredKeepable(route, {
    ...pieces,
    shape: "dog_head",
    walks: [[1, 3]],
  });
  expect(dog.request).toMatchObject({ shape: "dog_head", walks: [[1, 3]] });
  // A star is one line: walks are not its, and the request is the one of before.
  const star = exploredKeepable(route, { ...pieces, walks: [[1, 3]] });
  expect(star.request).not.toHaveProperty("walks");
  // Walks that do not fit the line are not trusted.
  const broken = exploredKeepable(route, {
    ...pieces,
    shape: "dog_head",
    walks: [[3, 9]],
  });
  expect(broken.request).not.toHaveProperty("walks");
});
