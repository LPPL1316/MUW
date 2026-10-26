import userPhotos from "@shaperoute/shared-types/fixtures/user-photos.json";

import { answers, apiError } from "../account/testing";
import { fetchUserPhotos, isUserPhoto, isUserPhotosPage } from "./userPhotos";

// GET /users/{public_id}/photos (TASK-305).

const URL = "http://api";
const TOKEN = "the-token";
const ID = "8c1f7a52-3d4e-4b9a-9f61-2a7c0e5d9b13";

test("the example of the API is what the app reads", () => {
  expect(isUserPhotosPage(userPhotos)).toBe(true);
  expect(isUserPhotosPage({ ...userPhotos, next: null })).toBe(true);
  const [photo] = userPhotos.photos;
  expect(isUserPhoto({ ...photo, drawing_id: undefined })).toBe(false);
  expect(isUserPhoto({ ...photo, url: 7 })).toBe(false);
  expect(isUserPhotosPage({ photos: "none", next: null })).toBe(false);
});

test("the first page without a cursor, the next with it", async () => {
  const fetchFn: jest.Mock = answers(
    { status: 200, body: userPhotos },
    { status: 200, body: { ...userPhotos, next: null } },
  );
  const first = await fetchUserPhotos(URL, TOKEN, ID, null, { fetchFn, key: null });
  expect(first).toEqual({ kind: "ok", value: userPhotos });
  expect(fetchFn.mock.calls[0][0]).toBe(`${URL}/users/${ID}/photos`);
  expect(fetchFn.mock.calls[0][1]).toMatchObject({
    method: "GET",
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  await fetchUserPhotos(URL, TOKEN, ID, userPhotos.next, { fetchFn, key: null });
  expect(fetchFn.mock.calls[1][0]).toBe(
    `${URL}/users/${ID}/photos?cursor=${userPhotos.next}`,
  );
});

test("an API older than TASK-305 has no photos: not found", async () => {
  const fetchFn: jest.Mock = answers({
    status: 404,
    body: apiError("http_error", "Not Found"),
  });
  const outcome = await fetchUserPhotos(URL, TOKEN, ID, null, { fetchFn, key: null });
  expect(outcome).toMatchObject({ kind: "api_error", code: "http_error" });
});
