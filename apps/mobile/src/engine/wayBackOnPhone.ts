import type { WayBack, WayBackRequest } from "@shaperoute/shared-types";

import { isApiError } from "../api/routes";
import { isWayBack, requestWayBack, type WayBackOutcome } from "../api/wayBack";
import { type PhoneEngine, phoneEngine, WAY_BACK_TIMEOUT_MS } from "./phoneEngine";
import { phoneId } from "./prefetch";
import { NETWORKS, savedZones, type ZoneEntry, zonesForEngine } from "./zones";

/**
 * The way back to the route on the streets (TASK-314, ADR-0274): the
 * engine on the phone first, with a zone saved around the runner, then the
 * server. Anything else is "none", and the run keeps the straight line of
 * ADR-0263: no signal, an API older than TASK-314 (404), too many requests
 * (429), no way back (422), the phone or the server too slow. Never throws
 * and never shows an error: whoever asks only draws what it gets.
 */

export type WayBackAnswer =
  | { kind: "way"; way: WayBack; by: "phone" | "server" }
  | { kind: "none"; why: string }
  | { kind: "cancelled" };

type Options = {
  signal?: AbortSignal;
  engine?: PhoneEngine;
  zones?: () => ZoneEntry[];
  phone?: () => string;
  ask?: typeof requestWayBack;
  timeoutMs?: number;
};

/** What the phone did: a way, a verdict the server would give too, or
 * nothing worth more than asking the server. */
type OnPhone =
  | { kind: "way"; way: WayBack }
  | { kind: "verdict"; why: string }
  | { kind: "skipped"; why: string }
  | { kind: "cancelled" };

export async function wayBackOnPhoneFirst(
  baseUrl: string | null,
  request: WayBackRequest,
  {
    signal,
    engine = phoneEngine,
    zones = savedZones,
    phone = phoneId,
    ask = requestWayBack,
    timeoutMs = WAY_BACK_TIMEOUT_MS,
  }: Options = {},
): Promise<WayBackAnswer> {
  const onPhone = await wayBackOnPhone(request, engine, zones, timeoutMs, signal);
  if (onPhone.kind === "cancelled" || signal?.aborted) {
    return { kind: "cancelled" };
  }
  if (onPhone.kind === "way") {
    return { kind: "way", way: onPhone.way, by: "phone" };
  }
  if (onPhone.kind === "verdict") {
    return { kind: "none", why: onPhone.why };
  }
  if (baseUrl === null) {
    return { kind: "none", why: `${onPhone.why}, and no server` };
  }
  return fromServer(await ask(baseUrl, request, { signal, phone: phone() }));
}

async function wayBackOnPhone(
  request: WayBackRequest,
  engine: PhoneEngine,
  zones: () => ZoneEntry[],
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<OnPhone> {
  const network = NETWORKS[request.activity];
  if (network === undefined) {
    return { kind: "verdict", why: `no way back for ${request.activity}` };
  }
  if (!engine.available) {
    return { kind: "skipped", why: "the engine does not run on this phone" };
  }
  const near = zonesForEngine(zones(), network, request.here);
  if (near.length === 0) {
    return { kind: "skipped", why: "no zone saved around the runner" };
  }
  const answer = await engine.wayBack(JSON.stringify(request), near, timeoutMs, signal);
  if (answer.kind === "cancelled") {
    return { kind: "cancelled" };
  }
  if (answer.kind === "failed") {
    return { kind: "skipped", why: answer.why };
  }
  let body: unknown;
  try {
    body = JSON.parse(answer.json);
  } catch {
    return { kind: "skipped", why: "the engine gave no JSON" };
  }
  if (isWayBack(body)) {
    return { kind: "way", way: body };
  }
  // No way on the same map: the server would say the same.
  if (isApiError(body) && body.error.code === "invalid_request") {
    return { kind: "verdict", why: body.error.message };
  }
  return {
    kind: "skipped",
    why: isApiError(body) ? body.error.message : "the engine gave no way",
  };
}

function fromServer(outcome: WayBackOutcome): WayBackAnswer {
  switch (outcome.kind) {
    case "way":
      return { kind: "way", way: outcome.way, by: "server" };
    case "cancelled":
      return { kind: "cancelled" };
    case "api_error":
      return { kind: "none", why: `${outcome.code}: ${outcome.message}` };
    case "unreachable":
      return { kind: "none", why: `${outcome.url} cannot be reached` };
    case "bad_answer":
      return { kind: "none", why: `the server answered ${outcome.status}` };
  }
}
