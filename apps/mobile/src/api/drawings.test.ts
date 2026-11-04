import drawing from "@shaperoute/shared-types/fixtures/drawing.json";
import detail from "@shaperoute/shared-types/fixtures/drawing-details.json";
import photoRequest from "@shaperoute/shared-types/fixtures/drawing-photo-request.json";
import request from "@shaperoute/shared-types/fixtures/drawing-request-details.json";
import drawings from "@shaperoute/shared-types/fixtures/drawings.json";
import myDrawing from "@shaperoute/shared-types/fixtures/my-drawing.json";
import myDetails from "@shaperoute/shared-types/fixtures/my-drawing-details.json";
import type { DrawingPhoto, MyDrawing } from "@shaperoute/shared-types";

import { answers, apiError } from "../account/testing";
import {
  choiceFrom,
  choiceOf,
  descriptionOf,
  type DrawingChoice,
  drawingPhotoSource,
  drawingProblem,
  fetchDrawing,
  fetchMyDrawing,
  fetchMyDrawings,
  fetchUserDrawings,
  isChosen,
  isDrawing,
  isDrawingDetail,
  isDrawingsPage,
  isMyDrawing,
  isSeen,
  NOT_CHOSEN,
  removeDrawingPhoto,
  sameChoice,
  saveDrawing,
  saveDrawingPhoto,
  titleOf,
  worthAgain,
} from "./drawings";

const URL = "http://api";
const TOKEN = "the-token";
const KEY = "7c2e91a4b05d3f68";
const AUTH = { Authorization: `Bearer ${TOKEN}` };
const options = (fetchFn: jest.Mock) => ({ fetchFn, key: null });

const MY_DETAILS = myDetails as MyDrawing;

/** The choice of the API's example with details. */
const CHOSEN: DrawingChoice = {
  title: "Sunday heart by the river",
  description: "Legs heavy after the bridge.\nThe heart came out round all the same.",
  activity: "running",
  tags: [
    { public_id: "3b9d2e10-7c4a-4f8e-a1d6-5e2f9c0b7a44", username: "adam.trento" },
  ],
  visibility: "followers",
};

test("the examples of the API are what the app reads", () => {
  expect(isMyDrawing(myDrawing)).toBe(true);
  expect(isMyDrawing(myDetails)).toBe(true);
  expect(isMyDrawing({ ...myDrawing, id: null, title: null, public: false })).toBe(
    true,
  );
  expect(isMyDrawing({ ...myDrawing, public: "yes" })).toBe(false);
  expect(isMyDrawing({ ...myDetails, visibility: "friends" })).toBe(false);
  expect(isMyDrawing({ ...myDetails, tags: [{ public_id: 1 }] })).toBe(false);
  expect(isMyDrawing({ ...myDetails, photos: [{ n: 1 }] })).toBe(false);
  expect(isDrawingsPage(drawings)).toBe(true);
  expect(isDrawing(drawings.drawings[0])).toBe(true);
  // A run without a route: no score.
  expect(isDrawing({ ...drawings.drawings[0], score: null, fidelity: null })).toBe(
    true,
  );
  expect(isDrawing({ ...drawings.drawings[0], track_preview: [[46]] })).toBe(false);
  expect(isDrawingDetail(drawing)).toBe(true);
  expect(isDrawingDetail(detail)).toBe(true);
  expect(isDrawingDetail({ ...drawing, author: null })).toBe(false);
  // The body of the choice: every field, nothing else.
  expect(Object.keys(request).sort()).toEqual([
    "activity",
    "description",
    "tags",
    "title",
    "visibility",
  ]);
});

test("a title or a description loses the spaces around it, and empty is none", () => {
  expect(titleOf("  Sunday heart  ")).toBe("Sunday heart");
  expect(titleOf("   ")).toBeNull();
  expect(titleOf("")).toBeNull();
  expect(descriptionOf(" Heavy legs.\nRound heart. ")).toBe(
    "Heavy legs.\nRound heart.",
  );
  expect(descriptionOf(" \n ")).toBeNull();
});

