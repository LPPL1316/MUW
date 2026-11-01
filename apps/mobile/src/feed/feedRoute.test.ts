import detail from "@shaperoute/shared-types/fixtures/recommended-route.json";
import list from "@shaperoute/shared-types/fixtures/recommended-routes.json";

import type { RecommendedRouteDetail } from "../explore/recommendedRoutes";
import { fetchPostRoute, isRouteOf, postRoute } from "./feedRoute";
import { PADDLE_POSTS, paddleDetail } from "./paddlePosts";
import { SAMPLE_FEED, type SamplePost } from "./sampleFeed";

const star = detail as RecommendedRouteDetail;

/** A post made from the star of the fixtures. */
const POST: SamplePost = {
  id: star.id,
  user: "dade.runs",
  title: "A star over Trento",
  city: star.city,
  shape: "star",
  route_m: star.route_m,
  minutes: 30,
  score: 93,
  line: [star.points[0], star.points[1], star.points[0]],
};

/** An API that answers each path with a body, or 404; it keeps the paths. */
function api(bodies: Record<string, unknown>) {
  const asked: string[] = [];
  const fetchFn = jest.fn(async (url: string) => {
    const path = url.replace("http://api", "");
    asked.push(path);
    return path in bodies
      ? Response.json(bodies[path])
      : Response.json({ error: {} }, { status: 404 });
  }) as unknown as typeof fetch;
  return { fetchFn, asked };
}

const NEAR = `/recommended-routes?lat=${POST.line[0][0].toFixed(2)}&lon=${POST.line[0][1].toFixed(2)}&radius_m=5000`;

test("a post is a route of «Explore» while its own is fetched", () => {
  expect(postRoute(POST)).toEqual({
    id: star.id,
    city: "trento",
    shape: "star",
    word: null,
    style: null,
    distance_m: star.route_m,
    route_m: star.route_m,
    similarity: 0.93,
    start: star.points[0],
    away_m: 0,
    preview: POST.line,
  });
});

test("every example drawing is a route to open", () => {
  for (const post of SAMPLE_FEED) {
    const route = postRoute(post);
    expect(route.start).toEqual(post.line[0]);
    expect(route.similarity).toBeGreaterThan(0);
    expect(route.similarity).toBeLessThanOrEqual(1);
  }
});

test("the route of a post is the same figure, in the same city, as long", () => {
  expect(isRouteOf(POST, star)).toBe(true);
  expect(isRouteOf(POST, { ...star, shape: "circle" })).toBe(false);
  expect(isRouteOf(POST, { ...star, city: "roma" })).toBe(false);
  expect(isRouteOf(POST, { ...star, route_m: star.route_m + 1 })).toBe(false);
  expect(isRouteOf(POST, { ...star, shape: null })).toBe(false);
});

test("the route still under the id of the post is fetched once", async () => {
  const { fetchFn, asked } = api({ [`/recommended-routes/${star.id}`]: star });
  const outcome = await fetchPostRoute(POST, { fetchFn, key: null })(
    "http://api",
    POST.id,
  );
  expect(outcome).toEqual({ kind: "route", route: star });
  expect(asked).toEqual([`/recommended-routes/${star.id}`]);
});

test("an id that is another route's by now: the route is found by its start", async () => {
  const moved = { ...star, id: "trento-star-5000-7" };
  const other = { ...star, shape: "circle", route_m: 4727 };
  const [first] = list.routes;
  const { fetchFn, asked } = api({
    [`/recommended-routes/${star.id}`]: other,
    [NEAR]: {
      routes: [
        { ...first, id: "trento-circle-5000-0", shape: "circle", route_m: 4727 },
        {
          ...first,
          id: moved.id,
          city: "trento",
          shape: "star",
          route_m: star.route_m,
        },
      ],
    },
    [`/recommended-routes/${moved.id}`]: moved,
  });
  const outcome = await fetchPostRoute(POST, { fetchFn, key: null })(
    "http://api",
    POST.id,
  );
  expect(outcome).toEqual({ kind: "route", route: moved });
  expect(asked).toEqual([
    `/recommended-routes/${star.id}`,
    NEAR,
    `/recommended-routes/${moved.id}`,
  ]);
});

test("an id that is nobody's: the route is found by its start", async () => {
  const moved = { ...star, id: "trento-star-5000-7" };
  const [first] = list.routes;
  const { fetchFn } = api({
    [NEAR]: {
      routes: [
        {
          ...first,
          id: moved.id,
          city: "trento",
          shape: "star",
          route_m: star.route_m,
        },
      ],
    },
    [`/recommended-routes/${moved.id}`]: moved,
  });
  const outcome = await fetchPostRoute(POST, { fetchFn, key: null })(
    "http://api",
    POST.id,
  );
  expect(outcome).toEqual({ kind: "route", route: moved });
});

test("a route no longer in the catalogue does not open as another", async () => {
  const other = { ...star, shape: "circle", route_m: 4727 };
  const [first] = list.routes;
  const { fetchFn } = api({
    [`/recommended-routes/${star.id}`]: other,
    [NEAR]: { routes: [{ ...first, shape: "circle", route_m: 4727 }] },
  });
  expect(
    await fetchPostRoute(POST, { fetchFn, key: null })("http://api", POST.id),
  ).toEqual({ kind: "failed" });
});

test("with the API down it fails, and never throws", async () => {
  const fetchFn = jest
    .fn()
    .mockRejectedValue(
      new TypeError("Network request failed"),
    ) as unknown as typeof fetch;
  expect(
    await fetchPostRoute(POST, { fetchFn, key: null })("http://api", POST.id),
  ).toEqual({ kind: "failed" });
});

describe("a drawing on the water (TASK-228)", () => {
  const [heart, , , dog] = PADDLE_POSTS;

  test("is a route of «Explore» with «Paddle»: its distance, its pieces", () => {
    expect(postRoute(heart)).toEqual({
      id: "example:heart:paddling:45.8811,10.8456",
      city: "Lago di Garda",
      shape: "heart",
      word: null,
      style: null,
      // The distance asked for, not the one paddled.
      distance_m: 2000,
      route_m: heart.route_m,
      similarity: 0.96,
      start: heart.line[0],
      away_m: 0,
      preview: heart.line,
    });
    expect(postRoute(dog).gaps).toEqual(dog.gaps);
    expect(postRoute(dog).gaps?.length).toBeGreaterThan(0);
  });

  test("its route came with the app: nothing is asked, and it is paddled", async () => {
    const { fetchFn, asked } = api({});
    for (const post of PADDLE_POSTS) {
      const outcome = await fetchPostRoute(post, { fetchFn })("http://api", post.id);
      expect(outcome).toEqual({ kind: "route", route: paddleDetail(post) });
      if (outcome.kind === "route") {
        expect(outcome.route.activity).toBe("paddling");
        expect(outcome.route.shape).toBe(post.shape);
      }
    }
    expect(asked).toEqual([]);
  });
});
