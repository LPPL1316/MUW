import type { LatLon } from "@shaperoute/shared-types";

import { apiKey, keyHeaders } from "../api/apiUrl";

/**
 * A shape through the real places of a theme, in any city (TASK-129,
 * ADR-0099): POST /themed-route-jobs, then GET /themed-route-jobs/{id}.
 * The bodies are packages/shared-types/fixtures/themed-route-job-*.json.
 */

export type ThemedStop = {
  name: string;
  point: LatLon;
  passed: boolean;
  /** Its Wikidata item, when OpenStreetMap names one (TASK-329). */
  wikidata?: string | null;
  /** Passed by, on a route the API planned: its free photo, or null for
   * none. Read with `apiPhoto`. Absent on our ideas, which ask the API for
   * it by `wikidata`, and from an API before TASK-329. */
  photo?: unknown;
};

export type ThemedResult = {
  points: LatLon[];
  distance_m: number;
  similarity: number;
  shape: string;
  theme: string;
  theme_label: string;
  target_m: number;
  city: string | null;
  centre: LatLon;
  /** Every place found, those passed by first. */
  stops: ThemedStop[];
  license: string;
};

export type ThemedJob = {
  job_id: string;
  status: "queued" | "running" | "done" | "failed";
  result: ThemedResult | null;
  error: { code: string; message: string } | null;
};

export type ThemedRequest = {
  text: string;
  centre: LatLon | null;
  city: string | null;
};

type Options = { fetchFn?: typeof fetch; key?: string | null; signal?: AbortSignal };

function isPoint(value: unknown): value is LatLon {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/** A result as GET /themed-route-jobs/{id} gives it, or an idea keeps it. */
export function isThemedResult(value: unknown): value is ThemedResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    Array.isArray(r.points) &&
    r.points.length >= 2 &&
    r.points.every(isPoint) &&
    typeof r.distance_m === "number" &&
    typeof r.similarity === "number" &&
    typeof r.shape === "string" &&
    typeof r.theme === "string" &&
    typeof r.theme_label === "string" &&
    typeof r.target_m === "number" &&
    (r.city === null || typeof r.city === "string") &&
    isPoint(r.centre) &&
    Array.isArray(r.stops) &&
    r.stops.every((s: unknown) => {
      if (typeof s !== "object" || s === null) {
        return false;
      }
      const stop = s as Record<string, unknown>;
      return (
        typeof stop.name === "string" &&
        isPoint(stop.point) &&
        typeof stop.passed === "boolean"
      );
    })
  );
}

export function isThemedJob(body: unknown): body is ThemedJob {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const job = body as Record<string, unknown>;
  const statuses = ["queued", "running", "done", "failed"];
  if (typeof job.job_id !== "string" || !statuses.includes(job.status as string)) {
    return false;
  }
  if (job.status === "done") {
    return isThemedResult(job.result);
  }
  if (job.status === "failed") {
    const error = job.error as Record<string, unknown> | null;
    return (
      typeof error === "object" &&
      error !== null &&
      typeof error.code === "string" &&
      typeof error.message === "string"
    );
  }
  return true;
}

/** Sends the request or asks how it goes; null when the API cannot be read. */
export async function postThemed(
  baseUrl: string,
  request: ThemedRequest,
  { fetchFn = fetch, key = apiKey(), signal }: Options = {},
): Promise<ThemedJob | null> {
  return asJob(
    fetchFn(`${baseUrl}/themed-route-jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...keyHeaders(key) },
      body: JSON.stringify(request),
      signal,
    }),
  );
}

export async function getThemed(
  baseUrl: string,
  jobId: string,
  { fetchFn = fetch, key = apiKey(), signal }: Options = {},
): Promise<ThemedJob | null> {
  return asJob(
    fetchFn(`${baseUrl}/themed-route-jobs/${encodeURIComponent(jobId)}`, {
      headers: keyHeaders(key),
      signal,
    }),
  );
}

async function asJob(pending: Promise<Response>): Promise<ThemedJob | null> {
  try {
    const response = await pending;
    const body: unknown = await response.json();
    return response.ok && isThemedJob(body) ? body : null;
  } catch {
    return null;
  }
}
