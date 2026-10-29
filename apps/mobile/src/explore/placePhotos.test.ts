import answer from "@shaperoute/shared-types/fixtures/place-photos.json";
import { act, renderHook } from "@testing-library/react-native";

import {
  apiPhoto,
  fetchPlacePhotos,
  forgetPlacePhotos,
  MAX_ASKED,
  usePlacePhotos,
} from "./placePhotos";

const API = "http://192.168.1.23:8000";
const MOREDA = "Q1442886";
const OYON = "Q581589";

/** The API's answer for the items asked, as the fixture has them. */
function api(photos: Record<string, unknown> = answer.photos) {
  return jest.fn(async (input: RequestInfo | URL) => {
    const asked = new URL(String(input)).searchParams.get("items")?.split(",") ?? [];
    return Response.json({
      photos: Object.fromEntries(
        Object.entries(photos).filter(([item]) => asked.includes(item)),
      ),
    });
  });
}

beforeEach(() => {
  forgetPlacePhotos();
});

test("the photos of the items asked, read from the API with its key", async () => {
  const fetchFn = api();
  const found = await fetchPlacePhotos(API, [MOREDA, OYON, "Q1"], {
    fetchFn,
    key: "k",
  });
  expect(found).toEqual(
    new Map([
      [
        MOREDA,
        { url: `/city-photos/${MOREDA}.jpg`, credit: "© LBM1948 · CC BY-SA 4.0" },
      ],
      [OYON, { url: `/city-photos/${OYON}.jpg`, credit: null }],
    ]),
  );
  const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe(`${API}/place-photos?items=${MOREDA}%2C${OYON}%2CQ1`);
  expect(init.headers).toEqual({ "X-API-Key": "k" });
});

test("a photo only from the API itself, never from another host", () => {
  expect(apiPhoto({ url: "/city-photos/Q1.jpg", credit: " " })).toEqual({
    url: "/city-photos/Q1.jpg",
    credit: null,
  });
  for (const url of ["https://upload.wikimedia.org/a.jpg", "//evil/a.jpg", "a.jpg"]) {
    expect(apiPhoto({ url, credit: null })).toBeNull();
  }
  expect(apiPhoto(null)).toBeNull();
  expect(apiPhoto("/city-photos/Q1.jpg")).toBeNull();
});

test("an API without the photos, or none at all, gives none and no error", async () => {
  const old = jest.fn(async () =>
    Response.json({ detail: "Not Found" }, { status: 404 }),
  );
  expect(await fetchPlacePhotos(API, [MOREDA], { fetchFn: old })).toBeNull();
  const down = jest.fn(async () => {
    throw new TypeError("Network request failed");
  });
  expect(await fetchPlacePhotos(API, [MOREDA], { fetchFn: down })).toBeNull();
  const odd = jest.fn(async () => Response.json({ photos: [] }));
  expect(await fetchPlacePhotos(API, [MOREDA], { fetchFn: odd })).toEqual(new Map());
});

test("each item is asked once in a run, at most fifteen a request", async () => {
  const items = Array.from({ length: MAX_ASKED + 2 }, (_, n) => `Q${n + 1}`);
  const fetchFn = api({ Q16: answer.photos[MOREDA] });
  const { result, rerender } = await renderHook(
    ({ asked }: { asked: string[] }) => usePlacePhotos(API, asked, fetchFn),
    { initialProps: { asked: items } },
  );
  await act(async () => {});
  expect(fetchFn).toHaveBeenCalledTimes(2);
  expect(result.current).toEqual(new Map([["Q16", answer.photos[MOREDA]]]));

  // Asked again, and with an item already known: nothing new asked.
  await rerender({ asked: ["Q16", "Q2"] });
  await act(async () => {});
  expect(fetchFn).toHaveBeenCalledTimes(2);
  expect(result.current).toEqual(new Map([["Q16", answer.photos[MOREDA]]]));
});

test("without an API, or without items, nothing is asked", async () => {
  const fetchFn = api();
  const none = await renderHook(() => usePlacePhotos(null, [MOREDA], fetchFn));
  const empty = await renderHook(() => usePlacePhotos(API, [], fetchFn));
  await act(async () => {});
  expect(fetchFn).not.toHaveBeenCalled();
  expect(none.result.current.size).toBe(0);
  expect(empty.result.current.size).toBe(0);
});
