import type { Visibility } from "@shaperoute/shared-types";

import { sessionEnded } from "../account/messages";
import { saveDrawingOrder } from "../api/drawingOrder";
import { isSeen } from "../api/drawings";
import { keptList } from "../storage/keptList";
import type { Synced } from "./drawingPhotos";

/**
 * The order of the posts, on the phone (TASK-348, ADR-0301): where the map
 * stands among the photos of each run, as chosen here, and whether the API
 * has it. As the photos (drawingPhotos.ts): it goes only while others see
 * the drawing, after its photos, and made «Only me» the API forgets it
 * while it stays here, to go again when the drawing opens.
 */

export const DRAWING_ORDERS_FILE = "drawing-orders.json";

export type OrderKept = {
  /** The id of the account the run belongs to (User.id). */
  owner: number;
  /** The run's key in «My activities». */
  key: string;
  /** `drawing` and `photo:n`, as the API takes it. */
  order: string[];
  /** The API has it. */
  sent: boolean;
};

function isOrderKept(value: unknown): value is OrderKept {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item.owner === "number" &&
    typeof item.key === "string" &&
    Array.isArray(item.order) &&
    item.order.every((name) => typeof name === "string") &&
    typeof item.sent === "boolean"
  );
}

// Written so that a write cut short loses no order that was there (TASK-252).
const kept = keptList(DRAWING_ORDERS_FILE, isOrderKept);

function same(item: OrderKept, owner: number, key: string): boolean {
  return item.owner === owner && item.key === key;
}

export function loadDrawingOrders(): OrderKept[] {
  return kept.load();
}

/** Keeps `order` for the run `key` of `owner`, in place of the one before;
 * the API does not have it yet. False when the phone refused the file. */
export function keepOrder(
  owner: number,
  key: string,
  order: readonly string[],
): boolean {
  const list = loadDrawingOrders().filter((item) => !same(item, owner, key));
  return kept.save([...list, { owner, key, order: [...order], sent: false }]);
}

/** The order chosen here for the run `key`; null when none was. */
export function orderOnPhone(owner: number, key: string): string[] | null {
  return loadDrawingOrders().find((item) => same(item, owner, key))?.order ?? null;
}

/** The run is gone: its order goes with it. */
export function forgetOrderOf(owner: number, key: string): void {
  const list = loadDrawingOrders();
  if (list.some((item) => same(item, owner, key))) {
    kept.save(list.filter((item) => !same(item, owner, key)));
  }
}

/** The account is deleted: the orders of its runs leave the phone. */
export function forgetAllOrdersOf(owner: number): void {
  const list = loadDrawingOrders();
  if (list.some((item) => item.owner === owner)) {
    kept.save(list.filter((item) => item.owner !== owner));
  }
}

type Options = { fetchFn?: typeof fetch; key?: string | null };

/**
 * Sends the order chosen here for the run `key`, right after its drawing
 * and its photos went with `visibility`. With "only_me" the API dropped it:
 * it stays here, to go again when the drawing opens to the others. An order
 * the API will never take (422) is let go; anything else leaves it waiting.
 */
export async function syncOrder(
  baseUrl: string,
  token: string,
  owner: number,
  key: string,
  visibility: Visibility,
  options: Options = {},
): Promise<Synced> {
  const mine = loadDrawingOrders().find((item) => same(item, owner, key));
  if (mine === undefined) {
    return "done";
  }
  if (!isSeen(visibility)) {
    if (mine.sent) {
      keepOrder(owner, key, mine.order);
    }
    return "done";
  }
  if (mine.sent) {
    return "done";
  }
  const outcome = await saveDrawingOrder(baseUrl, token, key, mine.order, options);
  if (outcome.kind === "ok") {
    const list = loadDrawingOrders().filter((item) => !same(item, owner, key));
    kept.save([...list, { ...mine, sent: true }]);
    return "done";
  }
  if (sessionEnded(outcome)) {
    return "session_ended";
  }
  if (outcome.kind === "api_error" && outcome.code === "invalid_request") {
    // An order the API will never take: the post keeps the map first.
    forgetOrderOf(owner, key);
    return "done";
  }
  // No network, the API busy, or the drawing still only the owner's for it
  // (409): it waits, as the photos do.
  return "waits";
}
