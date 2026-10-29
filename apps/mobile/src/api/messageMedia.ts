import type { MessageAttachment, MessageMedia } from "@shaperoute/shared-types";
import { File, Paths, UploadType } from "expo-file-system";

import { type AccountOutcome, authHeaders } from "./accounts";
import { apiKey, keyHeaders } from "./apiUrl";
import { isApiError } from "./routes";

/**
 * The photos and videos of the private messages (TASK-333, ADR-0289,
 * docs/API.md «Gli allegati»): the file goes first, as it is, with
 * POST /me/message-media; the message then carries its id. Reading one asks
 * with the key and the token, as every call: an image with headers, a video
 * downloaded into the cache and played from there.
 */

type Options = {
  key?: string | null;
  upload?: Upload;
  download?: Download;
};

/** What the phone answers after sending a file: as File.upload says it. */
export type Uploaded = {
  status: number;
  body: string;
  headers: Record<string, string>;
};

export type Upload = (
  url: string,
  fileUri: string,
  options: {
    httpMethod: "POST" | "PUT";
    mimeType: string;
    headers: Record<string, string>;
  },
) => Promise<Uploaded>;

/** Downloads `url` into `fileUri` with `headers`; rejects when it cannot. */
export type Download = (
  url: string,
  fileUri: string,
  headers: Record<string, string>,
) => Promise<void>;

const sendFile: Upload = (url, fileUri, options) =>
  new File(fileUri).upload(url, { ...options, uploadType: UploadType.BINARY_CONTENT });

const fetchFile: Download = async (url, fileUri, headers) => {
  await File.downloadFileAsync(url, new File(fileUri), { headers, idempotent: true });
};

function headersOf(token: string, key: string | null, mimeType?: string) {
  return {
    ...(mimeType === undefined ? {} : { "Content-Type": mimeType }),
    ...keyHeaders(key),
    ...authHeaders(token),
  };
}

function retryAfterOf(headers: Record<string, string>): number | null {
  const found = Object.entries(headers).find(
    ([name]) => name.toLowerCase() === "retry-after",
  );
  const seconds = Number(found?.[1] ?? undefined);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function outcomeOf<T>(
  sent: Uploaded,
  accept: (body: unknown, status: number) => body is T,
  baseUrl: string,
): AccountOutcome<T> {
  let body: unknown = null;
  if (sent.body !== "") {
    try {
      body = JSON.parse(sent.body);
    } catch {
      body = undefined;
    }
  }
  if (sent.status >= 200 && sent.status < 300 && accept(body, sent.status)) {
    return { kind: "ok", value: body };
  }
  if (sent.status === 0) {
    return { kind: "unreachable", url: baseUrl };
  }
  return sent.status >= 400 && isApiError(body)
    ? { kind: "api_error", ...body.error, retryAfterS: retryAfterOf(sent.headers) }
    : { kind: "bad_answer", status: sent.status };
}

export function isMessageMedia(body: unknown): body is MessageMedia {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as MessageMedia).id === "string" &&
    ((body as MessageMedia).kind === "photo" || (body as MessageMedia).kind === "video")
  );
}

function isNoBody(body: unknown, status: number): body is null {
  return status === 204 && body === null;
}

/** POST /me/message-media: the file at `fileUri`, kept for a message. */
export async function uploadMedia(
  baseUrl: string,
  token: string,
  fileUri: string,
  mimeType: string,
  { key = apiKey(), upload = sendFile }: Options = {},
): Promise<AccountOutcome<MessageMedia>> {
  let sent: Uploaded;
  try {
    sent = await upload(`${baseUrl}/me/message-media`, fileUri, {
      httpMethod: "POST",
      mimeType,
      headers: headersOf(token, key, mimeType),
    });
  } catch {
    return { kind: "unreachable", url: baseUrl };
  }
  return outcomeOf(sent, isMessageMedia, baseUrl);
}

/** PUT /me/message-media/{id}/poster: the first picture of a video sent. */
export async function putPoster(
  baseUrl: string,
  token: string,
  mediaId: string,
  jpegUri: string,
  { key = apiKey(), upload = sendFile }: Options = {},
): Promise<AccountOutcome<null>> {
  let sent: Uploaded;
  try {
    sent = await upload(
      `${baseUrl}/me/message-media/${encodeURIComponent(mediaId)}/poster`,
      jpegUri,
      {
        httpMethod: "PUT",
        mimeType: "image/jpeg",
        headers: headersOf(token, key, "image/jpeg"),
      },
    );
  } catch {
    return { kind: "unreachable", url: baseUrl };
  }
  return outcomeOf(sent, isNoBody, baseUrl);
}

/** Where a photo or video is read, or its first picture. */
export function mediaUrl(baseUrl: string, mediaId: string, poster = false): string {
  return `${baseUrl}/message-media/${encodeURIComponent(mediaId)}${poster ? "/poster" : ""}`;
}

/** An Image's source for a photo or a video's first picture: the address
 * with the key and the token. */
export function mediaImage(
  baseUrl: string,
  token: string,
  mediaId: string,
  poster = false,
  key: string | null = apiKey(),
): { uri: string; headers: Record<string, string> } {
  return { uri: mediaUrl(baseUrl, mediaId, poster), headers: headersOf(token, key) };
}

/** The name a file of a message has in the cache: its id never changes. */
export function cachedName(attachment: Pick<MessageAttachment, "kind" | "media_id">) {
  return `message-${attachment.media_id}.${attachment.kind === "video" ? "mp4" : "jpg"}`;
}

/**
 * The photo or video of a message in the phone's cache, downloaded once;
 * null when it cannot be (no connection, expired, gone).
 */
export async function cachedMedia(
  baseUrl: string,
  token: string,
  attachment: Pick<MessageAttachment, "kind" | "media_id">,
  { key = apiKey(), download = fetchFile }: Options = {},
  exists: (uri: string) => boolean = (uri) => new File(uri).exists,
): Promise<string | null> {
  if (attachment.media_id === null) {
    return null;
  }
  const uri = `${Paths.cache.uri}${cachedName(attachment)}`;
  if (exists(uri)) {
    return uri;
  }
  try {
    await download(mediaUrl(baseUrl, attachment.media_id), uri, headersOf(token, key));
  } catch {
    return null;
  }
  return uri;
}
