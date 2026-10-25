import {
  CONTACT_HASHES_MAX,
  type ContactPerson,
  type ContactsPeople,
  FOLLOW_STATES,
} from "@shaperoute/shared-types";

import { type AccountOutcome, ask } from "./accounts";
import { isPerson } from "./people";

/**
 * The members found from the phone's contacts (TASK-262 C, docs/API.md,
 * «People from the contacts»): POST /people/from-contacts with the hashes
 * of the numbers, CONTACT_HASHES_MAX at a time.
 */

type Options = { fetchFn?: typeof fetch; key?: string | null };

/**
 * The most requests one look in the contacts makes: 5000 numbers. The API
 * takes a few looks an hour (MAX_CALLS_PER_HOUR in contact_people.py).
 */
export const CONTACT_BATCHES_MAX = 10;

/** The hashes in groups the API takes, at most CONTACT_BATCHES_MAX of them. */
export function batches(hashes: readonly string[]): string[][] {
  const groups: string[][] = [];
  for (
    let start = 0;
    start < hashes.length && groups.length < CONTACT_BATCHES_MAX;
    start += CONTACT_HASHES_MAX
  ) {
    groups.push(hashes.slice(start, start + CONTACT_HASHES_MAX));
  }
  return groups;
}

/** POST /people/from-contacts with one group of hashes. */
export function findContactsBatch(
  baseUrl: string,
  token: string,
  hashes: readonly string[],
  options: Options = {},
): Promise<AccountOutcome<ContactsPeople>> {
  return ask(
    baseUrl,
    "/people/from-contacts",
    { method: "POST", token, body: { hashes } },
    isContactsPeople,
    options,
  );
}

/**
 * Every group of hashes, one after the other: the members found in all of
 * them, each once, by name. The first group that fails stops the rest and
 * is the answer: what the others found is not shown half.
 */
export async function findContactsPeople(
  baseUrl: string,
  token: string,
  hashes: readonly string[],
  options: Options = {},
): Promise<AccountOutcome<ContactsPeople>> {
  const found = new Map<string, ContactPerson>();
  for (const group of batches(hashes)) {
    const outcome = await findContactsBatch(baseUrl, token, group, options);
    if (outcome.kind !== "ok") {
      return outcome;
    }
    for (const person of outcome.value.people) {
      found.set(person.public_id, person);
    }
  }
  const people = [...found.values()].sort((a, b) =>
    a.username.toLowerCase().localeCompare(b.username.toLowerCase()),
  );
  return { kind: "ok", value: { people } };
}

export function isContactPerson(body: unknown): body is ContactPerson {
  if (!isPerson(body)) {
    return false;
  }
  const follow: unknown = (body as unknown as Record<string, unknown>).follow;
  return FOLLOW_STATES.some((state) => state === follow);
}

export function isContactsPeople(body: unknown): body is ContactsPeople {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const people = (body as Record<string, unknown>).people;
  return Array.isArray(people) && people.every(isContactPerson);
}
