/**
 * The order of a post (TASK-348, ADR-0301): the map among the photos, as
 * the API keeps it in `order`: `drawing` once, and each photo by its place,
 * `photo:2`. A place says which photo, not where it stands: moving a photo
 * changes the order, never its place.
 */

/** The map, in an order. */
export const DRAWING_ITEM = "drawing";
const PHOTO_ITEM = "photo:";

/** One page of a post: the map, or the photo in place `n`. */
export type PostItem = { kind: "drawing" } | { kind: "photo"; n: number };

/** What the API calls an item. */
export function itemName(item: PostItem): string {
  return item.kind === "drawing" ? DRAWING_ITEM : `${PHOTO_ITEM}${item.n}`;
}

/** The order as the API takes it. */
export function orderOf(items: readonly PostItem[]): string[] {
  return items.map(itemName);
}

/**
 * The pages of a post with the photos in `places`, in `order`: as the API
 * answers (drawings.in_order), a place no photo has leaves it, and a photo
 * the order does not name comes last, by place. No order: the map first
 * and the photos by place, as every post before ADR-0301.
 */
export function itemsOf(
  order: readonly string[] | null | undefined,
  places: readonly number[],
): PostItem[] {
  const sorted = [...places].sort((a, b) => a - b);
  const items: PostItem[] = [];
  for (const name of order ?? []) {
    if (name === DRAWING_ITEM) {
      if (!items.some((item) => item.kind === "drawing")) {
        items.push({ kind: "drawing" });
      }
      continue;
    }
    const n = Number(name.slice(PHOTO_ITEM.length));
    if (
      name.startsWith(PHOTO_ITEM) &&
      sorted.includes(n) &&
      !items.some((item) => item.kind === "photo" && item.n === n)
    ) {
      items.push({ kind: "photo", n });
    }
  }
  if (!items.some((item) => item.kind === "drawing")) {
    items.unshift({ kind: "drawing" });
  }
  for (const n of sorted) {
    if (!items.some((item) => item.kind === "photo" && item.n === n)) {
      items.push({ kind: "photo", n });
    }
  }
  return items;
}

/** Where the map stands among the pages: 0 is the first. */
export function drawingIndex(items: readonly PostItem[]): number {
  return Math.max(
    0,
    items.findIndex((item) => item.kind === "drawing"),
  );
}

/** `list` with the item at `from` moved to `to`, the others in their order. */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length) {
    return next;
  }
  const [item] = next.splice(from, 1);
  next.splice(Math.min(Math.max(to, 0), next.length), 0, item as T);
  return next;
}

/** Where a tile dragged by `dx` from `from` lands, in a row of `count`
 * tiles `step` apart: the nearest place, never off the row. */
export function dropIndex(from: number, dx: number, step: number, count: number): number {
  if (step <= 0 || count <= 0) {
    return Math.max(0, Math.min(from, count - 1));
  }
  return Math.max(0, Math.min(count - 1, from + Math.round(dx / step)));
}

/**
 * The pages of a run not saved yet, its photos given their places in the
 * post's order (keepPhotos keeps them from place 1): the order to send
 * beside them, and the photos in that order.
 */
export function renumbered<T>(
  items: readonly ({ kind: "drawing" } | { kind: "photo"; photo: T })[],
): { order: string[]; photos: T[] } {
  const photos: T[] = [];
  const order = items.map((item) => {
    if (item.kind === "drawing") {
      return DRAWING_ITEM;
    }
    photos.push(item.photo);
    return `${PHOTO_ITEM}${photos.length}`;
  });
  return { order, photos };
}
