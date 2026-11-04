import type { Visibility } from "@shaperoute/shared-types";
import { File, Paths } from "expo-file-system";

import { sessionEnded } from "../account/messages";
import {
  isSeen,
  removeDrawingPhoto,
  saveDrawingPhoto,
  worthAgain,
} from "../api/drawings";
import { keptList } from "../storage/keptList";
import { forgetAllOrdersOf, forgetOrderOf } from "./drawingOrder";

/**
 * The photos of the runs, on the phone (TASK-208, ADR-0170; the user's
 * choice: «use the phones' memory more than ours»). Each photo is a JPEG in
 * base64 in a file of the app's documents, already shrunk, beside the
 * runs still to go to the API (activities/outbox.ts); a list beside them
 * says, for each, whether the API has it. The API gets the photos of a run
 * only while others see its drawing («Everyone» or «Followers»), after the
 * drawing itself; with «Only me» it drops them, and they stay here. A run
 * deleted takes its photos with it. The photos of a run only its owner sees
 * never go from one phone to another.
 */

export const DRAWING_PHOTOS_FILE = "drawing-photos.json";
/** The files of the photos start with this: one per photo. */
export const DRAWING_PHOTO_PREFIX = "drawing-photo-";

export type PhotoKept = {
  /** The id of the account the run belongs to (User.id). */
  owner: number;
  /** The run's key in «My activities». */
  key: string;
  /** Its place, 1 to DRAWING_MAX_PHOTOS: which photo, not where it stands
   * in the post (drawingOrder.ts). */
  n: number;
  /** The API has it, in that place. */
  sent: boolean;
  /** Taken off on this phone while the API still has it: to be emptied
   * there. The file is gone already. */
  removed?: boolean;
};

/** A photo on this phone, as an `Image` shows it. */
export type PhonePhoto = { n: number; base64: string };

function isPhotoKept(value: unknown): value is PhotoKept {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item.owner === "number" &&
    typeof item.key === "string" &&
    typeof item.n === "number" &&
    typeof item.sent === "boolean" &&
    (item.removed === undefined || typeof item.removed === "boolean")
  );
}

// Written so that a write cut short loses no photo that was there (TASK-252).
const kept = keptList(DRAWING_PHOTOS_FILE, isPhotoKept);

function photoFile(owner: number, key: string, n: number): File {
  return new File(Paths.document, `${DRAWING_PHOTO_PREFIX}${owner}-${key}-${n}.b64`);
}

function same(item: PhotoKept, owner: number, key: string, n?: number): boolean {
  return item.owner === owner && item.key === key && (n === undefined || item.n === n);
}

/** The list in the file, in its order; none when it cannot be read. */
export function loadDrawingPhotos(): PhotoKept[] {
  return kept.load();
}

function save(list: PhotoKept[]): boolean {
  return kept.save(list);
}

/** `item` in place of any entry for its photo. */
function withEntry(list: PhotoKept[], item: PhotoKept): PhotoKept[] {
  return [...list.filter((other) => !same(other, item.owner, item.key, item.n)), item];
}

function writeFile(file: File, base64: string): boolean {
  try {
    file.create({ overwrite: true });
    file.write(base64);
    return true;
  } catch {
    return false;
  }
}

function readFile(file: File): string | null {
  try {
    return file.exists ? file.textSync() : null;
  } catch {
    return null;
  }
}

function deleteFile(file: File): void {
  try {
    if (file.exists) {
      file.delete();
    }
  } catch {
    // A file that will not go leaves a photo behind, nothing worse.
  }
}

/** What an `Image` shows of a photo on the phone: the JPEG itself. */
export function phonePhotoUri(base64: string): string {
  return `data:image/jpeg;base64,${base64}`;
}

/**
 * Keeps `base64` as the photo `n` of the run `key` of `owner`, in place of
 * any there; the API does not have it yet. False when the phone refused
 * the file: the photo is not kept.
 */
export function keepPhoto(
  owner: number,
  key: string,
  n: number,
  base64: string,
): boolean {
  if (!writeFile(photoFile(owner, key, n), base64)) {
    return false;
  }
  return save(withEntry(loadDrawingPhotos(), { owner, key, n, sent: false }));
}

/** Keeps the photos chosen at the end of a run, in order from place 1. */
export function keepPhotos(
  owner: number,
  key: string,
  photos: readonly string[],
): void {
  photos.forEach((base64, i) => {
    keepPhoto(owner, key, i + 1, base64);
  });
}

