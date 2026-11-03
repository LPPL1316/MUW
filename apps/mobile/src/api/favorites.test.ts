import cyclingFavorite from "@shaperoute/shared-types/fixtures/favorite-cycling.json";
import cyclingRequest from "@shaperoute/shared-types/fixtures/favorite-request-cycling.json";
import walkedRequest from "@shaperoute/shared-types/fixtures/favorite-request-walks.json";
import request from "@shaperoute/shared-types/fixtures/favorite-request.json";
import walkedFavorite from "@shaperoute/shared-types/fixtures/favorite-walks.json";
import favorite from "@shaperoute/shared-types/fixtures/favorite.json";
import cyclingFavorites from "@shaperoute/shared-types/fixtures/favorites-cycling.json";
import onFootFavorite from "@shaperoute/shared-types/fixtures/favorite-on-foot.json";
import onFootRequest from "@shaperoute/shared-types/fixtures/favorite-request-on-foot.json";
import favorites from "@shaperoute/shared-types/fixtures/favorites.json";

import { answers, apiError } from "../account/testing";
import {
  asBefore,
  beforeOnFoot,
  type Favorite,
  favoriteActivity,
  type FavoriteDetail,
  type FavoriteRequest,
  fetchFavorite,
  fetchFavorites,
  isFavorite,
  isFavoriteDetail,
  keepFavorite,
  removeFavorite,
} from "./favorites";

const URL = "http://api";
const TOKEN = "the-token";
const ID = favorite.id;
const AUTH = { Authorization: `Bearer ${TOKEN}` };

test("the examples of the API are what the app reads", () => {
  expect(favorites.favorites.every(isFavorite)).toBe(true);
  expect(isFavoriteDetail(favorite)).toBe(true);
  // The request has the fields of the type, no more and no fewer.
  const typed: FavoriteRequest = request as FavoriteRequest;
  expect(Object.keys(typed).sort()).toEqual(
    [
      "city",
      "distance_m",
      "points",
      "route_m",
      "shape",
      "similarity",
      "style",
      "title",
      "word",
    ].sort(),
  );
});

test("the list is asked with the token, and comes as the favorites", async () => {
  const fetchFn: jest.Mock = answers({ status: 200, body: favorites });
  const outcome = await fetchFavorites(URL, TOKEN, { fetchFn, key: null });
  expect(outcome).toEqual({ kind: "ok", value: favorites.favorites });
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe("http://api/me/favorites");
  expect(init).toMatchObject({ method: "GET", headers: AUTH });
});

test("one favorite comes whole", async () => {
  const fetchFn: jest.Mock = answers({ status: 200, body: favorite });
  const outcome = await fetchFavorite(URL, TOKEN, ID, { fetchFn, key: null });
  expect(outcome).toEqual({ kind: "ok", value: favorite });
  expect(fetchFn.mock.calls[0][0]).toBe(`http://api/me/favorites/${ID}`);
});

test("keeping sends the route under its key; new or already kept is the same", async () => {
  const [kept] = favorites.favorites;
  const fetchFn: jest.Mock = answers(
    { status: 201, body: kept },
    { status: 200, body: kept },
  );
  const body = request as FavoriteRequest;
  for (let i = 0; i < 2; i += 1) {
    const outcome = await keepFavorite(URL, TOKEN, ID, body, { fetchFn, key: null });
    expect(outcome).toEqual({ kind: "ok", value: kept });
  }
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe(`http://api/me/favorites/${ID}`);
  expect(init).toMatchObject({
    method: "PUT",
    headers: { ...AUTH, "Content-Type": "application/json" },
  });
  expect(JSON.parse(String(init?.body))).toEqual(request);
});

test("removing answers with nothing", async () => {
  const fetchFn: jest.Mock = answers({ status: 204 });
  const outcome = await removeFavorite(URL, TOKEN, ID, { fetchFn, key: null });
  expect(outcome).toEqual({ kind: "ok", value: null });
  expect(fetchFn.mock.calls[0][1]).toMatchObject({ method: "DELETE", headers: AUTH });
});

test("an error, no API, and an answer that is not one are told apart", async () => {
  const fetchFn: jest.Mock = answers(
    { status: 401, body: apiError("session_expired") },
    new Error("offline"),
    { status: 200, body: { favorites: [{ id: 1 }] } },
    { status: 200, body: { ...favorite, points: [[46.0, 11.0]] } },
  );
  const options = { fetchFn, key: null };
  expect(await fetchFavorites(URL, TOKEN, options)).toMatchObject({
    kind: "api_error",
    code: "session_expired",
  });
  expect(await fetchFavorites(URL, TOKEN, options)).toEqual({
    kind: "unreachable",
    url: URL,
  });
  expect(await fetchFavorites(URL, TOKEN, options)).toEqual({
    kind: "bad_answer",
    status: 200,
  });
  expect(await fetchFavorite(URL, TOKEN, ID, options)).toEqual({
    kind: "bad_answer",
    status: 200,
  });
});