test("the choice as the API keeps it, and as an API before TASK-208 kept it", () => {
  expect(choiceOf(MY_DETAILS)).toEqual(CHOSEN);
  expect(choiceOf(myDrawing as MyDrawing)).toEqual({
    ...NOT_CHOSEN,
    title: "Sunday heart by the river",
    visibility: "everyone",
  });
  expect(choiceOf({ ...(myDrawing as MyDrawing), public: false })).toEqual({
    ...NOT_CHOSEN,
    title: "Sunday heart by the river",
  });
});

test("a choice read from a file of the phone is made whole", () => {
  expect(choiceFrom(CHOSEN)).toEqual(CHOSEN);
  expect(choiceFrom({ title: "Heart", public: true })).toEqual({
    ...NOT_CHOSEN,
    title: "Heart",
    visibility: "everyone",
  });
  expect(choiceFrom({ title: "", public: false })).toEqual(NOT_CHOSEN);
  expect(choiceFrom({ title: "Heart" })).toBeNull();
  expect(choiceFrom({ ...CHOSEN, activity: "flying" })).toBeNull();
  // A tag that is not one is left out, the rest stays.
  expect(choiceFrom({ ...CHOSEN, tags: [{ name: "adam" }] })).toEqual({
    ...CHOSEN,
    tags: [],
  });
  expect(choiceFrom(null)).toBeNull();
});

test("something chosen is worth a drawing; nothing chosen is not", () => {
  expect(isChosen(NOT_CHOSEN)).toBe(false);
  expect(isChosen({ ...NOT_CHOSEN, title: "Heart" })).toBe(true);
  expect(isChosen({ ...NOT_CHOSEN, description: "Hard." })).toBe(true);
  expect(isChosen({ ...NOT_CHOSEN, activity: "cycling" })).toBe(true);
  expect(isChosen({ ...NOT_CHOSEN, tags: CHOSEN.tags })).toBe(true);
  expect(isChosen({ ...NOT_CHOSEN, visibility: "followers" })).toBe(true);
  expect(isSeen("everyone")).toBe(true);
  expect(isSeen("followers")).toBe(true);
  expect(isSeen("only_me")).toBe(false);
  expect(sameChoice(CHOSEN, { ...CHOSEN })).toBe(true);
  expect(sameChoice(CHOSEN, { ...CHOSEN, tags: [] })).toBe(false);
  expect(sameChoice(CHOSEN, { ...CHOSEN, description: null })).toBe(false);
});

test("the choice for a run is asked with the token", async () => {
  const fetchFn = answers({ status: 200, body: myDrawing });
  const outcome = await fetchMyDrawing(URL, TOKEN, KEY, options(fetchFn));
  expect(outcome).toEqual({ kind: "ok", value: myDrawing });
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe(`http://api/me/activities/${KEY}/drawing`);
  expect(init).toMatchObject({ method: "GET", headers: AUTH });
});

test("the choice goes whole, every field every time, the tags as public ids", async () => {
  const fetchFn = answers({ status: 200, body: myDetails });
  const outcome = await saveDrawing(URL, TOKEN, KEY, CHOSEN, options(fetchFn));
  expect(outcome.kind).toBe("ok");
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe(`http://api/me/activities/${KEY}/drawing`);
  expect(init).toMatchObject({ method: "PUT", headers: AUTH });
  expect(JSON.parse(String(init?.body))).toEqual(request);

  const off = answers({
    status: 200,
    body: { ...myDrawing, title: null, public: false },
  });
  await saveDrawing(URL, TOKEN, KEY, NOT_CHOSEN, options(off));
  expect(JSON.parse(String(off.mock.calls[0][1]?.body))).toEqual({
    title: null,
    visibility: "only_me",
    description: null,
    activity: "running",
    tags: [],
  });
});