/** The photos of the run `key` on this phone, by place. */
export function photosOnPhone(owner: number, key: string): PhonePhoto[] {
  return loadDrawingPhotos()
    .filter((item) => same(item, owner, key) && item.removed !== true)
    .sort((a, b) => a.n - b.n)
    .flatMap((item) => {
      const base64 = readFile(photoFile(owner, key, item.n));
      return base64 === null || base64 === "" ? [] : [{ n: item.n, base64 }];
    });
}

/**
 * Takes the photo `n` off the phone. With `onServer`, or sent from here,
 * the API still has it: it is emptied there with the next sync.
 */
export function removePhoto(
  owner: number,
  key: string,
  n: number,
  onServer: boolean,
): void {
  deleteFile(photoFile(owner, key, n));
  const list = loadDrawingPhotos();
  const was = list.find((item) => same(item, owner, key, n));
  const stillThere = onServer || was?.sent === true;
  save(
    stillThere
      ? withEntry(list, { owner, key, n, sent: true, removed: true })
      : list.filter((item) => !same(item, owner, key, n)),
  );
}

/** The run is gone: its photos go with it, here and (with it) on the API,
 * and their order (TASK-348). */
export function forgetPhotosOf(owner: number, key: string): void {
  forgetOrderOf(owner, key);
  const list = loadDrawingPhotos();
  const mine = list.filter((item) => same(item, owner, key));
  if (mine.length === 0) {
    return;
  }
  mine.forEach((item) => deleteFile(photoFile(owner, key, item.n)));
  save(list.filter((item) => !same(item, owner, key)));
}

/** The account is deleted: every photo of its runs leaves the phone, and
 * their orders. */
export function forgetAllPhotosOf(owner: number): void {
  forgetAllOrdersOf(owner);
  const list = loadDrawingPhotos();
  const mine = list.filter((item) => item.owner === owner);
  if (mine.length === 0) {
    return;
  }
  mine.forEach((item) => deleteFile(photoFile(owner, item.key, item.n)));
  save(list.filter((item) => item.owner !== owner));
}

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** What a sync did: everything is as chosen on the API; or some photo
 * still waits (no network, the API busy, or the drawing still only the
 * owner's for it); or the token opens no session any more. */
export type Synced = "done" | "waits" | "session_ended";

/**
 * Makes the API's photos of the run `key` those chosen here, right after
 * its drawing went with `visibility`. With "only_me" the API dropped them
 * all: they stay on the phone, to be sent again when the drawing opens to
 * the others. Otherwise each photo kept here and not there goes (a 409,
 * the drawing still "only_me" for the API, leaves it waiting), and each
 * place emptied here is emptied there. A file the API will never take
 * (not a photo, 422) is let go.
 */
export async function syncPhotos(
  baseUrl: string,
  token: string,
  owner: number,
  key: string,
  visibility: Visibility,
  options: Options = {},
): Promise<Synced> {
  const mine = loadDrawingPhotos()
    .filter((item) => same(item, owner, key))
    .sort((a, b) => a.n - b.n);
  if (mine.length === 0) {
    return "done";
  }
  if (!isSeen(visibility)) {
    const list = loadDrawingPhotos();
    save(
      list.flatMap((item) =>
        !same(item, owner, key)
          ? [item]
          : item.removed === true
            ? []
            : [{ owner, key, n: item.n, sent: false }],
      ),
    );
    return "done";
  }
  for (const item of mine) {
    if (item.removed === true) {
      const outcome = await removeDrawingPhoto(baseUrl, token, key, item.n, options);
      if (sessionEnded(outcome)) {
        return "session_ended";
      }
      if (worthAgain(outcome)) {
        return "waits";
      }
      // Emptied, or no run to empty it on any more.
      save(loadDrawingPhotos().filter((other) => !same(other, owner, key, item.n)));
      continue;
    }
    if (item.sent) {
      continue;
    }
    const base64 = readFile(photoFile(owner, key, item.n));
    if (base64 === null || base64 === "") {
      save(loadDrawingPhotos().filter((other) => !same(other, owner, key, item.n)));
      continue;
    }
    const outcome = await saveDrawingPhoto(
      baseUrl,
      token,
      key,
      item.n,
      base64,
      options,
    );
    if (outcome.kind === "ok") {
      save(withEntry(loadDrawingPhotos(), { owner, key, n: item.n, sent: true }));
      continue;
    }
    if (sessionEnded(outcome)) {
      return "session_ended";
    }
    if (outcome.kind === "api_error" && outcome.code === "invalid_request") {
      deleteFile(photoFile(owner, key, item.n));
      save(loadDrawingPhotos().filter((other) => !same(other, owner, key, item.n)));
      continue;
    }
    // No network, the API busy, or the drawing still only the owner's for
    // it (409): this photo and the ones after it wait.
    return "waits";
  }
  return "done";
}
