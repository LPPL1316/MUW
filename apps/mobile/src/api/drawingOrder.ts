import type { DrawingOrderRequest, MyDrawing } from "@shaperoute/shared-types";

import { type AccountOutcome, ask } from "./accounts";
import { isMyDrawing } from "./drawings";

type Options = { fetchFn?: typeof fetch; key?: string | null };

/**
 * PUT /me/activities/{key}/drawing/order (TASK-348, ADR-0301): where each
 * page stands in the post, the map among the photos. The whole order every
 * time, so sending it again after a phone without a network changes
 * nothing. On a drawing only the owner sees the API says 409 `http_error`,
 * as for its photos: the order stays on the phone.
 */
export function saveDrawingOrder(
  baseUrl: string,
  token: string,
  key: string,
  order: readonly string[],
  options: Options = {},
): Promise<AccountOutcome<MyDrawing>> {
  const body: DrawingOrderRequest = { order: [...order] };
  return ask(
    baseUrl,
    `/me/activities/${encodeURIComponent(key)}/drawing/order`,
    { method: "PUT", body, token },
    isMyDrawing,
    options,
  );
}