test("a photo goes to its place and comes back as the drawing; a place is emptied with DELETE", async () => {
  const fetchFn = answers({ status: 200, body: myDetails }, { status: 204 });
  const outcome = await saveDrawingPhoto(
    URL,
    TOKEN,
    KEY,
    2,
    photoRequest.image,
    options(fetchFn),
  );
  expect(outcome).toEqual({ kind: "ok", value: myDetails });
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe(`http://api/me/activities/${KEY}/drawing/photos/2`);
  expect(init).toMatchObject({ method: "PUT", headers: AUTH });
  expect(JSON.parse(String(init?.body))).toEqual(photoRequest);

  expect(await removeDrawingPhoto(URL, TOKEN, KEY, 2, options(fetchFn))).toEqual({
    kind: "ok",
    value: null,
  });
  expect(fetchFn.mock.calls[1][0]).toBe(
    `http://api/me/activities/${KEY}/drawing/photos/2`,
  );
  expect(fetchFn.mock.calls[1][1]).toMatchObject({ method: "DELETE", headers: AUTH });
});

test("a photo on the API is shown from its address, with the token", () => {
  const photo = MY_DETAILS.photos?.[0] as DrawingPhoto;
  expect(drawingPhotoSource(URL, TOKEN, photo)).toEqual({
    uri: `http://api${photo.url}`,
    headers: AUTH,
  });
});

test("the runs with a title or public come as a list", async () => {
  const fetchFn = answers({ status: 200, body: { drawings: [myDrawing] } });
  expect(await fetchMyDrawings(URL, TOKEN, options(fetchFn))).toEqual({
    kind: "ok",
    value: [myDrawing],
  });
  expect(fetchFn.mock.calls[0][0]).toBe("http://api/me/drawings");
});

test("an API from before drawings has none", async () => {
  const fetchFn = answers({ status: 404, body: apiError("http_error") });
  expect(await fetchMyDrawings(URL, TOKEN, options(fetchFn))).toEqual({
    kind: "ok",
    value: [],
  });
});

test("the drawings of a profile come a page at a time", async () => {
  const fetchFn = answers(
    { status: 200, body: { ...drawings, next: "abc/1" } },
    { status: 200, body: drawings },
  );
  const first = await fetchUserDrawings(URL, TOKEN, "a b", null, options(fetchFn));
  expect(first.kind === "ok" && first.value.next).toBe("abc/1");
  await fetchUserDrawings(URL, TOKEN, "a b", "abc/1", options(fetchFn));
  expect(fetchFn.mock.calls[0][0]).toBe("http://api/users/a%20b/drawings");
  expect(fetchFn.mock.calls[1][0]).toBe(
    "http://api/users/a%20b/drawings?cursor=abc%2F1",
  );
  expect(fetchFn.mock.calls[1][1]).toMatchObject({ method: "GET", headers: AUTH });
});

// Activities this app does not know: one the API may add one day, and one
// that is no name at all.
const UNKNOWN = ["rowing", "sledging"];

test.each(UNKNOWN)(
  "a drawing of %s is read as one of no activity, and its page still loads",
  (activity) => {
    // The guards drop the field from the body they read: each its own copy.
    const page = structuredClone({
      ...drawings,
      drawings: [{ ...drawings.drawings[0], activity }, ...drawings.drawings.slice(1)],
    });
    expect(isDrawingsPage(page)).toBe(true);
    expect(page.drawings[0]).not.toHaveProperty("activity");
    expect(page.drawings[0].id).toBe(drawings.drawings[0].id);
    const one = { ...structuredClone(detail), activity };
    expect(isDrawingDetail(one)).toBe(true);
    expect(one).not.toHaveProperty("activity");
  },
);

test.each(["skiing", "xc_skiing"])(
  "a drawing of %s keeps it, in a profile page and whole (TASK-375 B2)",
  (activity) => {
    const page = structuredClone({
      ...drawings,
      drawings: [{ ...drawings.drawings[0], activity }, ...drawings.drawings.slice(1)],
    });
    expect(isDrawingsPage(page)).toBe(true);
    expect(page.drawings[0]).toHaveProperty("activity", activity);
    const one = { ...structuredClone(detail), activity };
    expect(isDrawingDetail(one)).toBe(true);
    expect(one.activity).toBe(activity);
  },
);