// --- A word with the pen up (TASK-199) ---

test("a favorite with walks, and one of an older API without, are both read", () => {
  expect(isFavoriteDetail(walkedFavorite)).toBe(true);
  expect(walkedFavorite.walks).toEqual([[2, 5]]);
  expect("walks" in favorite).toBe(false);
  expect(isFavoriteDetail(favorite)).toBe(true);
  const typed: FavoriteRequest = walkedRequest as FavoriteRequest;
  expect(Object.keys(typed)).toEqual([...Object.keys(request), "walks"]);
});

test("a favorite with walks an older API refuses is kept without them", async () => {
  const [kept] = favorites.favorites;
  const fetchFn: jest.Mock = answers(
    {
      status: 422,
      body: apiError("invalid_request", "Extra inputs are not permitted"),
    },
    { status: 201, body: kept },
  );
  const body = walkedRequest as FavoriteRequest;
  const outcome = await keepFavorite(URL, TOKEN, ID, body, { fetchFn, key: null });
  expect(outcome).toEqual({ kind: "ok", value: kept });
  expect(String(fetchFn.mock.calls[0][1]?.body)).toBe(JSON.stringify(walkedRequest));
  const { walks: _walks, ...older } = walkedRequest;
  expect(String(fetchFn.mock.calls[1][1]?.body)).toBe(JSON.stringify(older));
});

test("a favorite without walks that is refused is not sent again", async () => {
  const fetchFn: jest.Mock = answers({
    status: 422,
    body: apiError("invalid_request", "You have 200 favorites."),
  });
  const body = request as FavoriteRequest;
  expect(
    await keepFavorite(URL, TOKEN, ID, body, { fetchFn, key: null }),
  ).toMatchObject({
    kind: "api_error",
    code: "invalid_request",
    message: "You have 200 favorites.",
  });
  expect(fetchFn).toHaveBeenCalledTimes(1);
});

// --- The activity a route was drawn for (TASK-200) ---

test("a bike favorite, and those of an older API, are read with their activity", () => {
  expect(cyclingFavorites.favorites.every(isFavorite)).toBe(true);
  expect(isFavoriteDetail(cyclingFavorite)).toBe(true);
  expect(favoriteActivity(cyclingFavorite)).toBe("cycling");
  expect(cyclingFavorites.favorites.map(favoriteActivity)).toEqual([
    "cycling",
    "running",
  ]);
  // Without the field, an older API's: a run.
  for (const older of [
    favorite as FavoriteDetail,
    walkedFavorite as FavoriteDetail,
    ...(favorites.favorites as Favorite[]),
  ]) {
    expect("activity" in older).toBe(false);
    expect(favoriteActivity(older)).toBe("running");
  }
  // An activity this app does not know is read as a run, as before; a swim
  // is one it knows since TASK-323 C2.
  expect(isFavorite({ ...favorites.favorites[0], activity: "hiking" })).toBe(true);
  expect(favoriteActivity({ activity: "hiking" })).toBe("running");
  expect(favoriteActivity({ activity: "swimming" })).toBe("swimming");
  expect(isFavorite({ ...favorites.favorites[0], activity: 3 })).toBe(false);
  expect(isFavoriteDetail({ ...favorite, activity: null })).toBe(false);
  // The request: the fields of before, and the activity last.
  const typed: FavoriteRequest = cyclingRequest as FavoriteRequest;
  expect(Object.keys(typed)).toEqual([...Object.keys(request), "activity"]);
});

test("a run is kept with the request of before, a bike route with its activity", async () => {
  const [bike, star] = cyclingFavorites.favorites;
  const fetchFn: jest.Mock = answers(
    { status: 201, body: star },
    { status: 201, body: bike },
  );
  const options = { fetchFn, key: null };
  await keepFavorite(URL, TOKEN, ID, request as FavoriteRequest, options);
  await keepFavorite(URL, TOKEN, bike.id, cyclingRequest as FavoriteRequest, options);
  // Byte for byte: an API older than TASK-200 takes the first.
  expect(String(fetchFn.mock.calls[0][1]?.body)).toBe(JSON.stringify(request));
  expect(String(fetchFn.mock.calls[1][1]?.body)).toBe(JSON.stringify(cyclingRequest));
  expect(asBefore(request as FavoriteRequest)).toBe(request);
});

