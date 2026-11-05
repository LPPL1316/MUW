import type { SkiNames, SkiUse } from "@shaperoute/shared-types";

import { type AccountOutcome, ask } from "./accounts";

/**
 * The lifts and pistes of a day of skiing (TASK-375 part D, ADR-0319,
 * docs/API.md «Ski names»): found by the API when the day was saved, given
 * to whoever can see its post. The body is
 * packages/shared-types/fixtures/ski-names.json.
 */

type Options = { fetchFn?: typeof fetch; key?: string | null };

function isSkiUse(body: unknown): body is SkiUse {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const { name, type, times } = body as Record<string, unknown>;
  return (
    typeof name === "string" &&
    name !== "" &&
    typeof type === "string" &&
    typeof times === "number" &&
    Number.isInteger(times) &&
    times >= 1
  );
}

export function isSkiNames(body: unknown): body is SkiNames {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const { lifts, pistes } = body as Record<string, unknown>;
  return (
    Array.isArray(lifts) &&
    lifts.every(isSkiUse) &&
    Array.isArray(pistes) &&
    pistes.every(isSkiUse)
  );
}

/** GET /drawings/{id}/ski-names: two empty lists when the day has none. */
export function fetchSkiNames(
  baseUrl: string,
  token: string,
  drawingId: string,
  options: Options = {},
): Promise<AccountOutcome<SkiNames>> {
  return ask(
    baseUrl,
    `/drawings/${encodeURIComponent(drawingId)}/ski-names`,
    { method: "GET", token },
    isSkiNames,
    options,
  );
}
