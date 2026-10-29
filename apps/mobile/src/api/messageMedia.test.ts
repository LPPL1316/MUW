import mediaExample from "@shaperoute/shared-types/fixtures/message-media.json";

import {
  cachedMedia,
  cachedName,
  mediaImage,
  mediaUrl,
  putPoster,
  type Upload,
  uploadMedia,
} from "./messageMedia";

// The files of the messages (TASK-333): sent as they are with the key and
// the token, the answer read as the API's; read the same way, a video once
// into the cache.

const URL = "http://api";
const TOKEN = "t0k3n";
const FILE = "file:///cache/ImagePicker/a.mp4";

const answered = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  jest.fn<ReturnType<Upload>, Parameters<Upload>>(async () => ({
    status,
    body: body === null ? "" : JSON.stringify(body),
    headers,
  }));

test("a file goes as it is, and the API's answer comes back", async () => {
  const upload = answered(201, mediaExample);
  const kept = await uploadMedia(URL, TOKEN, FILE, "video/mp4", { key: "k", upload });
  expect(kept).toEqual({ kind: "ok", value: mediaExample });
  expect(upload).toHaveBeenCalledWith(`${URL}/me/message-media`, FILE, {
    httpMethod: "POST",
    mimeType: "video/mp4",
    headers: {
      "Content-Type": "video/mp4",
      "X-API-Key": "k",
      Authorization: `Bearer ${TOKEN}`,
    },
  });
});

test("what the API refuses keeps its code and its wait", async () => {
  const error = {
    error: {
      code: "too_many_requests",
      message: "Too many videos today: try again tomorrow.",
    },
  };
  const upload = answered(429, error, { "retry-after": "3600" });
  const refused = await uploadMedia(URL, TOKEN, FILE, "video/mp4", {
    key: null,
    upload,
  });
  expect(refused).toEqual({
    kind: "api_error",
    code: "too_many_requests",
    message: "Too many videos today: try again tomorrow.",
    retryAfterS: 3600,
  });
  const strange = await uploadMedia(URL, TOKEN, FILE, "video/mp4", {
    key: null,
    upload: answered(502, null),
  });
  expect(strange).toEqual({ kind: "bad_answer", status: 502 });
});

test("without a connection the file did not go", async () => {
  const upload = jest.fn<ReturnType<Upload>, Parameters<Upload>>(async () => {
    throw new Error("offline");
  });
  expect(
    await uploadMedia(URL, TOKEN, FILE, "image/jpeg", { key: null, upload }),
  ).toEqual({
    kind: "unreachable",
    url: URL,
  });
});

test("a video's first picture is put beside it", async () => {
  const upload = answered(204, null);
  const put = await putPoster(URL, TOKEN, mediaExample.id, "file:///cache/p.jpg", {
    key: null,
    upload,
  });
  expect(put).toEqual({ kind: "ok", value: null });
  expect(upload.mock.calls[0][0]).toBe(
    `${URL}/me/message-media/${mediaExample.id}/poster`,
  );
  expect(upload.mock.calls[0][2].httpMethod).toBe("PUT");
});

test("a photo is read with the key and the token", () => {
  expect(mediaUrl(URL, "a b")).toBe(`${URL}/message-media/a%20b`);
  expect(mediaImage(URL, TOKEN, "id", true, "k")).toEqual({
    uri: `${URL}/message-media/id/poster`,
    headers: { "X-API-Key": "k", Authorization: `Bearer ${TOKEN}` },
  });
});

test("a video is downloaded once into the cache", async () => {
  const video = { kind: "video" as const, media_id: mediaExample.id };
  const download = jest.fn(async () => {});
  const there = new Set<string>();
  const exists = (uri: string) => there.has(uri);
  const uri = await cachedMedia(URL, TOKEN, video, { key: null, download }, exists);
  expect(uri).toBe(`file:///cache/${cachedName(video)}`);
  expect(cachedName(video)).toBe(`message-${mediaExample.id}.mp4`);
  expect(download).toHaveBeenCalledWith(
    `${URL}/message-media/${mediaExample.id}`,
    uri,
    {
      Authorization: `Bearer ${TOKEN}`,
    },
  );
  there.add(uri ?? "");
  await cachedMedia(URL, TOKEN, video, { key: null, download }, exists);
  expect(download).toHaveBeenCalledTimes(1);
  // Expired, or no connection: nothing to show.
  expect(
    await cachedMedia(URL, TOKEN, { kind: "video", media_id: null }, {}, exists),
  ).toBeNull();
  const failing = jest.fn(async () => {
    throw new Error("410");
  });
  expect(
    await cachedMedia(
      URL,
      TOKEN,
      { kind: "photo", media_id: "x" },
      { key: null, download: failing },
      exists,
    ),
  ).toBeNull();
});