test("a bike route an older API refuses is kept as an older app keeps it", async () => {
  const [kept] = favorites.favorites;
  const refused = {
    status: 422,
    body: apiError("invalid_request", "activity: Extra inputs are not permitted"),
  };
  const fetchFn: jest.Mock = answers(refused, { status: 201, body: kept });
  const options = { fetchFn, key: null };
  const bike = cyclingRequest as FavoriteRequest;
  expect(await keepFavorite(URL, TOKEN, ID, bike, options)).toEqual({
    kind: "ok",
    value: kept,
  });
  const { activity: _activity, ...older } = cyclingRequest;
  expect(String(fetchFn.mock.calls[1][1]?.body)).toBe(JSON.stringify(older));
  // A word with the pen up by bike: once more without both, as before
  // TASK-199; and only once.
  const again: jest.Mock = answers(refused, refused);
  const word = { ...(walkedRequest as FavoriteRequest), activity: "cycling" as const };
  expect(
    await keepFavorite(URL, TOKEN, ID, word, { fetchFn: again, key: null }),
  ).toMatchObject({
    kind: "api_error",
    code: "invalid_request",
  });
  expect(again).toHaveBeenCalledTimes(2);
  const { walks: _walks, ...unwalked } = walkedRequest;
  expect(String(again.mock.calls[1][1]?.body)).toBe(JSON.stringify(unwalked));
});

// --- The stretches of a bike route with the bike on foot (TASK-206) ---

test("a bike favorite with stretches on foot, and those of an older API, are read", () => {
  expect(isFavoriteDetail(onFootFavorite)).toBe(true);
  expect(onFootFavorite.on_foot).toEqual([[2, 3]]);
  expect(favoriteActivity(onFootFavorite)).toBe("cycling");
  expect("on_foot" in cyclingFavorite).toBe(false);
  // The request: the fields of a bike route, and the stretches last.
  const typed: FavoriteRequest = onFootRequest as FavoriteRequest;
  expect(Object.keys(typed)).toEqual([...Object.keys(cyclingRequest), "on_foot"]);
  // Without stretches, the same object: nothing to send again.
  expect(beforeOnFoot(cyclingRequest as FavoriteRequest)).toBe(cyclingRequest);
  const { on_foot: _onFoot, activity: _activity, ...older } = onFootRequest;
  expect(asBefore(typed)).toEqual(older);
});

test("stretches an API before TASK-206 refuses: kept without them, still by bike", async () => {
  const [kept] = cyclingFavorites.favorites;
  const refused = {
    status: 422,
    body: apiError("invalid_request", "on_foot: Extra inputs are not permitted"),
  };
  const fetchFn: jest.Mock = answers(refused, { status: 201, body: kept });
  const bike = onFootRequest as FavoriteRequest;
  expect(await keepFavorite(URL, TOKEN, ID, bike, { fetchFn, key: null })).toEqual({
    kind: "ok",
    value: kept,
  });
  expect(String(fetchFn.mock.calls[0][1]?.body)).toBe(JSON.stringify(onFootRequest));
  const { on_foot: _onFoot, ...byBike } = onFootRequest;
  expect(String(fetchFn.mock.calls[1][1]?.body)).toBe(JSON.stringify(byBike));
  expect(byBike.activity).toBe("cycling");
});

test("an API before TASK-200 refuses both: then as an older app, and no more", async () => {
  const [kept] = favorites.favorites;
  const refused = {
    status: 422,
    body: apiError("invalid_request", "Extra inputs are not permitted"),
  };
  const bike = onFootRequest as FavoriteRequest;
  const fetchFn: jest.Mock = answers(refused, refused, { status: 201, body: kept });
  expect(await keepFavorite(URL, TOKEN, ID, bike, { fetchFn, key: null })).toEqual({
    kind: "ok",
    value: kept,
  });
  const { on_foot: _onFoot, activity: _activity, ...older } = onFootRequest;
  expect(String(fetchFn.mock.calls[2][1]?.body)).toBe(JSON.stringify(older));
  // Refused three times: three requests, the last answer.
  const again: jest.Mock = answers(refused, refused, refused);
  expect(
    await keepFavorite(URL, TOKEN, ID, bike, { fetchFn: again, key: null }),
  ).toMatchObject({ kind: "api_error", code: "invalid_request" });
  expect(again).toHaveBeenCalledTimes(3);
});