test("the owner's own drawing keeps a day on the snow, not an activity unknown", () => {
  // B1: so changing who sees it never sends it back as a run.
  for (const activity of ["skiing", "xc_skiing"]) {
    const mine = { ...structuredClone(myDetails), activity };
    expect(isMyDrawing(mine)).toBe(true);
    expect(mine.activity).toBe(activity);
    expect(choiceOf(mine as MyDrawing).activity).toBe(activity);
  }
  const rowing = { ...structuredClone(myDetails), activity: "rowing" };
  expect(isMyDrawing(rowing)).toBe(true);
  expect(rowing).not.toHaveProperty("activity");
});

test("a day on the snow waiting on the phone keeps its activity", () => {
  expect(choiceFrom({ ...CHOSEN, activity: "skiing" })).toEqual({
    ...CHOSEN,
    activity: "skiing",
  });
  expect(choiceFrom({ ...CHOSEN, activity: "xc_skiing" })?.activity).toBe("xc_skiing");
});

test("a day on the snow is sent as itself", async () => {
  const fetchFn = answers({ status: 200, body: myDetails });
  await saveDrawing(
    URL,
    TOKEN,
    KEY,
    { ...CHOSEN, activity: "skiing" },
    options(fetchFn),
  );
  expect(JSON.parse(String(fetchFn.mock.calls[0][1]?.body))).toMatchObject({
    activity: "skiing",
  });
});

test("an activity this app knows stays, one that is no name still refuses", () => {
  const listed = drawings.drawings[0];
  const known = { ...structuredClone(listed), activity: "cycling" };
  expect(isDrawing(known)).toBe(true);
  expect(known.activity).toBe("cycling");
  expect(isDrawing({ ...structuredClone(listed), activity: 3 })).toBe(false);
  expect(isDrawing({ ...structuredClone(listed), activity: null })).toBe(false);
});

test("a profile page with a day on the snow comes whole", async () => {
  const page = {
    ...drawings,
    drawings: [
      { ...drawings.drawings[0], activity: "skiing" },
      ...drawings.drawings.slice(1),
    ],
  };
  const fetchFn = answers({ status: 200, body: page });
  const got = await fetchUserDrawings(URL, TOKEN, "a", null, options(fetchFn));
  expect(got.kind).toBe("ok");
  expect(got.kind === "ok" && got.value.drawings).toHaveLength(page.drawings.length);
});

test("a drawing is asked by its id", async () => {
  const fetchFn = answers({ status: 200, body: drawing });
  expect(await fetchDrawing(URL, TOKEN, drawing.id, options(fetchFn))).toEqual({
    kind: "ok",
    value: drawing,
  });
  expect(fetchFn.mock.calls[0][0]).toBe(`http://api/drawings/${drawing.id}`);
});

test("only no network and a busy API are worth another try", () => {
  expect(worthAgain({ kind: "unreachable", url: URL })).toBe(true);
  expect(worthAgain({ kind: "bad_answer", status: 502 })).toBe(true);
  expect(worthAgain({ kind: "bad_answer", status: 400 })).toBe(false);
  const busy = {
    kind: "api_error",
    retryAfterS: 30,
    ...apiError("too_many_requests").error,
  };
  expect(worthAgain(busy as never)).toBe(true);
  const gone = {
    kind: "api_error",
    retryAfterS: null,
    ...apiError("http_error").error,
  };
  expect(worthAgain(gone as never)).toBe(false);
  expect(worthAgain({ kind: "ok", value: myDrawing })).toBe(false);
});

test("a problem is said in words, the API's own for a refused choice", () => {
  expect(drawingProblem({ kind: "ok", value: null })).toBeNull();
  expect(drawingProblem({ kind: "unreachable", url: URL })).toBe(
    "No connection. Try again when you are online.",
  );
  const short = {
    kind: "api_error",
    retryAfterS: null,
    code: "invalid_request",
    message: "This run is too short to publish.",
  };
  expect(drawingProblem(short as never)).toBe("This run is too short to publish.");
  const gone = {
    kind: "api_error",
    retryAfterS: null,
    ...apiError("http_error").error,
  };
  expect(drawingProblem(gone as never)).toBe(
    "This run is no longer in your activities.",
  );
  const ended = {
    kind: "api_error",
    retryAfterS: null,
    ...apiError("session_expired").error,
  };
  expect(drawingProblem(ended as never)).toBe("Your session has ended. Log in again.");
});
